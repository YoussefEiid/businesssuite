'use client';

import React, { useState } from 'react';
import {
  Printer,
  X,
  Building2,
  Receipt,
  FileText,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CheckCircle,
  Copy,
  QrCode,
} from 'lucide-react';
import { getCurrencySymbol } from '../../utils/currency';

interface PrintableInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: any;
  companyInfo?: any;
  type?: 'sales' | 'purchase';
}

export function PrintableInvoiceModal({
  isOpen,
  onClose,
  invoice,
  companyInfo,
  type = 'sales',
}: PrintableInvoiceModalProps) {
  const [printFormat, setPrintFormat] = useState<'a4' | 'pos'>('a4');

  if (!isOpen || !invoice) return null;

  const company = companyInfo || {};
  const settings = company.settings || {};
  const party = invoice.party || {};
  const isSales = type === 'sales';
  const themeColor = settings.themeColor || '#0ea5e9';
  const currencyCode = invoice.currency || company.currencyCode || 'EGP';
  const sym = getCurrencySymbol(currencyCode, true);

  const handlePrint = async () => {
    if (typeof window !== 'undefined' && window.businessSuiteDesktop?.isDesktop) {
      const isPos = printFormat === 'pos';
      const lines = (invoice.items || []).map((item: any) => {
        const itemName =
          item.item?.nameAr ||
          item.item?.name ||
          item.nameAr ||
          item.name ||
          item.itemNameAr ||
          item.itemName ||
          item.description ||
          item.notes ||
          (item.item?.code ? `منتج (${item.item.code})` : '') ||
          (item.code ? `منتج (${item.code})` : '') ||
          (item.itemId ? `منتج (${String(item.itemId).slice(0, 8)})` : '');

        return {
          sku: item.item?.code || item.code || '',
          name: itemName,
          nameAr: item.item?.nameAr || item.nameAr || itemName,
          quantity: Number(item.quantity || 1),
          unitPrice: Number(item.unitPrice || 0),
          taxRate: Number(item.taxRate ?? 0),
          taxAmount: Number(item.taxAmount || 0),
          discount: Number(item.discountAmount || 0),
          total: Number(item.totalAmount || item.total || 0),
        };
      });

      if (isPos) {
        await window.businessSuiteDesktop.printReceipt({
          invoiceNumber: String(docNumber),
          date: new Date(invoice.createdAt || Date.now()).toLocaleString('ar-SA'),
          companyName: company.nameAr || company.name || 'BusinessSuite',
          companyTaxNumber: company.taxNumber,
          companyPhone: company.phone,
          companyAddress: company.address,
          customerName: party.nameAr || party.name,
          currency: sym,
          items: lines,
          subtotal: Number(invoice.subtotal || 0),
          taxTotal: Number(invoice.taxTotal || 0),
          discountTotal: Number(invoice.discountTotal || 0),
          grandTotal: Number(invoice.grandTotal || 0),
          paymentMethod: invoice.paymentMethod,
          notes: invoice.notes,
        });
      } else {
        await window.businessSuiteDesktop.printInvoice({
          invoiceNumber: String(docNumber),
          date: new Date(invoice.createdAt || Date.now()).toLocaleDateString('ar-SA'),
          partyName: party.nameAr || party.name || (isSales ? 'عميل نقدي عام' : 'مورد عام'),
          partyTaxNumber: party.taxNumber,
          partyPhone: party.phone,
          partyAddress: party.address,
          companyName: company.nameAr || company.name || 'BusinessSuite',
          companyTaxNumber: company.taxNumber,
          companyCommercialReg: company.commercialReg,
          companyPhone: company.phone,
          companyEmail: company.email,
          companyAddress: company.address,
          currency: sym,
          items: lines,
          subtotal: Number(invoice.subtotal || 0),
          taxTotal: Number(invoice.taxTotal || 0),
          discountTotal: Number(invoice.discountTotal || 0),
          grandTotal: Number(invoice.grandTotal || 0),
          notes: invoice.notes,
        });
      }
    } else {
      window.print();
    }
  };

  const invoiceTitle = isSales ? 'فاتورة ضريبية (Tax Invoice)' : 'فاتورة مشتريات وتوريد (Purchase Bill)';
  const partyTitle = isSales ? 'بيانات العميل (Customer):' : 'بيانات المورد (Supplier):';
  const docNumber = invoice.invoiceNumber || invoice.billNumber || invoice.id;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-[99999] overflow-y-auto">
      {/* Container */}
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[96vh] flex flex-col overflow-hidden text-right">
        {/* Modal Controls Bar (Hidden in Print) */}
        <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-sky-400" />
            <span className="font-bold text-sm">معاينة وطباعة الفاتورة الضريبية</span>
            <span className="text-xs bg-slate-800 text-sky-300 px-2 py-0.5 rounded font-mono">
              #{docNumber}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Format Toggle */}
            <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setPrintFormat('a4')}
                className={`px-3 py-1 rounded-md font-semibold transition ${
                  printFormat === 'a4' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                قياسي A4
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('pos')}
                className={`px-3 py-1 rounded-md font-semibold transition ${
                  printFormat === 'pos' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                حراري POS (80mm)
              </button>
            </div>

            {/* Print Trigger */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الآن</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/60 flex justify-center">
          {/* ================= A4 FORMAT ================= */}
          {printFormat === 'a4' && (
            <div
              id="printable-document"
              className="bg-white w-full max-w-[800px] min-h-[1050px] p-8 shadow-sm border border-slate-200 text-slate-800 text-xs space-y-6 print:m-0 print:p-0 print:border-none print:shadow-none print:w-full"
              dir="rtl"
            >
              {/* Header */}
              <div className="flex justify-between items-start border-b-2 pb-6" style={{ borderColor: themeColor }}>
                <div className="space-y-1 max-w-[320px]">
                  <h1 className="text-xl font-extrabold" style={{ color: themeColor }}>
                    {company.name || settings.companyName || 'مؤسسة الأعمال المتقدمة'}
                  </h1>
                  <p className="text-[11px] text-slate-500">{company.nameEn || settings.companyNameEn || 'BusinessSuite Enterprise'}</p>
                  {company.taxNumber && (
                    <p className="font-semibold text-slate-700">
                      الرقم الضريبي:{' '}
                      <span className="font-mono text-slate-900">{company.taxNumber}</span>
                    </p>
                  )}
                  {company.commercialReg && (
                    <p className="text-slate-600">
                      السجل التجاري: <span className="font-mono">{company.commercialReg}</span>
                    </p>
                  )}
                  {company.address && <p className="text-slate-500">{company.address}</p>}
                  {company.phone && <p className="text-slate-500 font-mono">هاتف: {company.phone}</p>}
                </div>

                <div className="flex flex-col items-center text-center space-y-2">
                  {company.logoUrl ? (
                    <img
                      src={company.logoUrl}
                      alt="Logo"
                      className="w-20 h-20 object-contain rounded-lg border border-slate-100 p-1"
                    />
                  ) : (
                    <div
                      className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-black text-2xl shadow-xs"
                      style={{ backgroundColor: themeColor }}
                    >
                      <Building2 className="w-8 h-8" />
                    </div>
                  )}

                  <div className="text-center">
                    <span className="text-sm font-extrabold uppercase px-3 py-1 rounded bg-slate-100 border border-slate-200 text-slate-800 block">
                      {invoiceTitle}
                    </span>
                  </div>
                </div>
              </div>

              {/* Invoice Meta & Party Grid */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50/80 p-4 rounded-xl border border-slate-200/80">
                {/* Party Info */}
                <div className="space-y-1 border-l border-slate-200 pl-4">
                  <span className="font-bold text-slate-900 block mb-1">{partyTitle}</span>
                  <div className="text-sm font-extrabold text-slate-900">{party.name || party.nameAr || 'عميل نقدي عام'}</div>
                  {party.taxNumber && (
                    <div className="text-slate-600">
                      الرقم الضريبي: <span className="font-mono font-bold text-slate-800">{party.taxNumber}</span>
                    </div>
                  )}
                  {party.phone && <div className="text-slate-600 font-mono">الهاتف: {party.phone}</div>}
                  {party.address && <div className="text-slate-500">{party.address}</div>}
                </div>

                {/* Doc Meta */}
                <div className="space-y-1 pr-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">رقم الفاتورة:</span>
                    <span className="font-mono font-extrabold text-slate-900 text-sm">#{docNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">تاريخ الإصدار:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {invoice.issueDate
                        ? new Date(invoice.issueDate).toLocaleDateString('ar-SA')
                        : new Date().toLocaleDateString('ar-SA')}
                    </span>
                  </div>
                  {invoice.warehouse && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">المستودع:</span>
                      <span className="font-bold text-slate-700">{invoice.warehouse.nameAr || invoice.warehouse.name}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-500">حالة السداد:</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                        invoice.paymentStatus === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : invoice.paymentStatus === 'PARTIALLY_PAID'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {invoice.paymentStatus === 'PAID'
                        ? 'مسددة بالكامل'
                        : invoice.paymentStatus === 'PARTIALLY_PAID'
                        ? 'مسددة جزئيًا'
                        : 'غير مسددة (آجلة)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3 w-10 text-center">#</th>
                      <th className="p-3">الصنف / الوصف</th>
                      <th className="p-3 text-center">الكمية</th>
                      <th className="p-3 text-left">سعر الوحدة</th>
                      <th className="p-3 text-left">الخصم</th>
                      <th className="p-3 text-center">الضريبة</th>
                      <th className="p-3 text-left">الإجمالي (شامل الضريبة)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoice.items?.map((item: any, idx: number) => {
                      const itemName =
                        item.item?.nameAr ||
                        item.item?.name ||
                        item.nameAr ||
                        item.name ||
                        item.itemNameAr ||
                        item.itemName ||
                        item.description ||
                        item.notes ||
                        (item.item?.code ? `منتج (${item.item.code})` : '') ||
                        (item.code ? `منتج (${item.code})` : '') ||
                        (item.itemId ? `منتج (${String(item.itemId).slice(0, 8)})` : '');
                      const itemCode = item.item?.code || item.code || '';

                      return (
                        <tr key={item.id || idx} className="hover:bg-slate-50/50">
                          <td className="p-3 text-center font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900">{itemName}</div>
                            {itemCode && <div className="text-[10px] text-slate-400 font-mono">{itemCode}</div>}
                          </td>
                          <td className="p-3 text-center font-bold font-mono">{Number(item.quantity)}</td>
                          <td className="p-3 text-left font-mono">{Number(item.unitPrice).toFixed(2)} {sym}</td>
                          <td className="p-3 text-left font-mono text-slate-500">
                            {Number(item.discountAmount || 0) > 0 ? `${Number(item.discountAmount).toFixed(2)} ${sym}` : '-'}
                          </td>
                          <td className="p-3 text-center font-mono text-slate-600">
                            {Number(item.taxRate ?? 0)}%
                          </td>
                          <td className="p-3 text-left font-bold font-mono text-slate-900">
                            {Number(item.totalAmount || 0).toFixed(2)} {sym}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals & QR Code Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start pt-2">
                {/* QR Code & ZATCA Simulation */}
                <div className="flex items-center gap-4 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="w-24 h-24 bg-white border border-slate-300 rounded-lg p-2 flex flex-col items-center justify-center flex-shrink-0">
                    <QrCode className="w-16 h-16 text-slate-800" />
                    <span className="text-[8px] text-slate-400 font-mono mt-0.5">ZATCA QR</span>
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-600">
                    <div className="font-bold text-slate-800">رمز الاستجابة السريعة (QR):</div>
                    <div>مطابق لمعايير الفوترة الإلكترونية بالمملكة</div>
                    <div className="text-[10px] text-slate-400">يشمل: اسم المورد، الرقم الضريبي، التوقيت، وإجمالي الضريبة.</div>
                  </div>
                </div>

                {/* Totals Summary */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                  <div className="flex justify-between text-slate-600">
                    <span>المجموع قبل الضريبة (Subtotal):</span>
                    <span className="font-mono font-bold">{Number(invoice.subtotal || 0).toFixed(2)} {sym}</span>
                  </div>

                  {Number(invoice.discountTotal || 0) > 0 && (
                    <div className="flex justify-between text-rose-600 font-semibold">
                      <span>إجمالي الخصم (Discount):</span>
                      <span className="font-mono">-{Number(invoice.discountTotal).toFixed(2)} {sym}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-slate-600">
                    <span>ضريبة القيمة المضافة (VAT):</span>
                    <span className="font-mono font-bold">{Number(invoice.taxTotal || 0).toFixed(2)} {sym}</span>
                  </div>

                  <div
                    className="flex justify-between text-base font-extrabold pt-2 border-t border-slate-200 text-slate-900"
                    style={{ color: themeColor }}
                  >
                    <span>الإجمالي النهائي المستحق:</span>
                    <span className="font-mono">{Number(invoice.grandTotal || 0).toFixed(2)} {sym}</span>
                  </div>

                  {Number(invoice.paidAmount || 0) > 0 && (
                    <div className="flex justify-between text-emerald-700 font-bold pt-1 border-t border-dashed border-slate-200 text-xs">
                      <span>المبلغ المسدد (Paid):</span>
                      <span className="font-mono">{Number(invoice.paidAmount).toFixed(2)} {sym}</span>
                    </div>
                  )}

                  {Number(invoice.grandTotal || 0) - Number(invoice.paidAmount || 0) > 0 && (
                    <div className="flex justify-between text-rose-700 font-bold text-xs">
                      <span>المتبقي غير المسدد (Remaining):</span>
                      <span className="font-mono">
                        {(Number(invoice.grandTotal || 0) - Number(invoice.paidAmount || 0)).toFixed(2)} {sym}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Terms & Conditions */}
              {settings.termsAndConditions && (
                <div className="p-3.5 bg-slate-50/50 rounded-xl border border-slate-200 text-[10px] text-slate-500 space-y-1">
                  <div className="font-bold text-slate-700">الشروط والأحكام:</div>
                  <div className="whitespace-pre-line leading-relaxed">{settings.termsAndConditions}</div>
                </div>
              )}

              {/* Footer */}
              <div className="text-center pt-4 border-t border-slate-200 text-[11px] text-slate-500 font-medium">
                {settings.invoiceFooter || 'شكرًا لتعاملكم معنا، نسعد بخدمتكم دائمًا'}
              </div>
            </div>
          )}

          {/* ================= 80MM POS THERMAL FORMAT ================= */}
          {printFormat === 'pos' && (
            <div
              id="printable-document"
              className="bg-white w-[300px] p-4 shadow-sm border border-slate-300 font-mono text-slate-900 text-xs space-y-3 print:m-0 print:p-0 print:border-none print:shadow-none print:w-full"
              dir="rtl"
            >
              <div className="text-center space-y-1 pb-2 border-b border-dashed border-slate-400">
                <h2 className="font-black text-sm">{company.name || 'BusinessSuite POS'}</h2>
                {company.taxNumber && <p className="text-[10px]">الرقم الضريبي: {company.taxNumber}</p>}
                {company.phone && <p className="text-[10px]">الهاتف: {company.phone}</p>}
                <p className="font-bold text-xs pt-1">*** فاتورة ضريبية مبسطة ***</p>
              </div>

              <div className="text-[10px] space-y-0.5 border-b border-dashed border-slate-400 pb-2">
                <div className="flex justify-between">
                  <span>رقم الفاتورة:</span>
                  <span className="font-bold">#{docNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>التاريخ:</span>
                  <span>
                    {invoice.issueDate
                      ? new Date(invoice.issueDate).toLocaleString('ar-SA')
                      : new Date().toLocaleString('ar-SA')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>العميل:</span>
                  <span>{party.name || party.nameAr || 'عميل نقدي'}</span>
                </div>
              </div>

              {/* POS Items */}
              <div className="border-b border-dashed border-slate-400 pb-2 space-y-1.5 text-[11px]">
                {invoice.items?.map((item: any, idx: number) => {
                  const itemName =
                    item.item?.nameAr ||
                    item.item?.name ||
                    item.nameAr ||
                    item.name ||
                    item.itemNameAr ||
                    item.itemName ||
                    item.description ||
                    item.notes ||
                    (item.item?.code ? `منتج (${item.item.code})` : '') ||
                    (item.code ? `منتج (${item.code})` : '') ||
                    (item.itemId ? `منتج (${String(item.itemId).slice(0, 8)})` : '');
                  return (
                    <div key={idx} className="space-y-0.5">
                      <div className="font-bold">{itemName}</div>
                      <div className="flex justify-between text-slate-600 text-[10px]">
                        <span>
                          {Number(item.quantity)} × {Number(item.unitPrice).toFixed(2)}
                        </span>
                        <span className="font-bold text-slate-900">{Number(item.totalAmount).toFixed(2)} {sym}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* POS Totals */}
              <div className="space-y-1 text-[11px] border-b border-dashed border-slate-400 pb-2">
                <div className="flex justify-between">
                  <span>المجموع الفرعي:</span>
                  <span>{Number(invoice.subtotal || 0).toFixed(2)} {sym}</span>
                </div>
                <div className="flex justify-between">
                  <span>الضريبة:</span>
                  <span>{Number(invoice.taxTotal || 0).toFixed(2)} {sym}</span>
                </div>
                <div className="flex justify-between font-black text-sm pt-1 border-t border-slate-300">
                  <span>الإجمالي المطلوب:</span>
                  <span>{Number(invoice.grandTotal || 0).toFixed(2)} {sym}</span>
                </div>
              </div>

              {/* POS QR */}
              <div className="flex flex-col items-center justify-center pt-2 space-y-1 text-center">
                <QrCode className="w-20 h-20 text-slate-800" />
                <p className="text-[9px] text-slate-500">شكراً لزيارتكم</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
