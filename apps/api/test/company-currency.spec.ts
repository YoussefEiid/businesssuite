import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TenantsService } from '../src/tenants/tenants.service';
import { PlatformService } from '../src/platform/platform.service';
import { AuthService } from '../src/auth/auth.service';
import { EntitlementsService } from '../src/entitlements/entitlements.service';
import { UpdateCompanyProfileDto } from '../src/tenants/dto/tenant.dto';
import { CreatePlatformTenantDto } from '../src/platform/dto/platform.dto';
import { RegisterCompanyDto } from '../src/auth/dto/register.dto';
import { CurrencyCode } from '@business-suite/shared';
import { JwtService } from '@nestjs/jwt';

// Centralized currency formatter logic (identical to web/src/utils/currency.ts)
function formatMoney(
  amount: number | string,
  currencyCode: 'EGP' | 'SAR' | 'USD' = 'EGP',
  isRtl: boolean = true,
): string {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount || 0));
  const validNum = isNaN(num) ? 0 : num;
  const isNegative = validNum < 0;
  const absNum = Math.abs(validNum);

  const formattedNumber = absNum.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  let result = '';
  if (isRtl) {
    switch (currencyCode) {
      case 'SAR':
        result = `${formattedNumber} ر.س`;
        break;
      case 'USD':
        result = `${formattedNumber} $`;
        break;
      case 'EGP':
      default:
        result = `${formattedNumber} ج.م`;
        break;
    }
  } else {
    switch (currencyCode) {
      case 'SAR':
        result = `SAR ${formattedNumber}`;
        break;
      case 'USD':
        result = `$${formattedNumber}`;
        break;
      case 'EGP':
      default:
        result = `EGP ${formattedNumber}`;
        break;
    }
  }

  return isNegative ? `-${result}` : result;
}

