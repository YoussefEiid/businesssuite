import { PrismaClient, Prisma, ItemType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Demo Company (Al-Amal Trading Est.) for manual UI demonstration...');

  const starterPlan = await prisma.plan.findUnique({ where: { code: 'STARTER' } });
  if (!starterPlan) {
    throw new Error('Default system plans must be seeded first before creating demo data.');
  }

  const salt = await bcrypt.genSalt(10);
  const tenantAPassword = await bcrypt.hash('Amal123456!', salt);

  const tenantA = await prisma.tenant.upsert({
    where: { slug: 'alamal-trading' },
    update: {},
    create: {
      name: 'Al-Amal Trading Est.',
      slug: 'alamal-trading',
      taxNumber: '300999888100003',
      commercialReg: '1010998877',
      phone: '+966114445555',
      email: 'info@alamal.com',
      currencyCode: 'SAR',
      settings: {
        create: {
          companyName: 'Al-Amal Trading Est.',
          companyNameAr: 'مؤسسة الأمل للتجارة',
          taxNumber: '300999888100003',
          commercialReg: '1010998877',
          phone: '+966114445555',
          email: 'info@alamal.com',
          invoiceHeader: 'مؤسسة الأمل للتجارة - الرياض',
          invoiceFooterAr: 'شكرًا لتعاملكم معنا',
        },
      },
    },
  });

  const userA = await prisma.user.upsert({
    where: { email: 'ahmed@alamal.com' },
    update: {},
    create: {
      email: 'ahmed@alamal.com',
      name: 'Ahmed Al-Mansour',
      phone: '+966501112233',
      passwordHash: tenantAPassword,
      isActive: true,
    },
  });

  await prisma.membership.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenantA.id,
        userId: userA.id,
      },
    },
    update: {},
    create: {
      tenantId: tenantA.id,
      userId: userA.id,
      roleName: 'TENANT_OWNER',
    },
  });

  const now = new Date();
  const nextYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  await prisma.subscription.upsert({
    where: { tenantId: tenantA.id },
    update: {},
    create: {
      tenantId: tenantA.id,
      planId: starterPlan.id,
      status: 'ACTIVE',
      startDate: now,
      endDate: nextYear,
    },
  });

  const branchA = await prisma.branch.upsert({
    where: { tenantId_code: { tenantId: tenantA.id, code: 'BR-01' } },
    update: {},
    create: {
      tenantId: tenantA.id,
      code: 'BR-01',
      name: 'Main Branch',
      nameAr: 'الفرع الرئيسي',
      isDefault: true,
    },
  });

  const whA = await prisma.warehouse.upsert({
    where: { tenantId_code: { tenantId: tenantA.id, code: 'WH-01' } },
    update: {},
    create: {
      tenantId: tenantA.id,
      branchId: branchA.id,
      code: 'WH-01',
      name: 'Main Warehouse',
      nameAr: 'المستودع الرئيسي',
      isDefault: true,
    },
  });

  const unitPcsA = await prisma.unit.upsert({
    where: { tenantId_code: { tenantId: tenantA.id, code: 'PCS' } },
    update: {},
    create: {
      tenantId: tenantA.id,
      code: 'PCS',
      name: 'Piece',
      nameAr: 'حبة',
      symbol: 'حبة',
      isDefault: true,
    },
  });

  const itemA = await prisma.item.upsert({
    where: { tenantId_code: { tenantId: tenantA.id, code: 'ITM-101' } },
    update: {},
    create: {
      tenantId: tenantA.id,
      code: 'ITM-101',
      barcode: '6281001112223',
      name: 'Wireless Optical Mouse',
      nameAr: 'ماوس لاسلكي ضوئي',
      type: ItemType.STOCK,
      baseUnitId: unitPcsA.id,
      purchasePrice: new Prisma.Decimal(25),
      sellingPrice: new Prisma.Decimal(45),
      taxRate: new Prisma.Decimal(0),
    },
  });

  await prisma.warehouseStock.upsert({
    where: {
      tenantId_warehouseId_itemId: {
        tenantId: tenantA.id,
        warehouseId: whA.id,
        itemId: itemA.id,
      },
    },
    update: {},
    create: {
      tenantId: tenantA.id,
      warehouseId: whA.id,
      itemId: itemA.id,
      quantity: new Prisma.Decimal(100),
      averageCost: new Prisma.Decimal(25),
    },
  });

  console.log('Demo tenant seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
