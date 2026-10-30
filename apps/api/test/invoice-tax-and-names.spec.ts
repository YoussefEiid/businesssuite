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
import { DocumentStatus, PaymentStatus } from '@business-suite/shared';

describe('Invoice Fixes: 0% Default Tax & Real Item Name Resolution', () => {
  let prisma: PrismaService;
  let inventoryService: InventoryService;
  let salesService: SalesService;
  let purchasesService: PurchasesService;
  let treasuryService: TreasuryService;
  let partiesService: PartiesService;

  let tenantId: string;
  let userId: string;
  let warehouseId: string;
  let itemA: any;
  let itemB: any;
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

    // Create unique tenant and user
    const plan = await prisma.plan.findUnique({ where: { code: 'BUSINESS' } });
    const user = await prisma.user.create({
      data: {
        email: `tax-name-test-${Date.now()}@test.com`,
        name: 'Tax Auditor',
        passwordHash: 'dummy',
      },
    });
    userId = user.id;

    const tenant = await prisma.tenant.create({
      data: {
        name: 'Tax & Invoice Test Org',
        slug: `tax-audit-${Date.now()}`,
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

    const wh = await inventoryService.createWarehouse(
      tenantId,
      {
        code: 'WH-TAX',
        name: 'Tax Test Warehouse',
        nameAr: 'مستودع اختبار الضريبة',
      },
      userId,
    );
    warehouseId = wh.id;

    const cashAcc = await treasuryService.createAccount(
      tenantId,
      {
        type: 'CASH' as any,
        code: 'CASH-TAX',
        name: 'Tax Test Cash Box',
        nameAr: 'خزينة اختبار الفواتير',
      },
      userId,
    );
    cashAccountId = cashAcc.id;

    const cust = await partiesService.createParty(
      tenantId,
      {
        type: 'CUSTOMER' as any,
        code: 'CUST-TAX',
        name: 'Al-Noor Electronics',
        nameAr: 'شركة النور للإلكترونيات',
      },
      userId,
    );
    customerId = cust.id;

    const supp = await partiesService.createParty(
      tenantId,
      {
        type: 'SUPPLIER' as any,
        code: 'SUPP-TAX',
        name: 'Global Supply Co',
        nameAr: 'شركة التوريد العالمية',
      },
      userId,
    );
    supplierId = supp.id;

    // Create item A (no tax specified -> should default to 0)
    itemA = await inventoryService.createItem(
      tenantId,
      {
        code: 'PROD-A',
        name: 'Wireless Bluetooth Mouse',
        nameAr: 'ماوس لاسلكي بلوتوث',
        type: 'STOCK' as any,
        purchasePrice: 50,
        sellingPrice: 100,
        initialQuantity: 100,
        initialWarehouseId: warehouseId,
      },
      userId,
    );

    // Create item B
    itemB = await inventoryService.createItem(
      tenantId,
      {
        code: 'PROD-B',
        name: 'Mechanical Gaming Keyboard',
        nameAr: 'لوحة مفاتيح ميكانيكية',
        type: 'STOCK' as any,
        purchasePrice: 150,
        sellingPrice: 300,
        initialQuantity: 50,
        initialWarehouseId: warehouseId,
      },
      userId,
    );
  }, 30000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('1. Default 0% Tax Verification', () => {
    it('Item creation should default taxRate to 0 if unspecified', () => {
      expect(Number(itemA.taxRate)).toBe(0);
      expect(Number(itemB.taxRate)).toBe(0);
    });

    it('Sales Invoice with unspecified taxRate must have taxRate = 0, taxTotal = 0, and total = subtotal - discount', async () => {
      const invoice = await salesService.createInvoice(
        tenantId,
        {
          partyId: customerId,
          warehouseId,
          postImmediately: true,
          items: [
            {
              itemId: itemA.id,
              quantity: 2,
              unitPrice: 100,
              discountAmount: 10,
              // Note: no taxRate specified
            },
          ],
        },
        userId,
      );

      expect(invoice.status).toBe(DocumentStatus.POSTED);
      expect(Number(invoice.subtotal)).toBe(200);
      expect(Number(invoice.discountTotal)).toBe(10);
      expect(Number(invoice.taxTotal)).toBe(0);
      expect(Number(invoice.grandTotal)).toBe(190); // 200 - 10 + 0
      expect(invoice.items[0]).toBeDefined();
      expect(Number(invoice.items[0].taxRate)).toBe(0);
      expect(Number(invoice.items[0].taxAmount)).toBe(0);
      expect(Number(invoice.items[0].totalAmount)).toBe(190);
    });

    it('Purchase Invoice with unspecified taxRate must have taxRate = 0 and taxTotal = 0', async () => {
      const bill = await purchasesService.createInvoice(
        tenantId,
        {
          partyId: supplierId,
          warehouseId,
          postImmediately: true,
          items: [
            {
              itemId: itemA.id,
              quantity: 10,
              unitPrice: 50,
              // Note: no taxRate specified
            },
          ],
        },
        userId,
      );

      expect(bill.status).toBe(DocumentStatus.POSTED);
      expect(Number(bill.subtotal)).toBe(500);
      expect(Number(bill.taxTotal)).toBe(0);
      expect(Number(bill.grandTotal)).toBe(500);
      expect(Number(bill.items[0].taxRate)).toBe(0);
      expect(Number(bill.items[0].taxAmount)).toBe(0);
    });
  });

  describe('2. Explicit Tax Rate Verification', () => {
    it('Sales Invoice with explicitly specified 15% tax should calculate tax correctly', async () => {
      const invoice = await salesService.createInvoice(
        tenantId,
        {
          partyId: customerId,
          warehouseId,
          postImmediately: true,
          items: [
            {
              itemId: itemA.id,
              quantity: 4,
              unitPrice: 100,
              discountAmount: 0,
              taxRate: 15,
            },
          ],
        },
        userId,
      );

      expect(Number(invoice.subtotal)).toBe(400);
      expect(Number(invoice.taxTotal)).toBe(60); // 15% of 400
      expect(Number(invoice.grandTotal)).toBe(460);
      expect(Number(invoice.items[0].taxRate)).toBe(15);
      expect(Number(invoice.items[0].taxAmount)).toBe(60);
    });
  });

  describe('3. Real Item Name Resolution on Invoices & Returns', () => {
    it('Sales Invoice response must include item relation with real product names (never "صنف")', async () => {
      const invoice = await salesService.createInvoice(
        tenantId,
        {
          partyId: customerId,
          warehouseId,
          postImmediately: true,
          items: [
            {
              itemId: itemA.id,
              quantity: 1,
              unitPrice: 100,
            },
            {
              itemId: itemB.id,
              quantity: 1,
              unitPrice: 300,
            },
          ],
        },
        userId,
      );

      expect(invoice.items).toHaveLength(2);

      const lineA = invoice.items.find((i: any) => i.itemId === itemA.id);
      expect(lineA).toBeDefined();
      expect(lineA!.item).toBeDefined();
      expect(lineA!.item.name).toBe('Wireless Bluetooth Mouse');
      expect(lineA!.item.nameAr).toBe('ماوس لاسلكي بلوتوث');
      expect(lineA!.item.code).toBe('PROD-A');

      const lineB = invoice.items.find((i: any) => i.itemId === itemB.id);
      expect(lineB).toBeDefined();
      expect(lineB!.item).toBeDefined();
      expect(lineB!.item.name).toBe('Mechanical Gaming Keyboard');
      expect(lineB!.item.nameAr).toBe('لوحة مفاتيح ميكانيكية');
      expect(lineB!.item.code).toBe('PROD-B');
    });

    it('Cash sale invoice must return populated items and paymentStatus PAID', async () => {
      const cashInvoice = await salesService.createInvoice(
        tenantId,
        {
          partyId: customerId,
          warehouseId,
          postImmediately: true,
          isCashSale: true,
          treasuryAccountId: cashAccountId,
          items: [
            {
              itemId: itemA.id,
              quantity: 1,
              unitPrice: 100,
            },
          ],
        },
        userId,
      );

      expect(cashInvoice.paymentStatus).toBe(PaymentStatus.PAID);
      expect(cashInvoice.items[0].item).toBeDefined();
      expect(cashInvoice.items[0].item.name).toBe('Wireless Bluetooth Mouse');
    });

    it('Sales Return must include item relation with real product names', async () => {
      // 1. Create a posted invoice
      const invoice = await salesService.createInvoice(
        tenantId,
        {
          partyId: customerId,
          warehouseId,
          postImmediately: true,
          items: [
            {
              itemId: itemA.id,
              quantity: 5,
              unitPrice: 100,
            },
          ],
        },
        userId,
      );

      // 2. Create sales return
      const ret = await salesService.createSalesReturn(
        tenantId,
        {
          salesInvoiceId: invoice.id,
          items: [
            {
              itemId: itemA.id,
              quantity: 2,
            },
          ],
        },
        userId,
      );

      expect(ret.status).toBe(DocumentStatus.POSTED);
      expect(ret.items).toHaveLength(1);
      expect(ret.items[0].item).toBeDefined();
      expect(ret.items[0].item.name).toBe('Wireless Bluetooth Mouse');
      expect(ret.items[0].item.nameAr).toBe('ماوس لاسلكي بلوتوث');
      expect(Number(ret.items[0].taxRate)).toBe(0);
      expect(Number(ret.taxTotal)).toBe(0);
      expect(Number(ret.grandTotal)).toBe(200);

      // 3. List sales returns
      const returnsList = await salesService.listSalesReturns(tenantId);
      const foundRet = returnsList.find((r: any) => r.id === ret.id);
      expect(foundRet).toBeDefined();
      expect(foundRet!.items[0].item).toBeDefined();
      expect(foundRet!.items[0].item.name).toBe('Wireless Bluetooth Mouse');
    });

    it('Purchase Invoice response must include item relation with real product names', async () => {
      const bill = await purchasesService.createInvoice(
        tenantId,
        {
          partyId: supplierId,
          warehouseId,
          postImmediately: true,
          items: [
            {
              itemId: itemB.id,
              quantity: 2,
              unitPrice: 150,
            },
          ],
        },
        userId,
      );

      expect(bill.items).toHaveLength(1);
      expect(bill.items[0].item).toBeDefined();
      expect(bill.items[0].item.name).toBe('Mechanical Gaming Keyboard');
      expect(bill.items[0].item.nameAr).toBe('لوحة مفاتيح ميكانيكية');
      expect(bill.items[0].item.code).toBe('PROD-B');
    });
  });

  describe('4. POS Checkout Tax Behavior (0% default, explicit 15%, null/missing handling)', () => {
    let item500: any;

    beforeAll(async () => {
      // Create a 500 SAR product like SKU-000 with default 0% tax
      item500 = await inventoryService.createItem(
        tenantId,
        {
          code: `POS-500-${Date.now().toString().slice(-4)}`,
          name: 'NGK Spark Plugs Set',
          nameAr: 'طقم بوجيهات NGK 16',
          type: 'STOCK' as any,
          purchasePrice: 250,
          sellingPrice: 500,
          initialQuantity: 20,
          initialWarehouseId: warehouseId,
        },
        userId,
      );
    });

    it('Item created without taxRate must default to 0 in database', () => {
      expect(Number(item500.taxRate)).toBe(0);
    });

    it('POS Checkout with 0% tax: 500 SAR item -> Subtotal: 500, Tax: 0, Grand Total: 500', async () => {
      const posPayload = {
        warehouseId,
        postImmediately: true,
        isCashSale: true,
        treasuryAccountId: cashAccountId,
        items: [
          {
            itemId: item500.id,
            quantity: 1,
            unitPrice: 500,
            discountPercent: 0,
            taxRate: Number(item500.taxRate ?? 0), // Evaluates to 0
          },
        ],
        notes: 'POS Cashier Checkout (CASH)',
      };

      const invoice = await salesService.createInvoice(tenantId, posPayload, userId);

      expect(invoice.status).toBe(DocumentStatus.POSTED);
      expect(Number(invoice.subtotal)).toBe(500);
      expect(Number(invoice.taxTotal)).toBe(0);
      expect(Number(invoice.grandTotal)).toBe(500);
      expect(invoice.items).toHaveLength(1);
      expect(Number(invoice.items[0].taxRate)).toBe(0);
      expect(Number(invoice.items[0].taxAmount)).toBe(0);
      expect(Number(invoice.items[0].totalAmount)).toBe(500);
    });

    it('POS Checkout with explicit 15% tax: 500 SAR item -> Subtotal: 500, Tax: 75, Grand Total: 575', async () => {
      const posPayload = {
        warehouseId,
        postImmediately: true,
        isCashSale: true,
        treasuryAccountId: cashAccountId,
        items: [
          {
            itemId: item500.id,
            quantity: 1,
            unitPrice: 500,
            discountPercent: 0,
            taxRate: 15, // Explicitly set to 15%
          },
        ],
        notes: 'POS Cashier Checkout (CARD)',
      };

      const invoice = await salesService.createInvoice(tenantId, posPayload, userId);

      expect(invoice.status).toBe(DocumentStatus.POSTED);
      expect(Number(invoice.subtotal)).toBe(500);
      expect(Number(invoice.taxTotal)).toBe(75); // 15% of 500 = 75 SAR
      expect(Number(invoice.grandTotal)).toBe(575); // 500 + 75 = 575 SAR
      expect(invoice.items).toHaveLength(1);
      expect(Number(invoice.items[0].taxRate)).toBe(15);
      expect(Number(invoice.items[0].taxAmount)).toBe(75);
      expect(Number(invoice.items[0].totalAmount)).toBe(575);
    });

    it('POS Checkout with missing/undefined taxRate must default to 0% tax', async () => {
      const posPayload = {
        warehouseId,
        postImmediately: true,
        isCashSale: true,
        treasuryAccountId: cashAccountId,
        items: [
          {
            itemId: item500.id,
            quantity: 2,
            unitPrice: 500,
            // taxRate omitted
          },
        ],
        notes: 'POS Cashier Checkout (Missing taxRate)',
      };

      const invoice = await salesService.createInvoice(tenantId, posPayload, userId);

      expect(invoice.status).toBe(DocumentStatus.POSTED);
      expect(Number(invoice.subtotal)).toBe(1000);
      expect(Number(invoice.taxTotal)).toBe(0);
      expect(Number(invoice.grandTotal)).toBe(1000);
      expect(Number(invoice.items[0].taxRate)).toBe(0);
      expect(Number(invoice.items[0].taxAmount)).toBe(0);
    });
  });
});
