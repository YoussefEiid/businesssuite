import { app, BrowserWindow, shell, screen, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { configService } from './services/config.service';
import { logger } from './services/logger.service';
import { registerIpcHandlers } from './ipc/handlers';
import { splashService } from './services/splash.service';
import { postgresService } from './services/postgres.service';
import { apiProcessService } from './services/api-process.service';
import { backupService } from './services/backup.service';

// Set application name early so all Electron paths (userData, logs) use 'BusinessSuite'
app.name = 'BusinessSuite';

// Enforce single instance lock
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  logger.warn('Another BusinessSuite instance is already running. Terminating second instance.');
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let isShuttingDown = false;
const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized: boolean;
}

function getWindowStateFilePath(): string {
  const userData = app && typeof app.getPath === 'function'
    ? app.getPath('userData')
    : path.join(process.cwd(), '.desktop-data');
  return path.join(userData, 'window-state.json');
}

function loadWindowState(): WindowState {
  const defaultState: WindowState = {
    width: 1280,
    height: 800,
    isMaximized: false,
  };

  try {
    const stateFile = getWindowStateFilePath();
    if (fs.existsSync(stateFile)) {
      const data = fs.readFileSync(stateFile, 'utf-8');
      const saved: WindowState = JSON.parse(data);

      if (typeof saved.x === 'number' && typeof saved.y === 'number') {
        const boundsMatch = screen.getAllDisplays().some((display) => {
          const { x, y, width, height } = display.bounds;
          return (
            saved.x! >= x - 20 &&
            saved.x! < x + width - 50 &&
            saved.y! >= y - 20 &&
            saved.y! < y + height - 50
          );
        });
        if (!boundsMatch) {
          delete saved.x;
          delete saved.y;
        }
      }

      return {
        ...defaultState,
        ...saved,
      };
    }
  } catch (err: any) {
    logger.warn('Could not read window-state.json, using defaults', { error: err.message });
  }

  return defaultState;
}

function saveWindowState(win: BrowserWindow): void {
  try {
    const isMaximized = win.isMaximized();
    const bounds = win.getBounds();
    const state: WindowState = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized,
    };
    fs.writeFileSync(getWindowStateFilePath(), JSON.stringify(state), 'utf-8');
  } catch {
    // Ignore disk errors on shutdown
  }
}

