# Platform Owner & SaaS Administration Guide - BusinessSuite

This guide instructs the Platform Owner on managing subscription plans, dynamic feature toggles, tenant overrides, and billing.

---

## 1. Accessing the Platform Admin Portal

1. Log in with the SuperAdmin credentials at `http://localhost:3000/login` (`admin@business-suite.local` / `Admin123456!`).
2. Navigate to **لوحة مالك المنصة (Platform Owner)** in the sidebar.

---

## 2. Managing Subscription Plans & Features

- Under the **كتالوج الباقات والاستحقاقات** tab:
  - Click **تعديل المزايا والأسعار والحدود** on any plan.
  - Check or uncheck features from the live Feature Matrix.
  - Modify monthly/yearly pricing or quota caps (`USERS_LIMIT`, `ITEMS_LIMIT`, `MONTHLY_INVOICES_LIMIT`).
  - Click **حفظ وتطبيق التغييرات فورًا**.
  - *Result*: All subscribed tenants immediately gain or lose access to those features without server restarts or redeployment.

---

## 3. Applying Tenant-Specific Feature Overrides

To grant a custom feature addon (or temporarily disable a feature) for a specific company:
1. Under **قائمة الشركات والمشتركين**, click **استثناء ميزة** next to the target company.
2. Select the feature key from the dropdown (e.g. `reports.advanced`).
3. Select **ALLOW** (to grant) or **DENY** (to restrict).
4. Enter the business reason for audit compliance.
5. Click **تطبيق الاستثناء فورًا**.
6. The override takes precedence over the company's base plan instantly.

---

## 4. Manual Subscription Renewal & Payment Logging

1. Open the company record.
2. Enter the new end date and payment amount received via wire transfer or cash.
3. Select payment method (`MANUAL_BANK_TRANSFER`, `CASH`).
4. Save: The system creates a verified `BillingLog` entry and updates platform revenue analytics.
