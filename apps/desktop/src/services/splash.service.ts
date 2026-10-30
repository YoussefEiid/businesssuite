import { BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from './logger.service';

export class SplashService {
  private splashWindow: BrowserWindow | null = null;

  public createSplashWindow(): BrowserWindow {
    this.splashWindow = new BrowserWindow({
      width: 520,
      height: 340,
      frame: false,
      resizable: false,
      show: false,
      center: true,
      backgroundColor: '#090d16',
      transparent: false,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const splashPath = path.join(__dirname, '..', 'assets', 'splash.html');
    if (fs.existsSync(splashPath)) {
      this.splashWindow.loadFile(splashPath);
    } else {
      // Fallback path in development
      const devPath = path.join(__dirname, 'assets', 'splash.html');
      if (fs.existsSync(devPath)) {
        this.splashWindow.loadFile(devPath);
      }
    }

    this.splashWindow.once('ready-to-show', () => {
      this.splashWindow?.show();
    });

    return this.splashWindow;
  }

  public updateStatus(stage: string, percent: number, textAr: string, textEn: string): void {
    if (this.splashWindow && !this.splashWindow.isDestroyed()) {
      const code = `if (window.updateSplash) window.updateSplash(${JSON.stringify(stage)}, ${percent}, ${JSON.stringify(textAr)}, ${JSON.stringify(textEn)});`;
      this.splashWindow.webContents.executeJavaScript(code).catch(() => {});
    }
  }

  public showError(title: string, desc: string): void {
    if (this.splashWindow && !this.splashWindow.isDestroyed()) {
      const code = `if (window.showSplashError) window.showSplashError(${JSON.stringify(title)}, ${JSON.stringify(desc)});`;
      this.splashWindow.webContents.executeJavaScript(code).catch(() => {});
    }
  }

  public close(): void {
    if (this.splashWindow && !this.splashWindow.isDestroyed()) {
      this.splashWindow.close();
      this.splashWindow = null;
    }
  }
}

export const splashService = new SplashService();