async function createMainWindow(targetUrl: string): Promise<BrowserWindow> {
  const windowState = loadWindowState();

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#0f172a',
    title: 'BusinessSuite',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (!isDev) {
    Menu.setApplicationMenu(null);
  }

  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  mainWindow.once('ready-to-show', () => {
    // Reveal main window and close splash
    mainWindow?.show();
    splashService.close();
    logger.info('BusinessSuite Desktop main window displayed successfully');
  });

  mainWindow.on('close', () => {
    if (mainWindow) {
      saveWindowState(mainWindow);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  setupSecurityGuards(mainWindow, targetUrl);

  // Load target URL with automatic retry and branded fallback
  loadTargetUrl(mainWindow, targetUrl);

  return mainWindow;
}

function loadTargetUrl(win: BrowserWindow, targetUrl: string): void {
  logger.info('Loading target URL in BusinessSuite desktop', { url: targetUrl });

  let fallbackLoaded = false;
  const triggerFallback = () => {
    if (fallbackLoaded || win.isDestroyed()) return;
    fallbackLoaded = true;
    loadFallbackPage(win);
  };

  win.webContents.on('did-fail-load', (_, errorCode, errorDescription, validatedURL) => {
    if (errorCode === -3) return; // Ignore internal aborts

    logger.warn('Failed to load target URL', {
      errorCode,
      errorDescription,
      validatedURL,
    });

    triggerFallback();
  });

  win.loadURL(targetUrl).catch((err) => {
    if (err && (err.code === 'ERR_ABORTED' || (err.message && err.message.includes('ERR_ABORTED')))) {
      return;
    }
    logger.error('Error during initial loadURL', err);
    triggerFallback();
  });
}

function loadFallbackPage(win: BrowserWindow, reason?: string): void {
  const mode = process.env.DEPLOYMENT_MODE || configService.getConfig().deploymentMode || 'DESKTOP_OFFLINE';

  if (mode === 'DESKTOP_OFFLINE') {
    const offlineErrorPath = path.join(__dirname, 'assets', 'offline-error.html');
    if (fs.existsSync(offlineErrorPath)) {
      logger.info('Loading dedicated local offline diagnostic screen', { path: offlineErrorPath, reason });
      win.loadFile(offlineErrorPath);
      return;
    }
  }

  const fallbackPath = path.join(__dirname, 'assets', 'fallback.html');
  if (fs.existsSync(fallbackPath)) {
    win.loadFile(fallbackPath);
  } else {
    const backupHtml = `
      <!DOCTYPE html>
      <html dir="rtl" style="background:#0f172a;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
        <body style="text-align:center;">
          <h2>تعذر تشغيل خدمة BusinessSuite المحلية</h2>
          <p>Could not start local BusinessSuite service.</p>
          <button onclick="location.reload()" style="padding:10px 20px;margin-top:10px;cursor:pointer;">إعادة المحاولة / Retry</button>
        </body>
      </html>`;
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(backupHtml)}`);
  }
}

function setupSecurityGuards(win: BrowserWindow, allowedTargetUrl: string): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    logger.info('Intercepted window.open request', { url });
    try {
      const parsed = new URL(url);
      if (['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) {
        shell.openExternal(url);
      }
    } catch {}
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const targetOrigin = new URL(allowedTargetUrl).origin;
      const navOrigin = new URL(navigationUrl).origin;

      if (navigationUrl.startsWith('file://')) {
        return;
      }

      if (targetOrigin !== navOrigin) {
        logger.warn('Blocked unauthorized in-app navigation', {
          navigationUrl,
          targetOrigin,
        });
        event.preventDefault();
        shell.openExternal(navigationUrl);
      }
    } catch {
      event.preventDefault();
    }
  });
}

// Second instance focus handler
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// App Lifecycle Initialization
app.whenReady().then(async () => {
  logger.info('BusinessSuite Desktop Application starting', {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
  });

  // 1. Show startup splash screen immediately
  splashService.createSplashWindow();

  // 2. Register all IPC handlers
  registerIpcHandlers(() => mainWindow);

  const mode = process.env.DEPLOYMENT_MODE || configService.getConfig().deploymentMode || 'DESKTOP_OFFLINE';
  let targetUrl = '';

  try {
    let postgresStarted = false;
    let apiStarted = false;
    let healthCheckPassed = false;

    if (mode === 'DESKTOP_OFFLINE') {
      // Stage 1: Local PostgreSQL
      splashService.updateStatus(
        'الخطوة 1 من 3',
        30,
        'جاري تجهيز قاعدة البيانات المحلية...',
        'Preparing local PostgreSQL database...',
      );
      await postgresService.start();
      postgresStarted = true;

      // Stage 2: Local NestJS API & Static UI runtime
      splashService.updateStatus(
        'الخطوة 2 من 3',
        65,
        'جاري تشغيل خدمات BusinessSuite المحلية...',
        'Starting BusinessSuite local services...',
      );
      await apiProcessService.start();
      apiStarted = true;
      healthCheckPassed = true;

      // Stage 3: Resolve dynamic local loopback URL
      splashService.updateStatus(
        'الخطوة 3 من 3',
        95,
        'جاري تحميل BusinessSuite...',
        'Loading BusinessSuite Desktop...',
      );
      targetUrl = configService.getTargetUrl(apiProcessService.getApiUrl());
    } else {
      // Hosted Web/SaaS mode
      splashService.updateStatus(
        'الاتصال بالخادم',
        80,
        'جاري الاتصال بخادم BusinessSuite...',
        'Connecting to BusinessSuite cloud...',
      );
      targetUrl = configService.getTargetUrl();
    }

    // Comprehensive startup diagnostics log
    const pgCfg = postgresService.getConfig();
    logger.info('=== BusinessSuite Offline Desktop Startup Diagnostics ===', {
      isPackaged: app.isPackaged,
      runtimeMode: mode,
      postgresBinDir: mode === 'DESKTOP_OFFLINE' ? pgCfg.binDir : 'N/A (SaaS)',
      postgresPort: mode === 'DESKTOP_OFFLINE' ? pgCfg.dbPort : 'N/A (SaaS)',
      apiPort: mode === 'DESKTOP_OFFLINE' ? apiProcessService.getApiPort() : 'N/A (SaaS)',
      frontendUrl: targetUrl,
      postgresStarted,
      apiStarted,
      healthCheckPassed,
      finalBrowserWindowTarget: targetUrl,
    });

    // Create and display main application window
    await createMainWindow(targetUrl);
  } catch (err: any) {
    logger.error('Fatal startup error in BusinessSuite Desktop', err);
    if (mode === 'DESKTOP_OFFLINE') {
      splashService.close();
      const offlineErrorPath = path.join(__dirname, 'assets', 'offline-error.html');
      await createMainWindow(`file://${offlineErrorPath}?msg=${encodeURIComponent(err.message || 'فشل تشغيل الخدمات المحلية')}`);
    } else {
      splashService.showError(
        'تعذر الاتصال بخادم BusinessSuite',
        err.message || 'فشل الاتصال بالخادم البعيد.',
      );
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(targetUrl);
    }
  });
});

// Graceful application shutdown
app.on('before-quit', async (event) => {
  if (isShuttingDown) return;

  event.preventDefault();
  isShuttingDown = true;
  logger.info('BusinessSuite Desktop initiating clean graceful shutdown...');

  try {
    // 1. Stop local API cleanly to flush in-flight HTTP requests
    await apiProcessService.stop();

    // 2. Stop PostgreSQL cleanly with fast WAL flush
    await postgresService.stop();

    logger.info('All local background services stopped safely.');
  } catch (err: any) {
    logger.error('Error during shutdown', err);
  } finally {
    app.exit(0);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    logger.info('All windows closed, quitting application');
    app.quit();
  }
});
