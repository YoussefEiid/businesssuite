/**
 * Desktop configuration and IPC contracts for BusinessSuite Desktop Edition
 */

export enum DesktopIpcChannels {
  GET_VERSION = 'desktop:get-version',
  GET_PRINTERS = 'desktop:get-printers',
  PRINT_RECEIPT = 'desktop:print-receipt',
  PRINT_INVOICE = 'desktop:print-invoice',
  OPEN_CASH_DRAWER = 'desktop:open-cash-drawer',
  GET_CONFIG = 'desktop:get-config',
  SAVE_CONFIG = 'desktop:save-config',
  RESET_CONFIG = 'desktop:reset-config',
  GET_LOGS_PATH = 'desktop:get-logs-path',
  OPEN_LOGS_FOLDER = 'desktop:open-logs-folder',
  RETRY_CONNECTION = 'desktop:retry-connection',
  BARCODE_SCANNED = 'desktop:barcode-scanned',
  // Offline Desktop Infrastructure Channels
  CREATE_BACKUP = 'desktop:create-backup',
  LIST_BACKUPS = 'desktop:list-backups',
  RESTORE_BACKUP = 'desktop:restore-backup',
  OPEN_DATA_FOLDER = 'desktop:open-data-folder',
  OPEN_BACKUPS_FOLDER = 'desktop:open-backups-folder',
  GET_LICENSE_STATUS = 'desktop:get-license-status',
  ACTIVATE_LICENSE = 'desktop:activate-license',
  GET_APP_STATUS = 'desktop:get-app-status',
}

export type PaperWidth = '80mm' | '58mm';
export type DesktopDeploymentMode = 'DESKTOP_OFFLINE' | 'WEB_SAAS';

export const DEFAULT_PRODUCTION_URL = 'https://app.businesssuite.com';
export const DEFAULT_DEVELOPMENT_URL = 'http://localhost:3000';
export const DEFAULT_OFFLINE_URL = 'http://127.0.0.1';

export function isLocalhostUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const h = parsed.hostname.toLowerCase();
    return (
      h === 'localhost' ||
      h === '127.0.0.1' ||
      h === '::1' ||
      h === '[::1]' ||
      h === '0.0.0.0' ||
      h.endsWith('.localhost')
    );
  } catch {
    return false;
  }
}

export interface BackupFileInfo {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  sizeFormatted: string;
  createdAt: string;
  version: string;
}

export interface LicenseInfo {
  isValid: boolean;
  isTrial: boolean;
  licensee: string;
  companyName: string;
  expiresAt: string | null;
  daysRemaining: number | null;
  hardwareId: string;
  tier: string;
  error?: string;
}

export interface AppStatusInfo {
  version: string;
  mode: DesktopDeploymentMode;
  apiPort: number;
  dbPort: number;
  isDatabaseReady: boolean;
  isApiReady: boolean;
  dataPath: string;
  backupsPath: string;
  logsPath: string;
}

export interface DesktopConfig {
  deploymentMode: DesktopDeploymentMode;
  targetUrl: string;
  receiptPrinter: string;
  invoicePrinter: string;
  silentPrinting: boolean;
  receiptPaperWidth: PaperWidth;
  openCashDrawerOnSale: boolean;
  autostart: boolean;
  minimizeToTray: boolean;
  backupRetentionCount: number;
  autoBackupDaily: boolean;
}

export const DEFAULT_DESKTOP_CONFIG: DesktopConfig = {
  deploymentMode: 'DESKTOP_OFFLINE',
  targetUrl: DEFAULT_OFFLINE_URL,
  receiptPrinter: '',
  invoicePrinter: '',
  silentPrinting: false,
  receiptPaperWidth: '80mm',
  openCashDrawerOnSale: true,
  autostart: false,
  minimizeToTray: false,
  backupRetentionCount: 14,
  autoBackupDaily: true,
};

export interface PrinterInfo {
  name: string;
  displayName?: string;
  description?: string;
  isDefault: boolean;
  status?: number;
}

export interface PrintReceiptLine {
  name: string;
  nameAr?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  taxRate?: number;
}

export interface PrintReceiptPayload {
  invoiceNumber: string;
  date: string;
  cashierName?: string;
  customerName?: string;
  companyName: string;
  companyTaxNumber?: string;
  companyPhone?: string;
  companyAddress?: string;
  currency: string;
  items: PrintReceiptLine[];
  subtotal: number;
  taxTotal: number;
  discountTotal?: number;
  grandTotal: number;
  tenderedAmount?: number;
  changeDue?: number;
  paymentMethod?: string;
  notes?: string;
  paperWidth?: PaperWidth;
  silent?: boolean;
}

export interface PrintInvoicePayload {
  invoiceNumber: string;
  date: string;
  dueDate?: string;
  partyName: string;
  partyTaxNumber?: string;
  partyPhone?: string;
  partyAddress?: string;
  companyName: string;
  companyTaxNumber?: string;
  companyCommercialReg?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyAddress?: string;
  currency: string;
  items: {
    sku?: string;
    name: string;
    nameAr?: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    taxAmount: number;
    discount?: number;
    total: number;
  }[];
  subtotal: number;
  taxTotal: number;
  discountTotal?: number;
  grandTotal: number;
  paymentStatus?: string;
  notes?: string;
  silent?: boolean;
}

export interface BusinessSuiteDesktopBridge {
  isDesktop: boolean;
  getVersion: () => Promise<string>;
  getPrinters: () => Promise<PrinterInfo[]>;
  printReceipt: (payload: PrintReceiptPayload) => Promise<{ success: boolean; error?: string }>;
  printInvoice: (payload: PrintInvoicePayload) => Promise<{ success: boolean; error?: string }>;
  openCashDrawer: () => Promise<{ success: boolean; error?: string }>;
  getDesktopConfig: () => Promise<DesktopConfig>;
  saveDesktopConfig: (config: Partial<DesktopConfig>) => Promise<{ success: boolean; error?: string }>;
  resetDesktopConfig: () => Promise<{ success: boolean; error?: string }>;
  getLogsPath: () => Promise<string>;
  openLogsFolder: () => Promise<void>;
  retryConnection: () => Promise<void>;
  onBarcodeScanned: (callback: (barcode: string) => void) => () => void;
  // Offline Desktop Infrastructure Methods
  createBackup: (customPath?: string) => Promise<{ success: boolean; backupPath?: string; error?: string }>;
  listBackups: () => Promise<BackupFileInfo[]>;
  restoreBackup: (backupPath: string) => Promise<{ success: boolean; error?: string }>;
  openDataFolder: () => Promise<void>;
  openBackupsFolder: () => Promise<void>;
  getLicenseStatus: () => Promise<LicenseInfo>;
  activateLicense: (licenseKey: string) => Promise<{ success: boolean; error?: string }>;
  getAppStatus: () => Promise<AppStatusInfo>;
  getApiUrl?: () => string;
}

