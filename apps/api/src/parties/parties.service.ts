import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePartyDto, UpdatePartyDto, CreateContactDto } from './dto/party.dto';
import { PartyType, Prisma } from '@prisma/client';

@Injectable()
export class PartiesService {
  private readonly logger = new Logger(PartiesService.name);

  constructor(private prisma: PrismaService) {}

  async listParties(tenantId: string, type?: PartyType, search?: string) {
    const where: Prisma.PartyWhereInput = { tenantId };

    if (type) {
      where.OR = [{ type }, { type: PartyType.BOTH }];
    }

    if (search) {
      const q = search.trim();
      where.AND = [
        {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { nameAr: { contains: q, mode: 'insensitive' } },
            { code: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
            { taxNumber: { contains: q, mode: 'insensitive' } },
          ],
        },
      ];
    }

    return this.prisma.party.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        contacts: true,
        _count: {
          select: {
            salesInvoices: true,
            purchaseInvoices: true,
          },
        },
      },
    });
  }

  async getParty(tenantId: string, partyId: string) {
    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: {
        contacts: true,
        salesInvoices: {
          take: 10,
          orderBy: { issueDate: 'desc' },
          select: {
            id: true,
            invoiceNumber: true,
            issueDate: true,
            grandTotal: true,
            paidAmount: true,
            remainingAmount: true,
            status: true,
            paymentStatus: true,
          },
        },
        purchaseInvoices: {
          take: 10,
          orderBy: { issueDate: 'desc' },
          select: {
            id: true,
            billNumber: true,
            issueDate: true,
            grandTotal: true,
            paidAmount: true,
            remainingAmount: true,
            status: true,
            paymentStatus: true,
          },
        },
      },
    });

    if (!party || party.tenantId !== tenantId) {
      throw new NotFoundException('Party not found');
    }

    return party;
  }

  async createParty(tenantId: string, dto: CreatePartyDto, userId: string) {
    const existing = await this.prisma.party.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code: dto.code,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Party code '${dto.code}' already exists`);
    }

    const openingRec = dto.openingReceivable ? new Prisma.Decimal(dto.openingReceivable) : new Prisma.Decimal(0);
    const openingPay = dto.openingPayable ? new Prisma.Decimal(dto.openingPayable) : new Prisma.Decimal(0);

    const party = await this.prisma.party.create({
      data: {
        tenantId,
        type: dto.type,
        code: dto.code,
        name: dto.name,
        nameAr: dto.nameAr,
        phone: dto.phone,
        email: dto.email,
        taxNumber: dto.taxNumber,
        commercialReg: dto.commercialReg,
        creditLimit: dto.creditLimit ? new Prisma.Decimal(dto.creditLimit) : new Prisma.Decimal(0),
        openingReceivable: openingRec,
        openingPayable: openingPay,
        receivableBalance: openingRec,
        payableBalance: openingPay,
        address: dto.address,
        notes: dto.notes,
      },
      include: {
        contacts: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'PARTY_CREATED',
        entityType: 'Party',
        entityId: party.id,
        newValues: dto as any,
      },
    });

    return party;
  }

  async updateParty(tenantId: string, partyId: string, dto: UpdatePartyDto, userId: string) {
    const existing = await this.prisma.party.findUnique({ where: { id: partyId } });
    if (!existing || existing.tenantId !== tenantId) {
      throw new NotFoundException('Party not found');
    }

    const updated = await this.prisma.party.update({
      where: { id: partyId },
      data: {
        type: dto.type ?? existing.type,
        name: dto.name ?? existing.name,
        nameAr: dto.nameAr ?? existing.nameAr,
        phone: dto.phone ?? existing.phone,
        email: dto.email ?? existing.email,
        taxNumber: dto.taxNumber ?? existing.taxNumber,
        commercialReg: dto.commercialReg ?? existing.commercialReg,
        creditLimit: dto.creditLimit !== undefined ? new Prisma.Decimal(dto.creditLimit) : existing.creditLimit,
        address: dto.address ?? existing.address,
        notes: dto.notes ?? existing.notes,
        isActive: dto.isActive ?? existing.isActive,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'PARTY_UPDATED',
        entityType: 'Party',
        entityId: partyId,
        oldValues: existing as any,
        newValues: dto as any,
      },
    });

    return updated;
  }

  async deleteParty(tenantId: string, partyId: string, userId: string) {
    const existing = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: {
        _count: {
          select: {
            salesInvoices: true,
            purchaseInvoices: true,
            treasuryVouchers: true,
            quotations: true,
          },
        },
      },
    });

    if (!existing || existing.tenantId !== tenantId) {
      throw new NotFoundException('Party not found');
    }

    const hasTransactions =
      existing._count.salesInvoices > 0 ||
      existing._count.purchaseInvoices > 0 ||
      existing._count.treasuryVouchers > 0 ||
      existing._count.quotations > 0;

    if (hasTransactions) {
      await this.prisma.party.update({
        where: { id: partyId },
        data: { isActive: false },
      });
      return { success: true, archived: true, message: 'Party has transactions; archived instead of deleted' };
    }

    await this.prisma.party.delete({ where: { id: partyId } });
    return { success: true, deleted: true };
  }

  async getStatementOfAccount(tenantId: string, partyId: string, fromDate?: Date, toDate?: Date) {
    const party = await this.prisma.party.findUnique({ where: { id: partyId } });
    if (!party || party.tenantId !== tenantId) throw new NotFoundException('Party not found');

    const sales = await this.prisma.salesInvoice.findMany({
      where: {
        tenantId,
        partyId,
        status: 'POSTED',
        ...(fromDate && { issueDate: { gte: fromDate } }),
        ...(toDate && { issueDate: { lte: toDate } }),
      },
      orderBy: { issueDate: 'asc' },
    });

    const purchases = await this.prisma.purchaseInvoice.findMany({
      where: {
        tenantId,
        partyId,
        status: 'POSTED',
        ...(fromDate && { issueDate: { gte: fromDate } }),
        ...(toDate && { issueDate: { lte: toDate } }),
      },
      orderBy: { issueDate: 'asc' },
    });

    const vouchers = await this.prisma.treasuryVoucher.findMany({
      where: {
        tenantId,
        partyId,
        status: 'POSTED',
        ...(fromDate && { issueDate: { gte: fromDate } }),
        ...(toDate && { issueDate: { lte: toDate } }),
      },
      orderBy: { issueDate: 'asc' },
    });

    const salesReturns = await this.prisma.salesReturn.findMany({
      where: {
        tenantId,
        partyId,
        status: 'POSTED',
        ...(fromDate && { issueDate: { gte: fromDate } }),
        ...(toDate && { issueDate: { lte: toDate } }),
      },
      orderBy: { issueDate: 'asc' },
    });

    // Build timeline ledger
    const transactions: any[] = [];

    for (const s of sales) {
      transactions.push({
        date: s.issueDate,
        docType: 'SALES_INVOICE',
        docNumber: s.invoiceNumber,
        debit: Number(s.grandTotal), // Customer owes us more
        credit: 0,
        notes: s.notes,
      });
    }

    for (const sr of salesReturns) {
      transactions.push({
        date: sr.issueDate,
        docType: 'SALES_RETURN',
        docNumber: sr.returnNumber,
        debit: 0,
        credit: Number(sr.grandTotal), // Customer balance decreases
        notes: sr.notes,
      });
    }

    for (const v of vouchers) {
      if (v.type === 'RECEIPT') {
        transactions.push({
          date: v.issueDate,
          docType: 'RECEIPT_VOUCHER',
          docNumber: v.voucherNumber,
          debit: 0,
          credit: Number(v.amount), // Customer paid us
          notes: v.notes,
        });
      } else {
        transactions.push({
          date: v.issueDate,
          docType: 'PAYMENT_VOUCHER',
          docNumber: v.voucherNumber,
          debit: Number(v.amount), // We paid supplier
          credit: 0,
          notes: v.notes,
        });
      }
    }

    for (const p of purchases) {
      transactions.push({
        date: p.issueDate,
        docType: 'PURCHASE_BILL',
        docNumber: p.billNumber,
        debit: 0,
        credit: Number(p.grandTotal), // We owe supplier more
        notes: p.notes,
      });
    }

    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningReceivable = Number(party.openingReceivable);
    const statementRows = transactions.map((t) => {
      runningReceivable += t.debit - t.credit;
      return {
        ...t,
        runningBalance: runningReceivable,
      };
    });

    return {
      party: {
        id: party.id,
        code: party.code,
        name: party.name,
        nameAr: party.nameAr,
        taxNumber: party.taxNumber,
        openingReceivable: party.openingReceivable,
        currentReceivable: party.receivableBalance,
        currentPayable: party.payableBalance,
      },
      statement: statementRows,
    };
  }

  // --- Contacts ---

  async addContact(tenantId: string, partyId: string, dto: CreateContactDto) {
    const party = await this.prisma.party.findUnique({ where: { id: partyId } });
    if (!party || party.tenantId !== tenantId) throw new NotFoundException('Party not found');

    return this.prisma.partyContact.create({
      data: {
        tenantId,
        partyId,
        name: dto.name,
        jobTitle: dto.jobTitle,
        phone: dto.phone,
        email: dto.email,
        isPrimary: dto.isPrimary ?? false,
      },
    });
  }

  async deleteContact(tenantId: string, partyId: string, contactId: string) {
    const contact = await this.prisma.partyContact.findUnique({ where: { id: contactId } });
    if (!contact || contact.partyId !== partyId || contact.tenantId !== tenantId) {
      throw new NotFoundException('Contact not found');
    }

    await this.prisma.partyContact.delete({ where: { id: contactId } });
    return { success: true };
  }
}
