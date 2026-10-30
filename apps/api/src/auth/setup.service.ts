import {
  Injectable,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { InitializeCompanyDto } from './dto/setup.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async getSetupStatus() {
    const tenantCount = await this.prisma.tenant.count();
    const userCount = await this.prisma.user.count({
      where: { isSuperAdmin: false },
    });

    return {
      needsSetup: tenantCount === 0 || userCount === 0,
      tenantCount,
      userCount,
      deploymentMode: process.env.DEPLOYMENT_MODE || 'DESKTOP_OFFLINE',
    };
  }

  async initializeCompany(dto: InitializeCompanyDto) {
    const status = await this.getSetupStatus();
    // Allow setup if no tenants exist or in desktop offline mode
    if (!status.needsSetup && process.env.DEPLOYMENT_MODE !== 'DESKTOP_OFFLINE') {
      throw new ConflictException('System is already initialized with an active company.');
    }

    const email = dto.adminEmail.toLowerCase().trim();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser && status.needsSetup) {
      throw new ConflictException('A user with this email already exists.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.adminPassword, salt);

    const slug = dto.companyName
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || `company-${Date.now()}`;

    // Ensure comprehensive offline business plan exists
    let plan = await this.prisma.plan.findUnique({
      where: { code: 'BUSINESS' },
    });

    if (!plan) {
      plan = await this.prisma.plan.create({
        data: {
          code: 'BUSINESS',
          nameAr: 'باقة الأعمال المتقدمة - نسخة سطح المكتب',
          nameEn: 'Business Enterprise - Desktop Edition',
          priceMonthly: 0,
          priceYearly: 0,
          currency: dto.currencyCode,
          sortOrder: 1,
          features: [
            'sales.core',
            'sales.quotations',
            'sales.returns',
            'purchases.core',
            'purchases.orders',
            'purchases.returns',
            'inventory.core',
            'inventory.transfers',
            'inventory.stocktake',
            'crm.contacts',
            'crm.pipeline',
            'finance.cashbank',
            'finance.allocations',
            'reports.basic',
            'reports.advanced',
            'reports.cost_visibility',
            'staff.custom_roles',
            'branding.custom',
            'tools.import_export',
          ],
          quotas: {
            USERS_LIMIT: 999,
            BRANCHES_LIMIT: 99,
            WAREHOUSES_LIMIT: 99,
            ITEMS_LIMIT: 99999,
            MONTHLY_INVOICES_LIMIT: 99999,
          },
        },
      });
    }

    const now = new Date();
    const tenYearsLater = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: dto.companyName,
          slug: `${slug}-${Math.floor(1000 + Math.random() * 9000)}`,
          phone: dto.phone,
          email: dto.adminEmail,
          currencyCode: dto.currencyCode,
          taxNumber: dto.taxNumber,
          commercialReg: dto.commercialRegistration,
          address: dto.address,
        },
      });

      // 2. Create User
      const user = existingUser || (await tx.user.create({
        data: {
          email,
          name: dto.adminName,
          phone: dto.phone,
          passwordHash,
          isActive: true,
          isSuperAdmin: false,
        },
      }));

      // 3. Create Membership as TENANT_OWNER
      await tx.membership.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          roleName: 'TENANT_OWNER',
          status: 'ACTIVE',
        },
      });

      // 4. Create Active Perpetual Desktop Subscription
      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          status: 'ACTIVE',
          startDate: now,
          endDate: tenYearsLater,
        },
      });

      // 5. Default Branch
      const branch = await tx.branch.create({
        data: {
          tenantId: tenant.id,
          code: 'BR-01',
          name: 'Main Branch',
          nameAr: 'الفرع الرئيسي',
          isDefault: true,
        },
      });

      // 6. Default Warehouse
      await tx.warehouse.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          code: 'WH-01',
          name: 'Main Warehouse',
          nameAr: 'المستودع الرئيسي',
          isDefault: true,
        },
      });

      // 7. Default Unit
      await tx.unit.create({
        data: {
          tenantId: tenant.id,
          code: 'PCS',
          name: 'Piece',
          nameAr: 'حبة',
          symbol: 'حبة',
          isDefault: true,
        },
      });

      // 8. Default Cash Treasury Account
      await tx.treasuryAccount.create({
        data: {
          tenantId: tenant.id,
          code: 'CASH-01',
          name: 'Main Cash Box',
          nameAr: 'الخزينة الرئيسية',
          type: 'CASH',
          isDefault: true,
        },
      });

      // 9. Default CRM Pipeline & Stages
      const pipeline = await tx.cRMPipeline.create({
        data: {
          tenantId: tenant.id,
          name: 'Sales Pipeline',
          nameAr: 'مسار المبيعات الرئيسي',
          isDefault: true,
        },
      });

      await tx.cRMStage.createMany({
        data: [
          { tenantId: tenant.id, pipelineId: pipeline.id, name: 'Lead', nameAr: 'عميل محتمل', probability: 20, sortOrder: 1 },
          { tenantId: tenant.id, pipelineId: pipeline.id, name: 'Qualified', nameAr: 'مؤهل للشراء', probability: 40, sortOrder: 2 },
          { tenantId: tenant.id, pipelineId: pipeline.id, name: 'Proposal Sent', nameAr: 'تم إرسال العرض', probability: 70, sortOrder: 3 },
          { tenantId: tenant.id, pipelineId: pipeline.id, name: 'Won', nameAr: 'صفقة ناجحة', probability: 100, sortOrder: 4 },
          { tenantId: tenant.id, pipelineId: pipeline.id, name: 'Lost', nameAr: 'صفقة خاسرة', probability: 0, sortOrder: 5 },
        ],
      });

      // 10. Tenant Settings
      await tx.tenantSetting.create({
        data: {
          tenantId: tenant.id,
          companyName: dto.companyName,
          companyNameAr: dto.companyNameAr || dto.companyName,
          phone: dto.phone,
          email: dto.adminEmail,
          taxNumber: dto.taxNumber,
          address: dto.address,
        },
      });

      return { tenant, user };
    });

    // Generate JWT access token
    const payload: JwtPayload = {
      sub: result.user.id,
      email: result.user.email,
      isSuperAdmin: false,
      activeTenantId: result.tenant.id,
      activeRole: 'TENANT_OWNER',
    };

    const accessToken = this.jwtService.sign(payload);

    this.logger.log(`Desktop company initialized successfully: ${result.tenant.name} (${result.tenant.id})`);

    return {
      success: true,
      accessToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        isSuperAdmin: false,
        activeTenantId: result.tenant.id,
        activeRole: 'TENANT_OWNER',
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        currencyCode: result.tenant.currencyCode,
      },
    };
  }
}
