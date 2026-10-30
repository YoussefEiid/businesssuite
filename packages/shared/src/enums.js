"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuotaKey = exports.LeadStatus = exports.AccountType = exports.VoucherType = exports.PartyType = exports.StockMovementType = exports.ItemType = exports.PaymentStatus = exports.DocumentStatus = exports.SystemRole = exports.TenantStatus = exports.SubscriptionStatus = exports.DeploymentMode = void 0;
var DeploymentMode;
(function (DeploymentMode) {
    DeploymentMode["SAAS"] = "SAAS";
    DeploymentMode["SINGLE_TENANT"] = "SINGLE_TENANT";
})(DeploymentMode || (exports.DeploymentMode = DeploymentMode = {}));
var SubscriptionStatus;
(function (SubscriptionStatus) {
    SubscriptionStatus["TRIAL"] = "TRIAL";
    SubscriptionStatus["ACTIVE"] = "ACTIVE";
    SubscriptionStatus["GRACE"] = "GRACE";
    SubscriptionStatus["SUSPENDED"] = "SUSPENDED";
    SubscriptionStatus["EXPIRED"] = "EXPIRED";
    SubscriptionStatus["CANCELLED"] = "CANCELLED";
})(SubscriptionStatus || (exports.SubscriptionStatus = SubscriptionStatus = {}));
var TenantStatus;
(function (TenantStatus) {
    TenantStatus["ACTIVE"] = "ACTIVE";
    TenantStatus["SUSPENDED"] = "SUSPENDED";
    TenantStatus["ARCHIVED"] = "ARCHIVED";
})(TenantStatus || (exports.TenantStatus = TenantStatus = {}));
var SystemRole;
(function (SystemRole) {
    SystemRole["SUPER_ADMIN"] = "SUPER_ADMIN";
    SystemRole["TENANT_OWNER"] = "TENANT_OWNER";
    SystemRole["COMPANY_ADMIN"] = "COMPANY_ADMIN";
    SystemRole["SALES_AGENT"] = "SALES_AGENT";
    SystemRole["WAREHOUSE_KEEPER"] = "WAREHOUSE_KEEPER";
    SystemRole["CASHIER"] = "CASHIER";
    SystemRole["REPORTS_VIEWER"] = "REPORTS_VIEWER";
    SystemRole["CUSTOM"] = "CUSTOM";
})(SystemRole || (exports.SystemRole = SystemRole = {}));
var DocumentStatus;
(function (DocumentStatus) {
    DocumentStatus["DRAFT"] = "DRAFT";
    DocumentStatus["POSTED"] = "POSTED";
    DocumentStatus["CANCELLED"] = "CANCELLED";
})(DocumentStatus || (exports.DocumentStatus = DocumentStatus = {}));
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["UNPAID"] = "UNPAID";
    PaymentStatus["PARTIALLY_PAID"] = "PARTIALLY_PAID";
    PaymentStatus["PAID"] = "PAID";
    PaymentStatus["OVERPAID"] = "OVERPAID";
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
var ItemType;
(function (ItemType) {
    ItemType["STOCK"] = "STOCK";
    ItemType["SERVICE"] = "SERVICE";
})(ItemType || (exports.ItemType = ItemType = {}));
var StockMovementType;
(function (StockMovementType) {
    StockMovementType["OPENING_BALANCE"] = "OPENING_BALANCE";
    StockMovementType["PURCHASE_RECEIPT"] = "PURCHASE_RECEIPT";
    StockMovementType["PURCHASE_RETURN"] = "PURCHASE_RETURN";
    StockMovementType["SALES_DELIVERY"] = "SALES_DELIVERY";
    StockMovementType["SALES_RETURN"] = "SALES_RETURN";
    StockMovementType["TRANSFER_OUT"] = "TRANSFER_OUT";
    StockMovementType["TRANSFER_IN"] = "TRANSFER_IN";
    StockMovementType["STOCKTAKE_ADJUSTMENT"] = "STOCKTAKE_ADJUSTMENT";
})(StockMovementType || (exports.StockMovementType = StockMovementType = {}));
var PartyType;
(function (PartyType) {
    PartyType["CUSTOMER"] = "CUSTOMER";
    PartyType["SUPPLIER"] = "SUPPLIER";
    PartyType["BOTH"] = "BOTH";
})(PartyType || (exports.PartyType = PartyType = {}));
var VoucherType;
(function (VoucherType) {
    VoucherType["RECEIPT"] = "RECEIPT";
    VoucherType["PAYMENT"] = "PAYMENT";
})(VoucherType || (exports.VoucherType = VoucherType = {}));
var AccountType;
(function (AccountType) {
    AccountType["CASH"] = "CASH";
    AccountType["BANK"] = "BANK";
})(AccountType || (exports.AccountType = AccountType = {}));
var LeadStatus;
(function (LeadStatus) {
    LeadStatus["NEW"] = "NEW";
    LeadStatus["CONTACTED"] = "CONTACTED";
    LeadStatus["QUALIFIED"] = "QUALIFIED";
    LeadStatus["PROPOSAL_SENT"] = "PROPOSAL_SENT";
    LeadStatus["WON"] = "WON";
    LeadStatus["LOST"] = "LOST";
})(LeadStatus || (exports.LeadStatus = LeadStatus = {}));
var QuotaKey;
(function (QuotaKey) {
    QuotaKey["USERS_LIMIT"] = "USERS_LIMIT";
    QuotaKey["BRANCHES_LIMIT"] = "BRANCHES_LIMIT";
    QuotaKey["WAREHOUSES_LIMIT"] = "WAREHOUSES_LIMIT";
    QuotaKey["ITEMS_LIMIT"] = "ITEMS_LIMIT";
    QuotaKey["MONTHLY_INVOICES_LIMIT"] = "MONTHLY_INVOICES_LIMIT";
    QuotaKey["ATTACHMENTS_STORAGE_MB"] = "ATTACHMENTS_STORAGE_MB";
})(QuotaKey || (exports.QuotaKey = QuotaKey = {}));
//# sourceMappingURL=enums.js.map