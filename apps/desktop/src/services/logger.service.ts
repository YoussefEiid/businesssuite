import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export class LoggerService {
  private logFilePath: string;

  constructor() {
    const baseDir = process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'BusinessSuite')
      : (app && typeof app.getPath === 'function' ? app.getPath('userData') : path.join(process.cwd(), '.desktop-data'));
    const logsDir = path.join(baseDir, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    this.logFilePath = path.join(logsDir, 'desktop.log');
  }

  public getLogFilePath(): string {
    return this.logFilePath;
  }

  public getLogsDirectory(): string {
    return path.dirname(this.logFilePath);
  }

  public info(message: string, meta?: any): void {
    this.writeEntry('INFO', message, meta);
  }

  public warn(message: string, meta?: any): void {
    this.writeEntry('WARN', message, meta);
  }

  public error(message: string, error?: any, meta?: any): void {
    const errorDetails = error instanceof Error
      ? { message: error.message, stack: error.stack }
      : error;
    this.writeEntry('ERROR', message, { ...meta, error: errorDetails });
  }

  private writeEntry(level: string, message: string, meta?: any): void {
    const timestamp = new Date().toISOString();
    const sanitizedMeta = meta ? this.sanitize(meta) : undefined;
    const metaStr = sanitizedMeta ? ` | ${JSON.stringify(sanitizedMeta)}` : '';
    const line = `[${timestamp}] [${level}] ${message}${metaStr}\n`;

    try {
      fs.appendFileSync(this.logFilePath, line, 'utf-8');
    } catch {
      // Fallback silently if disk write fails
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[${level}] ${message}`, sanitizedMeta || '');
    }
  }

  /**
   * Strictly sanitize any object to ensure secrets, passwords, tokens, and authorization headers are never logged
   */
  private sanitize(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitize(item));
    }

    const sanitized: Record<string, any> = {};
    const sensitiveKeys = [
      'password',
      'pass',
      'token',
      'accesstoken',
      'refreshtoken',
      'jwt',
      'secret',
      'authorization',
      'auth',
      'cookie',
      'set-cookie',
      'mfasecret',
      'database_url',
      'privatekey',
    ];

    for (const [key, value] of Object.entries(obj)) {
      const lower = key.toLowerCase();
      if (sensitiveKeys.some((s) => lower.includes(s))) {
        sanitized[key] = '***REDACTED***';
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

export const logger = new LoggerService();
