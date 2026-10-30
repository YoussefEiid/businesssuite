export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    if ((window as any).businessSuiteDesktop?.getApiUrl) {
      const custom = (window as any).businessSuiteDesktop.getApiUrl();
      if (custom) return custom;
    }
    return `${window.location.origin}/api`;
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
}

export class ApiService {
  private static getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('bs_access_token');
  }

  private static getActiveTenantId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('bs_active_tenant_id');
  }

  static async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const tenantId = this.getActiveTenantId();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (tenantId) {
      headers['X-Tenant-Id'] = tenantId;
    }

    const baseUrl = getApiBaseUrl();
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorData: any;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }

      const errorMessage =
        errorData.message ||
        errorData.error ||
        `Request failed with status ${response.status}`;

      throw new Error(Array.isArray(errorMessage) ? errorMessage.join(', ') : errorMessage);
    }

    return response.json();
  }

  // --- First-Run Setup & Diagnostics ---
  static getSetupStatus() {
    return this.request<{ needsSetup: boolean; tenantCount: number; userCount: number; deploymentMode: string }>('/setup/status');
  }

  static initializeCompany(body: any) {
    return this.request('/setup/initialize', { method: 'POST', body: JSON.stringify(body) });
  }

  // --- Auth ---
  static login(body: any) {
    return this.request('/auth/login', { method: 'POST', body: JSON.stringify(body) });
  }

  static register(body: any) {
    return this.request('/auth/register', { method: 'POST', body: JSON.stringify(body) });
  }

  static getProfile() {
    return this.request('/auth/me');
  }

  static switchTenant(tenantId: string) {
    return this.request('/auth/switch-tenant', {
      method: 'POST',
      body: JSON.stringify({ tenantId }),
    });
  }

  // --- Entitlements ---
  static getMyEntitlements() {
    return this.request('/entitlements/my-entitlements');
  }

  static getFeatureCatalog() {
    return this.request('/entitlements/catalog');
  }


  // --- Parties ---
  static listParties(type?: string, search?: string) {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (search) params.append('search', search);
    return this.request(`/parties?${params.toString()}`);
  }

  static getParty(id: string) {
    return this.request(`/parties/${id}`);
  }

  static createParty(body: any) {
    return this.request('/parties', { method: 'POST', body: JSON.stringify(body) });
  }

  static updateParty(id: string, body: any) {
    return this.request(`/parties/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  }

  static deleteParty(id: string) {
    return this.request(`/parties/${id}`, { method: 'DELETE' });
  }

  static getPartyStatement(id: string, fromDate?: string, toDate?: string) {
    const params = new URLSearchParams();
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    return this.request(`/parties/${id}/statement?${params.toString()}`);
  }

  // --- Inventory ---
  static listItems(search?: string, categoryId?: string, type?: string) {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (categoryId) params.append('categoryId', categoryId);
    if (type) params.append('type', type);
    return this.request(`/inventory/items?${params.toString()}`);
  }

  static getItem(id: string) {
    return this.request(`/inventory/items/${id}`);
  }

  static createItem(body: any) {
    return this.request('/inventory/items', { method: 'POST', body: JSON.stringify(body) });
  }

  static updateItem(id: string, body: any) {
    return this.request(`/inventory/items/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  }

  static deleteItem(id: string) {
    return this.request(`/inventory/items/${id}`, { method: 'DELETE' });
  }

  static listWarehouses() {
    return this.request('/inventory/warehouses');
  }

  static listCategories() {
    return this.request('/inventory/categories');
  }

  static listUnits() {
    return this.request('/inventory/units');
  }

  static getLowStockItems() {
    return this.request('/inventory/items/low-stock');
  }

  static bulkImportItems(items: any[]) {
    return this.request('/inventory/items/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }

  static addItemUnitConversion(itemId: string, body: any) {
    return this.request(`/inventory/items/${itemId}/conversions`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  static deleteItemUnitConversion(itemId: string, conversionId: string) {
    return this.request(`/inventory/items/${itemId}/conversions/${conversionId}`, {
      method: 'DELETE',
    });
  }

  static createWarehouse(body: any) {
    return this.request('/inventory/warehouses', { method: 'POST', body: JSON.stringify(body) });
  }

  static updateWarehouse(id: string, body: any) {
    return this.request(`/inventory/warehouses/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  }

  static deleteWarehouse(id: string) {
    return this.request(`/inventory/warehouses/${id}`, { method: 'DELETE' });
  }

  static transferStock(body: any) {
    return this.request('/inventory/transfers', { method: 'POST', body: JSON.stringify(body) });
  }

  static adjustStock(body: any) {
    return this.request('/inventory/adjustments', { method: 'POST', body: JSON.stringify(body) });
  }

  // --- Sales ---
  static listQuotations() {
    return this.request('/sales/quotations');
  }

  static createQuotation(body: any) {
    return this.request('/sales/quotations', { method: 'POST', body: JSON.stringify(body) });
  }

  static convertQuotation(id: string) {
    return this.request(`/sales/quotations/${id}/convert`, { method: 'POST' });
  }

  static listInvoices(partyId?: string, search?: string) {
    const params = new URLSearchParams();
    if (partyId) params.append('partyId', partyId);
    if (search) params.append('search', search);
    return this.request(`/sales/invoices?${params.toString()}`);
  }

  static getInvoice(id: string) {
    return this.request(`/sales/invoices/${id}`);
  }

  static createInvoice(body: any) {
    return this.request('/sales/invoices', { method: 'POST', body: JSON.stringify(body) });
  }

  static postInvoice(id: string, body: any = {}) {
    return this.request(`/sales/invoices/${id}/post`, { method: 'POST', body: JSON.stringify(body) });
  }

  static quickInvoicePayment(id: string, body: any) {
    return this.request(`/sales/invoices/${id}/quick-payment`, { method: 'POST', body: JSON.stringify(body) });
  }

  static listSalesReturns() {
    return this.request('/sales/returns');
  }

  static createSalesReturn(body: any) {
    return this.request('/sales/returns', { method: 'POST', body: JSON.stringify(body) });
  }

  // --- Purchases ---
  static listOrders() {
    return this.request('/purchases/orders');
  }

  static createOrder(body: any) {
    return this.request('/purchases/orders', { method: 'POST', body: JSON.stringify(body) });
  }

  static convertOrder(id: string) {
    return this.request(`/purchases/orders/${id}/convert`, { method: 'POST' });
  }

  static listPurchases(partyId?: string, search?: string) {
    const params = new URLSearchParams();
    if (partyId) params.append('partyId', partyId);
    if (search) params.append('search', search);
    return this.request(`/purchases/invoices?${params.toString()}`);
  }

  static getPurchase(id: string) {
    return this.request(`/purchases/invoices/${id}`);
  }

  static createPurchase(body: any) {
    return this.request('/purchases/invoices', { method: 'POST', body: JSON.stringify(body) });
  }

  static updatePurchase(id: string, body: any) {
    return this.request(`/purchases/invoices/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  }

  static postPurchase(id: string) {
    return this.request(`/purchases/invoices/${id}/post`, { method: 'POST' });
  }

  static quickBillPayment(id: string, body: any) {
    return this.request(`/purchases/invoices/${id}/quick-payment`, { method: 'POST', body: JSON.stringify(body) });
  }

  static listPurchaseReturns() {
    return this.request('/purchases/returns');
  }

  static createPurchaseReturn(body: any) {
    return this.request('/purchases/returns', { method: 'POST', body: JSON.stringify(body) });
  }

  // --- Treasury ---
  static listAccounts() {
    return this.request('/treasury/accounts');
  }

  static createAccount(body: any) {
    return this.request('/treasury/accounts', { method: 'POST', body: JSON.stringify(body) });
  }

  static listVouchers(type?: string) {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    return this.request(`/treasury/vouchers?${params.toString()}`);
  }

  static getVoucher(id: string) {
    return this.request(`/treasury/vouchers/${id}`);
  }

  static createVoucher(body: any) {
    return this.request('/treasury/vouchers', { method: 'POST', body: JSON.stringify(body) });
  }

  static voidVoucher(id: string, body: any = {}) {
    return this.request(`/treasury/vouchers/${id}/void`, { method: 'POST', body: JSON.stringify(body) });
  }

  static transferTreasuryFunds(body: any) {
    return this.request('/treasury/transfers', { method: 'POST', body: JSON.stringify(body) });
  }

  // --- CRM ---
  static listLeads(status?: string, search?: string) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (search) params.append('search', search);
    return this.request(`/crm/leads?${params.toString()}`);
  }

  static createLead(body: any) {
    return this.request('/crm/leads', { method: 'POST', body: JSON.stringify(body) });
  }

  static deleteLead(id: string) {
    return this.request(`/crm/leads/${id}`, { method: 'DELETE' });
  }

  static convertLead(leadId: string) {
    return this.request(`/crm/leads/${leadId}/convert`, { method: 'POST' });
  }

  static listPipelines() {
    return this.request('/crm/pipelines');
  }

  static createOpportunity(body: any) {
    return this.request('/crm/opportunities', { method: 'POST', body: JSON.stringify(body) });
  }

  static updateOpportunityStage(opportunityId: string, stageId: string, status?: string) {
    return this.request(`/crm/opportunities/${opportunityId}/stage`, {
      method: 'PUT',
      body: JSON.stringify({ stageId, status }),
    });
  }

  static deleteOpportunity(opportunityId: string) {
    return this.request(`/crm/opportunities/${opportunityId}`, { method: 'DELETE' });
  }

  static listActivities(isCompleted?: boolean) {
    const params = new URLSearchParams();
    if (isCompleted !== undefined) params.append('isCompleted', String(isCompleted));
    return this.request(`/crm/activities?${params.toString()}`);
  }

  static createActivity(body: any) {
    return this.request('/crm/activities', { method: 'POST', body: JSON.stringify(body) });
  }

  static toggleActivity(activityId: string, isCompleted: boolean) {
    return this.request(`/crm/activities/${activityId}/toggle`, {
      method: 'PUT',
      body: JSON.stringify({ isCompleted }),
    });
  }

  static deleteActivity(activityId: string) {
    return this.request(`/crm/activities/${activityId}`, { method: 'DELETE' });
  }

  // --- Reports ---
  static getDashboardSummary() {
    return this.request('/reports/dashboard-summary');
  }

  static getSalesReport(fromDate?: string, toDate?: string) {
    const params = new URLSearchParams();
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    return this.request(`/reports/sales?${params.toString()}`);
  }

  static getStockValuation() {
    return this.request('/reports/stock-valuation');
  }

  static getCustomerReceivables() {
    return this.request('/reports/customer-receivables');
  }

  static getSupplierPayables() {
    return this.request('/reports/supplier-payables');
  }

  // --- Company Settings, Branches, Staff & Roles ---
  static getCompanyProfile() {
    return this.request('/tenant/profile');
  }

  static updateCompanyProfile(body: any) {
    return this.request('/tenant/profile', { method: 'PUT', body: JSON.stringify(body) });
  }

  static listMembers() {
    return this.request('/tenant/members');
  }

  static inviteMember(body: any) {
    return this.request('/tenant/members', { method: 'POST', body: JSON.stringify(body) });
  }

  static updateMember(id: string, body: any) {
    return this.request(`/tenant/members/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  }

  static removeMember(id: string) {
    return this.request(`/tenant/members/${id}`, { method: 'DELETE' });
  }

  static listBranches() {
    return this.request('/tenant/branches');
  }

  static createBranch(body: any) {
    return this.request('/tenant/branches', { method: 'POST', body: JSON.stringify(body) });
  }

  static updateBranch(id: string, body: any) {
    return this.request(`/tenant/branches/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  }

  static deleteBranch(id: string) {
    return this.request(`/tenant/branches/${id}`, { method: 'DELETE' });
  }

  static listRoles() {
    return this.request('/tenant/roles');
  }

  static createRole(body: any) {
    return this.request('/tenant/roles', { method: 'POST', body: JSON.stringify(body) });
  }

  // --- Platform Owner ---
  static getPlatformOverview() {
    return this.request('/platform/overview');
  }

  static listPlatformTenants() {
    return this.request('/platform/tenants');
  }

  static createPlatformTenant(body: any) {
    return this.request('/platform/tenants', { method: 'POST', body: JSON.stringify(body) });
  }

  static getPlatformTenantDetails(id: string) {
    return this.request(`/platform/tenants/${id}`);
  }

  static updateTenantStatus(id: string, status: string, reason?: string) {
    return this.request(`/platform/tenants/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, reason }),
    });
  }

  static listPlatformPlans(includeArchived?: boolean) {
    return this.request(`/platform/plans${includeArchived ? '?includeArchived=true' : ''}`);
  }

  static createPlan(body: any) {
    return this.request('/platform/plans', { method: 'POST', body: JSON.stringify(body) });
  }

  static clonePlan(id: string, body: any) {
    return this.request(`/platform/plans/${id}/clone`, { method: 'POST', body: JSON.stringify(body) });
  }

  static toggleArchivePlan(id: string) {
    return this.request(`/platform/plans/${id}/archive`, { method: 'PUT' });
  }

  static updatePlan(id: string, body: any) {
    return this.request(`/platform/plans/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  }

  static manageTenantSubscription(tenantId: string, body: any) {
    return this.request(`/platform/tenants/${tenantId}/subscription`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  static setTenantFeatureOverride(tenantId: string, body: any) {
    return this.request(`/platform/tenants/${tenantId}/feature-override`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  static deleteTenantFeatureOverride(tenantId: string, featureKey: string) {
    return this.request(`/platform/tenants/${tenantId}/feature-override/${featureKey}`, {
      method: 'DELETE',
    });
  }

  static setTenantQuotaOverride(tenantId: string, body: any) {
    return this.request(`/platform/tenants/${tenantId}/quota-override`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  static listAuditLogs(limit?: number) {
    return this.request(`/platform/audit-logs${limit ? `?limit=${limit}` : ''}`);
  }
}
