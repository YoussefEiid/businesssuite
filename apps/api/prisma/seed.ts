import { PrismaClient, Prisma, TenantStatus, ItemType, PartyType, DocumentStatus, PaymentStatus, StockMovementType, VoucherType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding BusinessSuite database...');

  // 1. Seed Platform Plans
  console.log('1. Seeding Plans...');

  const starterFeatures = [
    'sales.core',
    'purchases.core',
    'inventory.core',
    'crm.contacts',
    'finance.cashbank',
    'reports.basic',
  ];

  const growthFeatures = [
    ...starterFeatures,
    'sales.quotations',
    'sales.returns',
    'purchases.orders',
    'purchases.returns',
    'inventory.transfers',
    'crm.pipeline',
    'finance.allocations',
    'branding.custom',
  ];

  const businessFeatures = [
    ...growthFeatures,
    'inventory.stocktake',
    'reports.advanced',
    'reports.cost_visibility',
    'staff.custom_roles',
    'tools.import_export',
  ];

  const starterPlan = await prisma.plan.upsert({
    where: { code: 'STARTER' },
    update: {},
    create: {
      code: 'STARTER',
      nameAr: 'الباقة الأساسية',
      nameEn: 'Starter Plan',
      descriptionAr: 'مناسبة للشركات الناشئة والمؤسسات الصغيرة',
      descriptionEn: 'Ideal for startups and micro businesses',
      priceMonthly: new Prisma.Decimal(99),
      priceYearly: new Prisma.Decimal(990),
      currency: 'SAR',
      sortOrder: 1,
      features: starterFeatures,
      quotas: {
        USERS_LIMIT: 3,
        BRANCHES_LIMIT: 1,
        WAREHOUSES_LIMIT: 1,
        ITEMS_LIMIT: 250,
        MONTHLY_INVOICES_LIMIT: 100,
      },
      version: 1,
    },
  });

  const growthPlan = await prisma.plan.upsert({
    where: { code: 'GROWTH' },
    update: {},
    create: {
      code: 'GROWTH',
      nameAr: 'باقة النمو',
      nameEn: 'Growth Plan',
      descriptionAr: 'للشركات المتوسطة التي تتطلب عروض أسعار وتحويلات ومسار مبيعات',
      descriptionEn: 'For growing businesses requiring quotes, transfers and CRM pipeline',
      priceMonthly: new Prisma.Decimal(249),
      priceYearly: new Prisma.Decimal(2490),
      currency: 'SAR',
      sortOrder: 2,
      features: growthFeatures,
      quotas: {
        USERS_LIMIT: 10,
        BRANCHES_LIMIT: 3,
        WAREHOUSES_LIMIT: 3,
        ITEMS_LIMIT: 2000,
        MONTHLY_INVOICES_LIMIT: 1000,
      },
      version: 1,
    },
  });

  const businessPlan = await prisma.plan.upsert({
    where: { code: 'BUSINESS' },
    update: {},
    create: {
      code: 'BUSINESS',
      nameAr: 'باقة الأعمال المتقدمة',
      nameEn: 'Business Enterprise Plan',
      descriptionAr: 'كافة المزايا غير المحدودة مع رؤية التكلفة والأدوار المخصصة',
      descriptionEn: 'Full features, advanced analytics, custom roles and high limits',
      priceMonthly: new Prisma.Decimal(499),
      priceYearly: new Prisma.Decimal(4990),
      currency: 'SAR',
      sortOrder: 3,
      features: businessFeatures,
      quotas: {
        USERS_LIMIT: 50,
        BRANCHES_LIMIT: 10,
        WAREHOUSES_LIMIT: 10,
        ITEMS_LIMIT: 20000,
        MONTHLY_INVOICES_LIMIT: 10000,
      },
      version: 1,
    },
  });

  // 2. Seed SuperAdmin User
  console.log('2. Seeding Platform Owner SuperAdmin...');
  const salt = await bcrypt.genSalt(10);
  const superAdminPassword = await bcrypt.hash('Admin123456!', salt);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@business-suite.local' },
    update: {
      isSuperAdmin: true,
      isActive: true,
      passwordHash: superAdminPassword,
    },
    create: {
      email: 'admin@business-suite.local',
      name: 'Platform Owner Admin',
      phone: '+966500000000',
      passwordHash: superAdminPassword,
      isSuperAdmin: true,
      isActive: true,
    },
  });

  console.log('Clean system seed complete: System plans and Platform Owner provisioned.');
  console.log(`Platform Owner: ${superAdmin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
