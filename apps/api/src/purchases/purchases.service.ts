import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StockMovementService } from '../inventory/stock-movement.service';
import { SalesService } from '../sales/sales.service';
import {
  CreatePurchaseOrderDto,
  CreatePurchaseInvoiceDto,
  UpdatePurchaseInvoiceDto,
  CreatePurchaseReturnDto,
} from './dto/purchases.dto';
import { calculateLineAmounts, round } from '@business-suite/shared';
import {
  Prisma,
  DocumentStatus,
  PaymentStatus,
  StockMovementType,
} from '@prisma/client';

@Injectable()
export class PurchasesService {
  private readonly logger = new Logger(PurchasesService.name);

  constructor(
    private prisma: PrismaService,
    private stockMovementService: StockMovementService,
    private salesService: SalesService,
  ) {}

  // --- Purchase Orders ---

  async listOrders(tenantId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { tenantId },
      include: {
        party: { select: { id: true, name: true, nameAr: true, code: true } },
        items: { include: { item: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createOrder(tenantId: string, dto: CreatePurchaseOrderDto, userId: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Purchase Order must contain at least one line item');
    }

    return this.prisma.$transaction(async (tx) => {
      const orderNumber = await this.salesService.generateNextDocNumber(
        tenantId,
        'PURCHASE_ORDER',
        'PO',
        tx,
      );

      let subtotal = 0;
      let taxTotal = 0;
      let grandTotal = 0;

      const calculatedItems = dto.items.map((line) => {
        const lineCalc = calculateLineAmounts({
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          taxRate: line.taxRate !== undefined ? line.taxRate : 0,
          isTaxInclusive: false,
        });

        subtotal += lineCalc.grossAmount;
        taxTotal += lineCalc.taxAmount;
        grandTotal += lineCalc.totalAmount;

        return {
          tenantId,
          itemId: line.itemId,
          quantity: new Prisma.Decimal(lineCalc.quantity),
          unitPrice: new Prisma.Decimal(lineCalc.unitPrice),
          taxRate: new Prisma.Decimal(line.taxRate !== undefined ? line.taxRate : 0),
          taxAmount: new Prisma.Decimal(lineCalc.taxAmount),
          totalAmount: new Prisma.Decimal(lineCalc.totalAmount),
          notes: line.notes,
        };
      });

      const order = await tx.purchaseOrder.create({
        data: {
          tenantId,
          orderNumber,
          partyId: dto.partyId,
          warehouseId: dto.warehouseId,
          expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : null,
          subtotal: new Prisma.Decimal(round(subtotal, 4)),
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

      return order;
    });
  }

  // --- Purchase Invoices / Bills ---

  async listInvoices(
    tenantId: string,
    params?: { partyId?: string; status?: DocumentStatus; search?: string },
  ) {
    const where: Prisma.PurchaseInvoiceWhereInput = { tenantId };
    if (params?.partyId) where.partyId = params.partyId;
    if (params?.status) where.status = params.status;
    if (params?.search) {
      where.OR = [
        { billNumber: { contains: params.search.trim(), mode: 'insensitive' } },
        { supplierInvoiceNumber: { contains: params.search.trim(), mode: 'insensitive' } },
        { party: { name: { contains: params.search.trim(), mode: 'insensitive' } } },
      ];
    }

    return this.prisma.purchaseInvoice.findMany({
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
    const invoice = await this.prisma.purchaseInvoice.findUnique({
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
      throw new NotFoundException('Purchase invoice not found');
    }

    return invoice;
  }

  async createInvoice(tenantId: string, dto: CreatePurchaseInvoiceDto, userId: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Invoice must contain at least one line item');
    }

    let subtotal = 0;
    let taxTotal = 0;
    let grandTotal = 0;

    const calculatedItems = dto.items.map((line) => {
      const lineCalc = calculateLineAmounts({
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxRate: line.taxRate !== undefined ? line.taxRate : 0,
        isTaxInclusive: false,
      });

      subtotal += lineCalc.grossAmount;
      taxTotal += lineCalc.taxAmount;
      grandTotal += lineCalc.totalAmount;

      return {
        tenantId,
        itemId: line.itemId,
        quantity: new Prisma.Decimal(lineCalc.quantity),
        unitPrice: new Prisma.Decimal(lineCalc.unitPrice),
        taxRate: new Prisma.Decimal(line.taxRate !== undefined ? line.taxRate : 0),
        taxAmount: new Prisma.Decimal(lineCalc.taxAmount),
        totalAmount: new Prisma.Decimal(lineCalc.totalAmount),
        notes: line.notes,
      };
    });

    const roundedGrandTotal = round(grandTotal, 4);

    return this.prisma.$transaction(async (tx) => {
      const billNumber = await this.salesService.generateNextDocNumber(
        tenantId,
        'PURCHASE_INVOICE',
        'BILL',
        tx,
      );

      const invoice = await tx.purchaseInvoice.create({
        data: {
          tenantId,
          billNumber,
          partyId: dto.partyId,
          warehouseId: dto.warehouseId,
          supplierInvoiceNumber: dto.supplierInvoiceNumber,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          status: DocumentStatus.DRAFT,
          paymentStatus: PaymentStatus.UNPAID,
          subtotal: new Prisma.Decimal(round(subtotal, 4)),
          taxTotal: new Prisma.Decimal(round(taxTotal, 4)),
          grandTotal: new Prisma.Decimal(roundedGrandTotal),
          remainingAmount: new Prisma.Decimal(roundedGrandTotal),
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

      if (dto.postImmediately) {
        return this.postInvoiceInternal(invoice.id, tenantId, userId, tx);
      }

      return invoice;
    });
  }

  async updateInvoice(
    tenantId: string,
    invoiceId: string,
    dto: UpdatePurchaseInvoiceDto,
    userId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.purchaseInvoice.findUnique({
        where: { id: invoiceId },
        include: { items: { include: { item: true } }, party: true },
      });

      if (!existing || existing.tenantId !== tenantId) {
        throw new NotFoundException('Purchase invoice not found');
      }

      let subtotal = Number(existing.subtotal);
      let taxTotal = Number(existing.taxTotal);
      let grandTotal = Number(existing.grandTotal);
      let calculatedItems: any[] | null = null;

      if (dto.items && dto.items.length > 0) {
        subtotal = 0;
        taxTotal = 0;
        grandTotal = 0;

        calculatedItems = dto.items.map((line) => {
          const lineCalc = calculateLineAmounts({
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            taxRate: line.taxRate !== undefined ? line.taxRate : 0,
            isTaxInclusive: false,
          });

          subtotal += lineCalc.grossAmount;
          taxTotal += lineCalc.taxAmount;
          grandTotal += lineCalc.totalAmount;

          return {
            tenantId,
            itemId: line.itemId,
            quantity: new Prisma.Decimal(lineCalc.quantity),
            unitPrice: new Prisma.Decimal(lineCalc.unitPrice),
            taxRate: new Prisma.Decimal(line.taxRate !== undefined ? line.taxRate : 0),
            taxAmount: new Prisma.Decimal(lineCalc.taxAmount),
            totalAmount: new Prisma.Decimal(lineCalc.totalAmount),
            notes: line.notes,
          };
        });

        // If invoice was posted, adjust the party payable balance difference
        if (existing.status === DocumentStatus.POSTED) {
          const grandTotalDiff = grandTotal - Number(existing.grandTotal);
          if (grandTotalDiff !== 0) {
            await tx.party.update({
              where: { id: existing.partyId },
              data: {
                payableBalance: { increment: grandTotalDiff },
              },
            });
          }
        }

        // Replace items
        await tx.purchaseInvoiceItem.deleteMany({
          where: { invoiceId },
        });

        await tx.purchaseInvoiceItem.createMany({
          data: calculatedItems.map((ci) => ({
            ...ci,
            invoiceId,
          })),
        });
      }

      const roundedGrandTotal = round(grandTotal, 4);
      const paidAmount = Number(existing.paidAmount || 0);
      const remainingAmount = Math.max(0, roundedGrandTotal - paidAmount);

      const updateData: any = {
        subtotal: new Prisma.Decimal(round(subtotal, 4)),
        taxTotal: new Prisma.Decimal(round(taxTotal, 4)),
        grandTotal: new Prisma.Decimal(roundedGrandTotal),
        remainingAmount: new Prisma.Decimal(remainingAmount),
      };

      if (dto.partyId) updateData.partyId = dto.partyId;
      if (dto.warehouseId) updateData.warehouseId = dto.warehouseId;
      if (dto.supplierInvoiceNumber !== undefined) updateData.supplierInvoiceNumber = dto.supplierInvoiceNumber;
      if (dto.dueDate !== undefined) updateData.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
      if (dto.notes !== undefined) updateData.notes = dto.notes;

      const updated = await tx.purchaseInvoice.update({
        where: { id: invoiceId },
        data: updateData,
        include: {
          items: { include: { item: true } },
          party: true,
          warehouse: true,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'PURCHASE_INVOICE_UPDATED',
          entityType: 'PurchaseInvoice',
          entityId: invoiceId,
          newValues: { billNumber: updated.billNumber, grandTotal: updated.grandTotal },
        },
      });

      return updated;
    });
  }

  async postInvoice(tenantId: string, invoiceId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      return this.postInvoiceInternal(invoiceId, tenantId, userId, tx);
    });
  }

  private async postInvoiceInternal(
    invoiceId: string,
    tenantId: string,
    userId: string,
    tx: Prisma.TransactionClient,
  ) {
    const invoice = await tx.purchaseInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: { include: { item: true } },
        party: true,
      },
    });

    if (!invoice || invoice.tenantId !== tenantId) {
      throw new NotFoundException('Purchase invoice not found');
    }

    if (invoice.status === DocumentStatus.POSTED) {
      throw new BadRequestException('Invoice is already posted');
    }

    // 1. Process Stock Additions & Recalculate WAC
    for (const line of invoice.items) {
      if (line.item.type === 'STOCK') {
        const lineQty = Number(line.quantity);
        const lineUnitPrice = Number(line.unitPrice);

        await this.stockMovementService.recordMovement({
          tenantId,
          warehouseId: invoice.warehouseId,
          itemId: line.itemId,
          type: StockMovementType.PURCHASE_RECEIPT,
          quantity: lineQty,
          unitPrice: lineUnitPrice,
          referenceType: 'PURCHASE_INVOICE',
          referenceId: invoice.id,
          documentNumber: invoice.billNumber,
          notes: `Purchase bill posting: ${invoice.billNumber}`,
          userId,
          tx,
        });

        // Update item purchase price
        await tx.item.update({
          where: { id: line.itemId },
          data: { purchasePrice: new Prisma.Decimal(lineUnitPrice) },
        });
      }
    }

    // 2. Increment Supplier Payable Balance
    await tx.party.update({
      where: { id: invoice.partyId },
      data: {
        payableBalance: { increment: invoice.grandTotal },
      },
    });

    // 3. Mark Invoice as Posted
    await tx.purchaseInvoice.update({
      where: { id: invoiceId },
      data: {
        status: DocumentStatus.POSTED,
        postedAt: new Date(),
        postedByUserId: userId,
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'PURCHASE_INVOICE_POSTED',
        entityType: 'PurchaseInvoice',
        entityId: invoiceId,
        newValues: { billNumber: invoice.billNumber, grandTotal: invoice.grandTotal },
      },
    });

    return tx.purchaseInvoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: {
        items: { include: { item: true } },
        party: true,
        warehouse: true,
      },
    });
  }

  // --- Purchase Returns ---

  async createPurchaseReturn(tenantId: string, dto: CreatePurchaseReturnDto, userId: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Return must contain at least one item');
    }

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.purchaseInvoice.findUnique({
        where: { id: dto.purchaseInvoiceId },
        include: {
          items: { include: { item: true } },
          party: true,
        },
      });

      if (!invoice || invoice.tenantId !== tenantId) {
        throw new NotFoundException('Original purchase invoice not found');
      }

      if (invoice.status !== DocumentStatus.POSTED) {
        throw new BadRequestException('Cannot return against unposted purchase invoice');
      }

      let subtotal = 0;
      let taxTotal = 0;
      let grandTotal = 0;

      const returnItemsData: any[] = [];

      for (const retLine of dto.items) {
        const invLine = invoice.items.find((i) => i.itemId === retLine.itemId);
        if (!invLine) {
          throw new BadRequestException(`Item ${retLine.itemId} not in original purchase bill`);
        }

        const originalQty = Number(invLine.quantity);
        const prevReturned = Number(invLine.returnedQty);
        const maxReturnable = originalQty - prevReturned;

        if (retLine.quantity > maxReturnable) {
          throw new BadRequestException({
            statusCode: 400,
            error: 'RETURN_QUANTITY_EXCEEDED',
            message: `Return quantity (${retLine.quantity}) exceeds remaining returnable quantity (${maxReturnable})`,
          });
        }

        const unitPrice = Number(invLine.unitPrice);
        const taxRate = Number(invLine.taxRate);

        const lineGross = retLine.quantity * unitPrice;
        const lineTax = round((lineGross * taxRate) / 100, 4);
        const lineTotal = round(lineGross + lineTax, 4);

        subtotal += lineGross;
        taxTotal += lineTax;
        grandTotal += lineTotal;

        returnItemsData.push({
          tenantId,
          itemId: retLine.itemId,
          quantity: new Prisma.Decimal(retLine.quantity),
          unitPrice: new Prisma.Decimal(unitPrice),
          taxRate: new Prisma.Decimal(taxRate),
          taxAmount: new Prisma.Decimal(lineTax),
          totalAmount: new Prisma.Decimal(lineTotal),
          notes: retLine.notes,
        });

        // Update returnedQty on purchase invoice item
        await tx.purchaseInvoiceItem.update({
          where: { id: invLine.id },
          data: { returnedQty: { increment: retLine.quantity } },
        });

        // Deduct stock from warehouse (checking negative stock)
        if (invLine.item.type === 'STOCK') {
          await this.stockMovementService.recordMovement({
            tenantId,
            warehouseId: invoice.warehouseId,
            itemId: retLine.itemId,
            type: StockMovementType.PURCHASE_RETURN,
            quantity: -retLine.quantity,
            unitPrice,
            referenceType: 'PURCHASE_RETURN',
            notes: `Purchase return for bill ${invoice.billNumber}`,
            userId,
            tx,
          });
        }
      }

      const returnNumber = await this.salesService.generateNextDocNumber(
        tenantId,
        'RETURN_PURCHASE',
        'RET-PUR',
        tx,
      );

      const purchaseReturn = await tx.purchaseReturn.create({
        data: {
          tenantId,
          returnNumber,
          purchaseInvoiceId: invoice.id,
          partyId: invoice.partyId,
          warehouseId: invoice.warehouseId,
          status: DocumentStatus.POSTED,
          subtotal: new Prisma.Decimal(round(subtotal, 4)),
          taxTotal: new Prisma.Decimal(round(taxTotal, 4)),
          grandTotal: new Prisma.Decimal(round(grandTotal, 4)),
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
          purchaseInvoice: { select: { id: true, billNumber: true } },
        },
      });

      // Reduce supplier payable balance
      await tx.party.update({
        where: { id: invoice.partyId },
        data: {
          payableBalance: { decrement: purchaseReturn.grandTotal },
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'PURCHASE_RETURN_POSTED',
          entityType: 'PurchaseReturn',
          entityId: purchaseReturn.id,
          newValues: { returnNumber, grandTotal: purchaseReturn.grandTotal },
        },
      });

      return purchaseReturn;
    });
  }

  async convertOrderToInvoice(tenantId: string, orderId: string, userId: string) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order || order.tenantId !== tenantId) {
      throw new NotFoundException('Purchase order not found');
    }

    const items = order.items.map((line) => ({
      itemId: line.itemId,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      taxRate: Number(line.taxRate),
      notes: line.notes || undefined,
    }));

    const warehouseId =
      order.warehouseId ||
      (await this.prisma.warehouse.findFirst({ where: { tenantId, isDefault: true } }))?.id ||
      (await this.prisma.warehouse.findFirst({ where: { tenantId } }))?.id;

    if (!warehouseId) {
      throw new BadRequestException('No warehouse found for bill creation');
    }

    const invoice = await this.createInvoice(
      tenantId,
      {
        partyId: order.partyId,
        warehouseId,
        items,
        notes: `تم إنشاؤها من أمر الشراء رقم ${order.orderNumber}${order.notes ? ' - ' + order.notes : ''}`,
      },
      userId,
    );

    return invoice;
  }

  async quickBillPayment(
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
    const invoice = await this.prisma.purchaseInvoice.findUnique({
      where: { id: invoiceId },
      include: { party: true },
    });

    if (!invoice || invoice.tenantId !== tenantId) {
      throw new NotFoundException('Purchase bill not found');
    }

    if (invoice.status !== DocumentStatus.POSTED) {
      throw new BadRequestException('Cannot pay an unposted draft bill');
    }

    const remainingAmount = Number(invoice.grandTotal) - Number(invoice.paidAmount);
    if (remainingAmount <= 0) {
      throw new BadRequestException('Bill is already fully paid');
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
      const voucherNumber = await this.salesService.generateNextDocNumber(
        tenantId,
        'VOUCHER_PAYMENT',
        'PV',
        tx,
      );

      const voucher = await tx.treasuryVoucher.create({
        data: {
          tenantId,
          voucherNumber,
          type: 'PAYMENT',
          accountId: body.accountId,
          partyId: invoice.partyId,
          amount: new Prisma.Decimal(payAmount),
          allocatedAmount: new Prisma.Decimal(payAmount),
          unallocatedAmount: new Prisma.Decimal(0),
          paymentMethod: body.paymentMethod || 'BANK_TRANSFER',
          referenceNumber: body.referenceNumber,
          notes: body.notes || `سداد سريع لفاتورة المشتريات ${invoice.billNumber}`,
          createdByUserId: userId,
          status: DocumentStatus.POSTED,
          allocations: {
            create: {
              tenantId,
              purchaseInvoiceId: invoice.id,
              allocatedAmount: new Prisma.Decimal(payAmount),
            },
          },
        },
      });

      // Update Treasury Account balance (-payment)
      await tx.treasuryAccount.update({
        where: { id: body.accountId },
        data: { currentBalance: { decrement: payAmount } },
      });

      // Update Party payable balance (-paid)
      await tx.party.update({
        where: { id: invoice.partyId },
        data: { payableBalance: { decrement: payAmount } },
      });

      // Update Purchase Invoice paidAmount & paymentStatus
      const newPaidAmount = round(Number(invoice.paidAmount) + payAmount, 4);
      const newStatus =
        newPaidAmount >= Number(invoice.grandTotal) - 0.001
          ? PaymentStatus.PAID
          : PaymentStatus.PARTIALLY_PAID;

      const updatedInvoice = await tx.purchaseInvoice.update({
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
          action: 'QUICK_BILL_PAYMENT_MADE',
          entityType: 'PurchaseInvoice',
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

  async listPurchaseReturns(tenantId: string) {
    return this.prisma.purchaseReturn.findMany({
      where: { tenantId },
      include: {
        party: { select: { id: true, name: true, nameAr: true, code: true } },
        purchaseInvoice: { select: { id: true, billNumber: true } },
        items: { include: { item: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
