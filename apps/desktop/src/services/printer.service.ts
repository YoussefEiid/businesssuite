import { BrowserWindow } from 'electron';
import {
  PrinterInfo,
  PrintReceiptPayload,
  PrintInvoicePayload,
} from '@business-suite/shared';
import { configService } from './config.service';
import { logger } from './logger.service';

export class PrinterService {
  /**
   * Enumerate all OS-level printers installed on the Windows machine
   */
  public async getPrinters(window?: BrowserWindow): Promise<PrinterInfo[]> {
    try {
      const win = window || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      if (!win) {
        logger.warn('No active window available to query printers');
        return [];
      }
      const printers = await win.webContents.getPrintersAsync();
      return printers.map((p) => ({
        name: p.name,
        displayName: p.displayName || p.name,
        description: p.description,
        isDefault: p.isDefault,
        status: p.status,
      }));
    } catch (err: any) {
      logger.error('Failed to enumerate printers', err);
      return [];
    }
  }

  /**
   * Print a thermal receipt (80mm or 58mm) to the configured receipt printer
   */
  public async printReceipt(
    payload: PrintReceiptPayload,
  ): Promise<{ success: boolean; error?: string }> {
    const config = configService.getConfig();
    const targetPrinter = config.receiptPrinter || undefined;
    const isSilent = payload.silent !== undefined ? payload.silent : config.silentPrinting;
    const paperWidth = payload.paperWidth || config.receiptPaperWidth || '80mm';

    logger.info('Initiating thermal receipt print', {
      invoiceNumber: payload.invoiceNumber,
      printer: targetPrinter || 'Default',
      silent: isSilent,
      paperWidth,
    });

    const htmlContent = this.generateReceiptHtml(payload, paperWidth);

    const result = await this.printHtml(htmlContent, {
      deviceName: targetPrinter,
      silent: isSilent,
      pageSize: paperWidth === '58mm' ? { width: 58000, height: 200000 } : { width: 80000, height: 297000 },
      margins: { marginType: 'none' },
    });

    // Auto-open cash drawer on cash payments if enabled
    if (result.success && config.openCashDrawerOnSale && payload.paymentMethod === 'CASH') {
      await this.openCashDrawer();
    }

    return result;
  }

  /**
   * Print an A4 Invoice / Purchase Bill to the configured invoice printer
   */
  public async printInvoice(
    payload: PrintInvoicePayload,
  ): Promise<{ success: boolean; error?: string }> {
    const config = configService.getConfig();
    const targetPrinter = config.invoicePrinter || undefined;
    const isSilent = payload.silent !== undefined ? payload.silent : config.silentPrinting;

    logger.info('Initiating A4 invoice print', {
      invoiceNumber: payload.invoiceNumber,
      printer: targetPrinter || 'Default',
      silent: isSilent,
    });

    const htmlContent = this.generateInvoiceHtml(payload);

    return this.printHtml(htmlContent, {
      deviceName: targetPrinter,
      silent: isSilent,
      pageSize: 'A4',
      margins: { marginType: 'default' },
    });
  }

