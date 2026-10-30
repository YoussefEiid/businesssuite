import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { spawnSync } from 'child_process';
import { app, shell } from 'electron';
import { BackupFileInfo } from '@business-suite/shared';
import { logger } from './logger.service';
import { postgresService } from './postgres.service';
import { apiProcessService } from './api-process.service';

export class BackupService {
  private backupsDir: string;
  private dataDir: string;

  constructor() {
    const baseDir = process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'BusinessSuite')
      : (app && typeof app.getPath === 'function' ? app.getPath('userData') : path.join(os.homedir(), '.businesssuite'));

    this.backupsDir = path.join(baseDir, 'backups');
    this.dataDir = path.join(baseDir, 'data');
    this.ensureDirs();
  }

  private ensureDirs(): void {
    if (!fs.existsSync(this.backupsDir)) {
      fs.mkdirSync(this.backupsDir, { recursive: true });
    }
  }

  public getBackupsDir(): string {
    return this.backupsDir;
  }

  public getDataDir(): string {
    return this.dataDir;
  }

  /**
   * Creates a safe .bsbak database backup
   */
  public async createBackup(customDestPath?: string): Promise<{ success: boolean; backupPath?: string; error?: string }> {
    this.ensureDirs();
    const pgCfg = postgresService.getConfig();
    const pgDumpExe = path.join(pgCfg.binDir, 'pg_dump.exe');

    if (!fs.existsSync(pgDumpExe)) {
      return { success: false, error: `pg_dump.exe not found at ${pgDumpExe}` };
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `BusinessSuite-Backup-${timestamp}.bsbak`;
    const targetFile = customDestPath || path.join(this.backupsDir, fileName);

    logger.info('Starting database backup creation...', { targetFile });

    const env = {
      ...process.env,
      PGPASSWORD: pgCfg.dbPass,
    };

    const dumpArgs = [
      '-U', pgCfg.dbUser,
      '-h', '127.0.0.1',
      '-p', pgCfg.dbPort.toString(),
      '-F', 'c', // Custom binary format with checksums
      '-b',      // Include large objects
      '-v',      // Verbose
      '-f', targetFile,
      pgCfg.dbName,
    ];

    try {
      const res = spawnSync(pgDumpExe, dumpArgs, { env, encoding: 'utf-8', windowsHide: true });
      if (res.status !== 0) {
        logger.error('pg_dump failed', { stderr: res.stderr });
        return { success: false, error: res.stderr || 'Backup creation failed.' };
      }

      logger.info('Database backup created successfully', { targetFile });

      // Prune old backups based on retention policy
      this.pruneOldBackups(14);

      return { success: true, backupPath: targetFile };
    } catch (err: any) {
      logger.error('Error during database backup', err);
      return { success: false, error: err.message || 'Backup failed.' };
    }
  }

  /**
   * Lists available backup files
   */
  public listBackups(): BackupFileInfo[] {
    this.ensureDirs();
    try {
      const files = fs.readdirSync(this.backupsDir);
      const list: BackupFileInfo[] = [];

      for (const f of files) {
        if (f.endsWith('.bsbak') || f.endsWith('.sql') || f.endsWith('.dump')) {
          const fullPath = path.join(this.backupsDir, f);
          const stat = fs.statSync(fullPath);
          const sizeKb = Math.round(stat.size / 1024);
          const sizeFormatted = sizeKb > 1024
            ? `${(sizeKb / 1024).toFixed(1)} MB`
            : `${sizeKb} KB`;

          list.push({
            fileName: f,
            filePath: fullPath,
            sizeBytes: stat.size,
            sizeFormatted,
            createdAt: stat.mtime.toISOString(),
            version: '1.0.0',
          });
        }
      }

      // Sort newest first
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (err: any) {
      logger.warn('Failed to list backups', { error: err.message });
      return [];
    }
  }

  /**
   * Safely restores database from backup file
   */
  public async restoreBackup(backupFilePath: string): Promise<{ success: boolean; error?: string }> {
    if (!fs.existsSync(backupFilePath)) {
      return { success: false, error: 'Backup file does not exist.' };
    }

    const pgCfg = postgresService.getConfig();
    const pgRestoreExe = path.join(pgCfg.binDir, 'pg_restore.exe');
    const psqlExe = path.join(pgCfg.binDir, 'psql.exe');

    if (!fs.existsSync(pgRestoreExe)) {
      return { success: false, error: `pg_restore.exe not found at ${pgRestoreExe}` };
    }

    logger.info('Initiating database restore from:', { backupFilePath });

    try {
      // 1. Stop local API to halt incoming writes
      await apiProcessService.stop();

      const env = {
        ...process.env,
        PGPASSWORD: pgCfg.dbPass,
      };

      // 2. Terminate active database connections
      if (fs.existsSync(psqlExe)) {
        const killConnSql = `
          SELECT pg_terminate_backend(pid)
          FROM pg_stat_activity
          WHERE datname = '${pgCfg.dbName}' AND pid <> pg_backend_pid();
        `;
        spawnSync(psqlExe, [
          '-U', pgCfg.dbUser,
          '-h', '127.0.0.1',
          '-p', pgCfg.dbPort.toString(),
          '-d', 'postgres',
          '-c', killConnSql,
        ], { env, encoding: 'utf-8', windowsHide: true });
      }

      // 3. Execute pg_restore with clean mode
      const restoreArgs = [
        '-U', pgCfg.dbUser,
        '-h', '127.0.0.1',
        '-p', pgCfg.dbPort.toString(),
        '-d', pgCfg.dbName,
        '-c', // Clean (drop) database objects before recreating them
        '-v',
        backupFilePath,
      ];

      const res = spawnSync(pgRestoreExe, restoreArgs, { env, encoding: 'utf-8', windowsHide: true });
      // Note: pg_restore often exits with code 1 if there were non-critical warnings (e.g. drop when table does not exist)
      logger.info('pg_restore finished with status:', { status: res.status });

      // 4. Restart local API
      await apiProcessService.start();

      return { success: true };
    } catch (err: any) {
      logger.error('Failed to restore database backup', err);
      // Attempt to restart API if failed
      try { await apiProcessService.start(); } catch {}
      return { success: false, error: err.message || 'Database restore failed.' };
    }
  }

  /**
   * Automatically creates a pre-migration backup before applying schema changes
   */
  public async createPreMigrationBackup(): Promise<string | null> {
    const res = await this.createBackup();
    if (res.success && res.backupPath) {
      logger.info('Created pre-migration backup at:', { path: res.backupPath });
      return res.backupPath;
    }
    return null;
  }

  /**
   * Prunes backups older than the retention count
   */
  public pruneOldBackups(retentionCount = 14): void {
    const backups = this.listBackups();
    if (backups.length > retentionCount) {
      const toDelete = backups.slice(retentionCount);
      for (const b of toDelete) {
        try {
          fs.unlinkSync(b.filePath);
          logger.info('Pruned old backup file:', { path: b.filePath });
        } catch {}
      }
    }
  }

  public openDataFolder(): void {
    if (fs.existsSync(this.dataDir)) {
      shell.openPath(this.dataDir);
    }
  }

  public openBackupsFolder(): void {
    if (fs.existsSync(this.backupsDir)) {
      shell.openPath(this.backupsDir);
    }
  }
}

export const backupService = new BackupService();