describe('Company Configurable Base Currency (EGP, SAR, USD)', () => {
  let prisma: PrismaService;
  let tenantsService: TenantsService;
  let platformService: PlatformService;
  let authService: AuthService;
  let adminUserId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', 'apps/api/.env'] }),
        PrismaModule,
      ],
      providers: [
        TenantsService,
        PlatformService,
        AuthService,
        EntitlementsService,
        JwtService,
      ],
    }).compile();

    prisma = moduleRef.get<PrismaService>(PrismaService);
    tenantsService = moduleRef.get<TenantsService>(TenantsService);
    platformService = moduleRef.get<PlatformService>(PlatformService);
    authService = moduleRef.get<AuthService>(AuthService);

    // Create an admin user for audit trails
    const admin = await prisma.user.create({
      data: {
        email: `curr-admin-${Date.now()}@test.com`,
        name: 'Currency Test Admin',
        passwordHash: 'dummy-hash',
        isSuperAdmin: true,
      },
    });
    adminUserId = admin.id;
  });

  afterAll(async () => {
    if (adminUserId) {
      await prisma.user.delete({ where: { id: adminUserId } }).catch(() => {});
    }
  });

  describe('1. Default Currency on Company Creation', () => {
    it('should default tenant.currencyCode to EGP when creating tenant without currency in DB', async () => {
      const plan = await prisma.plan.findUnique({ where: { code: 'BUSINESS' } });
      const slug = `curr-def-${Date.now()}`;
      const tenant = await prisma.tenant.create({
        data: {
          name: 'Default Currency Test Tenant',
          slug,
          subscription: {
            create: {
              planId: plan!.id,
              status: 'ACTIVE',
              startDate: new Date(),
              endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
      });

      expect(tenant.currencyCode).toBe('EGP');

      // Cleanup
      await prisma.subscription.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.tenant.delete({ where: { id: tenant.id } });
    });

    it('should default currencyCode to EGP on platform tenant creation if omitted', async () => {
      const plan = await prisma.plan.findUnique({ where: { code: 'BUSINESS' } });
      const email = `platform-tenant-${Date.now()}@test.com`;

      const result = await platformService.createTenant(
        {
          companyName: 'Platform Created Tenant EGP',
          ownerEmail: email,
          ownerName: 'Admin EGP',
          ownerPassword: 'Password123!',
          planId: plan!.id,
          // currencyCode omitted
        },
        adminUserId,
      );

      expect(result.currencyCode).toBe(CurrencyCode.EGP);

      // Verify in database
      const dbTenant = await prisma.tenant.findUnique({ where: { id: result.id } });
      expect(dbTenant?.currencyCode).toBe('EGP');

      // Cleanup
      await prisma.membership.deleteMany({ where: { tenantId: result.id } });
      await prisma.subscription.deleteMany({ where: { tenantId: result.id } });
      await prisma.tenant.delete({ where: { id: result.id } });
      await prisma.user.deleteMany({ where: { email } });
    });

    it('should correctly persist explicit SAR and USD on platform tenant creation', async () => {
      const plan = await prisma.plan.findUnique({ where: { code: 'BUSINESS' } });
      const emailSar = `platform-sar-${Date.now()}@test.com`;
      const emailUsd = `platform-usd-${Date.now()}@test.com`;

      const tenantSar = await platformService.createTenant(
        {
          companyName: 'Platform Created SAR',
          ownerEmail: emailSar,
          ownerName: 'Admin SAR',
          ownerPassword: 'Password123!',
          planId: plan!.id,
          currencyCode: CurrencyCode.SAR,
        },
        adminUserId,
      );
      expect(tenantSar.currencyCode).toBe('SAR');

      const tenantUsd = await platformService.createTenant(
        {
          companyName: 'Platform Created USD',
          ownerEmail: emailUsd,
          ownerName: 'Admin USD',
          ownerPassword: 'Password123!',
          planId: plan!.id,
          currencyCode: CurrencyCode.USD,
        },
        adminUserId,
      );
      expect(tenantUsd.currencyCode).toBe('USD');

      // Cleanup
      await prisma.membership.deleteMany({ where: { tenantId: { in: [tenantSar.id, tenantUsd.id] } } });
      await prisma.subscription.deleteMany({ where: { tenantId: { in: [tenantSar.id, tenantUsd.id] } } });
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantSar.id, tenantUsd.id] } } });
      await prisma.user.deleteMany({ where: { email: { in: [emailSar, emailUsd] } } });
    });
  });

  describe('2. Company Profile Currency Updates & hasTransactions Detection', () => {
    let testTenantId: string;
    let accountId: string;
    let voucherId: string;

    beforeAll(async () => {
      const plan = await prisma.plan.findUnique({ where: { code: 'BUSINESS' } });
      const tenant = await prisma.tenant.create({
        data: {
          name: 'Currency Update Lifecycle Tenant',
          slug: `curr-update-${Date.now()}`,
          subscription: {
            create: {
              planId: plan!.id,
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
      if (voucherId) {
        await prisma.treasuryVoucher.deleteMany({ where: { tenantId: testTenantId } });
      }
      if (accountId) {
        await prisma.treasuryAccount.deleteMany({ where: { tenantId: testTenantId } });
      }
      await prisma.subscription.deleteMany({ where: { tenantId: testTenantId } });
      await prisma.tenant.delete({ where: { id: testTenantId } });
    });

    it('should initially have hasTransactions = false and currencyCode = EGP', async () => {
      const profile = await tenantsService.getCompanyProfile(testTenantId);
      expect(profile.currencyCode).toBe('EGP');
      expect(profile.hasTransactions).toBe(false);
    });

    it('should successfully update currencyCode to SAR and USD via updateCompanyProfile', async () => {
      // Update to SAR
      const updatedSar = await tenantsService.updateCompanyProfile(
        testTenantId,
        {
          name: 'Currency Update Lifecycle Tenant (SAR)',
          currencyCode: CurrencyCode.SAR,
        },
        adminUserId,
      );
      expect(updatedSar.currencyCode).toBe('SAR');

      // Verify persistence
      let profile = await tenantsService.getCompanyProfile(testTenantId);
      expect(profile.currencyCode).toBe('SAR');

      // Update to USD
      const updatedUsd = await tenantsService.updateCompanyProfile(
        testTenantId,
        {
          name: 'Currency Update Lifecycle Tenant (USD)',
          currencyCode: CurrencyCode.USD,
        },
        adminUserId,
      );
      expect(updatedUsd.currencyCode).toBe('USD');

      profile = await tenantsService.getCompanyProfile(testTenantId);
      expect(profile.currencyCode).toBe('USD');
    });

    it('should reflect hasTransactions = true when a transaction (voucher) exists', async () => {
      // Create a treasury account and voucher for this tenant
      const account = await prisma.treasuryAccount.create({
        data: {
          tenantId: testTenantId,
          type: 'CASH',
          code: `CASH-${Date.now()}`,
          name: 'Main Cash Box',
          nameAr: 'الخزينة الرئيسية',
          currentBalance: 0,
        },
      });
      accountId = account.id;

      const voucher = await prisma.treasuryVoucher.create({
        data: {
          tenantId: testTenantId,
          accountId: account.id,
          voucherNumber: `VCH-${Date.now()}`,
          type: 'RECEIPT',
          amount: 250,
        },
      });
      voucherId = voucher.id;

      const profile = await tenantsService.getCompanyProfile(testTenantId);
      expect(profile.hasTransactions).toBe(true);
    });
  });

  describe('3. DTO Whitelist Validation', () => {
    it('should accept valid CurrencyCodes (EGP, SAR, USD) in UpdateCompanyProfileDto', async () => {
      for (const code of [CurrencyCode.EGP, CurrencyCode.SAR, CurrencyCode.USD]) {
        const dto = plainToInstance(UpdateCompanyProfileDto, {
          name: 'Valid Tenant',
          currencyCode: code,
        });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });

    it('should reject invalid currency codes in UpdateCompanyProfileDto', async () => {
      const invalidCodes = ['EUR', 'GBP', 'KWD', 'XYZ', '', 123];
      for (const code of invalidCodes) {
        const dto = plainToInstance(UpdateCompanyProfileDto, {
          name: 'Invalid Tenant',
          currencyCode: code,
        });
        const errors = await validate(dto);
        const currencyError = errors.find((e) => e.property === 'currencyCode');
        expect(currencyError).toBeDefined();
      }
    });

    it('should accept valid CurrencyCodes in CreatePlatformTenantDto and reject invalid ones', async () => {
      const validDto = plainToInstance(CreatePlatformTenantDto, {
        companyName: 'Valid Platform Tenant',
        ownerEmail: 'platform@valid.com',
        ownerName: 'Valid',
        ownerPassword: 'Password123!',
        planId: 'plan-id',
        currencyCode: CurrencyCode.USD,
      });
      const validErrors = await validate(validDto);
      expect(validErrors.find((e) => e.property === 'currencyCode')).toBeUndefined();

      const invalidDto = plainToInstance(CreatePlatformTenantDto, {
        companyName: 'Invalid Platform Tenant',
        ownerEmail: 'platform@invalid.com',
        ownerName: 'Invalid',
        ownerPassword: 'Password123!',
        planId: 'plan-id',
        currencyCode: 'CAD' as any,
      });
      const invalidErrors = await validate(invalidDto);
      expect(invalidErrors.find((e) => e.property === 'currencyCode')).toBeDefined();
    });

    it('should accept valid CurrencyCodes in RegisterCompanyDto and reject invalid ones', async () => {
      const validDto = plainToInstance(RegisterCompanyDto, {
        companyName: 'Self Reg Co',
        name: 'Founder',
        email: 'founder@test.com',
        password: 'Password123!',
        planCode: 'BUSINESS',
        currencyCode: CurrencyCode.EGP,
      });
      const validErrors = await validate(validDto);
      expect(validErrors.find((e) => e.property === 'currencyCode')).toBeUndefined();

      const invalidDto = plainToInstance(RegisterCompanyDto, {
        companyName: 'Self Reg Co',
        name: 'Founder',
        email: 'founder@test.com',
        password: 'Password123!',
        planCode: 'BUSINESS',
        currencyCode: 'BTC' as any,
      });
      const invalidErrors = await validate(invalidDto);
      expect(invalidErrors.find((e) => e.property === 'currencyCode')).toBeDefined();
    });
  });

  describe('4. Centralized Currency Formatter Rules', () => {
    it('should format EGP correctly in Arabic and English', () => {
      expect(formatMoney(500, 'EGP', true)).toBe('500.00 ج.م');
      expect(formatMoney(500, 'EGP', false)).toBe('EGP 500.00');
      expect(formatMoney(1234567.89, 'EGP', true)).toBe('1,234,567.89 ج.م');
      expect(formatMoney(1234567.89, 'EGP', false)).toBe('EGP 1,234,567.89');
    });

    it('should format SAR correctly in Arabic and English', () => {
      expect(formatMoney(500, 'SAR', true)).toBe('500.00 ر.س');
      expect(formatMoney(500, 'SAR', false)).toBe('SAR 500.00');
      expect(formatMoney(0, 'SAR', true)).toBe('0.00 ر.س');
      expect(formatMoney(0, 'SAR', false)).toBe('SAR 0.00');
    });

    it('should format USD correctly in Arabic and English', () => {
      expect(formatMoney(500, 'USD', true)).toBe('500.00 $');
      expect(formatMoney(500, 'USD', false)).toBe('$500.00');
      expect(formatMoney(99.9, 'USD', true)).toBe('99.90 $');
      expect(formatMoney(99.9, 'USD', false)).toBe('$99.90');
    });

    it('should format negative amounts correctly', () => {
      expect(formatMoney(-150.5, 'EGP', true)).toBe('-150.50 ج.م');
      expect(formatMoney(-150.5, 'SAR', false)).toBe('-SAR 150.50');
      expect(formatMoney(-150.5, 'USD', false)).toBe('-$150.50');
    });
  });
});
