import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EntitlementsService } from '../src/entitlements/entitlements.service';
import { PlatformService } from '../src/platform/platform.service';

describe('Dynamic Entitlements & Feature Gating Engine', () => {
  let entitlementsService: EntitlementsService;
  let platformService: PlatformService;
  let prisma: PrismaService;
  let testTenantId: string;
  let starterPlanId: string;
  let adminUserId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', 'apps/api/.env'] }),
        PrismaModule,
      ],
      providers: [EntitlementsService, PlatformService],
    }).compile();

    entitlementsService = moduleRef.get<EntitlementsService>(EntitlementsService);
    platformService = moduleRef.get<PlatformService>(PlatformService);
    prisma = moduleRef.get<PrismaService>(PrismaService);

    // Get seeded admin and starter plan
    const admin = await prisma.user.findFirst({ where: { isSuperAdmin: true } });
    adminUserId = admin!.id;

    const plan = await prisma.plan.findUnique({ where: { code: 'STARTER' } });
    starterPlanId = plan!.id;

    // Create isolated test company
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Entitlements Test Co',
        slug: `ent-test-${Date.now()}`,
        subscription: {
          create: {
            planId: starterPlanId,
            status: 'ACTIVE',
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
    });
    testTenantId = tenant.id;
  });

  afterAll(async () => {
    if (testTenantId) {
      await prisma.tenant.delete({ where: { id: testTenantId } });
    }
    await prisma.$disconnect();
  });

  it('1. Should resolve base plan features correctly (Starter includes sales.core but not reports.advanced)', async () => {
    const isSalesEntitled = await entitlementsService.isFeatureEntitled(testTenantId, 'sales.core');
    const isAdvancedReportsEntitled = await entitlementsService.isFeatureEntitled(testTenantId, 'reports.advanced');

    expect(isSalesEntitled).toBe(true);
    expect(isAdvancedReportsEntitled).toBe(false);
  });

  it('2. Should dynamically allow a feature via Tenant Override without code change or server restart', async () => {
    // Platform owner grants reports.advanced addon to this specific tenant
    await platformService.setFeatureOverride(
      testTenantId,
      {
        featureKey: 'reports.advanced',
        effect: 'ALLOW',
        reason: 'Granted as trial addon',
      },
      adminUserId,
    );

    // Immediate check
    const isAdvancedReportsEntitled = await entitlementsService.isFeatureEntitled(testTenantId, 'reports.advanced');
    expect(isAdvancedReportsEntitled).toBe(true);
  });

  it('3. Should dynamically deny an included feature via Tenant Override (DENY overrules plan)', async () => {
    await platformService.setFeatureOverride(
      testTenantId,
      {
        featureKey: 'sales.core',
        effect: 'DENY',
        reason: 'Temporary suspension',
      },
      adminUserId,
    );

    const isSalesEntitled = await entitlementsService.isFeatureEntitled(testTenantId, 'sales.core');
    expect(isSalesEntitled).toBe(false);

    // Remove override to restore
    await platformService.deleteFeatureOverride(testTenantId, 'sales.core', adminUserId);
    const isRestored = await entitlementsService.isFeatureEntitled(testTenantId, 'sales.core');
    expect(isRestored).toBe(true);
  });

  it('4. Should enforce quota check and quota overrides', async () => {
    // Base starter plan has USERS_LIMIT: 3
    const checkUnderLimit = await entitlementsService.checkQuotaAvailable(testTenantId, 'USERS_LIMIT', 2);
    expect(checkUnderLimit.allowed).toBe(true);

    const checkAtLimit = await entitlementsService.checkQuotaAvailable(testTenantId, 'USERS_LIMIT', 3);
    expect(checkAtLimit.allowed).toBe(false);

    // Override quota to 10
    await platformService.setQuotaOverride(
      testTenantId,
      {
        quotaKey: 'USERS_LIMIT',
        quotaLimit: 10,
        reason: 'Purchased extra seats',
      },
      adminUserId,
    );

    const checkAfterOverride = await entitlementsService.checkQuotaAvailable(testTenantId, 'USERS_LIMIT', 3);
    expect(checkAfterOverride.allowed).toBe(true);
    expect(checkAfterOverride.limit).toBe(10);
  });

  it('5. Should switch tenant to expired/read-only when subscription date passes', async () => {
    // Set subscription end date to past
    await prisma.subscription.update({
      where: { tenantId: testTenantId },
      data: {
        status: 'ACTIVE',
        endDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // yesterday
        graceEndsAt: null,
      },
    });
    entitlementsService.invalidateTenantCache(testTenantId);

    const entitlements = await entitlementsService.getTenantEntitlements(testTenantId);
    expect(entitlements.subscriptionStatus).toBe('EXPIRED');
    expect(entitlements.isSubscriptionActive).toBe(false);

    const isFeatureActive = await entitlementsService.isFeatureEntitled(testTenantId, 'sales.core');
    expect(isFeatureActive).toBe(false);
  });
});
