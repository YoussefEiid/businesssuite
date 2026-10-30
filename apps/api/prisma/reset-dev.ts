import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function verifyEnvironmentSafety() {
  const dbUrl = process.env.DATABASE_URL || '';
  const nodeEnv = process.env.NODE_ENV || 'development';

  console.log('[db:reset] Safety Check: Inspecting database target...');

  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is missing.');
  }

  // Strictly block production node environment
  if (nodeEnv.toLowerCase() === 'production') {
    throw new Error(
      `ABORT: NODE_ENV is set to "production". Destructive reset is permanently forbidden in production.`
    );
  }

  // Identify remote/cloud database domains to prevent accidental remote resets
  const remotePatterns = [
    'render.com',
    'ondigitalocean.com',
    'aws.com',
    'amazonaws.com',
    'supabase.co',
    'neon.tech',
    'cockroachlabs.cloud',
    'elephantsql.com',
    'azure.com',
    'heroku.com',
  ];

  for (const pattern of remotePatterns) {
    if (dbUrl.toLowerCase().includes(pattern)) {
      throw new Error(
        `ABORT: DATABASE_URL contains remote cloud domain (${pattern}). Destructive reset is ONLY allowed on localhost/127.0.0.1 development databases!`
      );
    }
  }

  const isLocal =
    dbUrl.includes('localhost') ||
    dbUrl.includes('127.0.0.1') ||
    dbUrl.includes('::1') ||
    dbUrl.includes('@postgres:'); // Docker compose internal network

  if (!isLocal) {
    throw new Error(
      `ABORT: DATABASE_URL does not point to localhost or local Docker container. Reset aborted for safety.`
    );
  }

  console.log('[db:reset] Safety Check PASSED: Local development database confirmed.');
}

async function resetDevelopmentDatabase() {
  verifyEnvironmentSafety();

  console.log('[db:reset] Starting clean database reset...');

  // 1. Delete all transactional, customer, and operational data
  await prisma.$transaction(async (tx) => {
    // Audit & Billing Logs
    await tx.auditLog.deleteMany({});
    await tx.billingLog.deleteMany({});

    // Overrides
    await tx.tenantFeatureOverride.deleteMany({});
    await tx.tenantQuotaOverride.deleteMany({});

    // CRM
    await tx.cRMActivity.deleteMany({});
    await tx.cRMOpportunity.deleteMany({});
    await tx.cRMLead.deleteMany({});
    await tx.cRMStage.deleteMany({});
    await tx.cRMPipeline.deleteMany({});

    // Treasury
    await tx.voucherAllocation.deleteMany({});
    await tx.treasuryVoucher.deleteMany({});
    await tx.treasuryAccount.deleteMany({});

    // Sales & Purchases Returns
    await tx.salesReturnItem.deleteMany({});
    await tx.salesReturn.deleteMany({});
    await tx.purchaseReturnItem.deleteMany({});
    await tx.purchaseReturn.deleteMany({});

    // Invoices & Orders
    await tx.salesInvoiceItem.deleteMany({});
    await tx.salesInvoice.deleteMany({});
    await tx.purchaseInvoiceItem.deleteMany({});
    await tx.purchaseInvoice.deleteMany({});
    await tx.salesQuotationItem.deleteMany({});
    await tx.salesQuotation.deleteMany({});
    await tx.purchaseOrderItem.deleteMany({});
    await tx.purchaseOrder.deleteMany({});

    // Stock & Inventory
    await tx.stockMovement.deleteMany({});
    await tx.warehouseStock.deleteMany({});
    await tx.itemUnitConversion.deleteMany({});
    await tx.item.deleteMany({});
    await tx.itemCategory.deleteMany({});
    await tx.unit.deleteMany({});
    await tx.warehouse.deleteMany({});
    await tx.branch.deleteMany({});

    // Parties
    await tx.partyContact.deleteMany({});
    await tx.party.deleteMany({});

    // Sequences & Settings
    await tx.documentSequence.deleteMany({});
    await tx.tenantSetting.deleteMany({});

    // Subscriptions
    await tx.subscription.deleteMany({});

    // Memberships & Roles
    await tx.membership.deleteMany({});
    await tx.role.deleteMany({});

    // Tenants
    await tx.tenant.deleteMany({});

    // Delete all tenant users (preserve or recreate superadmin)
    await tx.user.deleteMany({
      where: {
        isSuperAdmin: false,
      },
    });
  });

  console.log('[db:reset] All business and tenant records successfully cleared.');

  // 2. Ensure System Plans exist
  console.log('[db:reset] Provisioning system plans...');

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

  await prisma.plan.upsert({
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

  await prisma.plan.upsert({
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

  await prisma.plan.upsert({
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

  // 3. Provision Platform Owner SuperAdmin
  console.log('[db:reset] Provisioning Platform Owner SuperAdmin...');
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

  // 4. Verify clean state
  const platformUsersCount = await prisma.user.count();
  const tenantsCount = await prisma.tenant.count();
  const membershipsCount = await prisma.membership.count();
  const customersCount = await prisma.party.count({ where: { type: 'CUSTOMER' } });
  const suppliersCount = await prisma.party.count({ where: { type: 'SUPPLIER' } });
  const itemsCount = await prisma.item.count();
  const salesInvoicesCount = await prisma.salesInvoice.count();
  const purchaseInvoicesCount = await prisma.purchaseInvoice.count();
  const stockMovementsCount = await prisma.stockMovement.count();
  const treasuryVouchersCount = await prisma.treasuryVoucher.count();
  const crmLeadsCount = await prisma.cRMLead.count();

  console.log('\n--- Reset State Verification ---');
  console.log(`Platform users: ${platformUsersCount} (expected: 1)`);
  console.log(`Tenants: ${tenantsCount} (expected: 0)`);
  console.log(`Tenant memberships: ${membershipsCount} (expected: 0)`);
  console.log(`Customers: ${customersCount} (expected: 0)`);
  console.log(`Suppliers: ${suppliersCount} (expected: 0)`);
  console.log(`Items: ${itemsCount} (expected: 0)`);
  console.log(`Sales invoices: ${salesInvoicesCount} (expected: 0)`);
  console.log(`Purchase invoices: ${purchaseInvoicesCount} (expected: 0)`);
  console.log(`Stock movements: ${stockMovementsCount} (expected: 0)`);
  console.log(`Treasury vouchers: ${treasuryVouchersCount} (expected: 0)`);
  console.log(`CRM records: ${crmLeadsCount} (expected: 0)`);
  console.log(`Platform Owner: ${superAdmin.email} (isSuperAdmin = ${superAdmin.isSuperAdmin})`);

  if (
    platformUsersCount !== 1 ||
    tenantsCount !== 0 ||
    membershipsCount !== 0 ||
    customersCount !== 0 ||
    suppliersCount !== 0 ||
    itemsCount !== 0 ||
    salesInvoicesCount !== 0 ||
    purchaseInvoicesCount !== 0 ||
    stockMovementsCount !== 0 ||
    treasuryVouchersCount !== 0 ||
    crmLeadsCount !== 0
  ) {
    throw new Error('Verification failed: Non-zero business records detected after reset!');
  }

  console.log('\n==================================================');
  console.log('Development database reset complete.');
  console.log('Platform Owner:');
  console.log(superAdmin.email);
  console.log('==================================================\n');
}

resetDevelopmentDatabase()
  .catch((e) => {
    console.error('[db:reset] Fatal error during reset:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
