# Entitlements & Subscription Policy - BusinessSuite

## 1. Hierarchy of Precedence (Authorization Pipeline)

Every protected API call and UI action evaluates entitlements according to the following order of precedence:

1. **System & Platform Status**:
   - Platform Kill Switch / Maintenance Mode $\rightarrow$ Deny all (except SuperAdmin).
2. **Subscription Lifecycle State**:
   - `SUSPENDED` / `CANCELLED` $\rightarrow$ Block all tenant operational requests (HTTP 403 `SUBSCRIPTION_SUSPENDED`).
   - `EXPIRED` $\rightarrow$ Switch tenant to Read-Only archive mode; block write/create actions.
   - `TRIAL` / `ACTIVE` / `GRACE` $\rightarrow$ Proceed to next check.
3. **Tenant Feature Overrides**:
   - If tenant has an explicit override for feature $F$:
     - `DENY` $\rightarrow$ Denied immediately (overrules plan).
     - `ALLOW` $\rightarrow$ Allowed (grants feature even if not in base plan).
4. **Base Plan Feature Registry**:
   - If feature $F$ is included in tenant's active plan $\rightarrow$ Proceed.
   - If not in plan $\rightarrow$ Deny (HTTP 403 `FEATURE_NOT_IN_PLAN`).
5. **Feature Dependencies**:
   - If feature $F$ requires dependency $D$, $D$ must also be enabled.
6. **User RBAC & Permission Matrix**:
   - Tenant User must have the specific action permission (e.g., `sales.invoices.create`, `reports.view_cost`).
7. **Branch / Warehouse Contextual Scope**:
   - If the user's role is constrained to specific branches or warehouses, access outside that scope is blocked.
8. **Usage Quotas & Throttles**:
   - If the action consumes a quota (e.g., number of active users, active items, monthly invoices), the atomic counter is checked against the plan/override limit.

---

## 2. Plan Modifications & Downgrades

### 2.1 Modifying Plan Features
- When a plan is modified by Platform Owner:
  - Affected tenant entitlement caches in Redis / Memory are invalidated instantly using Pub/Sub or cache version tagging.
  - No server restart or application rebuild is needed.

### 2.2 Plan Downgrades & Quota Overages
- **No Data Loss**: Existing records (e.g., items, invoices, historical data) are never deleted upon downgrade.
- **Resource Throttling**: If current usage exceeds the new lower quota:
  - System blocks **creation** of new resources (e.g. creating item #51 when limit is 50).
  - Existing resources remain accessible for operations according to the feature policy.
- **Disabled Features**: Historical data for disabled features switches to Read-Only mode.

---

## 3. Standard Feature Catalog Keys

| Feature Key | Name (AR) | Name (EN) | Category | Dependencies |
|---|---|---|---|---|
| `sales.core` | المبيعات الأساسية | Sales Core | Sales | None |
| `sales.quotations` | عروض الأسعار | Sales Quotations | Sales | `sales.core` |
| `sales.returns` | مرتجعات المبيعات | Sales Returns | Sales | `sales.core` |
| `purchases.core` | المشتريات الأساسية | Purchases Core | Purchases | None |
| `purchases.orders` | أوامر الشراء | Purchase Orders | Purchases | `purchases.core` |
| `purchases.returns` | مرتجعات المشتريات | Purchase Returns | Purchases | `purchases.core` |
| `inventory.core` | المخزون الأساسي | Inventory Core | Inventory | None |
| `inventory.transfers` | التحويلات بين المخازن | Warehouse Transfers | Inventory | `inventory.core` |
| `inventory.stocktake` | الجرد والتسويات | Stocktake & Adjustments | Inventory | `inventory.core` |
| `crm.contacts` | إدارة جهات الاتصال | CRM Contacts | CRM | None |
| `crm.pipeline` | مسار المبيعات والفرص | CRM Deals & Pipeline | CRM | `crm.contacts` |
| `finance.cashbank` | الخزائن والبنوك | Treasury & Cash/Bank | Finance | None |
| `finance.allocations` | تخصيص الدفعات المتقدم | Advanced Allocations | Finance | `finance.cashbank` |
| `reports.basic` | التقارير الأساسية | Basic Reports | Reports | None |
| `reports.advanced` | التقارير المتقدمة والتحليل | Advanced Reports | Reports | `reports.basic` |
| `reports.cost_visibility` | رؤية التكلفة وهامش الربح | Cost & Margin Visibility | Reports | `reports.basic` |
| `branding.custom` | تخصيص الهوية والشعار | Custom Branding | Settings | None |
| `staff.custom_roles` | أدوار وصلاحيات مخصصة | Custom Staff Roles | Staff | None |
| `tools.import_export` | استيراد وتصدير البيانات | Import & Export Tools | Tools | None |
