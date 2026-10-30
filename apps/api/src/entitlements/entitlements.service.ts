import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { FEATURE_CATALOG } from '@business-suite/shared';

export interface TenantEntitlements {
  subscriptionStatus: string;
  isSubscriptionActive: boolean;
  planCode: string;
  planNameAr: string;
  planNameEn: string;
  features: string[]; // List of enabled feature keys
  quotas: Record<string, number>; // Quota limits (-1 = unlimited)
  isSingleTenant: boolean;
}

@Injectable()
export class EntitlementsService {
  private readonly logger = new Logger(EntitlementsService.name);
  // Fast in-memory cache for high-throughput API gating
  private entitlementsCache = new Map<string, { data: TenantEntitlements; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 60 * 1000; // 1 minute default, invalidated on update

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  invalidateTenantCache(tenantId: string) {
    this.entitlementsCache.delete(tenantId);
    this.logger.debug(`Invalidated entitlements cache for tenant ${tenantId}`);
  }

  async getTenantEntitlements(tenantId: string): Promise<TenantEntitlements> {
    const isSingleTenant = this.configService.get<string>('DEPLOYMENT_MODE') === 'SINGLE_TENANT';

    if (isSingleTenant) {
      // In Single-Tenant mode, all features are enabled with unlimited quotas
      const allFeatures = Object.keys(FEATURE_CATALOG);
      return {
        subscriptionStatus: 'ACTIVE',
        isSubscriptionActive: true,
        planCode: 'ENTERPRISE_SINGLE',
        planNameAr: 'نسخة مستقلة (غير محدودة)',
        planNameEn: 'Single-Tenant Enterprise',
        features: allFeatures,
        quotas: {
          USERS_LIMIT: -1,
          BRANCHES_LIMIT: -1,
          WAREHOUSES_LIMIT: -1,
          ITEMS_LIMIT: -1,
          MONTHLY_INVOICES_LIMIT: -1,
          ATTACHMENTS_STORAGE_MB: -1,
        },
        isSingleTenant: true,
      };
    }

    // Check memory cache
    const cached = this.entitlementsCache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    // Load tenant subscription, plan, and overrides
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscription: {
          include: {
            plan: true,
            planVersion: true,
          },
        },
        featureOverrides: true,
        quotaOverrides: true,
      },
    });

    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    const subscription = tenant.subscription;
    const now = new Date();

    let subscriptionStatus = subscription?.status || 'SUSPENDED';
    let isSubscriptionActive = false;

    if (subscription) {
      // Auto-check expiry against current date
      if (subscription.status === 'TRIAL') {
        if (subscription.trialEndsAt && subscription.trialEndsAt < now) {
          subscriptionStatus = 'EXPIRED';
        } else {
          isSubscriptionActive = true;
        }
      } else if (subscription.status === 'ACTIVE') {
        if (subscription.endDate < now) {
          if (subscription.graceEndsAt && subscription.graceEndsAt > now) {
            subscriptionStatus = 'GRACE';
            isSubscriptionActive = true;
          } else {
            subscriptionStatus = 'EXPIRED';
          }
        } else {
          isSubscriptionActive = true;
        }
      } else if (subscription.status === 'GRACE') {
        if (subscription.graceEndsAt && subscription.graceEndsAt < now) {
          subscriptionStatus = 'EXPIRED';
        } else {
          isSubscriptionActive = true;
        }
      }
    }

    const plan = subscription?.plan;
    const planFeatures: string[] = (plan?.features as string[]) || [];
    const planQuotas: Record<string, number> = (plan?.quotas as Record<string, number>) || {};

    // Apply feature overrides
    const effectiveFeaturesSet = new Set<string>(planFeatures);

    for (const override of tenant.featureOverrides) {
      const nowMs = now.getTime();
      const validFromOk = !override.validFrom || override.validFrom.getTime() <= nowMs;
      const validUntilOk = !override.validUntil || override.validUntil.getTime() >= nowMs;

      if (validFromOk && validUntilOk) {
        if (override.effect === 'ALLOW') {
          effectiveFeaturesSet.add(override.featureKey);
        } else if (override.effect === 'DENY') {
          effectiveFeaturesSet.delete(override.featureKey);
        }
      }
    }

    // Filter out features whose dependencies are not met
    const validatedFeatures: string[] = [];
    for (const featKey of effectiveFeaturesSet) {
      const def = FEATURE_CATALOG[featKey];
      if (!def) continue;

      const hasDeps = def.dependencies.every((dep) => effectiveFeaturesSet.has(dep));
      if (hasDeps) {
        validatedFeatures.push(featKey);
      }
    }

    // Apply quota overrides
    const effectiveQuotas = { ...planQuotas };
    for (const qOverride of tenant.quotaOverrides) {
      effectiveQuotas[qOverride.quotaKey] = qOverride.quotaLimit;
    }

    const result: TenantEntitlements = {
      subscriptionStatus,
      isSubscriptionActive,
      planCode: plan?.code || 'NONE',
      planNameAr: plan?.nameAr || 'بدون باقة',
      planNameEn: plan?.nameEn || 'No Plan',
      features: validatedFeatures,
      quotas: effectiveQuotas,
      isSingleTenant: false,
    };

    // Cache result
    this.entitlementsCache.set(tenantId, {
      data: result,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });

    return result;
  }

  async isFeatureEntitled(tenantId: string, featureKey: string): Promise<boolean> {
    const entitlements = await this.getTenantEntitlements(tenantId);
    if (!entitlements.isSubscriptionActive) return false;
    return entitlements.features.includes(featureKey);
  }

  async checkQuotaAvailable(
    tenantId: string,
    quotaKey: string,
    currentUsage: number,
  ): Promise<{ allowed: boolean; limit: number; current: number }> {
    const entitlements = await this.getTenantEntitlements(tenantId);
    const limit = entitlements.quotas[quotaKey] ?? -1;

    if (limit === -1) {
      return { allowed: true, limit: -1, current: currentUsage };
    }

    return {
      allowed: currentUsage < limit,
      limit,
      current: currentUsage,
    };
  }
}
