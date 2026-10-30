export declare enum DeploymentMode {
    SAAS = "SAAS",
    SINGLE_TENANT = "SINGLE_TENANT"
}
export declare enum SubscriptionStatus {
    TRIAL = "TRIAL",
    ACTIVE = "ACTIVE",
    GRACE = "GRACE",
    SUSPENDED = "SUSPENDED",
    EXPIRED = "EXPIRED",
    CANCELLED = "CANCELLED"
}
export declare enum TenantStatus {
    ACTIVE = "ACTIVE",
    SUSPENDED = "SUSPENDED",
    ARCHIVED = "ARCHIVED"
}
export declare enum SystemRole {
    SUPER_ADMIN = "SUPER_ADMIN",
    TENANT_OWNER = "TENANT_OWNER",
    COMPANY_ADMIN = "COMPANY_ADMIN",
    SALES_AGENT = "SALES_AGENT",
    WAREHOUSE_KEEPER = "WAREHOUSE_KEEPER",
    CASHIER = "CASHIER",
    REPORTS_VIEWER = "REPORTS_VIEWER",
    CUSTOM = "CUSTOM"
}
export declare enum DocumentStatus {
    DRAFT = "DRAFT",
    POSTED = "POSTED",
    CANCELLED = "CANCELLED"
}
export declare enum PaymentStatus {
    UNPAID = "UNPAID",
    PARTIALLY_PAID = "PARTIALLY_PAID",
    PAID = "PAID",
    OVERPAID = "OVERPAID"
}
export declare enum ItemType {
    STOCK = "STOCK",
    SERVICE = "SERVICE"
}
export declare enum StockMovementType {
    OPENING_BALANCE = "OPENING_BALANCE",
    PURCHASE_RECEIPT = "PURCHASE_RECEIPT",
    PURCHASE_RETURN = "PURCHASE_RETURN",
    SALES_DELIVERY = "SALES_DELIVERY",
    SALES_RETURN = "SALES_RETURN",
    TRANSFER_OUT = "TRANSFER_OUT",
    TRANSFER_IN = "TRANSFER_IN",
    STOCKTAKE_ADJUSTMENT = "STOCKTAKE_ADJUSTMENT"
}
export declare enum PartyType {
    CUSTOMER = "CUSTOMER",
    SUPPLIER = "SUPPLIER",
    BOTH = "BOTH"
}
export declare enum VoucherType {
    RECEIPT = "RECEIPT",
    PAYMENT = "PAYMENT"
}
export declare enum AccountType {
    CASH = "CASH",
    BANK = "BANK"
}
export declare enum LeadStatus {
    NEW = "NEW",
    CONTACTED = "CONTACTED",
    QUALIFIED = "QUALIFIED",
    PROPOSAL_SENT = "PROPOSAL_SENT",
    WON = "WON",
    LOST = "LOST"
}
export declare enum QuotaKey {
    USERS_LIMIT = "USERS_LIMIT",
    BRANCHES_LIMIT = "BRANCHES_LIMIT",
    WAREHOUSES_LIMIT = "WAREHOUSES_LIMIT",
    ITEMS_LIMIT = "ITEMS_LIMIT",
    MONTHLY_INVOICES_LIMIT = "MONTHLY_INVOICES_LIMIT",
    ATTACHMENTS_STORAGE_MB = "ATTACHMENTS_STORAGE_MB"
}
