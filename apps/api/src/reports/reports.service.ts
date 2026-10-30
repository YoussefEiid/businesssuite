import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { round } from '@business-suite/shared';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private prisma: PrismaService,
    private entitlementsService: EntitlementsService,
  ) {}

  async getDashboardSummary(tenantId: string, canViewCost: boolean) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Sales this month
    const salesMonth = await this.prisma.salesInvoice.aggregate({
      where: {
        tenantId,
        status: 'POSTED',
        issueDate: { gte: startOfMonth },
      },
      _sum: {
        grandTotal: true,
        costTotal: true,
      },
      _count: true,
    });

    // Purchases this month
    const purchasesMonth = await this.prisma.purchaseInvoice.aggregate({
      where: {
        tenantId,
        status: 'POSTED',
        issueDate: { gte: startOfMonth },
      },
      _sum: {
        grandTotal: true,
      },
      _count: true,
    });

    // Total outstanding receivables from customers
    const receivablesAgg = await this.prisma.party.aggregate({
      where: { tenantId, receivableBalance: { gt: 0 } },
      _sum: { receivableBalance: true },
    });

    // Total outstanding payables to suppliers
    const payablesAgg = await this.prisma.party.aggregate({
      where: { tenantId, payableBalance: { gt: 0 } },
      _sum: { payableBalance: true },
    });

    // Total cash & bank balance
    const treasuryAgg = await this.prisma.treasuryAccount.aggregate({
      where: { tenantId },
      _sum: { currentBalance: true },
    });

    // Total inventory valuation
    const stockItems = await this.prisma.warehouseStock.findMany({
      where: { tenantId },
      select: { quantity: true, averageCost: true },
    });

    let inventoryValuation = 0;
    for (const s of stockItems) {
      inventoryValuation += Number(s.quantity) * Number(s.averageCost);
    }

    const salesTotal = Number(salesMonth._sum.grandTotal || 0);
    const cogsTotal = Number(salesMonth._sum.costTotal || 0);
    const grossProfit = round(salesTotal - cogsTotal, 4);

    return {
      monthlySalesCount: salesMonth._count,
      monthlySalesTotal: salesTotal,
      monthlyPurchasesTotal: Number(purchasesMonth._sum.grandTotal || 0),
      totalReceivables: Number(receivablesAgg._sum.receivableBalance || 0),
      totalPayables: Number(payablesAgg._sum.payableBalance || 0),
      treasuryBalance: Number(treasuryAgg._sum.currentBalance || 0),
      inventoryValuation: canViewCost ? round(inventoryValuation, 4) : null,
      monthlyGrossProfit: canViewCost ? grossProfit : null,
    };
  }

  async getSalesReport(tenantId: string, fromDate?: Date, toDate?: Date) {
    const where: Prisma.SalesInvoiceWhereInput = {
      tenantId,
      status: 'POSTED',
      ...(fromDate && { issueDate: { gte: fromDate } }),
      ...(toDate && { issueDate: { lte: toDate } }),
    };

    const invoices = await this.prisma.salesInvoice.findMany({
      where,
      include: {
        party: { select: { id: true, name: true, nameAr: true, code: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
      orderBy: { issueDate: 'desc' },
    });

    const totalRevenue = invoices.reduce((acc, inv) => acc + Number(inv.grandTotal), 0);
    const totalTax = invoices.reduce((acc, inv) => acc + Number(inv.taxTotal), 0);
    const totalPaid = invoices.reduce((acc, inv) => acc + Number(inv.paidAmount), 0);
    const totalRemaining = invoices.reduce((acc, inv) => acc + Number(inv.remainingAmount), 0);

    return {
      totalCount: invoices.length,
      totalRevenue: round(totalRevenue, 4),
      totalTax: round(totalTax, 4),
      totalPaid: round(totalPaid, 4),
      totalRemaining: round(totalRemaining, 4),
      invoices,
    };
  }

  async getStockValuationReport(tenantId: string, canViewCost: boolean) {
    const stocks = await this.prisma.warehouseStock.findMany({
      where: { tenantId },
      include: {
        item: { select: { id: true, code: true, name: true, nameAr: true, minStockLevel: true } },
        warehouse: { select: { id: true, code: true, name: true, nameAr: true } },
      },
      orderBy: { item: { code: 'asc' } },
    });

    let totalValuation = 0;

    const rows = stocks.map((s) => {
      const qty = Number(s.quantity);
      const avgCost = Number(s.averageCost);
      const lineVal = qty * avgCost;
      totalValuation += lineVal;

      return {
        itemId: s.itemId,
        itemCode: s.item.code,
        itemName: s.item.name,
        itemNameAr: s.item.nameAr,
        warehouseCode: s.warehouse.code,
        warehouseName: s.warehouse.name,
        quantity: qty,
        unitAverageCost: canViewCost ? avgCost : null,
        totalValuation: canViewCost ? round(lineVal, 4) : null,
      };
    });

    return {
      totalItemsCount: rows.length,
      totalValuation: canViewCost ? round(totalValuation, 4) : null,
      stocks: rows,
    };
  }

  async getCustomerReceivablesReport(tenantId: string) {
    const customers = await this.prisma.party.findMany({
      where: {
        tenantId,
        receivableBalance: { gt: 0 },
      },
      orderBy: { receivableBalance: 'desc' },
      select: {
        id: true,
        code: true,
        name: true,
        nameAr: true,
        phone: true,
        creditLimit: true,
        receivableBalance: true,
      },
    });

    const totalReceivables = customers.reduce((acc, c) => acc + Number(c.receivableBalance), 0);

    return {
      totalCount: customers.length,
      totalReceivables: round(totalReceivables, 4),
      customers,
    };
  }

  async getSupplierPayablesReport(tenantId: string) {
    const suppliers = await this.prisma.party.findMany({
      where: {
        tenantId,
        payableBalance: { gt: 0 },
      },
      orderBy: { payableBalance: 'desc' },
      select: {
        id: true,
        code: true,
        name: true,
        nameAr: true,
        phone: true,
        payableBalance: true,
      },
    });

    const totalPayables = suppliers.reduce((acc, s) => acc + Number(s.payableBalance), 0);

    return {
      totalCount: suppliers.length,
      totalPayables: round(totalPayables, 4),
      suppliers,
    };
  }
}
