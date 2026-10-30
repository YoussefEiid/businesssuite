import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  DEFAULT_PRODUCTION_URL,
  DEFAULT_DEVELOPMENT_URL,
  DEFAULT_OFFLINE_URL,
  isLocalhostUrl,
  DEFAULT_DESKTOP_CONFIG,
} from '@business-suite/shared';

describe('Desktop Deployment Modes & Target URL Resolution', () => {
  const originalEnv = { ...process.env };
  let tempUserDataDir: string;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.DESKTOP_TARGET_URL;
    delete process.env.DEPLOYMENT_MODE;
    delete process.env.NODE_ENV;
    tempUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bs-desktop-test-'));
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    try {
      fs.rmSync(tempUserDataDir, { recursive: true, force: true });
    } catch {}
  });

  describe('1. Dual Runtime Modes & Default Configuration', () => {
    it('DEFAULT_DESKTOP_CONFIG must default to DESKTOP_OFFLINE mode', () => {
      expect(DEFAULT_DESKTOP_CONFIG.deploymentMode).toBe('DESKTOP_OFFLINE');
      expect(DEFAULT_DESKTOP_CONFIG.targetUrl).toBe(DEFAULT_OFFLINE_URL);
    });

    it('isLocalhostUrl correctly classifies loopback and external domains', () => {
      expect(isLocalhostUrl('http://localhost:3000')).toBe(true);
      expect(isLocalhostUrl('http://127.0.0.1:4000')).toBe(true);
      expect(isLocalhostUrl('http://[::1]:3000')).toBe(true);
      expect(isLocalhostUrl('http://0.0.0.0:8080')).toBe(true);
      expect(isLocalhostUrl('http://pos.localhost:3000')).toBe(true);
      expect(isLocalhostUrl('https://app.businesssuite.com')).toBe(false);
      expect(isLocalhostUrl('https://api.businesssuite.com')).toBe(false);
      expect(isLocalhostUrl('invalid-url')).toBe(false);
    });
  });

  describe('2. Target URL Resolution by Runtime Mode', () => {
    function resolveTargetUrl(params: {
      mode: 'DESKTOP_OFFLINE' | 'WEB_SAAS';
      localApiUrl?: string;
      envTargetUrl?: string;
      savedTargetUrl?: string;
    }): { url: string; mode: string } {
      if (params.mode === 'DESKTOP_OFFLINE') {
        const url = params.localApiUrl || 'http://127.0.0.1:4100';
        return { url, mode: 'DESKTOP_OFFLINE' };
      }

      // WEB_SAAS mode
      if (params.envTargetUrl && params.envTargetUrl.trim()) {
        return { url: params.envTargetUrl.trim(), mode: 'WEB_SAAS' };
      }

      if (params.savedTargetUrl && params.savedTargetUrl.trim()) {
        return { url: params.savedTargetUrl.trim(), mode: 'WEB_SAAS' };
      }

      return { url: DEFAULT_PRODUCTION_URL, mode: 'WEB_SAAS' };
    }

    it('A. DESKTOP_OFFLINE mode resolves strictly to local loopback server without internet', () => {
      const res = resolveTargetUrl({
        mode: 'DESKTOP_OFFLINE',
        localApiUrl: 'http://127.0.0.1:4188',
      });
      expect(res.url).toBe('http://127.0.0.1:4188');
      expect(res.mode).toBe('DESKTOP_OFFLINE');
    });

    it('B. WEB_SAAS mode resolves to central hosted production URL by default', () => {
      const res = resolveTargetUrl({
        mode: 'WEB_SAAS',
      });
      expect(res.url).toBe(DEFAULT_PRODUCTION_URL);
      expect(res.mode).toBe('WEB_SAAS');
    });

    it('C. WEB_SAAS mode respects custom environment or saved tenant URLs', () => {
      const res = resolveTargetUrl({
        mode: 'WEB_SAAS',
        savedTargetUrl: 'https://tenant1.businesssuite.com',
      });
      expect(res.url).toBe('https://tenant1.businesssuite.com');
      expect(res.mode).toBe('WEB_SAAS');
    });
  });
});
