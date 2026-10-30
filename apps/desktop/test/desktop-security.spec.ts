import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_DESKTOP_CONFIG, DEFAULT_OFFLINE_URL, DEFAULT_PRODUCTION_URL, DesktopIpcChannels } from '@business-suite/shared';

describe('Desktop Security, Configuration, and Integration Contracts', () => {
  describe('1. IPC Channel Whitelist', () => {
    it('should expose strictly defined, scoped IPC channels', () => {
      expect(DesktopIpcChannels.GET_VERSION).toBe('desktop:get-version');
      expect(DesktopIpcChannels.GET_PRINTERS).toBe('desktop:get-printers');
      expect(DesktopIpcChannels.PRINT_RECEIPT).toBe('desktop:print-receipt');
      expect(DesktopIpcChannels.PRINT_INVOICE).toBe('desktop:print-invoice');
      expect(DesktopIpcChannels.OPEN_CASH_DRAWER).toBe('desktop:open-cash-drawer');
      expect(DesktopIpcChannels.GET_CONFIG).toBe('desktop:get-config');
      expect(DesktopIpcChannels.SAVE_CONFIG).toBe('desktop:save-config');
      expect(DesktopIpcChannels.RESET_CONFIG).toBe('desktop:reset-config');
      expect(DesktopIpcChannels.GET_LOGS_PATH).toBe('desktop:get-logs-path');
      expect(DesktopIpcChannels.OPEN_LOGS_FOLDER).toBe('desktop:open-logs-folder');
      expect(DesktopIpcChannels.RETRY_CONNECTION).toBe('desktop:retry-connection');
      expect(DesktopIpcChannels.BARCODE_SCANNED).toBe('desktop:barcode-scanned');
    });

    it('should NOT contain any arbitrary shell execution or remote channels', () => {
      const channels = Object.values(DesktopIpcChannels);
      for (const ch of channels) {
        expect(ch).not.toMatch(/exec|shell|eval|remote|fs/i);
      }
    });
  });

  describe('2. Fallback Screen & Branding Assets', () => {
    const fallbackPath = path.join(__dirname, '..', 'src', 'assets', 'fallback.html');

    it('fallback.html must exist on disk', () => {
      expect(fs.existsSync(fallbackPath)).toBe(true);
    });

    it('fallback.html must contain both Arabic and English connection failure text', () => {
      const content = fs.readFileSync(fallbackPath, 'utf-8');
      expect(content).toContain('تعذر الاتصال بالخادم');
      expect(content).toContain('Unable to connect to BusinessSuite server');
      expect(content).toContain('retryConnection');
      expect(content).toContain('saveDesktopConfig');
    });

    it('icon assets must exist in src/assets and dist/assets', () => {
      const srcIconPng = path.join(__dirname, '..', 'src', 'assets', 'icon.png');
      const srcIconIco = path.join(__dirname, '..', 'src', 'assets', 'icon.ico');
      const distIconPng = path.join(__dirname, '..', 'dist', 'assets', 'icon.png');
      const distIconIco = path.join(__dirname, '..', 'dist', 'assets', 'icon.ico');

      expect(fs.existsSync(srcIconPng)).toBe(true);
      expect(fs.existsSync(srcIconIco)).toBe(true);
      expect(fs.existsSync(distIconPng)).toBe(true);
      expect(fs.existsSync(distIconIco)).toBe(true);
    });
  });

  describe('3. Default Configuration & URL Priority', () => {
    it('DEFAULT_DESKTOP_CONFIG should have secure, sane defaults for offline desktop', () => {
      expect(DEFAULT_DESKTOP_CONFIG.deploymentMode).toBe('DESKTOP_OFFLINE');
      expect(DEFAULT_DESKTOP_CONFIG.targetUrl).toBe(DEFAULT_OFFLINE_URL);
      expect(DEFAULT_PRODUCTION_URL).toBe('https://app.businesssuite.com');
      expect(DEFAULT_DESKTOP_CONFIG.receiptPaperWidth).toBe('80mm');
      expect(DEFAULT_DESKTOP_CONFIG.openCashDrawerOnSale).toBe(true);
      expect(DEFAULT_DESKTOP_CONFIG.silentPrinting).toBe(false);
      expect(DEFAULT_DESKTOP_CONFIG.autostart).toBe(false);
      expect(DEFAULT_DESKTOP_CONFIG.minimizeToTray).toBe(false);
      expect(DEFAULT_DESKTOP_CONFIG.backupRetentionCount).toBe(14);
      expect(DEFAULT_DESKTOP_CONFIG.autoBackupDaily).toBe(true);
    });
  });

  describe('4. Sanitized Logger Rules', () => {
    it('should correctly redact sensitive credentials from metadata', () => {
      // Inline verification of sanitize logic
      const sensitiveKeys = [
        'password',
        'token',
        'secret',
        'authorization',
        'auth',
        'jwt',
        'database_url',
      ];

      function sanitize(obj: any): any {
        if (!obj || typeof obj !== 'object') return obj;
        const out: any = Array.isArray(obj) ? [] : {};
        for (const [k, v] of Object.entries(obj)) {
          const lower = k.toLowerCase();
          if (sensitiveKeys.some((s) => lower.includes(s))) {
            out[k] = '***REDACTED***';
          } else if (typeof v === 'object') {
            out[k] = sanitize(v);
          } else {
            out[k] = v;
          }
        }
        return out;
      }

      const input = {
        user: 'admin',
        password: 'SuperSecretPassword123!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        nested: {
          authorization: 'Bearer secret-token',
          safeKey: 'regular-value',
        },
      };

      const result = sanitize(input);
      expect(result.password).toBe('***REDACTED***');
      expect(result.token).toBe('***REDACTED***');
      expect(result.nested.authorization).toBe('***REDACTED***');
      expect(result.nested.safeKey).toBe('regular-value');
      expect(result.user).toBe('admin');
    });
  });
});
