import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as net from 'net';
import * as crypto from 'crypto';
import { spawn, execSync, spawnSync } from 'child_process';
import { app, safeStorage } from 'electron';
import { logger } from './logger.service';

export interface PostgresConfig {
  dbPort: number;
  dbUser: string;
  dbPass: string;
  dbName: string;
  dataDir: string;
  logsDir: string;
  configDir: string;
  backupsDir: string;
  binDir: string;
}

export class PostgresService {
  private config: PostgresConfig;
  private isRunning = false;

  constructor() {
    const baseDir = process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'BusinessSuite')
      : (app && typeof app.getPath === 'function' ? app.getPath('userData') : path.join(os.homedir(), '.businesssuite'));

    const dataDir = path.join(baseDir, 'data');
    const logsDir = path.join(baseDir, 'logs');
    const configDir = path.join(baseDir, 'config');
    const backupsDir = path.join(baseDir, 'backups');

    const binDir = this.findPostgresBinDir();

    this.config = {
      dbPort: 5433, // Default desktop loopback port to avoid colliding with default 5432
      dbUser: 'bs_admin',
      dbPass: '',
      dbName: 'business_suite',
      dataDir,
      logsDir,
      configDir,
      backupsDir,
      binDir,
    };

    this.ensureDirectories();
    this.loadOrGenerateCredentials();
  }

  public getConfig(): PostgresConfig {
    return { ...this.config };
  }

  public getDatabaseUrl(): string {
    return `postgresql://${this.config.dbUser}:${encodeURIComponent(this.config.dbPass)}@127.0.0.1:${this.config.dbPort}/${this.config.dbName}?schema=public`;
  }

  private ensureDirectories(): void {
    const dirs = [this.config.dataDir, this.config.logsDir, this.config.configDir, this.config.backupsDir];
    for (const d of dirs) {
      if (!fs.existsSync(d)) {
        fs.mkdirSync(d, { recursive: true });
      }
    }
  }

  /**
   * Discovers PostgreSQL binaries across bundled and local Windows paths
   */
  public findPostgresBinDir(): string {
    const possiblePaths = [
      // 1. Packaged Electron extraResources
      path.join(process.resourcesPath || '', 'postgres', 'bin'),
      path.join(process.resourcesPath || '', 'resources', 'postgres', 'bin'),
      // 2. Local workspace resources
      path.join(__dirname, '..', '..', 'resources', 'postgres', 'bin'),
      path.join(__dirname, '..', 'resources', 'postgres', 'bin'),
      // 3. Explicit environment variable override
      process.env.PG_BIN_PATH || '',
      // 4. Standard Windows PostgreSQL installations
      'C:\\Program Files\\PostgreSQL\\18\\bin',
      'C:\\Program Files\\PostgreSQL\\17\\bin',
      'C:\\Program Files\\PostgreSQL\\16\\bin',
      'C:\\Program Files\\PostgreSQL\\15\\bin',
    ];

    for (const p of possiblePaths) {
      if (p && fs.existsSync(path.join(p, 'postgres.exe')) && fs.existsSync(path.join(p, 'initdb.exe'))) {
        logger.info('Found PostgreSQL runtime binaries at:', { binDir: p });
        return p;
      }
    }

    logger.warn('PostgreSQL binaries not found in standard paths; fallback to first candidate');
    return possiblePaths[0];
  }

  /**
   * Finds an available port on 127.0.0.1 starting from startPort
   */
  public async findAvailablePort(startPort: number): Promise<number> {
    for (let port = startPort; port < startPort + 50; port++) {
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
   * Loads or securely generates random credentials for the local database
   */
  private loadOrGenerateCredentials(): void {
    const credsPath = path.join(this.config.configDir, 'db-credentials.json');

    if (fs.existsSync(credsPath)) {
      try {
        const raw = fs.readFileSync(credsPath, 'utf-8');
        const parsed = JSON.parse(raw);
        let password = parsed.password;

        // Decrypt with Electron safeStorage if encrypted
        if (parsed.encrypted && safeStorage && safeStorage.isEncryptionAvailable()) {
          try {
            password = safeStorage.decryptString(Buffer.from(parsed.password, 'hex'));
          } catch {
            // Fallback to stored value
          }
        }

        if (password) {
          this.config.dbPass = password;
          if (parsed.port) {
            this.config.dbPort = parsed.port;
          }
          return;
        }
      } catch (err: any) {
        logger.warn('Could not read existing db-credentials.json', { error: err.message });
      }
    }

    // Generate strong 32-character random alphanumeric password
    const newPassword = crypto.randomBytes(24).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
    this.config.dbPass = newPassword;

    try {
      let storedPassword = newPassword;
      let isEncrypted = false;

      if (safeStorage && safeStorage.isEncryptionAvailable()) {
        try {
          storedPassword = safeStorage.encryptString(newPassword).toString('hex');
          isEncrypted = true;
        } catch {
          // Store directly if encryption fails
        }
      }

      const toSave = {
        username: this.config.dbUser,
        password: storedPassword,
        encrypted: isEncrypted,
        port: this.config.dbPort,
        createdAt: new Date().toISOString(),
      };

      fs.writeFileSync(credsPath, JSON.stringify(toSave, null, 2), 'utf-8');
      logger.info('Generated new strong local database credentials securely');
    } catch (err: any) {
      logger.error('Failed to persist database credentials', err);
    }
  }

  /**
   * Initializes a new PostgreSQL cluster if not already present
   */
  public async initializeDatabaseIfNeeded(): Promise<void> {
    const pgVersionFile = path.join(this.config.dataDir, 'PG_VERSION');

    this.loadOrGenerateCredentials();

    if (fs.existsSync(pgVersionFile)) {
      logger.info('Local PostgreSQL data directory already exists. Skipping initdb.');
      return;
    }

    logger.info('Initializing new PostgreSQL data directory at:', { dataDir: this.config.dataDir });

    const initdbExe = path.join(this.config.binDir, 'initdb.exe');
    if (!fs.existsSync(initdbExe)) {
      throw new Error(`initdb.exe not found at ${initdbExe}`);
    }

    // Write temporary password file for initdb --pwfile
    const tempPwFile = path.join(this.config.configDir, `.pw_${Date.now()}`);
    fs.writeFileSync(tempPwFile, this.config.dbPass, { encoding: 'utf-8', mode: 0o600 });

    try {
      const initArgs = [
        '-D', this.config.dataDir,
        '-U', this.config.dbUser,
        '--pwfile', tempPwFile,
        '-A', 'scram-sha-256',
        '-E', 'UTF8',
        '--locale=C',
      ];

      const res = spawnSync(initdbExe, initArgs, {
        encoding: 'utf-8',
        windowsHide: true,
      });

      if (res.status !== 0) {
        throw new Error(`initdb failed with exit code ${res.status}: ${res.stderr || res.stdout}`);
      }

      logger.info('PostgreSQL cluster initialized successfully.');

      // Tune postgresql.conf for loopback single-machine ERP performance
      const confPath = path.join(this.config.dataDir, 'postgresql.conf');
      const additions = [
        `\n# BusinessSuite Desktop Standalone Loopback Configuration`,
        `listen_addresses = '127.0.0.1'`,
        `port = ${this.config.dbPort}`,
        `max_connections = 50`,
        `shared_buffers = 128MB`,
        `work_mem = 4MB`,
        `maintenance_work_mem = 32MB`,
        `synchronous_commit = off`, // Fast disk writes for local station POS
        `checkpoint_completion_target = 0.9`,
        `wal_buffers = 4MB`,
        `default_statistics_target = 100`,
      ].join('\n');

      fs.appendFileSync(confPath, additions, 'utf-8');
    } finally {
      if (fs.existsSync(tempPwFile)) {
        try { fs.unlinkSync(tempPwFile); } catch {}
      }
    }
  }

  /**
   * Recovers from crashes by clearing stale postmaster.pid if process is dead
   */
  public recoverStaleLocks(): void {
    const pidFile = path.join(this.config.dataDir, 'postmaster.pid');
    if (fs.existsSync(pidFile)) {
      try {
        const content = fs.readFileSync(pidFile, 'utf-8');
        const lines = content.split('\n');
        const pid = parseInt(lines[0]?.trim(), 10);

        if (!isNaN(pid)) {
          let processAlive = false;
          try {
            // Check if PID is actively running
            process.kill(pid, 0);
            processAlive = true;
          } catch {
            processAlive = false;
          }

          if (!processAlive) {
            logger.warn(`Removing stale postmaster.pid (PID ${pid} is not running)`);
            fs.unlinkSync(pidFile);
          } else {
            logger.info(`Existing PostgreSQL process (PID ${pid}) is running`);
          }
        }
      } catch (err: any) {
        logger.warn('Failed to verify postmaster.pid lock', { error: err.message });
      }
    }
  }

  /**
   * Starts local PostgreSQL and verifies connection readiness
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;

    await this.initializeDatabaseIfNeeded();
    this.recoverStaleLocks();

    // Check if port is available; if not and postgres is already responding, use it
    const isPortOpen = await this.isPortResponding(this.config.dbPort);
    if (isPortOpen) {
      logger.info(`PostgreSQL already running on port ${this.config.dbPort}`);
      this.isRunning = true;
      await this.ensureDatabaseAndSchema();
      return;
    }

    const pgCtlExe = path.join(this.config.binDir, 'pg_ctl.exe');
    if (!fs.existsSync(pgCtlExe)) {
      throw new Error(`pg_ctl.exe not found at ${pgCtlExe}`);
    }

    const logFile = path.join(this.config.logsDir, 'postgresql.log');
    logger.info(`Starting PostgreSQL service on port ${this.config.dbPort}...`);

    const startArgs = [
      'start',
      '-D', this.config.dataDir,
      '-l', logFile,
      '-o', `-p ${this.config.dbPort} -h 127.0.0.1`,
    ];

    const child = spawn(pgCtlExe, startArgs, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();

    // Wait up to 15 seconds for PostgreSQL socket to respond
    const ready = await this.waitForReadiness(15000);
    if (!ready) {
      throw new Error(`PostgreSQL failed to become ready on 127.0.0.1:${this.config.dbPort}`);
    }

    this.isRunning = true;
    logger.info('PostgreSQL service started and ready for queries.');

    await this.ensureDatabaseAndSchema();
  }

  /**
   * Waits for PostgreSQL TCP loopback to respond
   */
  public async waitForReadiness(timeoutMs = 15000): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const ok = await this.isPortResponding(this.config.dbPort);
      if (ok) return true;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return false;
  }

  private isPortResponding(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(800);
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('error', () => {
        socket.destroy();
        resolve(false);
      });
      socket.once('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      socket.connect(port, '127.0.0.1');
    });
  }

  /**
   * Ensures business_suite database exists and schema is deployed
   */
  private async ensureDatabaseAndSchema(): Promise<void> {
    const psqlExe = path.join(this.config.binDir, 'psql.exe');
    if (!fs.existsSync(psqlExe)) {
      logger.warn('psql.exe not found, skipping database existence check');
      return;
    }

    const env = {
      ...process.env,
      PGPASSWORD: this.config.dbPass,
    };

    // Wait until PostgreSQL postmaster is fully accepting SQL queries
    for (let i = 0; i < 15; i++) {
      try {
        const ping = spawnSync(psqlExe, [
          '-U', this.config.dbUser,
          '-h', '127.0.0.1',
          '-p', this.config.dbPort.toString(),
          '-d', 'postgres',
          '-tAc', 'SELECT 1;',
        ], { env, encoding: 'utf-8', windowsHide: true });
        if (ping.stdout && ping.stdout.includes('1')) {
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 400));
    }

    // 1. Check if business_suite database exists
    const checkDbCmd = `SELECT 1 FROM pg_database WHERE datname = '${this.config.dbName}';`;
    try {
      const res = spawnSync(psqlExe, [
        '-U', this.config.dbUser,
        '-h', '127.0.0.1',
        '-p', this.config.dbPort.toString(),
        '-d', 'postgres',
        '-tAc', checkDbCmd,
      ], { env, encoding: 'utf-8', windowsHide: true });

      if (!res.stdout || !res.stdout.includes('1')) {
        logger.info(`Creating database ${this.config.dbName}...`);
        spawnSync(psqlExe, [
          '-U', this.config.dbUser,
          '-h', '127.0.0.1',
          '-p', this.config.dbPort.toString(),
          '-d', 'postgres',
          '-c', `CREATE DATABASE ${this.config.dbName} ENCODING 'UTF8';`,
        ], { env, encoding: 'utf-8', windowsHide: true });
        // Allow newly created database to settle
        await new Promise((r) => setTimeout(r, 600));
      }
    } catch (err: any) {
      logger.warn('Could not verify/create database via psql', { error: err.message });
    }

    // 2. Deploy schema DDL if Tenant table is missing
    try {
      const checkTableCmd = `SELECT 1 FROM information_schema.tables WHERE table_name = 'Tenant';`;
      const tableRes = spawnSync(psqlExe, [
        '-U', this.config.dbUser,
        '-h', '127.0.0.1',
        '-p', this.config.dbPort.toString(),
        '-d', this.config.dbName,
        '-tAc', checkTableCmd,
      ], { env, encoding: 'utf-8', windowsHide: true });

      if (!tableRes.stdout || !tableRes.stdout.includes('1')) {
        logger.info('Applying baseline BusinessSuite schema DDL to local database...');
        const migrationSql = this.findMigrationSql();
        if (migrationSql && fs.existsSync(migrationSql)) {
          const deployRes = spawnSync(psqlExe, [
            '-U', this.config.dbUser,
            '-h', '127.0.0.1',
            '-p', this.config.dbPort.toString(),
            '-d', this.config.dbName,
            '-f', migrationSql,
          ], { env, encoding: 'utf-8', windowsHide: true });

          if (deployRes.status === 0) {
            logger.info('Baseline schema DDL applied successfully.');
          } else {
            logger.error('Error applying baseline schema DDL', { stderr: deployRes.stderr });
          }
        }
      }
    } catch (err: any) {
      logger.error('Failed to deploy local database schema', err);
    }
  }

  private findMigrationSql(): string | null {
    const candidates = [
      path.join(process.resourcesPath || '', 'api', 'prisma', 'migrations', '0_init', 'migration.sql'),
      path.join(process.resourcesPath || '', 'resources', 'api', 'prisma', 'migrations', '0_init', 'migration.sql'),
      path.join(__dirname, '..', '..', 'resources', 'api', 'prisma', 'migrations', '0_init', 'migration.sql'),
      path.join(__dirname, '..', 'resources', 'api', 'prisma', 'migrations', '0_init', 'migration.sql'),
      path.join(__dirname, '..', '..', '..', 'api', 'prisma', 'migrations', '0_init', 'migration.sql'),
      path.join(__dirname, '..', '..', '..', '..', 'apps', 'api', 'prisma', 'migrations', '0_init', 'migration.sql'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return null;
  }

  /**
   * Safely stops PostgreSQL with fast shutdown and flushes WAL to disk
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    logger.info('Stopping local PostgreSQL service cleanly...');
    const pgCtlExe = path.join(this.config.binDir, 'pg_ctl.exe');

    if (fs.existsSync(pgCtlExe)) {
      try {
        const res = spawnSync(pgCtlExe, ['stop', '-D', this.config.dataDir, '-m', 'fast'], {
          encoding: 'utf-8',
          windowsHide: true,
        });
        logger.info('pg_ctl stop result:', { stdout: res.stdout, stderr: res.stderr });
      } catch (err: any) {
        logger.error('Error during pg_ctl stop', err);
      }
    }

    this.isRunning = false;
  }
}

export const postgresService = new PostgresService();
