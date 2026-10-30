import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { StockMovementService } from '../inventory/stock-movement.service';
import {
  CreateSalesQuotationDto,
  CreateSalesInvoiceDto,
  CreateSalesReturnDto,
} from './dto/sales.dto';
import {
  calculateLineAmounts,
  round,
} from '@business-suite/shared';
import {
  Prisma,
  DocumentStatus,
  PaymentStatus,
  StockMovementType,
  VoucherType,
  PartyType,
} from '@prisma/client';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private prisma: PrismaService,
    private entitlementsService: EntitlementsService,
    private stockMovementService: StockMovementService,
  ) {}

  /**
   * Concurrency-safe atomic document sequence generator per tenant and year
   */
  async generateNextDocNumber(
    tenantId: string,
    docType: string,
    prefix: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const client = tx || this.prisma;

    const sequence = await client.documentSequence.upsert({
      where: {
        tenantId_docType_year: {
          tenantId,
          docType,
          year,
        },
      },
      update: {
        lastNumber: { increment: 1 },
      },
      create: {
        tenantId,
        docType,
        year,
        lastNumber: 1,
      },
    });

    const seqStr = String(sequence.lastNumber).padStart(5, '0');
    return `${prefix}-${year}-${seqStr}`;
  }

  // --- Quotations ---

  async listQuotations(tenantId: string) {
    return this.prisma.salesQuotation.findMany({
      where: { tenantId },
      include: {
        party: { select: { id: true, name: true, nameAr: true, code: true } },
        items: { include: { item: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createQuotation(tenantId: string, dto: CreateSalesQuotationDto, userId: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Quotation must contain at least one line item');
    }

    return this.prisma.$transaction(async (tx) => {
      const quotationNumber = await this.generateNextDocNumber(
        tenantId,
        'SALES_QUOTATION',
        'QUO',
        tx,
      );

      let subtotal = 0;
      let discountTotal = 0;
      let taxTotal = 0;
      let grandTotal = 0;

      const calculatedItems = dto.items.map((line) => {
        const lineCalc = calculateLineAmounts({
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discountPercent: line.discountPercent,
          discountAmount: line.discountAmount,
          taxRate: line.taxRate !== undefined ? line.taxRate : 0,
          isTaxInclusive: false,
        });

        subtotal += lineCalc.grossAmount;
        discountTotal += lineCalc.discountAmount;
        taxTotal += lineCalc.taxAmount;
        grandTotal += lineCalc.totalAmount;

        return {
          tenantId,
          itemId: line.itemId,
          quantity: new Prisma.Decimal(lineCalc.quantity),
          unitPrice: new Prisma.Decimal(lineCalc.unitPrice),
          discountAmount: new Prisma.Decimal(lineCalc.discountAmount),
          taxRate: new Prisma.Decimal(line.taxRate !== undefined ? line.taxRate : 0),
          taxAmount: new Prisma.Decimal(lineCalc.taxAmount),
          totalAmount: new Prisma.Decimal(lineCalc.totalAmount),
          notes: line.notes,
        };
      });

      const quotation = await tx.salesQuotation.create({
        data: {
          tenantId,
          quotationNumber,
          partyId: dto.partyId,
          warehouseId: dto.warehouseId,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
          subtotal: new Prisma.Decimal(round(subtotal, 4)),
          discountTotal: new Prisma.Decimal(round(discountTotal, 4)),
          taxTotal: new Prisma.Decimal(round(taxTotal, 4)),
          grandTotal: new Prisma.Decimal(round(grandTotal, 4)),
          notes: dto.notes,
          createdByUserId: userId,
          items: {
            create: calculatedItems,
          },
        },
        include: { items: true },
      });

      return quotation;
    });
  }

  // --- Sales Invoices ---

  async listInvoices(
    tenantId: string,
    params?: { partyId?: string; status?: DocumentStatus; search?: string },
  ) {
    const where: Prisma.SalesInvoiceWhereInput = { tenantId };
    if (params?.partyId) where.partyId = params.partyId;
    if (params?.status) where.status = params.status;
    if (params?.search) {
      where.OR = [
        { invoiceNumber: { contains: params.search.trim(), mode: 'insensitive' } },
        { party: { name: { contains: params.search.trim(), mode: 'insensitive' } } },
      ];
    }

    return this.prisma.salesInvoice.findMany({
      where,
      include: {
        party: { select: { id: true, name: true, nameAr: true, code: true, phone: true } },
        warehouse: { select: { id: true, name: true, nameAr: true, code: true } },
        items: { include: { item: true } },
      },
      orderBy: { issueDate: 'desc' },
    });
  }

  async getInvoice(tenantId: string, invoiceId: string) {
    const invoice = await this.prisma.salesInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        party: true,
        warehouse: true,
        items: { include: { item: true } },
        returns: { include: { items: true } },
        allocations: { include: { voucher: true } },
      },
    });

    if (!invoice || invoice.tenantId !== tenantId) {
      throw new NotFoundException('Sales Invoice not found');
    }

    return invoice;
  }

  async createInvoice(tenantId: string, dto: CreateSalesInvoiceDto, userId: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Invoice must contain at least one line item');
    }

    // 1. Quota Check: MONTHLY_INVOICES_LIMIT
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyInvoicesCount = await this.prisma.salesInvoice.count({
      where: {
        tenantId,
        createdAt: { gte: startOfMonth },
      },
    });

    const quotaCheck = await this.entitlementsService.checkQuotaAvailable(
      tenantId,
      'MONTHLY_INVOICES_LIMIT',
      monthlyInvoicesCount,
    );

    if (!quotaCheck.allowed) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'QUOTA_EXCEEDED',
        message: `Monthly invoice limit reached (${quotaCheck.current}/${quotaCheck.limit}). Please upgrade your plan.`,
        quotaKey: 'MONTHLY_INVOICES_LIMIT',
      });
    }

    // 2. Compute Lines & Totals
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    let grandTotal = 0;

    const calculatedItems = dto.items.map((line) => {
      const lineCalc = calculateLineAmounts({
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountPercent: line.discountPercent,
        discountAmount: line.discountAmount,
        taxRate: line.taxRate !== undefined ? line.taxRate : 0,
        isTaxInclusive: dto.isTaxInclusive ?? false,
      });

      subtotal += lineCalc.grossAmount;
      discountTotal += lineCalc.discountAmount;
      taxTotal += lineCalc.taxAmount;
      grandTotal += lineCalc.totalAmount;

      return {
        tenantId,
        itemId: line.itemId,
        quantity: new Prisma.Decimal(lineCalc.quantity),
        unitPrice: new Prisma.Decimal(lineCalc.unitPrice),
        discountAmount: new Prisma.Decimal(lineCalc.discountAmount),
        taxRate: new Prisma.Decimal(line.taxRate !== undefined ? line.taxRate : 0),
        taxAmount: new Prisma.Decimal(lineCalc.taxAmount),
        totalAmount: new Prisma.Decimal(lineCalc.totalAmount),
        notes: line.notes,
      };
    });

    const roundedGrandTotal = round(grandTotal, 4);

    return this.prisma.$transaction(async (tx) => {
      let partyId = dto.partyId;
      if (!partyId) {
        let cashCust = await tx.party.findFirst({
          where: { tenantId, code: 'CASH-CUST' },
        });
        if (!cashCust) {
          cashCust = await tx.party.create({
            data: {
              tenantId,
              code: 'CASH-CUST',
              name: 'Walk-in Customer',
              nameAr: 'عميل نقدي عام',
              type: PartyType.CUSTOMER,
            },
          });
        }
        partyId = cashCust.id;
      }

      const invoiceNumber = await this.generateNextDocNumber(tenantId, 'SALES_INVOICE', 'INV', tx);

      const invoice = await tx.salesInvoice.create({
        data: {
          tenantId,
          invoiceNumber,
          partyId,
          warehouseId: dto.warehouseId,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          status: DocumentStatus.DRAFT,
          paymentStatus: PaymentStatus.UNPAID,
          subtotal: new Prisma.Decimal(round(subtotal, 4)),
          discountTotal: new Prisma.Decimal(round(discountTotal, 4)),
          taxTotal: new Prisma.Decimal(round(taxTotal, 4)),
          grandTotal: new Prisma.Decimal(roundedGrandTotal),
          remainingAmount: new Prisma.Decimal(roundedGrandTotal),
          isTaxInclusive: dto.isTaxInclusive ?? false,
          notes: dto.notes,
          createdByUserId: userId,
          items: {
            create: calculatedItems,
          },
        },
        include: {
          items: { include: { item: true } },
          party: true,
          warehouse: true,
        },
      });

      // Auto-post if requested
      if (dto.postImmediately) {
        return this.postInvoiceInternal(
          invoice.id,
          tenantId,
          userId,
          tx,
          dto.isCashSale,
          dto.treasuryAccountId,
        );
      }

      return invoice;
    });
  }

  async postInvoice(
    tenantId: string,
    invoiceId: string,
    userId: string,
    isCashSale?: boolean,
    treasuryAccountId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      return this.postInvoiceInternal(
        invoiceId,
        tenantId,
        userId,
        tx,
        isCashSale,
        treasuryAccountId,
      );
    });
  }

  private async postInvoiceInternal(
    invoiceId: string,
    tenantId: string,
    userId: string,
    tx: Prisma.TransactionClient,
    isCashSale?: boolean,
    treasuryAccountId?: string,
  ) {
    const invoice = await tx.salesInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: {
          include: { item: true },
        },
        party: true,
      },
    });

    if (!invoice || invoice.tenantId !== tenantId) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === DocumentStatus.POSTED) {
      throw new BadRequestException('Invoice is already posted');
    }

    let totalCogs = 0;

    // 1. Process Stock Deductions & Snapshot COGS
    for (const line of invoice.items) {
      if (line.item.type === 'STOCK') {
        const stockState = await tx.warehouseStock.findUnique({
          where: {
            tenantId_warehouseId_itemId: {
              tenantId,
              warehouseId: invoice.warehouseId,
              itemId: line.itemId,
            },
          },
        });

        const currentCost = Number(stockState?.averageCost || line.item.purchasePrice || 0);
        const lineQty = Number(line.quantity);
        const lineCost = lineQty * currentCost;
        totalCogs += lineCost;

        // Atomic deduction with negative stock check
        await this.stockMovementService.recordMovement({
          tenantId,
          warehouseId: invoice.warehouseId,
          itemId: line.itemId,
          type: StockMovementType.SALES_DELIVERY,
          quantity: -lineQty,
          unitPrice: currentCost,
          referenceType: 'SALES_INVOICE',
          referenceId: invoice.id,
          documentNumber: invoice.invoiceNumber,
          notes: `Sales invoice posting: ${invoice.invoiceNumber}`,
          userId,
          tx,
        });

        // Freeze COGS unit cost on invoice line
        await tx.salesInvoiceItem.update({
          where: { id: line.id },
          data: { unitCost: new Prisma.Decimal(currentCost) },
        });
      }
    }

    // 2. Increment Customer Receivable Balance
    const grandTotalNum = Number(invoice.grandTotal);
    await tx.party.update({
      where: { id: invoice.partyId },
      data: {
        receivableBalance: { increment: invoice.grandTotal },
      },
    });

    // 3. Mark Invoice as Posted
    const updatedInvoice = await tx.salesInvoice.update({
      where: { id: invoiceId },
      data: {
        status: DocumentStatus.POSTED,
        costTotal: new Prisma.Decimal(round(totalCogs, 4)),
        postedAt: new Date(),
        postedByUserId: userId,
      },
      include: { items: true, party: true },
    });

    // 4. Handle Cash Sale if selected
    if (isCashSale && treasuryAccountId) {
      const voucherNumber = await this.generateNextDocNumber(
        tenantId,
        'VOUCHER_RECEIPT',
        'REC',
        tx,
      );

      const voucher = await tx.treasuryVoucher.create({
        data: {
          tenantId,
          voucherNumber,
          type: VoucherType.RECEIPT,
          accountId: treasuryAccountId,
          partyId: invoice.partyId,
          amount: invoice.grandTotal,
          allocatedAmount: invoice.grandTotal,
          unallocatedAmount: new Prisma.Decimal(0),
          paymentMethod: 'CASH',
          notes: `Instant payment for cash invoice ${invoice.invoiceNumber}`,
          createdByUserId: userId,
          allocations: {
            create: {
              tenantId,
              salesInvoiceId: invoice.id,
              allocatedAmount: invoice.grandTotal,
            },
          },
        },
      });

      // Update Treasury Account Balance
      await tx.treasuryAccount.update({
        where: { id: treasuryAccountId },
        data: {
          currentBalance: { increment: invoice.grandTotal },
        },
      });

      // Decrement Party Receivable Balance
      await tx.party.update({
        where: { id: invoice.partyId },
        data: {
          receivableBalance: { decrement: invoice.grandTotal },
        },
      });

      // Mark invoice as fully paid
      await tx.salesInvoice.update({
        where: { id: invoiceId },
        data: {
          paymentStatus: PaymentStatus.PAID,
          paidAmount: invoice.grandTotal,
          remainingAmount: new Prisma.Decimal(0),
        },
      });
    }

    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'INVOICE_POSTED',
        entityType: 'SalesInvoice',
        entityId: invoiceId,
        newValues: { invoiceNumber: invoice.invoiceNumber, grandTotal: invoice.grandTotal },
      },
    });

    const finalInvoice = await tx.salesInvoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: {
        items: { include: { item: true } },
        party: true,
        warehouse: true,
      },
    });

    return finalInvoice;
  }

  // --- Sales Returns ---

  async createSalesReturn(tenantId: string, dto: CreateSalesReturnDto, userId: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Return must contain at least one item');
    }

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.salesInvoice.findUnique({
        where: { id: dto.salesInvoiceId },
        include: {
          items: { include: { item: true } },
          party: true,
        },
      });

      if (!invoice || invoice.tenantId !== tenantId) {
        throw new NotFoundException('Original sales invoice not found');
      }

      if (invoice.status !== DocumentStatus.POSTED) {
        throw new BadRequestException('Cannot create return against an unposted invoice');
      }

      let subtotal = 0;
      let taxTotal = 0;
      let grandTotal = 0;
      let costTotal = 0;

      const returnItemsData: any[] = [];

      for (const retLine of dto.items) {
        const invLine = invoice.items.find((i) => i.itemId === retLine.itemId);
        if (!invLine) {
          throw new BadRequestException(`Item ${retLine.itemId} was not present in original invoice`);
        }

        const originalQty = Number(invLine.quantity);
        const previouslyReturnedQty = Number(invLine.returnedQty);
        const maxReturnableQty = originalQty - previouslyReturnedQty;

        if (retLine.quantity > maxReturnableQty) {
          throw new BadRequestException({
            statusCode: 400,
            error: 'RETURN_QUANTITY_EXCEEDED',
            message: `Requested return quantity (${retLine.quantity}) exceeds remaining returnable quantity (${maxReturnableQty}) for item.`,
            maxReturnableQty,
            requestedQty: retLine.quantity,
          });
        }

        const unitPrice = Number(invLine.unitPrice);
        const unitCost = Number(invLine.unitCost);
        const taxRate = Number(invLine.taxRate);

        const lineGross = retLine.quantity * unitPrice;
        const lineTax = round((lineGross * taxRate) / 100, 4);
        const lineTotal = round(lineGross + lineTax, 4);
        const lineCost = round(retLine.quantity * unitCost, 4);

        subtotal += lineGross;
        taxTotal += lineTax;
        grandTotal += lineTotal;
        costTotal += lineCost;

        returnItemsData.push({
          tenantId,
          itemId: retLine.itemId,
          quantity: new Prisma.Decimal(retLine.quantity),
          unitPrice: new Prisma.Decimal(unitPrice),
          unitCost: new Prisma.Decimal(unitCost),
          taxRate: new Prisma.Decimal(taxRate),
          taxAmount: new Prisma.Decimal(lineTax),
          totalAmount: new Prisma.Decimal(lineTotal),
          notes: retLine.notes,
        });

        // Update returnedQty on invoice line
        await tx.salesInvoiceItem.update({
          where: { id: invLine.id },
          data: {
            returnedQty: { increment: retLine.quantity },
          },
        });

        // Return stock back to warehouse at original sale snapshot cost
        if (invLine.item.type === 'STOCK') {
          await this.stockMovementService.recordMovement({
            tenantId,
            warehouseId: invoice.warehouseId,
            itemId: retLine.itemId,
            type: StockMovementType.SALES_RETURN,
            quantity: retLine.quantity,
            unitPrice: unitCost,
            referenceType: 'SALES_RETURN',
            notes: `Sales return for invoice ${invoice.invoiceNumber}`,
            userId,
            tx,
          });
        }
      }

      const returnNumber = await this.generateNextDocNumber(
        tenantId,
        'RETURN_SALES',
        'RET',
        tx,
      );

      const salesReturn = await tx.salesReturn.create({
        data: {
          tenantId,
          returnNumber,
          salesInvoiceId: invoice.id,
          partyId: invoice.partyId,
          warehouseId: invoice.warehouseId,
          status: DocumentStatus.POSTED,
          subtotal: new Prisma.Decimal(round(subtotal, 4)),
          taxTotal: new Prisma.Decimal(round(taxTotal, 4)),
          grandTotal: new Prisma.Decimal(round(grandTotal, 4)),
          costTotal: new Prisma.Decimal(round(costTotal, 4)),
          notes: dto.notes,
          postedAt: new Date(),
          postedByUserId: userId,
          createdByUserId: userId,
          items: {
            create: returnItemsData,
          },
        },
        include: {
          items: { include: { item: true } },
          party: { select: { id: true, name: true, nameAr: true, code: true } },
          salesInvoice: { select: { id: true, invoiceNumber: true } },
        },
      });

      // Reduce customer receivable balance
      await tx.party.update({
        where: { id: invoice.partyId },
        data: {
          receivableBalance: { decrement: salesReturn.grandTotal },
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'SALES_RETURN_POSTED',
          entityType: 'SalesReturn',
          entityId: salesReturn.id,
          newValues: { returnNumber, grandTotal: salesReturn.grandTotal },
        },
      });

      return salesReturn;
    });
  }

  async convertQuotationToInvoice(tenantId: string, quotationId: string, userId: string) {
    const quotation = await this.prisma.salesQuotation.findUnique({
      where: { id: quotationId },
      include: { items: true },
    });

    if (!quotation || quotation.tenantId !== tenantId) {
      throw new NotFoundException('Quotation not found');
    }

    const items = quotation.items.map((line) => ({
      itemId: line.itemId,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      discountAmount: Number(line.discountAmount),
      taxRate: Number(line.taxRate),
      notes: line.notes || undefined,
    }));

    const warehouseId =
      quotation.warehouseId ||
      (await this.prisma.warehouse.findFirst({ where: { tenantId, isDefault: true } }))?.id ||
      (await this.prisma.warehouse.findFirst({ where: { tenantId } }))?.id;

    if (!warehouseId) {
      throw new BadRequestException('No warehouse found for invoice creation');
    }

    const invoice = await this.createInvoice(
      tenantId,
      {
        partyId: quotation.partyId,
        warehouseId,
        items,
        notes: `تم إنشاؤها من عرض السعر رقم ${quotation.quotationNumber}${quotation.notes ? ' - ' + quotation.notes : ''}`,
      },
      userId,
    );

    return invoice;
  }

  async quickInvoicePayment(
    tenantId: string,
    invoiceId: string,
    body: {
      amount: number;
      accountId: string;
      paymentMethod?: string;
      referenceNumber?: string;
      notes?: string;
    },
    userId: string,
  ) {
    const invoice = await this.prisma.salesInvoice.findUnique({
      where: { id: invoiceId },
      include: { party: true },
    });

    if (!invoice || invoice.tenantId !== tenantId) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status !== DocumentStatus.POSTED) {
      throw new BadRequestException('Cannot collect payment against an unposted draft invoice');
    }

    const remainingAmount = Number(invoice.grandTotal) - Number(invoice.paidAmount);
    if (remainingAmount <= 0) {
      throw new BadRequestException('Invoice is already fully paid');
    }

    const payAmount = Number(body.amount);
    if (!payAmount || payAmount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    if (payAmount > remainingAmount + 0.001) {
      throw new BadRequestException(`Payment amount (${payAmount}) exceeds remaining balance (${remainingAmount})`);
    }

    const account = await this.prisma.treasuryAccount.findUnique({
      where: { id: body.accountId },
    });
    if (!account || account.tenantId !== tenantId) {
      throw new NotFoundException('Treasury account not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const voucherNumber = await this.generateNextDocNumber(
        tenantId,
        'VOUCHER_RECEIPT',
        'RV',
        tx,
      );

      const voucher = await tx.treasuryVoucher.create({
        data: {
          tenantId,
          voucherNumber,
          type: VoucherType.RECEIPT,
          accountId: body.accountId,
          partyId: invoice.partyId,
          amount: new Prisma.Decimal(payAmount),
          allocatedAmount: new Prisma.Decimal(payAmount),
          unallocatedAmount: new Prisma.Decimal(0),
          paymentMethod: body.paymentMethod || 'CASH',
          referenceNumber: body.referenceNumber,
          notes: body.notes || `تحصيل سريع للفاتورة ${invoice.invoiceNumber}`,
          createdByUserId: userId,
          status: DocumentStatus.POSTED,
          allocations: {
            create: {
              tenantId,
              salesInvoiceId: invoice.id,
              allocatedAmount: new Prisma.Decimal(payAmount),
            },
          },
        },
      });

      // Update Treasury Account balance (+receipt)
      await tx.treasuryAccount.update({
        where: { id: body.accountId },
        data: { currentBalance: { increment: payAmount } },
      });

      // Update Party receivable balance (-paid)
      await tx.party.update({
        where: { id: invoice.partyId },
        data: { receivableBalance: { decrement: payAmount } },
      });

      // Update Sales Invoice paidAmount & paymentStatus
      const newPaidAmount = round(Number(invoice.paidAmount) + payAmount, 4);
      const newStatus =
        newPaidAmount >= Number(invoice.grandTotal) - 0.001
          ? PaymentStatus.PAID
          : PaymentStatus.PARTIALLY_PAID;

      const updatedInvoice = await tx.salesInvoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: new Prisma.Decimal(newPaidAmount),
          paymentStatus: newStatus,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'QUICK_PAYMENT_COLLECTED',
          entityType: 'SalesInvoice',
          entityId: invoiceId,
          newValues: { voucherNumber, amount: payAmount, newStatus },
        },
      });

      return {
        success: true,
        voucher,
        invoice: updatedInvoice,
      };
    });
  }

  async listSalesReturns(tenantId: string) {
    return this.prisma.salesReturn.findMany({
      where: { tenantId },
      include: {
        party: { select: { id: true, name: true, nameAr: true, code: true } },
        salesInvoice: { select: { id: true, invoiceNumber: true } },
        items: { include: { item: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
