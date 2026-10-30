import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import { spawn, ChildProcess } from 'child_process';
import { app } from 'electron';
import { logger } from './logger.service';
import { postgresService } from './postgres.service';

export class ApiProcessService {
  private apiProcess: ChildProcess | null = null;
  private apiPort: number = 4100;
  private isRunning: boolean = false;

  public getApiPort(): number {
    return this.apiPort;
  }

  public getApiUrl(): string {
    return `http://127.0.0.1:${this.apiPort}`;
  }

  /**
   * Finds an available loopback port for the local API
   */
  public async findAvailablePort(startPort = 4100): Promise<number> {
    for (let port = startPort; port < startPort + 100; port++) {
      const isAvailable = await new Promise<boolean>((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(false));
        server.once('listening', () => {
          server.close(() => resolve(true));
        });
        server.listen(port, '127.0.0.1');
      });

      if (isAvailable) {
        return port;
      }
    }
    return startPort;
  }

  /**
   * Finds the path to the compiled NestJS API main.js
   */
  private findApiScript(): string {
    const candidates = [
      // Packaged app in resources
      path.join(process.resourcesPath || '', 'api', 'dist', 'main.js'),
      path.join(process.resourcesPath || '', 'resources', 'api', 'dist', 'main.js'),
      // Local resources
      path.join(__dirname, '..', '..', 'resources', 'api', 'dist', 'main.js'),
      path.join(__dirname, '..', 'resources', 'api', 'dist', 'main.js'),
      // Workspace dev
      path.join(__dirname, '..', '..', '..', 'api', 'dist', 'main.js'),
      path.join(__dirname, '..', '..', '..', '..', 'apps', 'api', 'dist', 'main.js'),
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) {
        return c;
      }
    }

    return candidates[candidates.length - 1];
  }

  /**
   * Finds the path to the packaged static web UI export (out directory)
   */
  public findStaticWebDir(): string | null {
    const candidates = [
      // Packaged app in resources
      path.join(process.resourcesPath || '', 'web', 'out'),
      path.join(process.resourcesPath || '', 'web'),
      path.join(process.resourcesPath || '', 'resources', 'web', 'out'),
      path.join(process.resourcesPath || '', 'resources', 'web'),
      // Local resources
      path.join(__dirname, '..', '..', 'resources', 'web', 'out'),
      path.join(__dirname, '..', '..', 'resources', 'web'),
      path.join(__dirname, '..', 'resources', 'web', 'out'),
      // Workspace dev
      path.join(__dirname, '..', '..', '..', 'web', 'out'),
      path.join(__dirname, '..', '..', '..', '..', 'apps', 'web', 'out'),
    ];

    for (const c of candidates) {
      if (fs.existsSync(c) && fs.existsSync(path.join(c, 'index.html'))) {
        return c;
      }
    }

    return null;
  }

  /**
   * Starts the NestJS API as a hidden child process
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;

    this.apiPort = await this.findAvailablePort(4100);
    const apiScript = this.findApiScript();
    const staticWebDir = this.findStaticWebDir();

    logger.info('Starting local NestJS API child process...', {
      apiPort: this.apiPort,
      apiScript,
      staticWebDir,
      dbUrl: postgresService.getDatabaseUrl().replace(/:[^:@]+@/, ':***@'),
    });

    const baseDir = process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'BusinessSuite')
      : (app && typeof app.getPath === 'function' ? app.getPath('userData') : path.join(process.cwd(), '.businesssuite'));
    const logsDir = path.join(baseDir, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const logFile = path.join(logsDir, 'api.log');
    const logFd = fs.openSync(logFile, 'a');

    // Use Electron binary itself as Node runtime via ELECTRON_RUN_AS_NODE: '1'
    const execPath = process.execPath;

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: this.apiPort.toString(),
      DEPLOYMENT_MODE: 'DESKTOP_OFFLINE',
      DATABASE_URL: postgresService.getDatabaseUrl(),
      STATIC_DIR: staticWebDir || '',
      JWT_SECRET: 'business-suite-desktop-local-secret-2026-production',
      JWT_EXPIRES_IN: '30d',
      REFRESH_TOKEN_SECRET: 'business-suite-desktop-local-refresh-2026-production',
      REFRESH_TOKEN_EXPIRES_IN: '60d',
    };

    // If node_modules exists next to apiScript
    const apiDir = path.dirname(path.dirname(apiScript));
    const apiNodeModules = path.join(apiDir, 'node_modules');
    if (fs.existsSync(apiNodeModules)) {
      env.NODE_PATH = apiNodeModules;
    }

    this.apiProcess = spawn(execPath, [apiScript], {
      env,
      cwd: apiDir,
      windowsHide: true,
      stdio: ['ignore', logFd, logFd],
    });

    this.apiProcess.on('exit', (code, signal) => {
      logger.warn('Local NestJS API process exited', { code, signal });
      this.isRunning = false;
      this.apiProcess = null;
    });

    // Wait up to 25 seconds for API health endpoint
    const ready = await this.waitForHealth(25000);
    if (!ready) {
      throw new Error(`BusinessSuite API failed to respond on http://127.0.0.1:${this.apiPort}/api/health`);
    }

    this.isRunning = true;
    logger.info(`BusinessSuite Local API successfully verified on http://127.0.0.1:${this.apiPort}`);
  }

  /**
   * Polls http://127.0.0.1:<port>/api/health until responsive
   */
  public async waitForHealth(timeoutMs = 25000): Promise<boolean> {
    const startTime = Date.now();
    const url = `http://127.0.0.1:${this.apiPort}/api/health`;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data: any = await res.json();
          if (data && (data.status === 'ok' || data.status === 'degraded')) {
            return true;
          }
        }
      } catch {
        // Keep waiting
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    return false;
  }

  /**
   * Gracefully shuts down the API process
   */
  public async stop(): Promise<void> {
    if (!this.apiProcess) return;

    logger.info('Stopping local NestJS API process...');
    try {
      this.apiProcess.kill('SIGTERM');
      // Wait up to 3 seconds for exit
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          if (this.apiProcess) {
            try { this.apiProcess.kill('SIGKILL'); } catch {}
          }
          resolve();
        }, 3000);

        if (this.apiProcess) {
          this.apiProcess.once('exit', () => {
            clearTimeout(timer);
            resolve();
          });
        } else {
          clearTimeout(timer);
          resolve();
        }
      });
    } catch (err: any) {
      logger.error('Error stopping API process', err);
    }

    this.apiProcess = null;
    this.isRunning = false;
  }
}

export const apiProcessService = new ApiProcessService();
