# Requirements Traceability Matrix - BusinessSuite

| ID | Requirement Area | Feature / Capability | Implementation Path | Verification & Test Path | Status |
|---|---|---|---|---|---|
| **REQ-01** | Multi-Tenancy | Strict tenant isolation, composite foreign keys, RLS policies | `apps/api/src/tenants`, `apps/api/prisma/schema.prisma` | `apps/api/test/tenancy.e2e-spec.ts` | Planned |
| **REQ-02** | Platform Admin | Company management, plan creation, subscription lifecycle | `apps/api/src/platform`, `apps/web/app/platform` | `apps/api/test/platform.e2e-spec.ts` | Planned |
| **REQ-03** | Dynamic Entitlements | Real-time feature matrix, plan limits, tenant-specific overrides | `apps/api/src/entitlements`, `apps/web/src/hooks/use-entitlements.ts` | `apps/api/test/entitlements.spec.ts` | Planned |
| **REQ-04** | Auth & IAM | JWT/Session auth, multi-tenant switching, MFA for Platform Owner | `apps/api/src/auth`, `apps/web/app/(auth)` | `apps/api/test/auth.e2e-spec.ts` | Planned |
| **REQ-05** | Master Data | Customers & Suppliers with separate balances, opening balances | `apps/api/src/parties`, `apps/web/app/dashboard/parties` | `apps/api/test/parties.spec.ts` | Planned |
| **REQ-06** | CRM | Leads, Deals pipeline, stages, activities, conversion to customer | `apps/api/src/crm`, `apps/web/app/dashboard/crm` | `apps/api/test/crm.spec.ts` | Planned |
| **REQ-07** | Inventory | Multi-warehouse, items & services, multi-unit, Moving WAC, stock transfers | `apps/api/src/inventory`, `apps/web/app/dashboard/inventory` | `apps/api/test/inventory.spec.ts` | Planned |
| **REQ-08** | Stock Movements | Stocktake & adjustments, negative stock rejection, low stock alerts | `apps/api/src/inventory/stock-movement.service.ts` | `apps/api/test/stock-movement.spec.ts` | Planned |
| **REQ-09** | Sales Engine | Quotations, Cash/Credit Invoices, tax engine (inclusive/exclusive), discounts | `apps/api/src/sales`, `apps/web/app/dashboard/sales` | `apps/api/test/sales.e2e-spec.ts` | Planned |
| **REQ-10** | Purchases Engine | Purchase orders, vendor bills, stock addition, landed cost WAC updates | `apps/api/src/purchases`, `apps/web/app/dashboard/purchases` | `apps/api/test/purchases.e2e-spec.ts` | Planned |
| **REQ-11** | Returns Management | Sales & Purchase returns linked to original documents with max qty check | `apps/api/src/returns`, `apps/web/app/dashboard/returns` | `apps/api/test/returns.spec.ts` | Planned |
| **REQ-12** | Treasury & Payments | Cash boxes, bank accounts, receipt & payment vouchers, multi-invoice allocations | `apps/api/src/treasury`, `apps/web/app/dashboard/treasury` | `apps/api/test/treasury.e2e-spec.ts` | Planned |
| **REQ-13** | Reporting & Analytics | Sales, Purchases, Stock Valuation, Debts/Receivables, Gross Profit, Cost Protection | `apps/api/src/reports`, `apps/web/app/dashboard/reports` | `apps/api/test/reports.spec.ts` | Planned |
| **REQ-14** | Arabic & RTL UI | Bilingual Arabic (RTL default) / English (LTR), responsive UI, printable invoices | `apps/web/src/locales`, `apps/web/components/print` | Playwright E2E UI tests | Planned |
| **REQ-15** | Single-Tenant Mode | Environment-driven deployment switch for SaaS or isolated On-Premise instance | `apps/api/src/config`, `docker-compose.single-tenant.yml` | `apps/api/test/single-tenant.spec.ts` | Planned |
| **REQ-16** | Backup & Recovery | Database export/import tools, isolated tenant JSON/SQL export, system restore | `scripts/backup.sh`, `scripts/restore.sh` | Disaster recovery test script | Planned |
