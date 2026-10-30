# Frontend Bundle & Dependency Analysis

**System:** BusinessSuite Commercial ERP & SaaS  
**Framework:** Next.js 14.2.35 (App Router) + React 18.3.1 + TailwindCSS 3.4.3  
**Analysis Date:** 2026-10-28  

---

## 1. Production Bundle Composition Overview

Next.js production build metrics across routes:

| Route | Raw Page Size | First Load JS (Gzip) | First Load JS (Uncompressed Chunks) | Chunk Nature |
|---|---|---|---|---|
| `/` (Root redirector) | 590 B | 90.5 kB | ~440 kB | Dynamic client redirect |
| `/_not-found` | 873 B | 88.1 kB | ~430 kB | Static error page |
| `/login` | 2.07 kB | 101 kB | ~448 kB | Auth form |
| `/register` | 2.15 kB | 102 kB | ~451 kB | Registration form |
| `/dashboard` | 3.48 kB | 106 kB | ~455 kB | Overview KPIs & Summary |
| `/dashboard/crm` | 9.31 kB | 112 kB | ~475 kB | CRM Kanban, Leads, Activities |
| `/dashboard/inventory` | 12.4 kB | 115 kB | ~493 kB | Items, Transfers, Adjustments, CSV |
| `/dashboard/parties` | 6.34 kB | 109 kB | ~468 kB | Customers, Suppliers, Statements |
| `/dashboard/purchases` | 9.30 kB | 119 kB | ~498 kB | Vendor Bills, Orders, Returns, Files |
| `/dashboard/reports` | 6.99 kB | 109 kB | ~469 kB | Sales, Valuation, Debtors, Creditors |
| `/dashboard/sales` | 6.88 kB | 117 kB | ~488 kB | Invoices, Quotations, Returns, Print |
| `/dashboard/settings` | 10.2 kB | 113 kB | ~490 kB | Company, Branches, Warehouses, Roles |
| `/dashboard/treasury` | 8.44 kB | 111 kB | ~480 kB | Cash, Bank, Vouchers, Transfers |
| `/platform` | 13.9 kB | 116 kB | ~505 kB | Plans, Tenants, Overrides, Audit |

### Shared Core Chunks (All Routes)
- `1dd3208c-de6a4d9435f2f66b.js`: 53.6 kB gzip (172.8 kB raw) — React runtime, ReactDOM, Lucide icon shared exports
- `528-719f5d85570604fa.js`: 31.7 kB gzip (124.3 kB raw) — Shared UI, layout hooks (`useAuth`, `useEntitlements`, `api.ts`)
- Other shared runtime chunks: 1.89 kB gzip
- **Total Shared First Load JS:** 87.2 kB gzip

---

## 2. Dependency Audit

### Installed Direct Dependencies (`apps/web/package.json`)
```json
{
  "dependencies": {
    "@business-suite/shared": "*",
    "clsx": "^2.1.1",
    "lucide-react": "^0.378.0",
    "next": "^14.2.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwind-merge": "^2.3.0"
  }
}
```

### Dependency Findings & Assessment:
1. **Lightweight Core**: The web application avoids bloated external dependencies (e.g. no 500kB Chart.js, no Moment.js, no Lodash, no heavy UI suites like Ant Design or MUI). This is an excellent foundation for fast cold starts and low memory usage.
2. **Missing Font Subsetting**: Google Fonts are not bundled via `next/font`. Without `next/font`, the system relies on system fonts or external font requests, causing font layout shift (CLS) and degraded Arabic glyph alignment.
3. **No Redundant Polyfills**: Clean modern ES target (`ES2022`) in `@business-suite/shared` and Next.js modern browser matrix.
4. **Zero Unused Heavy Dependencies**: No orphaned chart, animation, or 3D libraries detected in `node_modules` for the web package.

---

## 3. Chunk Splitting & Dynamic Import Opportunities

### 3.1 Heavy Modals Eagerly Bundled
Currently, several large modals are imported directly at the top of page components:
- `PrintableInvoiceModal` (384 lines, contains dual layout A4/Thermal 80mm print templates, QR code mock, and print styling): Included directly in `sales/page.tsx` and `purchases/page.tsx`.
- `SearchableItemSelect` (211 lines, item search filter dropdown): Included synchronously.
- Inventory CSV parser & import dialog.
- Platform plan cloner & feature override engines.

**Optimization Strategy**:
- Wrap `PrintableInvoiceModal` with `next/dynamic` with `{ ssr: false }`. Users only pay the JS cost when clicking "Print".
- Move CSV import dialog into a lazy-loaded chunk.
- Reduces initial JS for `/dashboard/sales` and `/dashboard/purchases` by approximately 8–12 kB gzip.

---

## 4. API Network Footprint & Waterfall Audit

### Baseline Observations:
1. **Search Inputs**: Zero debouncing. Typing a 6-character item code fires 6 consecutive HTTP GET requests to `/inventory/items?search=...`.
2. **Tab Changes**: In `SalesPage`, changing tabs triggers full refetch of 8 different API endpoints instead of scoping to the active tab.
3. **Redundant Auth & Entitlement Checks**: Each page navigation validates profile and entitlements. Caching active entitlements in memory for the session avoids cascading waterfalls.

### Target Performance Remediation:
- Add a 250ms debounced search hook (`useDebounce`).
- Scope data queries to active tabs.
- Add request state indicators to eliminate duplicate submits.
