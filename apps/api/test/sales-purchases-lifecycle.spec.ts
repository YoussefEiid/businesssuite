import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EntitlementsService } from '../src/entitlements/entitlements.service';
import { StockMovementService } from '../src/inventory/stock-movement.service';
import { InventoryService } from '../src/inventory/inventory.service';
import { SalesService } from '../src/sales/sales.service';
import { PurchasesService } from '../src/purchases/purchases.service';
import { TreasuryService } from '../src/treasury/treasury.service';
import { PartiesService } from '../src/parties/parties.service';
import { ItemType, PartyType, VoucherType, DocumentStatus, PaymentStatus } from '@business-suite/shared';

describe('Commercial Operations Lifecycle: Purchases -> Sales -> Treasury -> Returns', () => {
  let prisma: PrismaService;
  let inventoryService: InventoryService;
  let salesService: SalesService;
  let purchasesService: PurchasesService;
  let treasuryService: TreasuryService;
  let partiesService: PartiesService;

  let tenantId: string;
  let userId: string;
  let warehouseId: string;
  let itemId: string;
  let customerId: string;
  let supplierId: string;
  let cashAccountId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', 'apps/api/.env'] }),
        PrismaModule,
      ],
      providers: [
        EntitlementsService,
        StockMovementService,
        InventoryService,
        SalesService,
        PurchasesService,
        TreasuryService,
        PartiesService,
      ],
    }).compile();

    prisma = moduleRef.get<PrismaService>(PrismaService);
    inventoryService = moduleRef.get<InventoryService>(InventoryService);
    salesService = moduleRef.get<SalesService>(SalesService);
    purchasesService = moduleRef.get<PurchasesService>(PurchasesService);
    treasuryService = moduleRef.get<TreasuryService>(TreasuryService);
    partiesService = moduleRef.get<PartiesService>(PartiesService);

    // Setup isolated test tenant
    const plan = await prisma.plan.findUnique({ where: { code: 'BUSINESS' } });
    const user = await prisma.user.create({
      data: {
        email: `tester-${Date.now()}@test.com`,
        name: 'Test Operator',
        passwordHash: 'dummy',
      },
    });
    userId = user.id;

    const tenant = await prisma.tenant.create({
      data: {
        name: 'Lifecycle Test Corp',
        slug: `lifecycle-${Date.now()}`,
        subscription: {
          create: {
            planId: plan!.id,
            status: 'ACTIVE',
            startDate: new Date(),
            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          },
        },
      },
    });
    tenantId = tenant.id;

    // Create Warehouse
    const wh = await inventoryService.createWarehouse(
      tenantId,
      {
        code: 'WH-MAIN',
        name: 'Central Warehouse',
        nameAr: 'المستودع المركزي',
      },
      userId,
    );
    warehouseId = wh.id;

    // Create Cash Account
    const cashAcc = await treasuryService.createAccount(
      tenantId,
      {
        type: 'CASH' as any,
        code: 'CASH-MAIN',
        name: 'Main Cash',
        nameAr: 'الخزينة الرئيسية',
        openingBalance: 10000,
      },
      userId,
    );
    cashAccountId = cashAcc.id;

    // Create Customer
    const customer = await partiesService.createParty(
      tenantId,
      {
        type: PartyType.CUSTOMER,
        code: 'CUST-001',
        name: 'Smart Solutions Co.',
        nameAr: 'شركة الحلول الذكية',
        creditLimit: 50000,
      },
      userId,
    );
    customerId = customer.id;

    // Create Supplier
    const supplier = await partiesService.createParty(
      tenantId,
      {
        type: PartyType.SUPPLIER,
        code: 'SUPP-001',
        name: 'Global Tech Distributors',
        nameAr: 'موزعو التقنية العالمية',
      },
      userId,
    );
    supplierId = supplier.id;

    // Create Stock Item with 0 stock
    const item = await inventoryService.createItem(
      tenantId,
      {
        code: 'PROD-4K-MONITOR',
        name: '4K UltraHD Monitor 27"',
        nameAr: 'شاشة 27 بوصة فائقة الدقة',
        type: ItemType.STOCK,
        purchasePrice: 800,
        sellingPrice: 1200,
        taxRate: 15,
      },
      userId,
    );
    itemId = item.id;
  });

  afterAll(async () => {
    if (tenantId) {
      await prisma.voucherAllocation.deleteMany({ where: { tenantId } });
      await prisma.treasuryVoucher.deleteMany({ where: { tenantId } });
      await prisma.salesReturnItem.deleteMany({ where: { tenantId } });
      await prisma.salesReturn.deleteMany({ where: { tenantId } });
      await prisma.purchaseReturnItem.deleteMany({ where: { tenantId } });
      await prisma.purchaseReturn.deleteMany({ where: { tenantId } });
      await prisma.salesInvoiceItem.deleteMany({ where: { tenantId } });
      await prisma.salesInvoice.deleteMany({ where: { tenantId } });
      await prisma.purchaseInvoiceItem.deleteMany({ where: { tenantId } });
      await prisma.purchaseInvoice.deleteMany({ where: { tenantId } });
      await prisma.stockMovement.deleteMany({ where: { tenantId } });
      await prisma.warehouseStock.deleteMany({ where: { tenantId } });
      await prisma.tenant.delete({ where: { id: tenantId } });
    }
    if (userId) {
      await prisma.user.delete({ where: { id: userId } });
    }
    await prisma.$disconnect();
  });

  it('1. Should post Purchase Bill: increments stock & calculates Moving Weighted Average Cost (WAC)', async () => {
    // Buy 10 units @ 800 SAR each (excl. 15% tax)
    const bill = await purchasesService.createInvoice(
      tenantId,
      {
        partyId: supplierId,
        warehouseId,
        postImmediately: true,
        items: [
          {
            itemId,
            quantity: 10,
            unitPrice: 800,
            taxRate: 15,
          },
        ],
      },
      userId,
    );

    expect(bill.status).toBe(DocumentStatus.POSTED);
    expect(Number(bill.subtotal)).toBe(8000);
    expect(Number(bill.taxTotal)).toBe(1200); // 15% of 8000
    expect(Number(bill.grandTotal)).toBe(9200);

    // Verify Stock level in warehouse
    const stock = await prisma.warehouseStock.findUnique({
      where: {
        tenantId_warehouseId_itemId: {
          tenantId,
          warehouseId,
          itemId,
        },
      },
    });

    expect(Number(stock!.quantity)).toBe(10);
    expect(Number(stock!.averageCost)).toBe(800);

    // Verify Supplier payable balance increased
    const supp = await partiesService.getParty(tenantId, supplierId);
    expect(Number(supp.payableBalance)).toBe(9200);
  });

  it('2. Should recalculate WAC correctly upon second purchase with different price', async () => {
    // Current stock: 10 units @ 800 = 8000 SAR
    // Buy 10 more units @ 1000 = 10000 SAR
    // New WAC = (8000 + 10000) / 20 = 18000 / 20 = 900 SAR
    await purchasesService.createInvoice(
      tenantId,
      {
        partyId: supplierId,
        warehouseId,
        postImmediately: true,
        items: [
          {
            itemId,
            quantity: 10,
            unitPrice: 1000,
            taxRate: 15,
          },
        ],
      },
      userId,
    );

    const stock = await prisma.warehouseStock.findUnique({
      where: {
        tenantId_warehouseId_itemId: {
          tenantId,
          warehouseId,
          itemId,
        },
      },
    });

    expect(Number(stock!.quantity)).toBe(20);
    expect(Number(stock!.averageCost)).toBe(900);
  });

  it('3. Should post Sales Invoice: decrements stock & freezes historical COGS snapshot', async () => {
    // Sell 5 units @ 1200 SAR each (Current WAC is 900 SAR)
    const invoice = await salesService.createInvoice(
      tenantId,
      {
        partyId: customerId,
        warehouseId,
        postImmediately: true,
        items: [
          {
            itemId,
            quantity: 5,
            unitPrice: 1200,
            taxRate: 15,
          },
        ],
      },
      userId,
    );

    expect(invoice.status).toBe(DocumentStatus.POSTED);
    expect(Number(invoice.subtotal)).toBe(6000);
    expect(Number(invoice.taxTotal)).toBe(900);
    expect(Number(invoice.grandTotal)).toBe(6900);
    expect(Number(invoice.costTotal)).toBe(4500); // 5 * 900 WAC

    // Verify remaining stock
    const stock = await prisma.warehouseStock.findUnique({
      where: {
        tenantId_warehouseId_itemId: {
          tenantId,
          warehouseId,
          itemId,
        },
      },
    });
    expect(Number(stock!.quantity)).toBe(15);
    expect(Number(stock!.averageCost)).toBe(900); // WAC unchanged on sale

    // Verify Customer receivable balance increased
    const cust = await partiesService.getParty(tenantId, customerId);
    expect(Number(cust.receivableBalance)).toBe(6900);
  });

  it('4. Negative Stock Prevention: Attempting to sell more than available quantity must be rejected', async () => {
    // We currently have 15 in stock. Trying to sell 16 must throw INSUFFICIENT_STOCK
    await expect(
      salesService.createInvoice(
        tenantId,
        {
          partyId: customerId,
          warehouseId,
          postImmediately: true,
          items: [
            {
              itemId,
              quantity: 16,
              unitPrice: 1200,
            },
          ],
        },
        userId,
      ),
    ).rejects.toThrow();

    // Verify stock was NOT modified
    const stock = await prisma.warehouseStock.findUnique({
      where: {
        tenantId_warehouseId_itemId: {
          tenantId,
          warehouseId,
          itemId,
        },
      },
    });
    expect(Number(stock!.quantity)).toBe(15);
  });

  it('5. Should issue Receipt Voucher with invoice allocation and mark invoice PAID', async () => {
    const invoices = await salesService.listInvoices(tenantId, { partyId: customerId });
    const targetInvoice = invoices[0];

    const voucher = await treasuryService.createVoucher(
      tenantId,
      {
        type: VoucherType.RECEIPT,
        accountId: cashAccountId,
        partyId: customerId,
        amount: Number(targetInvoice.grandTotal),
        allocations: [
          {
            salesInvoiceId: targetInvoice.id,
            allocatedAmount: Number(targetInvoice.grandTotal),
          },
        ],
      },
      userId,
    );

    expect(Number(voucher.amount)).toBe(6900);
    expect(Number(voucher.allocatedAmount)).toBe(6900);
    expect(Number(voucher.unallocatedAmount)).toBe(0);

    // Verify invoice is marked PAID
    const updatedInvoice = await salesService.getInvoice(tenantId, targetInvoice.id);
    expect(updatedInvoice.paymentStatus).toBe(PaymentStatus.PAID);
    expect(Number(updatedInvoice.remainingAmount)).toBe(0);

    // Verify Customer receivable balance reduced to 0
    const cust = await partiesService.getParty(tenantId, customerId);
    expect(Number(cust.receivableBalance)).toBe(0);
  });

  it('6. Should process Sales Return: validates max quantity and restores stock at original COGS', async () => {
    const invoices = await salesService.listInvoices(tenantId, { partyId: customerId });
    const originalInvoice = invoices[0];

    // Customer returns 2 units (out of 5 bought)
    const salesReturn = await salesService.createSalesReturn(
      tenantId,
      {
        salesInvoiceId: originalInvoice.id,
        items: [
          {
            itemId,
            quantity: 2,
          },
        ],
      },
      userId,
    );

    expect(salesReturn.status).toBe(DocumentStatus.POSTED);
    expect(Number(salesReturn.subtotal)).toBe(2400); // 2 * 1200
    expect(Number(salesReturn.taxTotal)).toBe(360); // 15%
    expect(Number(salesReturn.grandTotal)).toBe(2760);
    expect(Number(salesReturn.costTotal)).toBe(1800); // 2 * 900 original COGS

    // Verify stock increased from 15 to 17
    const stock = await prisma.warehouseStock.findUnique({
      where: {
        tenantId_warehouseId_itemId: {
          tenantId,
          warehouseId,
          itemId,
        },
      },
    });
    expect(Number(stock!.quantity)).toBe(17);

    // Trying to return 4 more units (when only 3 remain returnable) must be rejected
    await expect(
      salesService.createSalesReturn(
        tenantId,
        {
          salesInvoiceId: originalInvoice.id,
          items: [
            {
              itemId,
              quantity: 4,
            },
          ],
        },
        userId,
      ),
    ).rejects.toThrow();
  });
});
