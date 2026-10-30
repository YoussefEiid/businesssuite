export interface TenantEntitlements {
  subscriptionStatus: string;
  isSubscriptionActive: boolean;
  planCode: string;
  planNameAr: string;
  planNameEn: string;
  features: string[];
  quotas: Record<string, number>;
  isSingleTenant: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  isSuperAdmin: boolean;
  activeTenantId?: string;
  activeRole?: string;
  memberships: Array<{
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    roleName: string;
    tenantStatus: string;
  }>;
}

export interface DashboardSummary {
  monthlySalesCount: number;
  monthlySalesTotal: number;
  monthlyPurchasesTotal: number;
  totalReceivables: number;
  totalPayables: number;
  treasuryBalance: number;
  inventoryValuation: number | null;
  monthlyGrossProfit: number | null;
}
