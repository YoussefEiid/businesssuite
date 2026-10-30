# Assumptions & Design Decisions - BusinessSuite

This document details key technical and operational assumptions made for the implementation of BusinessSuite Version 1.0.

---

## 1. Multi-Tenancy & Isolation Model
- **Single Shared PostgreSQL Database with RLS**: All tenant data resides in a single PostgreSQL database with explicit `tenant_id` columns, unique compound indices (`[tenant_id, id]`, `[tenant_id, code]`), and PostgreSQL Row-Level Security (RLS) as an enforcing defense-in-depth layer.
- **Tenant Context Derivation**: The active tenant context is derived from the verified user session/membership, not trusted blindly from request headers or payloads.
- **Support Access**: Platform administrators cannot silently impersonate or browse tenant data without explicit, time-bounded, audit-logged support session tokens.

---

## 2. Currency, Arithmetic, and Accounting Boundary
- **Operational Ledger vs General Ledger**: BusinessSuite v1.0 implements operational sub-ledgers (Customer Receivables, Vendor Payables, Cash/Bank Books, and Stock Movement Valuations). It deliberately does not implement double-entry General Ledger chart of accounts or statutory tax filings.
- **Precision**: Monetary figures use `DECIMAL(18, 4)` in database storage and formatted to 2 or 3 decimals as defined by tenant settings.
- **Single Base Currency per Tenant**: In v1.0, each tenant operates under a single primary currency configured upon setup. Currency modification after financial transactions exist is prohibited.
- **Inventory Costing**: Moving Weighted Average Cost (WAC) is calculated on every purchase invoice posting. Unit cost is snapshotted upon sales invoice posting to maintain immutable historical cost of goods sold.

---

## 3. Stock Invariance & Negative Stock
- **Negative Stock Prohibition**: No stock movement is allowed to drop inventory below zero in any warehouse. Concurrent stock deductions use pessimistic locking or serializable atomic transactions.
- **Posting Events**:
  - Sales Quotations and Purchase Orders are non-affecting draft records.
  - Sales Invoice posting decrements stock.
  - Purchase Invoice posting increments stock.
  - Return documents reverse stock movements explicitly referencing the original invoice lines.

---

## 4. Subscriptions, Pricing & Quotas
- **Manual Billing & Invoicing in v1.0**: Subscriptions, renewals, upgrades, and manual payment receipts are managed directly by the Platform Owner via the Platform Admin portal. No third-party payment gateway is simulated or assumed.
- **Plan Pricing**: Initial default plans (Starter, Growth, Business) are seeded with configurable parameters and features, leaving final pricing unconfigured for platform owner specification.
- **Quota Exceeded Policy**: When a quota (e.g., active items, users, monthly invoices) is reached, existing data remains accessible (read-only), but new creation of the throttled resource is rejected.

---

## 5. Deployment Modes
- **SaaS Multi-Tenant Mode**: Standard mode where multiple companies are managed via the platform owner dashboard with dynamic subscriptions and plan gates.
- **Single-Tenant On-Premise Mode**: Configured via `DEPLOYMENT_MODE=SINGLE_TENANT` where a single pre-configured tenant operates with full features enabled without platform subscription checks.
