import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterCompanyDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || !user.isActive) {
      return null;
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (isMatch) {
      return user;
    }
    return null;
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Get all active memberships for this user
    const memberships = await this.prisma.membership.findMany({
      where: {
        userId: user.id,
        status: 'ACTIVE',
      },
      include: {
        tenant: true,
      },
    });

    let activeTenantId = dto.tenantId;
    let activeRole = user.isSuperAdmin ? 'SUPER_ADMIN' : 'COMPANY_ADMIN';

    if (activeTenantId) {
      const targetMembership = memberships.find((m) => m.tenantId === activeTenantId);
      if (!targetMembership && !user.isSuperAdmin) {
        throw new UnauthorizedException('User does not have access to the requested company');
      }
      if (targetMembership) {
        activeRole = targetMembership.roleName;
      }
    } else if (memberships.length > 0) {
      activeTenantId = memberships[0].tenantId;
      activeRole = memberships[0].roleName;
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      activeTenantId,
      activeRole,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isSuperAdmin: user.isSuperAdmin,
        activeTenantId,
        activeRole,
      },
      memberships: memberships.map((m) => ({
        tenantId: m.tenantId,
        tenantName: m.tenant.name,
        tenantSlug: m.tenant.slug,
        roleName: m.roleName,
        tenantStatus: m.tenant.status,
      })),
    };
  }

  async registerCompany(dto: RegisterCompanyDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    const slug = dto.companyName
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || `tenant-${Date.now()}`;

    // Find requested or default plan
    const planCode = dto.planCode || 'STARTER';
    let plan = await this.prisma.plan.findUnique({
      where: { code: planCode },
    });

    if (!plan) {
      // Create Starter plan if not yet seeded
      plan = await this.prisma.plan.create({
        data: {
          code: 'STARTER',
          nameAr: 'الباقة الأساسية',
          nameEn: 'Starter Plan',
          priceMonthly: 99,
          priceYearly: 990,
          features: [
            'sales.core',
            'purchases.core',
            'inventory.core',
            'crm.contacts',
            'finance.cashbank',
            'reports.basic',
          ],
          quotas: {
            USERS_LIMIT: 3,
            BRANCHES_LIMIT: 1,
            WAREHOUSES_LIMIT: 1,
            ITEMS_LIMIT: 250,
            MONTHLY_INVOICES_LIMIT: 100,
          },
        },
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const now = new Date();
    const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days trial

    // Execute atomic creation of all starter resources
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: dto.companyName,
          slug: `${slug}-${Math.floor(1000 + Math.random() * 9000)}`,
          phone: dto.phone,
          email: dto.email,
          currencyCode: dto.currencyCode || 'EGP',
        },
      });

      // 2. Create User
      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase().trim(),
          name: dto.userName,
          phone: dto.phone,
          passwordHash,
        },
      });

      // 3. Create Membership as TENANT_OWNER
      await tx.membership.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          roleName: 'TENANT_OWNER',
        },
      });

      // 4. Create Initial Subscription (Trial)
      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          status: 'TRIAL',
          startDate: now,
          endDate: trialEnd,
          trialEndsAt: trialEnd,
        },
      });

      // 5. Create Default Branch & Warehouse
      const branch = await tx.branch.create({
        data: {
          tenantId: tenant.id,
          code: 'BR-01',
          name: 'Main Branch',
          nameAr: 'الفرع الرئيسي',
          isDefault: true,
        },
      });

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

      // 6. Create Default Unit (Piece / حبة)
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

      // 7. Create Default Cash Account (Main Cash / الصندوق الرئيسي)
      await tx.treasuryAccount.create({
        data: {
          tenantId: tenant.id,
          type: 'CASH',
          code: 'CASH-01',
          name: 'Main Cash Box',
          nameAr: 'الخزينة الرئيسية',
          isDefault: true,
        },
      });

      // 8. Create Default CRM Pipeline & Stages
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

      // 9. Create Tenant Settings
      await tx.tenantSetting.create({
        data: {
          tenantId: tenant.id,
          companyName: dto.companyName,
          companyNameAr: dto.companyName,
          phone: dto.phone,
          email: dto.email,
        },
      });

      return { tenant, user };
    });

    return this.login({
      email: dto.email,
      password: dto.password,
      tenantId: result.tenant.id,
    });
  }

  async switchTenant(userId: string, targetTenantId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: {
        tenantId_userId: {
          tenantId: targetTenantId,
          userId,
        },
      },
      include: {
        tenant: true,
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!membership && !user.isSuperAdmin) {
      throw new UnauthorizedException('You do not belong to this company');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      activeTenantId: targetTenantId,
      activeRole: membership ? membership.roleName : 'SUPER_ADMIN',
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      activeTenantId: targetTenantId,
      activeTenantName: membership ? membership.tenant.name : 'Platform Management',
      activeRole: payload.activeRole,
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        isSuperAdmin: true,
        mfaEnabled: true,
        memberships: {
          include: {
            tenant: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
