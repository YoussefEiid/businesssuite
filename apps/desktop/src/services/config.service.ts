import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import {
  DesktopConfig,
  DEFAULT_DESKTOP_CONFIG,
  DEFAULT_PRODUCTION_URL,
  DEFAULT_DEVELOPMENT_URL,
  isLocalhostUrl,
} from '@business-suite/shared';
import { logger } from './logger.service';

export interface ResolvedTargetUrl {
  url: string;
  source: 'environment' | 'saved config' | 'packaged config' | 'default (development)' | 'default (production)';
  sanitizedFromLocalhost?: boolean;
}

function loadPackagedConfig(): DesktopConfig | null {
  const possiblePaths = [
    path.join(__dirname, '..', 'assets', 'desktop-config.json'),
    path.join(__dirname, 'assets', 'desktop-config.json'),
    path.join(process.resourcesPath || '', 'assets', 'desktop-config.json'),
  ];
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        return JSON.parse(raw);
      }
    } catch {
      // Continue to next path
    }
  }
  return null;
}

export class ConfigService {
  private configFilePath: string;
  private currentConfig: DesktopConfig;

  constructor() {
    const userData = app && typeof app.getPath === 'function'
      ? app.getPath('userData')
      : path.join(process.cwd(), '.desktop-data');
    this.configFilePath = path.join(userData, 'desktop-config.json');
    this.currentConfig = this.loadConfig();
  }

  public getConfig(): DesktopConfig {
    return { ...this.currentConfig };
  }

  /**
   * Resolve target URL based on deployment mode:
   * - DESKTOP_OFFLINE (Default): Points directly to local loopback API (http://127.0.0.1:<apiPort>)
   * - WEB_SAAS: Points to central hosted domain (https://app.businesssuite.com)
   */
  public resolveTargetUrl(localApiUrl?: string): ResolvedTargetUrl {
    const isPackaged = app ? app.isPackaged : process.env.NODE_ENV === 'production';
    const mode = process.env.DEPLOYMENT_MODE || this.currentConfig.deploymentMode || 'DESKTOP_OFFLINE';

    // 1. In DESKTOP_OFFLINE mode, target is the local loopback server
    if (mode === 'DESKTOP_OFFLINE') {
      const url = localApiUrl || (this.currentConfig.targetUrl?.startsWith('http://127.0.0.1') ? this.currentConfig.targetUrl : 'http://127.0.0.1:4100');
      return {
        url,
        source: 'default (production)',
      };
    }

    // 2. In WEB_SAAS mode, evaluate overrides and remote production URL
    if (process.env.DESKTOP_TARGET_URL && process.env.DESKTOP_TARGET_URL.trim()) {
      return {
        url: process.env.DESKTOP_TARGET_URL.trim(),
        source: 'environment',
      };
    }

    const saved = this.readSavedConfigFile();
    if (saved && typeof saved.targetUrl === 'string' && saved.targetUrl.trim() && !isLocalhostUrl(saved.targetUrl)) {
      return {
        url: saved.targetUrl.trim(),
        source: 'saved config',
      };
    }

    const packagedConfig = loadPackagedConfig();
    if (packagedConfig && typeof packagedConfig.targetUrl === 'string' && packagedConfig.targetUrl.trim() && !isLocalhostUrl(packagedConfig.targetUrl)) {
      return {
        url: packagedConfig.targetUrl.trim(),
        source: 'packaged config',
      };
    }

    return {
      url: DEFAULT_PRODUCTION_URL,
      source: 'default (production)',
    };
  }

  public getTargetUrl(localApiUrl?: string): string {
    const resolved = this.resolveTargetUrl(localApiUrl);
    logger.info('Resolved desktop target URL', {
      isPackaged: app ? app.isPackaged : false,
      targetUrl: resolved.url,
      source: resolved.source,
    });
    return resolved.url;
  }

  public saveConfig(updates: Partial<DesktopConfig>): DesktopConfig {
    const validated: Partial<DesktopConfig> = {};
    const isPackaged = app ? app.isPackaged : false;
    const allowLocalhost = process.env.DESKTOP_ALLOW_LOCALHOST === 'true';

    if (typeof updates.targetUrl === 'string' && updates.targetUrl.trim()) {
      try {
        const parsed = new URL(updates.targetUrl.trim());
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          validated.targetUrl = updates.targetUrl.trim().replace(/\/+$/, '');
        }
      } catch (e: any) {
        logger.warn('Ignored invalid targetUrl format', { url: updates.targetUrl, error: e.message });
      }
    }

    if (typeof updates.receiptPrinter === 'string') {
      validated.receiptPrinter = updates.receiptPrinter.trim();
    }

    if (typeof updates.invoicePrinter === 'string') {
      validated.invoicePrinter = updates.invoicePrinter.trim();
    }

    if (typeof updates.silentPrinting === 'boolean') {
      validated.silentPrinting = updates.silentPrinting;
    }

    if (updates.receiptPaperWidth === '80mm' || updates.receiptPaperWidth === '58mm') {
      validated.receiptPaperWidth = updates.receiptPaperWidth;
    }

    if (typeof updates.openCashDrawerOnSale === 'boolean') {
      validated.openCashDrawerOnSale = updates.openCashDrawerOnSale;
    }

    if (typeof updates.autostart === 'boolean') {
      validated.autostart = updates.autostart;
      this.updateAutoStart(updates.autostart);
    }

    if (typeof updates.minimizeToTray === 'boolean') {
      validated.minimizeToTray = updates.minimizeToTray;
    }

    this.currentConfig = {
      ...this.currentConfig,
      ...validated,
    };

    try {
      fs.writeFileSync(this.configFilePath, JSON.stringify(this.currentConfig, null, 2), 'utf-8');
      logger.info('Desktop configuration updated', { config: this.currentConfig });
    } catch (err: any) {
      logger.error('Failed to write desktop configuration to disk', err);
    }

    return { ...this.currentConfig };
  }

  public resetConfig(): DesktopConfig {
    this.currentConfig = {
      ...DEFAULT_DESKTOP_CONFIG,
    };

    try {
      if (fs.existsSync(this.configFilePath)) {
        fs.unlinkSync(this.configFilePath);
      }
      logger.info('Desktop configuration reset to defaults');
    } catch (err: any) {
      logger.error('Failed to reset desktop configuration', err);
    }
    return { ...this.currentConfig };
  }

  private readSavedConfigFile(): Partial<DesktopConfig> | null {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const raw = fs.readFileSync(this.configFilePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err: any) {
      logger.warn('Failed to read config file', { error: err.message });
    }
    return null;
  }

  private loadConfig(): DesktopConfig {
    const baseDefault: DesktopConfig = {
      ...DEFAULT_DESKTOP_CONFIG,
    };

    const saved = this.readSavedConfigFile();
    if (saved) {
      return {
        ...baseDefault,
        ...saved,
      };
    }

    // Try packaged bundled config if available
    const packaged = loadPackagedConfig();
    if (packaged) {
      return {
        ...baseDefault,
        ...packaged,
      };
    }

    return baseDefault;
  }

  private updateAutoStart(enabled: boolean): void {
    try {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        path: process.execPath,
      });
    } catch (err: any) {
      logger.warn('Could not set OS login item settings', { error: err.message });
    }
  }
}

export const configService = new ConfigService();
