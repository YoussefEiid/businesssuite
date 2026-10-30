import { safeStorage } from 'electron';
import { logger } from './logger.service';

export class StorageService {
  /**
   * Check if OS-level encryption (Windows DPAPI) is available
   */
  public isEncryptionAvailable(): boolean {
    try {
      return safeStorage.isEncryptionAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Encrypt a sensitive string using safeStorage
   * Returns base64 encoded encrypted string
   */
  public encrypt(plaintext: string): string {
    if (!plaintext) return '';
    try {
      if (this.isEncryptionAvailable()) {
        const encryptedBuffer = safeStorage.encryptString(plaintext);
        return `encrypted:${encryptedBuffer.toString('base64')}`;
      } else {
        logger.warn('Electron safeStorage not available on this platform; sensitive storage falling back to base64 encoding');
        return `plain:${Buffer.from(plaintext, 'utf-8').toString('base64')}`;
      }
    } catch (err: any) {
      logger.error('Failed to encrypt secret', err);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt a sensitive string previously encrypted with safeStorage
   */
  public decrypt(ciphertext: string): string {
    if (!ciphertext) return '';
    try {
      if (ciphertext.startsWith('encrypted:')) {
        const buffer = Buffer.from(ciphertext.slice(10), 'base64');
        return safeStorage.decryptString(buffer);
      } else if (ciphertext.startsWith('plain:')) {
        return Buffer.from(ciphertext.slice(6), 'base64').toString('utf-8');
      }
      return ciphertext;
    } catch (err: any) {
      logger.error('Failed to decrypt secret', err);
      return '';
    }
  }
}

export const storageService = new StorageService();
