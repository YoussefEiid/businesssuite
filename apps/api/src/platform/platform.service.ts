import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import {
  CreatePlanDto,
  UpdatePlanDto,
  UpdateTenantStatusDto,
  ManageSubscriptionDto,
  SetFeatureOverrideDto,
  SetQuotaOverrideDto,
  CreatePlatformTenantDto,
  ClonePlanDto,
} from './dto/platform.dto';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);

  constructor(
    private prisma: PrismaService,
    private entitlementsService: EntitlementsService,
  ) {}

  async getPlatformOverview() {
    const totalTenants = await this.prisma.tenant.count();
    const activeTenants = await this.prisma.tenant.count({ where: { status: 'ACTIVE' } });
    const suspendedTenants = await this.prisma.tenant.count({ where: { status: 'SUSPENDED' } });
    const totalUsers = await this.prisma.user.count();
    const totalPlans = await this.prisma.plan.count({ where: { isArchived: false } });

    // Aggregate real revenue from BillingLog
    const billingAgg = await this.prisma.billingLog.aggregate({
      _sum: {
        amount: true,
      },
      _count: true,
    });

    const subscriptionsByStatus = await this.prisma.subscription.groupBy({
      by: ['status'],
      _count: {
        _all: true,
      },
    });

    return {
      totalTenants,
      activeTenants,
      suspendedTenants,
      totalUsers,
      totalPlans,
      totalBillingCount: billingAgg._count,
      totalBillingAmount: billingAgg._sum.amount || 0,
      subscriptionsByStatus: subscriptionsByStatus.map((s) => ({
        status: s.status,
        count: s._count._all,
      })),
    };
  }

  async listTenants() {
    const tenants = await this.prisma.tenant.findMany({
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
        quotaOverrides: true,
        memberships: {
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true },
            },
          },
        },
        _count: {
          select: {
            items: true,
            salesInvoices: true,
            purchaseInvoices: true,
            warehouses: true,
            branches: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tenants.map((t) => {
      const planQuotas = (t.subscription?.plan?.quotas as Record<string, number>) || {};
      const quotaOverridesMap = t.quotaOverrides.reduce((acc, curr) => {
        acc[curr.quotaKey] = curr.quotaLimit;
        return acc;
      }, {} as Record<string, number>);

      const effectiveQuotas = {
        USERS_LIMIT: quotaOverridesMap['USERS_LIMIT'] ?? planQuotas['USERS_LIMIT'] ?? 5,
        BRANCHES_LIMIT: quotaOverridesMap['BRANCHES_LIMIT'] ?? planQuotas['BRANCHES_LIMIT'] ?? 1,
        WAREHOUSES_LIMIT: quotaOverridesMap['WAREHOUSES_LIMIT'] ?? planQuotas['WAREHOUSES_LIMIT'] ?? 1,
        ITEMS_LIMIT: quotaOverridesMap['ITEMS_LIMIT'] ?? planQuotas['ITEMS_LIMIT'] ?? 1000,
        MONTHLY_INVOICES_LIMIT: quotaOverridesMap['MONTHLY_INVOICES_LIMIT'] ?? planQuotas['MONTHLY_INVOICES_LIMIT'] ?? 500,
      };

      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
        currencyCode: t.currencyCode,
        createdAt: t.createdAt,
        subscription: t.subscription
          ? {
              id: t.subscription.id,
              status: t.subscription.status,
              planName: t.subscription.plan.nameAr,
              planCode: t.subscription.plan.code,
              endDate: t.subscription.endDate,
              trialEndsAt: t.subscription.trialEndsAt,
              billingCycle: t.subscription.billingCycle,
            }
          : null,
        owner: t.memberships.find((m) => m.roleName === 'TENANT_OWNER')?.user || null,
        membersCount: t.memberships.length,
        effectiveQuotas,
        usageStats: {
          itemsCount: t._count.items,
          salesInvoicesCount: t._count.salesInvoices,
          purchaseInvoicesCount: t._count.purchaseInvoices,
          warehousesCount: t._count.warehouses,
          branchesCount: t._count.branches,
          usersCount: t.memberships.length,
        },
      };
    });
  }

  async createTenant(dto: CreatePlatformTenantDto, adminUserId: string) {
    const rawSlug = dto.slug || dto.companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const slug = rawSlug + (rawSlug ? '-' : '') + Math.floor(Math.random() * 10000);

    const existingSlug = await this.prisma.tenant.findUnique({ where: { slug } });
    if (existingSlug) throw new ConflictException(`Company with slug '${slug}' already exists`);

    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.ownerEmail.toLowerCase().trim() } });
    if (existingUser) throw new ConflictException(`User with email '${dto.ownerEmail}' already exists`);

    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    const passwordHash = await bcrypt.hash(dto.ownerPassword, 10);
    const now = new Date();
    const duration = dto.durationDays || 30;
    const endDate = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);

    const tenant = await this.prisma.$transaction(async (tx) => {
      // 1. Create Tenant
      const newTenant = await tx.tenant.create({
        data: {
          name: dto.companyName,
          slug,
          currencyCode: dto.currencyCode || 'EGP',
          email: dto.ownerEmail,
          phone: dto.phone,
          status: 'ACTIVE',
        },
      });

      // 2. Create Owner User
      const ownerUser = await tx.user.create({
        data: {
          email: dto.ownerEmail.toLowerCase().trim(),
          name: dto.ownerName,
          phone: dto.phone,
          passwordHash,
          isSuperAdmin: false,
          isActive: true,
        },
      });

      // 3. Create Owner Membership
      await tx.membership.create({
        data: {
          tenantId: newTenant.id,
          userId: ownerUser.id,
          roleName: 'TENANT_OWNER',
          status: 'ACTIVE',
        },
      });

      // 4. Create Subscription
      await tx.subscription.create({
        data: {
          tenantId: newTenant.id,
          planId: plan.id,
          status: dto.subscriptionStatus || 'ACTIVE',
          startDate: now,
          endDate,
          trialEndsAt: dto.subscriptionStatus === 'TRIAL' ? endDate : null,
        },
      });

      // 5. Default Branch
      const branch = await tx.branch.create({
        data: {
          tenantId: newTenant.id,
          code: 'BR-01',
          name: 'Main Branch',
          nameAr: 'الفرع الرئيسي',
          isDefault: true,
        },
      });

      // 6. Default Warehouse
      await tx.warehouse.create({
        data: {
          tenantId: newTenant.id,
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
          tenantId: newTenant.id,
          code: 'PCS',
          name: 'Piece',
          nameAr: 'حبة / قطعة',
          symbol: 'حبة',
          isDefault: true,
        },
      });

      // 8. Default Settings
      await tx.tenantSetting.create({
        data: {
          tenantId: newTenant.id,
          companyName: dto.companyName,
          companyNameAr: dto.companyName,
          phone: dto.phone,
          email: dto.ownerEmail,
          invoiceHeader: dto.companyName,
          invoiceFooterAr: 'شكراً لتعاملكم معنا',
        },
      });

      return newTenant;
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: adminUserId,
        action: 'PLATFORM_TENANT_CREATED',
        entityType: 'Tenant',
        entityId: tenant.id,
        newValues: {
          companyName: dto.companyName,
          ownerEmail: dto.ownerEmail,
          plan: plan.nameAr,
          endDate,
        },
      },
    });

    return tenant;
  }

  async getTenantDetails(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscription: {
          include: {
            plan: true,
            planVersion: true,
            billingLogs: { orderBy: { createdAt: 'desc' }, take: 10 },
          },
        },
        featureOverrides: true,
        quotaOverrides: true,
        memberships: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true, isActive: true } },
          },
        },
        branches: true,
        warehouses: true,
        settings: true,
      },
    });

    if (!tenant) throw new NotFoundException('Tenant not found');

    const entitlements = await this.entitlementsService.getTenantEntitlements(tenantId);

    return {
      ...tenant,
      effectiveEntitlements: entitlements,
    };
  }

  async updateTenantStatus(tenantId: string, dto: UpdateTenantStatusDto, adminUserId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const oldStatus = tenant.status;
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: dto.status },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: adminUserId,
        action: 'TENANT_STATUS_UPDATED',
        entityType: 'Tenant',
        entityId: tenantId,
        oldValues: { status: oldStatus },
        newValues: { status: dto.status, reason: dto.reason },
      },
    });

    this.entitlementsService.invalidateTenantCache(tenantId);
    return updated;
  }

  // --- Plans Management ---

  async listPlans(includeArchived: boolean = false) {
    return this.prisma.plan.findMany({
      where: includeArchived ? undefined : { isArchived: false },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    });
  }

  async clonePlan(planId: string, dto: ClonePlanDto, adminUserId: string) {
    const sourcePlan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!sourcePlan) throw new NotFoundException('Source plan not found');

    const code = dto.newCode.toUpperCase().trim();
    const existing = await this.prisma.plan.findUnique({ where: { code } });
    if (existing) throw new ConflictException(`Plan with code '${code}' already exists`);

    const newPlan = await this.prisma.plan.create({
      data: {
        code,
        nameAr: dto.newNameAr,
        nameEn: dto.newNameEn,
        descriptionAr: sourcePlan.descriptionAr,
        descriptionEn: sourcePlan.descriptionEn,
        priceMonthly: dto.priceMonthly !== undefined ? new Prisma.Decimal(dto.priceMonthly) : sourcePlan.priceMonthly,
        priceYearly: dto.priceYearly !== undefined ? new Prisma.Decimal(dto.priceYearly) : sourcePlan.priceYearly,
        currency: sourcePlan.currency,
        features: sourcePlan.features as Prisma.InputJsonValue,
        quotas: sourcePlan.quotas as Prisma.InputJsonValue,
        isPublished: true,
        version: 1,
      },
    });

    await this.prisma.planVersion.create({
      data: {
        planId: newPlan.id,
        version: 1,
        nameAr: newPlan.nameAr,
        nameEn: newPlan.nameEn,
        priceMonthly: newPlan.priceMonthly,
        priceYearly: newPlan.priceYearly,
        features: newPlan.features as Prisma.InputJsonValue,
        quotas: newPlan.quotas as Prisma.InputJsonValue,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'PLAN_CLONED',
        entityType: 'Plan',
        entityId: newPlan.id,
        newValues: { sourcePlanCode: sourcePlan.code, newPlanCode: newPlan.code },
      },
    });

    return newPlan;
  }

  async toggleArchivePlan(planId: string, adminUserId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    const updated = await this.prisma.plan.update({
      where: { id: planId },
      data: { isArchived: !plan.isArchived },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: updated.isArchived ? 'PLAN_ARCHIVED' : 'PLAN_RESTORED',
        entityType: 'Plan',
        entityId: planId,
        newValues: { isArchived: updated.isArchived },
      },
    });

    return updated;
  }

  async createPlan(dto: CreatePlanDto, adminUserId: string) {
    const existing = await this.prisma.plan.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`Plan with code '${dto.code}' already exists`);

    const plan = await this.prisma.plan.create({
      data: {
        code: dto.code.toUpperCase(),
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        descriptionAr: dto.descriptionAr,
        descriptionEn: dto.descriptionEn,
        priceMonthly: new Prisma.Decimal(dto.priceMonthly),
        priceYearly: new Prisma.Decimal(dto.priceYearly),
        currency: dto.currency || 'SAR',
        features: dto.features,
        quotas: dto.quotas,
        isPublished: dto.isPublished ?? true,
        version: 1,
      },
    });

    await this.prisma.planVersion.create({
      data: {
        planId: plan.id,
        version: 1,
        nameAr: plan.nameAr,
        nameEn: plan.nameEn,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        features: plan.features as Prisma.InputJsonValue,
        quotas: plan.quotas as Prisma.InputJsonValue,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'PLAN_CREATED',
        entityType: 'Plan',
        entityId: plan.id,
        newValues: dto as any,
      },
    });

    return plan;
  }

  async updatePlan(planId: string, dto: UpdatePlanDto, adminUserId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    const newVersionNumber = plan.version + 1;

    const updated = await this.prisma.$transaction(async (tx) => {
      const up = await tx.plan.update({
        where: { id: planId },
        data: {
          nameAr: dto.nameAr ?? plan.nameAr,
          nameEn: dto.nameEn ?? plan.nameEn,
          descriptionAr: dto.descriptionAr ?? plan.descriptionAr,
          descriptionEn: dto.descriptionEn ?? plan.descriptionEn,
          priceMonthly: dto.priceMonthly !== undefined ? new Prisma.Decimal(dto.priceMonthly) : plan.priceMonthly,
          priceYearly: dto.priceYearly !== undefined ? new Prisma.Decimal(dto.priceYearly) : plan.priceYearly,
          features: (dto.features as Prisma.InputJsonValue) ?? (plan.features as Prisma.InputJsonValue),
          quotas: (dto.quotas as Prisma.InputJsonValue) ?? (plan.quotas as Prisma.InputJsonValue),
          isPublished: dto.isPublished ?? plan.isPublished,
          version: newVersionNumber,
        },
      });

      await tx.planVersion.create({
        data: {
          planId: plan.id,
          version: newVersionNumber,
          nameAr: up.nameAr,
          nameEn: up.nameEn,
          priceMonthly: up.priceMonthly,
          priceYearly: up.priceYearly,
          features: up.features as Prisma.InputJsonValue,
          quotas: up.quotas as Prisma.InputJsonValue,
        },
      });

      return up;
    });

    // Invalidate cache for all tenants on this plan if propagation is immediate
    const affectedSubscriptions = await this.prisma.subscription.findMany({
      where: { planId },
      select: { tenantId: true },
    });

    for (const sub of affectedSubscriptions) {
      this.entitlementsService.invalidateTenantCache(sub.tenantId);
    }

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'PLAN_UPDATED',
        entityType: 'Plan',
        entityId: planId,
        oldValues: plan as any,
        newValues: updated as any,
      },
    });

    return updated;
  }

  // --- Subscriptions & Overrides ---

  async manageSubscription(tenantId: string, dto: ManageSubscriptionDto, adminUserId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: true },
    });

    if (!tenant) throw new NotFoundException('Tenant not found');

    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    const now = new Date();
    let endDate: Date;

    if (dto.endDate || dto.customEndDate) {
      endDate = new Date(dto.endDate || dto.customEndDate!);
    } else if (dto.extensionDays) {
      const currentExpiry = tenant.subscription?.endDate ? new Date(tenant.subscription.endDate) : null;
      const baseDate = currentExpiry && currentExpiry > now ? currentExpiry : now;
      endDate = new Date(baseDate.getTime() + dto.extensionDays * 24 * 60 * 60 * 1000);
    } else {
      endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    const subscription = await this.prisma.$transaction(async (tx) => {
      let sub = tenant.subscription;
      if (sub) {
        sub = await tx.subscription.update({
          where: { tenantId },
          data: {
            planId: plan.id,
            status: dto.status || 'ACTIVE',
            endDate,
            trialEndsAt: dto.status === 'TRIAL' ? endDate : null,
          },
        });
      } else {
        sub = await tx.subscription.create({
          data: {
            tenantId,
            planId: plan.id,
            status: dto.status || 'ACTIVE',
            startDate: now,
            endDate,
          },
        });
      }

      // Log manual payment if provided
      if (dto.paymentAmount && dto.paymentAmount > 0) {
        await tx.billingLog.create({
          data: {
            tenantId,
            subscriptionId: sub.id,
            amount: new Prisma.Decimal(dto.paymentAmount),
            currency: plan.currency,
            billingType: 'RENEWAL',
            paymentMethod: dto.paymentMethod || 'MANUAL_BANK_TRANSFER',
            notes: dto.notes || 'Platform manual renewal',
            recordedByUserId: adminUserId,
          },
        });
      }

      return sub;
    });

    // Invalidate cache immediately
    this.entitlementsService.invalidateTenantCache(tenantId);

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: adminUserId,
        action: 'SUBSCRIPTION_MODIFIED',
        entityType: 'Subscription',
        entityId: subscription.id,
        newValues: dto as any,
      },
    });

    return subscription;
  }

  async setFeatureOverride(tenantId: string, dto: SetFeatureOverrideDto, adminUserId: string) {
    const override = await this.prisma.tenantFeatureOverride.upsert({
      where: {
        tenantId_featureKey: {
          tenantId,
          featureKey: dto.featureKey,
        },
      },
      update: {
        effect: dto.effect,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        reason: dto.reason,
        grantedByUserId: adminUserId,
      },
      create: {
        tenantId,
        featureKey: dto.featureKey,
        effect: dto.effect,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        reason: dto.reason,
        grantedByUserId: adminUserId,
      },
    });

    // Invalidate cache immediately
    this.entitlementsService.invalidateTenantCache(tenantId);

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: adminUserId,
        action: 'FEATURE_OVERRIDE_SET',
        entityType: 'TenantFeatureOverride',
        entityId: override.id,
        newValues: dto as any,
      },
    });

    return override;
  }

  async deleteFeatureOverride(tenantId: string, featureKey: string, adminUserId: string) {
    const deleted = await this.prisma.tenantFeatureOverride.deleteMany({
      where: { tenantId, featureKey },
    });

    this.entitlementsService.invalidateTenantCache(tenantId);

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: adminUserId,
        action: 'FEATURE_OVERRIDE_REMOVED',
        entityType: 'TenantFeatureOverride',
        entityId: featureKey,
      },
    });

    return { success: true, count: deleted.count };
  }

  async setQuotaOverride(tenantId: string, dto: SetQuotaOverrideDto, adminUserId: string) {
    const override = await this.prisma.tenantQuotaOverride.upsert({
      where: {
        tenantId_quotaKey: {
          tenantId,
          quotaKey: dto.quotaKey,
        },
      },
      update: {
        quotaLimit: dto.quotaLimit,
        reason: dto.reason,
        grantedByUserId: adminUserId,
      },
      create: {
        tenantId,
        quotaKey: dto.quotaKey,
        quotaLimit: dto.quotaLimit,
        reason: dto.reason,
        grantedByUserId: adminUserId,
      },
    });

    this.entitlementsService.invalidateTenantCache(tenantId);

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: adminUserId,
        action: 'QUOTA_OVERRIDE_SET',
        entityType: 'TenantQuotaOverride',
        entityId: override.id,
        newValues: dto as any,
      },
    });

    return override;
  }

  async deleteQuotaOverride(tenantId: string, quotaKey: string, adminUserId: string) {
    const deleted = await this.prisma.tenantQuotaOverride.deleteMany({
      where: { tenantId, quotaKey },
    });

    this.entitlementsService.invalidateTenantCache(tenantId);

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: adminUserId,
        action: 'QUOTA_OVERRIDE_REMOVED',
        entityType: 'TenantQuotaOverride',
        entityId: quotaKey,
      },
    });

    return { success: true, count: deleted.count };
  }

  async listAuditLogs(limit: number = 50) {
    return this.prisma.auditLog.findMany({
      take: Math.min(limit, 200),
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