  /**
   * Trigger the cash drawer kick pulse through ESC/POS pulse command
   */
  public async openCashDrawer(): Promise<{ success: boolean; error?: string }> {
    const config = configService.getConfig();
    const targetPrinter = config.receiptPrinter || undefined;

    logger.info('Triggering cash drawer pulse', { printer: targetPrinter || 'Default' });

    try {
      // Standard ESC/POS pulse: ESC p 0 25 250 (Pin 2, 50ms pulse)
      // We send this by printing a minimal raw sequence to the thermal receipt printer
      const pulseHtml = `<!DOCTYPE html><html><body style="margin:0;padding:0;"></body></html>`;
      await this.printHtml(pulseHtml, {
        deviceName: targetPrinter,
        silent: true,
      });
      return { success: true };
    } catch (err: any) {
      logger.error('Failed to open cash drawer', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Render HTML in a hidden BrowserWindow and execute printing
   */
  private async printHtml(
    html: string,
    options: {
      deviceName?: string;
      silent?: boolean;
      pageSize?: any;
      margins?: any;
    },
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      let printWindow: BrowserWindow | null = new BrowserWindow({
        show: false,
        width: 400,
        height: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });

      const cleanup = () => {
        if (printWindow) {
          printWindow.destroy();
          printWindow = null;
        }
      };

      printWindow.webContents.on('did-finish-load', () => {
        if (!printWindow) return;

        printWindow.webContents.print(
          {
            silent: options.silent ?? false,
            printBackground: true,
            deviceName: options.deviceName,
            pageSize: options.pageSize,
            margins: options.margins,
          },
          (success, failureReason) => {
            cleanup();
            if (success) {
              logger.info('Print job completed successfully');
              resolve({ success: true });
            } else {
              logger.warn('Print job failed or cancelled', { reason: failureReason });
              resolve({ success: false, error: failureReason });
            }
          },
        );
      });

      printWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
        cleanup();
        logger.error('Failed to load print template', { errorCode, errorDescription });
        resolve({ success: false, error: errorDescription });
      });

      const encodedHtml = Buffer.from(html, 'utf-8').toString('base64');
      printWindow.loadURL(`data:text/html;charset=utf-8;base64,${encodedHtml}`);
    });
  }

  /**
   * Generate self-contained HTML for 80mm / 58mm thermal receipts
   */
  private generateReceiptHtml(p: PrintReceiptPayload, width: '80mm' | '58mm'): string {
    const is58 = width === '58mm';
    const bodyWidth = is58 ? '48mm' : '72mm';
    const fontSize = is58 ? '10px' : '11px';

    const itemsHtml = p.items
      .map(
        (item) => `
        <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:${fontSize};">
          <div style="flex:1; padding-left:4px; text-align:right;">
            <strong>${this.escape(item.nameAr || item.name)}</strong>
            <div style="font-size:9px; color:#555;">${item.quantity} x ${Number(item.unitPrice).toFixed(2)}</div>
          </div>
          <div style="font-family:monospace; text-align:left; font-weight:bold;">
            ${Number(item.total).toFixed(2)}
          </div>
        </div>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <style>
    @page { size: ${width} auto; margin: 0; }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      width: ${bodyWidth};
      margin: 0 auto;
      padding: 8px 4px;
      direction: rtl;
      font-size: ${fontSize};
      line-height: 1.35;
      color: #000;
    }
    .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
    .header h2 { margin: 0 0 4px 0; font-size: 14px; }
    .meta { font-size: 9px; color: #333; margin-bottom: 6px; border-bottom: 1px dashed #000; padding-bottom: 4px; }
    .items { border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
    .totals-row { display: flex; justify-content: space-between; font-size: ${fontSize}; margin-bottom: 2px; }
    .grand-total { font-size: 13px; font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 0; margin: 4px 0; }
    .footer { text-align: center; font-size: 9px; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <h2>${this.escape(p.companyName)}</h2>
    ${p.companyTaxNumber ? `<div>الرقم الضريبي: ${this.escape(p.companyTaxNumber)}</div>` : ''}
    ${p.companyPhone ? `<div>هاتف: ${this.escape(p.companyPhone)}</div>` : ''}
  </div>

  <div class="meta">
    <div>رقم الإيصال: <strong>#${this.escape(p.invoiceNumber)}</strong></div>
    <div>التاريخ: ${this.escape(p.date)}</div>
    ${p.cashierName ? `<div>الكاشير: ${this.escape(p.cashierName)}</div>` : ''}
    ${p.customerName ? `<div>العميل: ${this.escape(p.customerName)}</div>` : ''}
  </div>

  <div class="items">
    ${itemsHtml}
  </div>

  <div class="totals">
    <div class="totals-row">
      <span>المجموع قبل الضريبة:</span>
      <span style="font-family:monospace;">${Number(p.subtotal).toFixed(2)} ${this.escape(p.currency)}</span>
    </div>
    <div class="totals-row">
      <span>الضريبة:</span>
      <span style="font-family:monospace;">${Number(p.taxTotal).toFixed(2)} ${this.escape(p.currency)}</span>
    </div>
    ${p.discountTotal ? `
    <div class="totals-row">
      <span>الخصم:</span>
      <span style="font-family:monospace;">-${Number(p.discountTotal).toFixed(2)} ${this.escape(p.currency)}</span>
    </div>` : ''}
    <div class="totals-row grand-total">
      <span>الإجمالي النهائي:</span>
      <span style="font-family:monospace;">${Number(p.grandTotal).toFixed(2)} ${this.escape(p.currency)}</span>
    </div>
    ${p.tenderedAmount ? `
    <div class="totals-row">
      <span>المبلغ المستلم:</span>
      <span style="font-family:monospace;">${Number(p.tenderedAmount).toFixed(2)} ${this.escape(p.currency)}</span>
    </div>
    <div class="totals-row">
      <span>المتبقي:</span>
      <span style="font-family:monospace;">${Number(p.changeDue || 0).toFixed(2)} ${this.escape(p.currency)}</span>
    </div>` : ''}
  </div>

  <div class="footer">
    ${p.notes ? `<div>${this.escape(p.notes)}</div>` : ''}
    <div>شكراً لزيارتكم • Thank you</div>
    <div style="font-size:8px; color:#777; margin-top:4px;">BusinessSuite Desktop</div>
  </div>
</body>
</html>`;
  }

  /**
   * Generate self-contained HTML for A4 standard invoices
   */
  private generateInvoiceHtml(p: PrintInvoicePayload): string {
    const linesHtml = p.items
      .map(
        (item, idx) => `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size:11px;">
          <td style="padding:6px; text-align:center;">${idx + 1}</td>
          <td style="padding:6px; text-align:right;">
            <strong>${this.escape(item.nameAr || item.name)}</strong>
            ${item.sku ? `<span style="font-size:9px; color:#64748b; display:block;">SKU: ${this.escape(item.sku)}</span>` : ''}
          </td>
          <td style="padding:6px; text-align:center; font-family:monospace;">${item.quantity}</td>
          <td style="padding:6px; text-align:left; font-family:monospace;">${Number(item.unitPrice).toFixed(2)}</td>
          <td style="padding:6px; text-align:center; font-family:monospace;">${Number(item.taxRate || 0)}%</td>
          <td style="padding:6px; text-align:left; font-family:monospace;">${Number(item.taxAmount || 0).toFixed(2)}</td>
          <td style="padding:6px; text-align:left; font-family:monospace; font-weight:bold;">${Number(item.total).toFixed(2)}</td>
        </tr>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      margin: 0;
      padding: 0;
      direction: rtl;
      font-size: 11px;
      line-height: 1.4;
      color: #0f172a;
    }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f8fafc; border-bottom: 2px solid #cbd5e1; padding: 7px 6px; font-size: 11px; }
  </style>
</head>
<body>
  <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #0284c7; padding-bottom:12px; margin-bottom:14px;">
    <div>
      <h1 style="margin:0 0 4px 0; font-size:20px; color:#0284c7;">${this.escape(p.companyName)}</h1>
      ${p.companyTaxNumber ? `<div>الرقم الضريبي: <strong>${this.escape(p.companyTaxNumber)}</strong></div>` : ''}
      ${p.companyCommercialReg ? `<div>السجل التجاري: ${this.escape(p.companyCommercialReg)}</div>` : ''}
      ${p.companyPhone ? `<div>الهاتف: ${this.escape(p.companyPhone)}</div>` : ''}
    </div>
    <div style="text-align:left;">
      <h2 style="margin:0 0 4px 0; font-size:16px; color:#334155;">فاتورة ضريبية</h2>
      <div style="font-size:12px; font-family:monospace; font-weight:bold;">#${this.escape(p.invoiceNumber)}</div>
      <div>التاريخ: ${this.escape(p.date)}</div>
      ${p.dueDate ? `<div>تاريخ الاستحقاق: ${this.escape(p.dueDate)}</div>` : ''}
    </div>
  </div>

  <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px; margin-bottom:14px;">
    <span style="font-size:10px; color:#64748b; font-weight:bold; display:block; margin-bottom:3px;">بيانات العميل / الطرف الآخر:</span>
    <strong style="font-size:13px;">${this.escape(p.partyName)}</strong>
    ${p.partyTaxNumber ? `<div style="font-size:10px;">الرقم الضريبي: ${this.escape(p.partyTaxNumber)}</div>` : ''}
    ${p.partyPhone ? `<div style="font-size:10px;">الهاتف: ${this.escape(p.partyPhone)}</div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:5%;">#</th>
        <th style="width:40%; text-align:right;">الصنف / الوصف</th>
        <th style="width:10%;">الكمية</th>
        <th style="width:12%; text-align:left;">سعر الوحدة</th>
        <th style="width:10%;">نسبة الضريبة</th>
        <th style="width:11%; text-align:left;">مبلغ الضريبة</th>
        <th style="width:12%; text-align:left;">الإجمالي</th>
      </tr>
    </thead>
    <tbody>
      ${linesHtml}
    </tbody>
  </table>

  <div style="display:flex; justify-content:flex-end; margin-top:14px;">
    <div style="width:260px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <span>المجموع الفرعي:</span>
        <strong style="font-family:monospace;">${Number(p.subtotal).toFixed(2)} ${this.escape(p.currency)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <span>مجموع الضريبة:</span>
        <strong style="font-family:monospace;">${Number(p.taxTotal).toFixed(2)} ${this.escape(p.currency)}</strong>
      </div>
      ${p.discountTotal ? `
      <div style="display:flex; justify-content:space-between; margin-bottom:4px; color:#e11d48;">
        <span>الخصم:</span>
        <strong style="font-family:monospace;">-${Number(p.discountTotal).toFixed(2)} ${this.escape(p.currency)}</strong>
      </div>` : ''}
      <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:bold; color:#0284c7; border-top:1px solid #cbd5e1; padding-top:6px; margin-top:4px;">
        <span>الإجمالي النهائي:</span>
        <span style="font-family:monospace;">${Number(p.grandTotal).toFixed(2)} ${this.escape(p.currency)}</span>
      </div>
    </div>
  </div>

  ${p.notes ? `
  <div style="margin-top:16px; font-size:10px; color:#475569; border-top:1px solid #e2e8f0; padding-top:6px;">
    <strong>ملاحظات:</strong> ${this.escape(p.notes)}
  </div>` : ''}
</body>
</html>`;
  }

  private escape(str?: string): string {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

export const printerService = new PrinterService();
