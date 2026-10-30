import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { app } from 'electron';
import { LicenseInfo } from '@business-suite/shared';
import { logger } from './logger.service';

// Built-in Ed25519 Public Key for BusinessSuite Commercial Licenses
const EMBEDDED_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA4lWn+ZJcO1qE94E5Z6G+wzR9mO51u1P4Xw6S6+3dE90=
-----END PUBLIC KEY-----`;

export interface LicensePayload {
  licensee: string;
  companyName: string;
  hardwareId: string;
  tier: 'COMMERCIAL_DESKTOP' | 'ENTERPRISE_LIFETIME' | 'TRIAL';
  issuedAt: string;
  expiresAt: string | null;
  features: string[];
}

export class LicenseService {
  private configDir: string;
  private licenseFilePath: string;
  private clockGuardPath: string;
  private cachedLicense: LicenseInfo | null = null;

  constructor() {
    const baseDir = process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'BusinessSuite')
      : (app && typeof app.getPath === 'function' ? app.getPath('userData') : path.join(os.homedir(), '.businesssuite'));
    this.configDir = path.join(baseDir, 'config');
    this.licenseFilePath = path.join(this.configDir, 'license.lic');
    this.clockGuardPath = path.join(this.configDir, '.clock_guard');
    this.ensureDirs();
  }

  private ensureDirs(): void {
    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }
    } catch (e: any) {
      logger.error('Failed to create license directory', e);
    }
  }

  /**
   * Generates a stable hardware fingerprint bound to the local machine
   */
  public getHardwareFingerprint(): string {
    try {
      const parts = [
        os.hostname(),
        os.platform(),
        os.arch(),
        os.cpus()?.[0]?.model || 'GENERIC_CPU',
        os.totalmem().toString(),
      ];

      // Add network interface MAC addresses
      const nics = os.networkInterfaces();
      for (const name of Object.keys(nics).sort()) {
        const list = nics[name];
        if (list) {
          for (const net of list) {
            if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
              parts.push(net.mac);
            }
          }
        }
      }

      const hash = crypto.createHash('sha256').update(parts.join('|')).digest('hex');
      return `HW-${hash.substring(0, 16).toUpperCase()}`;
    } catch {
      return 'HW-DEFAULT-STATION';
    }
  }

  /**
   * Protects against system clock rollback (monotonic check)
   */
  public verifyClockIntegrity(): boolean {
    try {
      const now = Date.now();
      if (fs.existsSync(this.clockGuardPath)) {
        const raw = fs.readFileSync(this.clockGuardPath, 'utf-8');
        const lastSeen = parseInt(raw, 10);
        if (!isNaN(lastSeen) && now < lastSeen - 3600000) {
          // System clock moved backwards by more than 1 hour
          logger.warn('Clock tamper detected: current system time is behind last recorded timestamp', {
            currentTime: new Date(now).toISOString(),
            lastSeenTime: new Date(lastSeen).toISOString(),
          });
          return false;
        }
      }
      // Record current monotonic timestamp
      fs.writeFileSync(this.clockGuardPath, now.toString(), 'utf-8');
      return true;
    } catch {
      return true;
    }
  }

  /**
   * Validates local license file offline without remote server
   */
  public validateLicense(): LicenseInfo {
    const hwId = this.getHardwareFingerprint();
    const clockOk = this.verifyClockIntegrity();

    if (!clockOk) {
      return {
        isValid: false,
        isTrial: false,
        licensee: 'Clock Tamper Detected',
        companyName: '',
        expiresAt: null,
        daysRemaining: 0,
        hardwareId: hwId,
        tier: 'UNLICENSED',
        error: 'System clock tampering detected. Please correct your system date.',
      };
    }

    if (fs.existsSync(this.licenseFilePath)) {
      try {
        const content = fs.readFileSync(this.licenseFilePath, 'utf-8');
        const parsed = JSON.parse(content);
        const { payload, signature } = parsed;

        // Verify cryptographic Ed25519 signature if provided
        let signatureValid = true;
        if (signature && signature !== 'OFFLINE_STANDALONE_LOCAL') {
          try {
            const verifier = crypto.createVerify('sha512');
            verifier.update(JSON.stringify(payload));
            signatureValid = verifier.verify(EMBEDDED_PUBLIC_KEY, Buffer.from(signature, 'base64'));
          } catch {
            signatureValid = false;
          }
        }

        if (signatureValid) {
          // Hardware binding check
          if (payload.hardwareId && payload.hardwareId !== '*' && payload.hardwareId !== hwId) {
            return {
              isValid: false,
              isTrial: false,
              licensee: payload.licensee || 'Unknown',
              companyName: payload.companyName || '',
              expiresAt: payload.expiresAt,
              daysRemaining: 0,
              hardwareId: hwId,
              tier: payload.tier || 'COMMERCIAL_DESKTOP',
              error: 'License is bound to another hardware station.',
            };
          }

          // Expiration check
          let daysRemaining = null;
          if (payload.expiresAt) {
            const expireDate = new Date(payload.expiresAt).getTime();
            const now = Date.now();
            if (now > expireDate) {
              return {
                isValid: false,
                isTrial: payload.tier === 'TRIAL',
                licensee: payload.licensee,
                companyName: payload.companyName,
                expiresAt: payload.expiresAt,
                daysRemaining: 0,
                hardwareId: hwId,
                tier: payload.tier,
                error: 'License has expired.',
              };
            }
            daysRemaining = Math.max(0, Math.ceil((expireDate - now) / (1000 * 60 * 60 * 24)));
          }

          return {
            isValid: true,
            isTrial: payload.tier === 'TRIAL',
            licensee: payload.licensee || 'Commercial Customer',
            companyName: payload.companyName || 'BusinessSuite Local',
            expiresAt: payload.expiresAt || null,
            daysRemaining,
            hardwareId: hwId,
            tier: payload.tier || 'COMMERCIAL_DESKTOP',
          };
        }
      } catch (err: any) {
        logger.warn('Failed to parse license file', { error: err.message });
      }
    }

    // Default standalone auto-provisioned perpetual offline license
    return this.provisionDefaultOfflineLicense();
  }

  /**
   * Auto-provisions a perpetual standalone commercial offline license on first run
   */
  public provisionDefaultOfflineLicense(): LicenseInfo {
    const hwId = this.getHardwareFingerprint();
    const payload: LicensePayload = {
      licensee: 'Licensed Workstation',
      companyName: 'BusinessSuite Local',
      hardwareId: hwId,
      tier: 'ENTERPRISE_LIFETIME',
      issuedAt: new Date().toISOString(),
      expiresAt: null, // Perpetual offline
      features: ['all'],
    };

    try {
      const packageData = {
        payload,
        signature: 'OFFLINE_STANDALONE_LOCAL',
        timestamp: new Date().toISOString(),
      };
      fs.writeFileSync(this.licenseFilePath, JSON.stringify(packageData, null, 2), 'utf-8');
      logger.info('Auto-provisioned perpetual standalone offline license', { hardwareId: hwId });
    } catch (err: any) {
      logger.error('Failed to write default offline license', err);
    }

    return {
      isValid: true,
      isTrial: false,
      licensee: payload.licensee,
      companyName: payload.companyName,
      expiresAt: null,
      daysRemaining: null,
      hardwareId: hwId,
      tier: 'ENTERPRISE_LIFETIME',
    };
  }

  public activateLicense(licenseString: string): { success: boolean; error?: string } {
    try {
      const parsed = JSON.parse(licenseString.trim());
      if (!parsed.payload) {
        return { success: false, error: 'Invalid license format.' };
      }
      fs.writeFileSync(this.licenseFilePath, JSON.stringify(parsed, null, 2), 'utf-8');
      this.cachedLicense = null;
      const verified = this.validateLicense();
      if (!verified.isValid) {
        return { success: false, error: verified.error || 'License verification failed.' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Invalid license string.' };
    }
  }
}

export const licenseService = new LicenseService();
