import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SalesService } from '../sales/sales.service';
import {
  CreateAccountDto,
  CreateVoucherDto,
  VoidVoucherDto,
  TransferFundsDto,
} from './dto/treasury.dto';
import { round } from '@business-suite/shared';
import {
  Prisma,
  VoucherType,
  DocumentStatus,
  PaymentStatus,
} from '@prisma/client';

@Injectable()
export class TreasuryService {
  private readonly logger = new Logger(TreasuryService.name);

  constructor(
    private prisma: PrismaService,
    private salesService: SalesService,
  ) {}

  // --- Accounts ---

  async listAccounts(tenantId: string) {
    return this.prisma.treasuryAccount.findMany({
      where: { tenantId },
      orderBy: { code: 'asc' },
    });
  }

  async getAccount(tenantId: string, accountId: string) {
    const account = await this.prisma.treasuryAccount.findUnique({
      where: { id: accountId },
      include: {
        vouchers: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: { party: true },
        },
      },
    });

    if (!account || account.tenantId !== tenantId) {
      throw new NotFoundException('Treasury account not found');
    }

    return account;
  }

  async createAccount(tenantId: string, dto: CreateAccountDto, userId: string) {
    const opening = dto.openingBalance ? new Prisma.Decimal(dto.openingBalance) : new Prisma.Decimal(0);

    const account = await this.prisma.treasuryAccount.create({
      data: {
        tenantId,
        type: dto.type,
        code: dto.code,
        name: dto.name,
        nameAr: dto.nameAr,
        accountNumber: dto.accountNumber,
        bankName: dto.bankName,
        openingBalance: opening,
        currentBalance: opening,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'TREASURY_ACCOUNT_CREATED',
        entityType: 'TreasuryAccount',
        entityId: account.id,
        newValues: dto as any,
      },
    });

    return account;
  }

  // --- Vouchers & Allocations ---

  async listVouchers(tenantId: string, type?: VoucherType) {
    const where: Prisma.TreasuryVoucherWhereInput = { tenantId };
    if (type) where.type = type;

    return this.prisma.treasuryVoucher.findMany({
      where,
      include: {
        account: true,
        party: true,
        allocations: {
          include: {
            salesInvoice: { select: { id: true, invoiceNumber: true, grandTotal: true } },
            purchaseInvoice: { select: { id: true, billNumber: true, grandTotal: true } },
          },
        },
      },
      orderBy: { issueDate: 'desc' },
    });
  }

  async getVoucher(tenantId: string, voucherId: string) {
    const voucher = await this.prisma.treasuryVoucher.findUnique({
      where: { id: voucherId },
      include: {
        account: true,
        party: true,
        allocations: {
          include: {
            salesInvoice: true,
            purchaseInvoice: true,
          },
        },
      },
    });

    if (!voucher || voucher.tenantId !== tenantId) {
      throw new NotFoundException('Voucher not found');
    }

    return voucher;
  }

  async createVoucher(tenantId: string, dto: CreateVoucherDto, userId: string) {
    const account = await this.prisma.treasuryAccount.findUnique({
      where: { id: dto.accountId },
    });

    if (!account || account.tenantId !== tenantId) {
      throw new NotFoundException('Treasury account not found');
    }

    const voucherAmount = round(dto.amount, 4);
    if (voucherAmount <= 0) {
      throw new BadRequestException('Voucher amount must be greater than zero');
    }

    return this.prisma.$transaction(async (tx) => {
      const docPrefix = dto.type === VoucherType.RECEIPT ? 'REC' : 'PAY';
      const docType = dto.type === VoucherType.RECEIPT ? 'VOUCHER_RECEIPT' : 'VOUCHER_PAYMENT';
      const voucherNumber = await this.salesService.generateNextDocNumber(
        tenantId,
        docType,
        docPrefix,
        tx,
      );

      // 1. Calculate Allocations
      let allocatedTotal = 0;
      const allocationRecords: any[] = [];

      if (dto.allocations && dto.allocations.length > 0) {
        for (const alloc of dto.allocations) {
          const allocAmt = round(alloc.allocatedAmount, 4);
          if (allocAmt <= 0) continue;

          allocatedTotal += allocAmt;

          if (alloc.salesInvoiceId) {
            const invoice = await tx.salesInvoice.findUnique({
              where: { id: alloc.salesInvoiceId },
            });
            if (!invoice || invoice.tenantId !== tenantId) {
              throw new NotFoundException(`Sales Invoice ${alloc.salesInvoiceId} not found`);
            }

            const remaining = Number(invoice.remainingAmount);
            if (allocAmt > remaining + 0.0001) {
              throw new BadRequestException({
                statusCode: 400,
                error: 'ALLOCATION_EXCEEDS_INVOICE_REMAINING',
                message: `Allocation amount (${allocAmt}) exceeds remaining balance (${remaining}) of invoice ${invoice.invoiceNumber}`,
              });
            }

            const newPaid = round(Number(invoice.paidAmount) + allocAmt, 4);
            const newRemaining = round(Math.max(0, remaining - allocAmt), 4);
            const paymentStatus = newRemaining === 0 ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID;

            await tx.salesInvoice.update({
              where: { id: invoice.id },
              data: {
                paidAmount: new Prisma.Decimal(newPaid),
                remainingAmount: new Prisma.Decimal(newRemaining),
                paymentStatus,
              },
            });

            allocationRecords.push({
              tenantId,
              salesInvoiceId: invoice.id,
              allocatedAmount: new Prisma.Decimal(allocAmt),
            });
          } else if (alloc.purchaseInvoiceId) {
            const bill = await tx.purchaseInvoice.findUnique({
              where: { id: alloc.purchaseInvoiceId },
            });
            if (!bill || bill.tenantId !== tenantId) {
              throw new NotFoundException(`Purchase Bill ${alloc.purchaseInvoiceId} not found`);
            }

            const remaining = Number(bill.remainingAmount);
            if (allocAmt > remaining + 0.0001) {
              throw new BadRequestException({
                statusCode: 400,
                error: 'ALLOCATION_EXCEEDS_BILL_REMAINING',
                message: `Allocation amount (${allocAmt}) exceeds remaining balance (${remaining}) of bill ${bill.billNumber}`,
              });
            }

            const newPaid = round(Number(bill.paidAmount) + allocAmt, 4);
            const newRemaining = round(Math.max(0, remaining - allocAmt), 4);
            const paymentStatus = newRemaining === 0 ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID;

            await tx.purchaseInvoice.update({
              where: { id: bill.id },
              data: {
                paidAmount: new Prisma.Decimal(newPaid),
                remainingAmount: new Prisma.Decimal(newRemaining),
                paymentStatus,
              },
            });

            allocationRecords.push({
              tenantId,
              purchaseInvoiceId: bill.id,
              allocatedAmount: new Prisma.Decimal(allocAmt),
            });
          }
        }
      }

      if (allocatedTotal > voucherAmount + 0.0001) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'ALLOCATION_EXCEEDS_VOUCHER_TOTAL',
          message: `Total allocated sum (${allocatedTotal}) cannot exceed voucher amount (${voucherAmount})`,
        });
      }

      const unallocatedAmount = round(voucherAmount - allocatedTotal, 4);

      // 2. Create Voucher
      const voucher = await tx.treasuryVoucher.create({
        data: {
          tenantId,
          voucherNumber,
          type: dto.type,
          accountId: dto.accountId,
          partyId: dto.partyId,
          amount: new Prisma.Decimal(voucherAmount),
          allocatedAmount: new Prisma.Decimal(allocatedTotal),
          unallocatedAmount: new Prisma.Decimal(unallocatedAmount),
          paymentMethod: dto.paymentMethod || 'CASH',
          referenceNumber: dto.referenceNumber,
          status: DocumentStatus.POSTED,
          notes: dto.notes,
          createdByUserId: userId,
          allocations: {
            create: allocationRecords,
          },
        },
        include: { allocations: true },
      });

      // 3. Update Treasury Account Balance
      if (dto.type === VoucherType.RECEIPT) {
        await tx.treasuryAccount.update({
          where: { id: dto.accountId },
          data: { currentBalance: { increment: voucherAmount } },
        });

        // Decrement Customer Receivable Balance if party is attached
        if (dto.partyId) {
          await tx.party.update({
            where: { id: dto.partyId },
            data: { receivableBalance: { decrement: voucherAmount } },
          });
        }
      } else {
        // PAYMENT
        await tx.treasuryAccount.update({
          where: { id: dto.accountId },
          data: { currentBalance: { decrement: voucherAmount } },
        });

        // Decrement Supplier Payable Balance if party is attached
        if (dto.partyId) {
          await tx.party.update({
            where: { id: dto.partyId },
            data: { payableBalance: { decrement: voucherAmount } },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'TREASURY_VOUCHER_CREATED',
          entityType: 'TreasuryVoucher',
          entityId: voucher.id,
          newValues: { voucherNumber, amount: voucherAmount, type: dto.type },
        },
      });

      return voucher;
    });
  }

  // --- Void / Cancel Voucher with Atomic Reversal ---

  async voidVoucher(tenantId: string, voucherId: string, dto: VoidVoucherDto, userId: string) {
    const voucher = await this.prisma.treasuryVoucher.findUnique({
      where: { id: voucherId },
      include: { allocations: true },
    });

    if (!voucher || voucher.tenantId !== tenantId) {
      throw new NotFoundException('Voucher not found');
    }

    if (voucher.status === DocumentStatus.CANCELLED) {
      throw new BadRequestException('Voucher is already cancelled/voided');
    }

    const voucherAmount = Number(voucher.amount);

    return this.prisma.$transaction(async (tx) => {
      // 1. Reverse Account and Party Balances
      if (voucher.type === VoucherType.RECEIPT) {
        // Was money IN -> now deduct back from treasury
        await tx.treasuryAccount.update({
          where: { id: voucher.accountId },
          data: { currentBalance: { decrement: voucherAmount } },
        });

        // Add back to customer receivable if party exists
        if (voucher.partyId) {
          await tx.party.update({
            where: { id: voucher.partyId },
            data: { receivableBalance: { increment: voucherAmount } },
          });
        }
      } else {
        // Was money OUT (PAYMENT) -> now add back to treasury
        await tx.treasuryAccount.update({
          where: { id: voucher.accountId },
          data: { currentBalance: { increment: voucherAmount } },
        });

        // Add back to supplier payable if party exists
        if (voucher.partyId) {
          await tx.party.update({
            where: { id: voucher.partyId },
            data: { payableBalance: { increment: voucherAmount } },
          });
        }
      }

      // 2. Reverse Multi-Invoice Allocations
      if (voucher.allocations && voucher.allocations.length > 0) {
        for (const alloc of voucher.allocations) {
          const allocAmt = Number(alloc.allocatedAmount);

          if (alloc.salesInvoiceId) {
            const invoice = await tx.salesInvoice.findUnique({
              where: { id: alloc.salesInvoiceId },
            });
            if (invoice) {
              const currentPaid = Number(invoice.paidAmount);
              const newPaid = round(Math.max(0, currentPaid - allocAmt), 4);
              const newRemaining = round(Math.max(0, Number(invoice.grandTotal) - newPaid), 4);
              const paymentStatus = newPaid === 0 ? PaymentStatus.UNPAID : PaymentStatus.PARTIALLY_PAID;

              await tx.salesInvoice.update({
                where: { id: invoice.id },
                data: {
                  paidAmount: new Prisma.Decimal(newPaid),
                  remainingAmount: new Prisma.Decimal(newRemaining),
                  paymentStatus,
                },
              });
            }
          } else if (alloc.purchaseInvoiceId) {
            const bill = await tx.purchaseInvoice.findUnique({
              where: { id: alloc.purchaseInvoiceId },
            });
            if (bill) {
              const currentPaid = Number(bill.paidAmount);
              const newPaid = round(Math.max(0, currentPaid - allocAmt), 4);
              const newRemaining = round(Math.max(0, Number(bill.grandTotal) - newPaid), 4);
              const paymentStatus = newPaid === 0 ? PaymentStatus.UNPAID : PaymentStatus.PARTIALLY_PAID;

              await tx.purchaseInvoice.update({
                where: { id: bill.id },
                data: {
                  paidAmount: new Prisma.Decimal(newPaid),
                  remainingAmount: new Prisma.Decimal(newRemaining),
                  paymentStatus,
                },
              });
            }
          }
        }
      }

      // 3. Mark Voucher as CANCELLED
      const voidNote = dto.reason ? ` [تم الإلغاء: ${dto.reason.trim()}]` : ' [تم الإلغاء والعكس المالي]';
      const updatedVoucher = await tx.treasuryVoucher.update({
        where: { id: voucher.id },
        data: {
          status: DocumentStatus.CANCELLED,
          notes: voucher.notes ? `${voucher.notes}${voidNote}` : voidNote.trim(),
        },
      });

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'TREASURY_VOUCHER_VOIDED',
          entityType: 'TreasuryVoucher',
          entityId: voucher.id,
          newValues: {
            voucherNumber: voucher.voucherNumber,
            amount: voucherAmount,
            reason: dto.reason,
            voidedAt: new Date().toISOString(),
          },
        },
      });

      return {
        success: true,
        message: 'تم إلغاء السند وعكس الأثر المالي بنجاح',
        voucher: updatedVoucher,
      };
    });
  }

  // --- Fund Transfer between Accounts / Banks ---

  async transferFunds(tenantId: string, dto: TransferFundsDto, userId: string) {
    if (dto.sourceAccountId === dto.destinationAccountId) {
      throw new BadRequestException('حساب المصدر وحساب الوجهة لا يمكن أن يكونا متطابقين');
    }

    const transferAmount = round(dto.amount, 4);
    if (transferAmount <= 0) {
      throw new BadRequestException('مبلغ التحويل يجب أن يكون أكبر من الصفر');
    }

    const [sourceAccount, destAccount] = await Promise.all([
      this.prisma.treasuryAccount.findUnique({ where: { id: dto.sourceAccountId } }),
      this.prisma.treasuryAccount.findUnique({ where: { id: dto.destinationAccountId } }),
    ]);

    if (!sourceAccount || sourceAccount.tenantId !== tenantId) {
      throw new NotFoundException('حساب المصدر غير موجود');
    }
    if (!destAccount || destAccount.tenantId !== tenantId) {
      throw new NotFoundException('حساب الوجهة غير موجود');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Generate Doc numbers
      const payNumber = await this.salesService.generateNextDocNumber(
        tenantId,
        'VOUCHER_PAYMENT',
        'PAY',
        tx,
      );
      const recNumber = await this.salesService.generateNextDocNumber(
        tenantId,
        'VOUCHER_RECEIPT',
        'REC',
        tx,
      );

      const notesOut = `تحويل صادر إلى ${destAccount.nameAr || destAccount.name}${dto.notes ? ` - ${dto.notes}` : ''}`;
      const notesIn = `تحويل وارد من ${sourceAccount.nameAr || sourceAccount.name}${dto.notes ? ` - ${dto.notes}` : ''}`;

      // 2. Outflow Voucher from Source
      const outVoucher = await tx.treasuryVoucher.create({
        data: {
          tenantId,
          voucherNumber: payNumber,
          type: VoucherType.PAYMENT,
          accountId: dto.sourceAccountId,
          amount: new Prisma.Decimal(transferAmount),
          allocatedAmount: new Prisma.Decimal(0),
          unallocatedAmount: new Prisma.Decimal(transferAmount),
          paymentMethod: 'BANK_TRANSFER',
          referenceNumber: dto.referenceNumber,
          status: DocumentStatus.POSTED,
          notes: notesOut,
          createdByUserId: userId,
        },
      });

      // 3. Inflow Voucher to Destination
      const inVoucher = await tx.treasuryVoucher.create({
        data: {
          tenantId,
          voucherNumber: recNumber,
          type: VoucherType.RECEIPT,
          accountId: dto.destinationAccountId,
          amount: new Prisma.Decimal(transferAmount),
          allocatedAmount: new Prisma.Decimal(0),
          unallocatedAmount: new Prisma.Decimal(transferAmount),
          paymentMethod: 'BANK_TRANSFER',
          referenceNumber: dto.referenceNumber,
          status: DocumentStatus.POSTED,
          notes: notesIn,
          createdByUserId: userId,
        },
      });

      // 4. Update Balances
      await tx.treasuryAccount.update({
        where: { id: dto.sourceAccountId },
        data: { currentBalance: { decrement: transferAmount } },
      });

      await tx.treasuryAccount.update({
        where: { id: dto.destinationAccountId },
        data: { currentBalance: { increment: transferAmount } },
      });

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'TREASURY_FUNDS_TRANSFERRED',
          entityType: 'TreasuryTransfer',
          entityId: `${outVoucher.id}-${inVoucher.id}`,
          newValues: {
            amount: transferAmount,
            sourceAccountId: dto.sourceAccountId,
            destinationAccountId: dto.destinationAccountId,
            outVoucherNumber: payNumber,
            inVoucherNumber: recNumber,
          },
        },
      });

      return {
        success: true,
        message: 'تم التحويل المالي بين الحسابات بنجاح',
        amount: transferAmount,
        outVoucher,
        inVoucher,
      };
    });
  }
}

