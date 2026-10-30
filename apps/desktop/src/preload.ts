import { contextBridge, ipcRenderer } from 'electron';
import {
  DesktopIpcChannels,
  PrintReceiptPayload,
  PrintInvoicePayload,
  DesktopConfig,
  BusinessSuiteDesktopBridge,
} from '@business-suite/shared';

/**
 * Preload script exposing strictly whitelisted capabilities to the renderer world.
 * nodeIntegration is FALSE, contextIsolation is TRUE.
 * ipcRenderer is NEVER directly accessible from the renderer.
 */
const desktopBridge: BusinessSuiteDesktopBridge = {
  isDesktop: true,

  getVersion: () => ipcRenderer.invoke(DesktopIpcChannels.GET_VERSION),

  getPrinters: () => ipcRenderer.invoke(DesktopIpcChannels.GET_PRINTERS),

  printReceipt: (payload: PrintReceiptPayload) =>
    ipcRenderer.invoke(DesktopIpcChannels.PRINT_RECEIPT, payload),

  printInvoice: (payload: PrintInvoicePayload) =>
    ipcRenderer.invoke(DesktopIpcChannels.PRINT_INVOICE, payload),

  openCashDrawer: () => ipcRenderer.invoke(DesktopIpcChannels.OPEN_CASH_DRAWER),

  getDesktopConfig: () => ipcRenderer.invoke(DesktopIpcChannels.GET_CONFIG),

  saveDesktopConfig: (config: Partial<DesktopConfig>) =>
    ipcRenderer.invoke(DesktopIpcChannels.SAVE_CONFIG, config),

  resetDesktopConfig: () => ipcRenderer.invoke(DesktopIpcChannels.RESET_CONFIG),

  getLogsPath: () => ipcRenderer.invoke(DesktopIpcChannels.GET_LOGS_PATH),

  openLogsFolder: () => ipcRenderer.invoke(DesktopIpcChannels.OPEN_LOGS_FOLDER),

  retryConnection: () => ipcRenderer.invoke(DesktopIpcChannels.RETRY_CONNECTION),

  createBackup: (customPath?: string) =>
    ipcRenderer.invoke(DesktopIpcChannels.CREATE_BACKUP, customPath),

  listBackups: () => ipcRenderer.invoke(DesktopIpcChannels.LIST_BACKUPS),

  restoreBackup: (backupPath: string) =>
    ipcRenderer.invoke(DesktopIpcChannels.RESTORE_BACKUP, backupPath),

  openDataFolder: () => ipcRenderer.invoke(DesktopIpcChannels.OPEN_DATA_FOLDER),

  openBackupsFolder: () => ipcRenderer.invoke(DesktopIpcChannels.OPEN_BACKUPS_FOLDER),

  getLicenseStatus: () => ipcRenderer.invoke(DesktopIpcChannels.GET_LICENSE_STATUS),

  activateLicense: (licenseKey: string) =>
    ipcRenderer.invoke(DesktopIpcChannels.ACTIVATE_LICENSE, licenseKey),

  getAppStatus: () => ipcRenderer.invoke(DesktopIpcChannels.GET_APP_STATUS),

  onBarcodeScanned: (callback: (barcode: string) => void) => {
    const handler = (_: any, barcode: string) => callback(barcode);
    ipcRenderer.on(DesktopIpcChannels.BARCODE_SCANNED, handler);
    return () => {
      ipcRenderer.removeListener(DesktopIpcChannels.BARCODE_SCANNED, handler);
    };
  },
};

contextBridge.exposeInMainWorld('businessSuiteDesktop', desktopBridge);
