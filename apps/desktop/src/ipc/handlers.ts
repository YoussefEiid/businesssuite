import { ipcMain, app, shell, BrowserWindow } from 'electron';
import {
  DesktopIpcChannels,
  PrintReceiptPayload,
  PrintInvoicePayload,
  DesktopConfig,
} from '@business-suite/shared';
import { printerService } from '../services/printer.service';
import { configService } from '../services/config.service';
import { logger } from '../services/logger.service';
import { backupService } from '../services/backup.service';
import { licenseService } from '../services/license.service';
import { postgresService } from '../services/postgres.service';
import { apiProcessService } from '../services/api-process.service';

export function registerIpcHandlers(mainWindowGetter: () => BrowserWindow | null): void {
  // 1. App Version
  ipcMain.handle(DesktopIpcChannels.GET_VERSION, async () => {
    return app.getVersion();
  });

  // 2. Discover OS Printers
  ipcMain.handle(DesktopIpcChannels.GET_PRINTERS, async () => {
    const win = mainWindowGetter();
    return printerService.getPrinters(win || undefined);
  });

  // 3. Print Thermal Receipt
  ipcMain.handle(DesktopIpcChannels.PRINT_RECEIPT, async (_, payload: PrintReceiptPayload) => {
    try {
      if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid receipt payload structure');
      }
      if (!payload.invoiceNumber || !payload.companyName || !Array.isArray(payload.items)) {
        throw new Error('Missing mandatory receipt fields (invoiceNumber, companyName, items)');
      }
      return await printerService.printReceipt(payload);
    } catch (err: any) {
      logger.error('IPC Error: PRINT_RECEIPT failed', err);
      return { success: false, error: err.message };
    }
  });

  // 4. Print A4 Invoice
  ipcMain.handle(DesktopIpcChannels.PRINT_INVOICE, async (_, payload: PrintInvoicePayload) => {
    try {
      if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid invoice payload structure');
      }
      if (!payload.invoiceNumber || !payload.partyName || !Array.isArray(payload.items)) {
        throw new Error('Missing mandatory invoice fields (invoiceNumber, partyName, items)');
      }
      return await printerService.printInvoice(payload);
    } catch (err: any) {
      logger.error('IPC Error: PRINT_INVOICE failed', err);
      return { success: false, error: err.message };
    }
  });

  // 5. Open Cash Drawer
  ipcMain.handle(DesktopIpcChannels.OPEN_CASH_DRAWER, async () => {
    try {
      return await printerService.openCashDrawer();
    } catch (err: any) {
      logger.error('IPC Error: OPEN_CASH_DRAWER failed', err);
      return { success: false, error: err.message };
    }
  });

  // 6. Get Desktop Configuration
  ipcMain.handle(DesktopIpcChannels.GET_CONFIG, async () => {
    return configService.getConfig();
  });

  // 7. Save Desktop Configuration
  ipcMain.handle(DesktopIpcChannels.SAVE_CONFIG, async (_, updates: Partial<DesktopConfig>) => {
    try {
      if (!updates || typeof updates !== 'object') {
        throw new Error('Invalid configuration payload');
      }
      const saved = configService.saveConfig(updates);
      return { success: true, config: saved };
    } catch (err: any) {
      logger.error('IPC Error: SAVE_CONFIG failed', err);
      return { success: false, error: err.message };
    }
  });

  // 8. Reset Desktop Configuration
  ipcMain.handle(DesktopIpcChannels.RESET_CONFIG, async () => {
    try {
      const reset = configService.resetConfig();
      return { success: true, config: reset };
    } catch (err: any) {
      logger.error('IPC Error: RESET_CONFIG failed', err);
      return { success: false, error: err.message };
    }
  });

  // 9. Get Logs Path
  ipcMain.handle(DesktopIpcChannels.GET_LOGS_PATH, async () => {
    return logger.getLogFilePath();
  });

  // 10. Open Logs Folder in Windows Explorer
  ipcMain.handle(DesktopIpcChannels.OPEN_LOGS_FOLDER, async () => {
    try {
      const dir = logger.getLogsDirectory();
      await shell.openPath(dir);
    } catch (err: any) {
      logger.error('Failed to open logs folder', err);
    }
  });

  // 11. Retry Connection
  ipcMain.handle(DesktopIpcChannels.RETRY_CONNECTION, async () => {
    const win = mainWindowGetter();
    if (win) {
      const mode = configService.getConfig().deploymentMode || 'DESKTOP_OFFLINE';
      const targetUrl = mode === 'DESKTOP_OFFLINE'
        ? configService.getTargetUrl(apiProcessService.getApiUrl())
        : configService.getTargetUrl();
      logger.info('Retrying connection to target URL', { url: targetUrl });
      win.loadURL(targetUrl);
    }
  });

  // 12. Create Database Backup (.bsbak)
  ipcMain.handle(DesktopIpcChannels.CREATE_BACKUP, async (_, customPath?: string) => {
    return backupService.createBackup(customPath);
  });

  // 13. List Database Backups
  ipcMain.handle(DesktopIpcChannels.LIST_BACKUPS, async () => {
    return backupService.listBackups();
  });

  // 14. Restore Database Backup (.bsbak)
  ipcMain.handle(DesktopIpcChannels.RESTORE_BACKUP, async (_, backupPath: string) => {
    return backupService.restoreBackup(backupPath);
  });

  // 15. Open Data Folder
  ipcMain.handle(DesktopIpcChannels.OPEN_DATA_FOLDER, async () => {
    backupService.openDataFolder();
  });

  // 16. Open Backups Folder
  ipcMain.handle(DesktopIpcChannels.OPEN_BACKUPS_FOLDER, async () => {
    backupService.openBackupsFolder();
  });

  // 17. Get License Status
  ipcMain.handle(DesktopIpcChannels.GET_LICENSE_STATUS, async () => {
    return licenseService.validateLicense();
  });

  // 18. Activate License
  ipcMain.handle(DesktopIpcChannels.ACTIVATE_LICENSE, async (_, licenseKey: string) => {
    return licenseService.activateLicense(licenseKey);
  });

  // 19. Get App Status
  ipcMain.handle(DesktopIpcChannels.GET_APP_STATUS, async () => {
    const pgCfg = postgresService.getConfig();
    return {
      version: app.getVersion(),
      mode: configService.getConfig().deploymentMode,
      apiPort: apiProcessService.getApiPort(),
      dbPort: pgCfg.dbPort,
      isDatabaseReady: true,
      isApiReady: true,
      dataPath: pgCfg.dataDir,
      backupsPath: backupService.getBackupsDir(),
      logsPath: logger.getLogsDirectory(),
    };
  });
}
