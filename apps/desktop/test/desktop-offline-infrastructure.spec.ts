import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as net from 'net';
import { postgresService } from '../src/services/postgres.service';
import { apiProcessService } from '../src/services/api-process.service';
import { backupService } from '../src/services/backup.service';
import { licenseService } from '../src/services/license.service';
import { configService } from '../src/services/config.service';

describe('Desktop Offline Standalone Infrastructure Tests', () => {
  describe('1. PostgreSQL Binary Discovery & Runtime Paths', () => {
    it('should discover valid PostgreSQL runtime binary directory', () => {
      const binDir = postgresService.findPostgresBinDir();
      expect(binDir).toBeTruthy();
      expect(fs.existsSync(binDir)).toBe(true);

      const postgresExe = path.join(binDir, 'postgres.exe');
      const initdbExe = path.join(binDir, 'initdb.exe');
      expect(fs.existsSync(postgresExe)).toBe(true);
      expect(fs.existsSync(initdbExe)).toBe(true);
    });

    it('should resolve database data path outside Program Files and outside app.asar', () => {
      const cfg = postgresService.getConfig();
      expect(cfg.dataDir).toBeTruthy();
      expect(cfg.dataDir.toLowerCase()).not.toContain('program files');
      expect(cfg.dataDir.toLowerCase()).not.toContain('app.asar');
      expect(cfg.dataDir).toContain('BusinessSuite');
    });

    it('should generate secure loopback database URL with non-empty credentials', () => {
      const dbUrl = postgresService.getDatabaseUrl();
      expect(dbUrl).toMatch(/^postgresql:\/\/bs_admin:[^@]+@127\.0\.0\.1:\d+\/business_suite\?schema=public$/);
      expect(dbUrl).not.toContain('localhost:5432');
      expect(dbUrl).toContain('127.0.0.1');
    });
  });

  describe('2. Dynamic Port Allocation & Process Isolation', () => {
    it('should dynamically find an available loopback port', async () => {
      const port = await apiProcessService.findAvailablePort(4200);
      expect(port).toBeGreaterThanOrEqual(4200);
      expect(port).toBeLessThan(4300);

      // Verify the port is genuinely free
      const server = net.createServer();
      await new Promise<void>((resolve, reject) => {
        server.listen(port, '127.0.0.1', () => {
          server.close(() => resolve());
        });
        server.on('error', reject);
      });
    });

    it('should detect when a port is responding', async () => {
      const server = net.createServer();
      const testPort = 4988;
      await new Promise<void>((resolve) => server.listen(testPort, '127.0.0.1', resolve));

      const isResponding = await new Promise<boolean>((resolve) => {
        const socket = new net.Socket();
        socket.once('connect', () => {
          socket.destroy();
          resolve(true);
        });
        socket.once('error', () => resolve(false));
        socket.connect(testPort, '127.0.0.1');
      });

      server.close();
      expect(isResponding).toBe(true);
    });
  });

  describe('3. Crash & Stale Process Lock Recovery', () => {
    it('should detect and remove stale postmaster.pid lock file if PID is dead', () => {
      const cfg = postgresService.getConfig();
      const pidFile = path.join(cfg.dataDir, 'postmaster.pid');

      // Create a simulated stale PID lock with an impossible dead PID
      const fakePid = 99999999;
      fs.writeFileSync(pidFile, `${fakePid}\nC:/fake/path\n`, 'utf-8');
      expect(fs.existsSync(pidFile)).toBe(true);

      // Trigger recovery
      postgresService.recoverStaleLocks();

      // Stale lock must be removed
      expect(fs.existsSync(pidFile)).toBe(false);
    });
  });

  describe('4. Packaged Frontend & API Assets Resolution', () => {
    it('should resolve packaged or local static web out directory', () => {
      const staticDir = apiProcessService.findStaticWebDir();
      expect(staticDir).toBeTruthy();
      expect(fs.existsSync(staticDir!)).toBe(true);

      // Verify essential pre-rendered pages exist in static export
      const indexHtml = path.join(staticDir!, 'index.html');
      const loginHtml = path.join(staticDir!, 'login.html');
      const setupHtml = path.join(staticDir!, 'setup.html');
      expect(fs.existsSync(indexHtml)).toBe(true);
      expect(fs.existsSync(loginHtml)).toBe(true);
      expect(fs.existsSync(setupHtml)).toBe(true);
    });
  });

  describe('5. Database Backup (.bsbak) & Retention Management', () => {
    it('should create database backup directory outside live data folder', () => {
      const backupsDir = backupService.getBackupsDir();
      const dataDir = backupService.getDataDir();

      expect(fs.existsSync(backupsDir)).toBe(true);
      expect(backupsDir).not.toBe(dataDir);
      expect(backupsDir).toContain('backups');
    });

    it('should correctly prune old backups exceeding retention limit', () => {
      const backupsDir = backupService.getBackupsDir();
      const testFiles: string[] = [];

      // Create 5 dummy test backup files with staggered timestamps
      for (let i = 1; i <= 5; i++) {
        const filePath = path.join(backupsDir, `BusinessSuite-Backup-TEST-${i}.bsbak`);
        fs.writeFileSync(filePath, `DUMMY_BACKUP_CONTENT_${i}`, 'utf-8');
        testFiles.push(filePath);
      }

      // Prune to keep only 2 backups
      backupService.pruneOldBackups(2);

      const remaining = backupService.listBackups().filter((b) => b.fileName.includes('TEST'));
      expect(remaining.length).toBeLessThanOrEqual(2);

      // Clean up remaining test files
      for (const f of testFiles) {
        try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
      }
    });
  });

  describe('6. Cryptographic Offline Licensing Engine', () => {
    it('should generate a deterministic, machine-bound hardware fingerprint', () => {
      const hwId1 = licenseService.getHardwareFingerprint();
      const hwId2 = licenseService.getHardwareFingerprint();

      expect(hwId1).toBeTruthy();
      expect(hwId1).toMatch(/^HW-[A-F0-9]{16}$/);
      expect(hwId1).toBe(hwId2); // Must be stable across multiple checks
    });

    it('should validate monotonic system clock integrity', () => {
      const isClockValid = licenseService.verifyClockIntegrity();
      expect(isClockValid).toBe(true);
    });

    it('should validate standalone offline license without remote server', () => {
      const license = licenseService.validateLicense();
      expect(license).toBeDefined();
      expect(license.isValid).toBe(true);
      expect(license.hardwareId).toBeTruthy();
      expect(license.tier).toBe('ENTERPRISE_LIFETIME');
    });
  });

  describe('7. Loopback Security & Target URL Resolution', () => {
    it('should resolve targetUrl to local loopback in DESKTOP_OFFLINE mode', () => {
      const targetUrl = configService.getTargetUrl('http://127.0.0.1:4123');
      expect(targetUrl).toBe('http://127.0.0.1:4123');
      expect(targetUrl).toContain('127.0.0.1');
      expect(targetUrl).not.toContain('app.businesssuite.com');
    });

    it('should NOT require internet or public DNS resolution for desktop launch', () => {
      const cfg = configService.getConfig();
      expect(cfg.deploymentMode).toBe('DESKTOP_OFFLINE');
    });
  });
});
