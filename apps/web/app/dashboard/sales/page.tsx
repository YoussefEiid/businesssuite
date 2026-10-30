'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { DashboardLayout } from '../../../src/components/layout/DashboardLayout';
import { ApiService } from '../../../src/services/api';
import { useEntitlements } from '../../../src/hooks/use-entitlements';
import { useLanguage } from '../../../src/hooks/use-language';
import { useCompany } from '../../../src/hooks/use-company';
import { useToast } from '../../../src/hooks/use-toast';
import { useConfirm } from '../../../src/hooks/use-confirm';
import { useDebounce } from '../../../src/hooks/use-debounce';
import { DataTable, Column } from '../../../src/components/ui/DataTable';
import { Modal } from '../../../src/components/ui/Modal';
import { Button } from '../../../src/components/ui/Button';
import { Input } from '../../../src/components/ui/Input';
import { Select } from '../../../src/components/ui/Select';
import { Badge } from '../../../src/components/ui/Badge';
import {
  Plus,
  FileText,
  Printer,
  CheckCircle,
  X,
  Trash2,
  Receipt,
  RotateCcw,
  DollarSign,
  ArrowRightLeft,
  Calendar,
  Layers,
  ChevronRight,
  TrendingUp,
  ShoppingCart,
} from 'lucide-react';
import { SearchableItemSelect } from '../../../src/components/ui/SearchableItemSelect';

// Dynamically import heavy PrintableInvoiceModal for code splitting
const PrintableInvoiceModal = dynamic(
  () => import('../../../src/components/ui/PrintableInvoiceModal').then((m) => m.PrintableInvoiceModal),
  { ssr: false },
);

export default function SalesPage() {
  const { hasFeature } = useEntitlements();
  const { isRtl } = useLanguage();
  const { formatMoney } = useCompany();
  const toast = useToast();
  const { confirm } = useConfirm();

  const [activeTab, setActiveTab] = useState<'invoices' | 'quotations' | 'returns'>('invoices');

  // Main Data States
  const [invoices, setInvoices] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);

  // 1. Create Invoice Modal
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [isCashSale, setIsCashSale] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [lines, setLines] = useState<any[]>([
    { itemId: '', quantity: 1, unitPrice: 0, discountPercent: 0, taxRate: 0 },
  ]);
  const [submittingInvoice, setSubmittingInvoice] = useState(false);

  // 2. Create Quotation Modal
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [quotationExpiry, setQuotationExpiry] = useState('');
  const [quotationNotes, setQuotationNotes] = useState('');
  const [submittingQuotation, setSubmittingQuotation] = useState(false);

  // 3. Quick Payment Modal
  const [quickPayInvoice, setQuickPayInvoice] = useState<any | null>(null);
  const [quickPayForm, setQuickPayForm] = useState({
    amount: 0,
    accountId: '',
    paymentMethod: 'CASH',
    referenceNumber: '',
    notes: '',
  });
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // 4. Sales Return Modal
  const [returnInvoice, setReturnInvoice] = useState<any | null>(null);
  const [returnLines, setReturnLines] = useState<any[]>([]);
  const [returnNotes, setReturnNotes] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  // 5. Print Modal
  const [printInvoice, setPrintInvoice] = useState<any | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invs, quots, rets, pts, itms, whs, accs, prof] = await Promise.all([
        ApiService.listInvoices(undefined, debouncedSearch || undefined),
        ApiService.listQuotations().catch(() => []),
        ApiService.listSalesReturns().catch(() => []),
        ApiService.listParties('CUSTOMER'),
        ApiService.listItems(),
        ApiService.listWarehouses(),
        ApiService.listAccounts().catch(() => []),
        ApiService.getCompanyProfile().catch(() => null),
      ]);
      setInvoices(invs || []);
      setQuotations(quots || []);
      setReturns(rets || []);
      setParties(pts || []);
      setItems(itms || []);
      setWarehouses(whs || []);
      setAccounts(accs || []);
      setCompanyProfile(prof);

      if (whs.length > 0 && !selectedWarehouseId) setSelectedWarehouseId(whs[0].id);
      if (accs.length > 0 && !selectedAccountId) setSelectedAccountId(accs[0].id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load sales data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [debouncedSearch]);

  // Line item helpers
  const addLine = () => {
    setLines([...lines, { itemId: '', quantity: 1, unitPrice: 0, discountPercent: 0, taxRate: 0 }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, itemId: string) => {
    const selected = items.find((i) => i.id === itemId);
    const newLines = [...lines];
    newLines[index] = {
      ...newLines[index],
      itemId,
      unitPrice: Number(selected?.sellingPrice || 0),
      taxRate: Number(selected?.taxRate ?? 0),
    };
    setLines(newLines);
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const calcTotals = () => {
    let subtotal = 0;
    let taxTotal = 0;
    lines.forEach((l) => {
      const lineSub = Number(l.quantity || 0) * Number(l.unitPrice || 0) * (1 - Number(l.discountPercent || 0) / 100);
      const lineTax = lineSub * (Number(l.taxRate || 0) / 100);
      subtotal += lineSub;
      taxTotal += lineTax;
    });
    return { subtotal, taxTotal, grandTotal: subtotal + taxTotal };
  };

  // Submit Invoice
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = lines.filter((l) => l.itemId && l.quantity > 0);
    if (validLines.length === 0) {
      toast.warning(isRtl ? 'يرجى إضافة صنف واحد على الأقل مع تحديد الكمية' : 'Please add at least one line item');
      return;
    }
    if (!selectedWarehouseId) {
      toast.warning(isRtl ? 'يرجى تحديد المستودع' : 'Please select warehouse');
      return;
    }

    setSubmittingInvoice(true);
    try {
      const payload: any = {
        partyId: selectedPartyId || undefined,
        warehouseId: selectedWarehouseId,
        postImmediately: true,
        isCashSale,
        treasuryAccountId: isCashSale ? selectedAccountId : undefined,
        items: validLines.map((l) => ({
          itemId: l.itemId,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          discountPercent: Number(l.discountPercent || 0),
          taxRate: Number(l.taxRate || 0),
        })),
      };

      const res = await ApiService.createInvoice(payload);
      toast.success(isRtl ? `تم إصدار الفاتورة #${res.invoiceNumber} بنجاح` : `Invoice #${res.invoiceNumber} posted`);
      setShowInvoiceModal(false);
      setLines([{ itemId: '', quantity: 1, unitPrice: 0, discountPercent: 0, taxRate: 0 }]);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create invoice');
    } finally {
      setSubmittingInvoice(false);
    }
  };

  // Submit Quotation
  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = lines.filter((l) => l.itemId && l.quantity > 0);
    if (validLines.length === 0) {
      toast.warning(isRtl ? 'يرجى إضافة صنف واحد على الأقل' : 'Please add at least one item');
      return;
    }

    setSubmittingQuotation(true);
    try {
      const payload: any = {
        partyId: selectedPartyId || undefined,
        expiryDate: quotationExpiry ? new Date(quotationExpiry).toISOString() : undefined,
        notes: quotationNotes || undefined,
        items: validLines.map((l) => ({
          itemId: l.itemId,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          discountPercent: Number(l.discountPercent || 0),
          taxRate: Number(l.taxRate || 0),
        })),
      };

      const res = await ApiService.createQuotation(payload);
      toast.success(isRtl ? `تم إنشاء عرض السعر #${res.quotationNumber} بنجاح` : `Quotation #${res.quotationNumber} created`);
      setShowQuotationModal(false);
      setLines([{ itemId: '', quantity: 1, unitPrice: 0, discountPercent: 0, taxRate: 0 }]);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create quotation');
    } finally {
      setSubmittingQuotation(false);
    }
  };

  // Convert Quotation to Invoice
  const handleConvertQuotation = async (id: string) => {
    const ok = await confirm({
      title: isRtl ? 'تحويل عرض السعر إلى فاتورة مبيعات' : 'Convert Quotation to Invoice',
      message: isRtl
        ? 'هل تريد تحويل عرض السعر إلى فاتورة مبيعات معتمدة وخصم المخزون؟'
        : 'Convert this quotation into a posted sales invoice and deduct stock?',
    });
    if (!ok) return;

    try {
      const inv = await ApiService.convertQuotation(id);
      toast.success(isRtl ? `تم تحويل العرض إلى فاتورة #${inv.invoiceNumber}` : `Converted to invoice #${inv.invoiceNumber}`);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to convert quotation');
    }
  };

  // Quick Payment
  const handleQuickPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPayInvoice || quickPayForm.amount <= 0) return;

    setSubmittingPayment(true);
    try {
      await ApiService.quickInvoicePayment(quickPayInvoice.id, {
        amount: Number(quickPayForm.amount),
        accountId: quickPayForm.accountId,
        paymentMethod: quickPayForm.paymentMethod,
        referenceNumber: quickPayForm.referenceNumber || undefined,
        notes: quickPayForm.notes || undefined,
      });
      toast.success(isRtl ? 'تم تسجيل الدفعة النقدية وإصدار سند القبض بنجاح' : 'Payment recorded successfully');
      setQuickPayInvoice(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Open Return Modal
  const openReturnModal = (inv: any) => {
    setReturnInvoice(inv);
    const returnable = (inv.items || inv.lines || []).map((l: any) => ({
      invoiceLineId: l.id,
      itemId: l.itemId,
      item: l.item || items.find((i: any) => i.id === l.itemId),
      originalQty: Number(l.quantity),
      quantity: 0,
      unitPrice: Number(l.unitPrice),
      taxRate: Number(l.taxRate ?? 0),
    }));
    setReturnLines(returnable);
    setReturnNotes('');
  };

  const handleCreateSalesReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeReturns = returnLines.filter((l) => Number(l.quantity) > 0);
    if (activeReturns.length === 0) {
      toast.warning(isRtl ? 'يرجى تحديد كمية مرتجع لصنف واحد على الأقل' : 'Please specify return quantity');
      return;
    }

    setSubmittingReturn(true);
    try {
      await ApiService.createSalesReturn({
        salesInvoiceId: returnInvoice.id,
        notes: returnNotes || undefined,
        items: activeReturns.map((l) => ({
          itemId: l.itemId,
          quantity: Number(l.quantity),
        })),
      });
      toast.success(isRtl ? 'تم تسجيل مرتجع المبيعات واسترجاع البضاعة بنجاح' : 'Sales return posted successfully');
      setReturnInvoice(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to post return');
    } finally {
      setSubmittingReturn(false);
    }
  };

  // Columns for Invoices
  const invoiceColumns: Column<any>[] = [
    {
      key: 'invoiceNumber',
      header: isRtl ? 'رقم الفاتورة' : 'Invoice #',
      sortable: true,
      render: (r) => <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{r.invoiceNumber}</span>,
    },
    {
      key: 'party',
      header: isRtl ? 'العميل' : 'Customer',
      render: (r) => <span>{r.party ? (isRtl ? r.party.nameAr || r.party.name : r.party.name) : (isRtl ? 'عميل نقدي عام' : 'Cash Customer')}</span>,
    },
    {
      key: 'postedAt',
      header: isRtl ? 'التاريخ' : 'Date',
      sortable: true,
      render: (r) => (
        <span className="font-mono text-slate-500">
          {new Date(r.postedAt || r.createdAt).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US')}
        </span>
      ),
    },
    {
      key: 'grandTotal',
      header: isRtl ? 'الإجمالي' : 'Total',
      align: 'end',
      sortable: true,
      render: (r) => (
        <span className="font-mono font-bold tabular-nums">
          {formatMoney(r.grandTotal)}
        </span>
      ),
    },
    {
      key: 'grossMargin',
      header: isRtl ? 'مجمل الربح' : 'Gross Margin',
      align: 'end',
      sortable: true,
      render: (r) => (
        <span
          className={`font-mono font-bold tabular-nums ${
            Number(r.grossMargin) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}
        >
          {formatMoney(r.grossMargin || 0)}
        </span>
      ),
    },
    {
      key: 'paymentStatus',
      header: isRtl ? 'حالة السداد' : 'Payment Status',
      render: (r) => (
        <Badge
          variant={r.paymentStatus === 'PAID' ? 'success' : r.paymentStatus === 'PARTIALLY_PAID' ? 'warning' : 'danger'}
          size="sm"
        >
          {r.paymentStatus === 'PAID'
            ? isRtl ? 'مدفوعة' : 'Paid'
            : r.paymentStatus === 'PARTIALLY_PAID'
            ? isRtl ? 'سداد جزئي' : 'Partially Paid'
            : isRtl ? 'غير مدفوعة' : 'Unpaid'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: isRtl ? 'الإجراءات' : 'Actions',
      align: 'end',
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPrintInvoice(r)}
            title={isRtl ? 'معاينة وطباعة الفاتورة' : 'Print Invoice'}
            icon={<Printer className="w-3.5 h-3.5 text-sky-600" />}
          />
          {r.paymentStatus !== 'PAID' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setQuickPayInvoice(r);
                setQuickPayForm({
                  amount: Number(r.grandTotal) - Number(r.paidAmount || 0),
                  accountId: accounts[0]?.id || '',
                  paymentMethod: 'CASH',
                  referenceNumber: '',
                  notes: '',
                });
              }}
              title={isRtl ? 'سداد سريع / قبض' : 'Quick Payment'}
              icon={<DollarSign className="w-3.5 h-3.5 text-emerald-600" />}
            />
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => openReturnModal(r)}
            title={isRtl ? 'مرتجع مبيعات' : 'Sales Return'}
            icon={<RotateCcw className="w-3.5 h-3.5 text-amber-500" />}
          />
        </div>
      ),
    },
  ];

  // Columns for Quotations
  const quotationColumns: Column<any>[] = [
    {
      key: 'quotationNumber',
      header: isRtl ? 'رقم العرض' : 'Quote #',
      sortable: true,
      render: (r) => <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{r.quotationNumber}</span>,
    },
    {
      key: 'party',
      header: isRtl ? 'العميل' : 'Customer',
      render: (r) => <span>{r.party ? (isRtl ? r.party.nameAr || r.party.name : r.party.name) : (isRtl ? 'عميل عام' : 'General')}</span>,
    },
    {
      key: 'createdAt',
      header: isRtl ? 'تاريخ الإنشاء' : 'Date',
      sortable: true,
      render: (r) => (
        <span className="font-mono text-slate-500">
          {new Date(r.createdAt).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US')}
        </span>
      ),
    },
    {
      key: 'grandTotal',
      header: isRtl ? 'الإجمالي' : 'Total',
      align: 'end',
      sortable: true,
      render: (r) => (
        <span className="font-mono font-bold tabular-nums">
          {formatMoney(r.grandTotal)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: isRtl ? 'الإجراءات' : 'Actions',
      align: 'end',
      render: (r) => (
        <Button
          size="sm"
          variant="outline"
          className="text-2xs h-7"
          onClick={() => handleConvertQuotation(r.id)}
          icon={<ArrowRightLeft className="w-3 h-3 text-sky-600" />}
        >
          {isRtl ? 'تحويل لفاتورة' : 'Convert'}
        </Button>
      ),
    },
  ];

  // Columns for Returns
  const returnColumns: Column<any>[] = [
    {
      key: 'returnNumber',
      header: isRtl ? 'رقم المرتجع' : 'Return #',
      sortable: true,
      render: (r) => <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{r.returnNumber}</span>,
    },
    {
      key: 'invoice',
      header: isRtl ? 'الفاتورة الأصلية' : 'Original Invoice',
      render: (r) => <span className="font-mono text-slate-500">#{r.invoice?.invoiceNumber}</span>,
    },
    {
      key: 'party',
      header: isRtl ? 'العميل' : 'Customer',
      render: (r) => <span>{r.party ? (isRtl ? r.party.nameAr || r.party.name : r.party.name) : '—'}</span>,
    },
    {
      key: 'totalAmount',
      header: isRtl ? 'قيمة المرتجع' : 'Return Amount',
      align: 'end',
      sortable: true,
      render: (r) => (
        <span className="font-mono font-bold text-rose-600 dark:text-rose-400 tabular-nums">
          {formatMoney(r.totalAmount)}
        </span>
      ),
    },
  ];

  const totals = calcTotals();

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {isRtl ? 'المبيعات والفواتير' : 'Sales & Invoicing'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isRtl
                ? 'إصدار الفواتير الضريبية، عروض الأسعار، إدارة المرتجعات، والتحصيل المالي'
                : 'Manage tax invoices, sales quotations, returns and customer receivables'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLines([{ itemId: '', quantity: 1, unitPrice: 0, discountPercent: 0, taxRate: 0 }]);
                setShowQuotationModal(true);
              }}
              icon={<FileText className="w-3.5 h-3.5" />}
            >
              {isRtl ? 'عرض سعر جديد' : 'New Quote'}
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setLines([{ itemId: '', quantity: 1, unitPrice: 0, discountPercent: 0, taxRate: 0 }]);
                setShowInvoiceModal(true);
              }}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              {isRtl ? 'فاتورة مبيعات جديدة' : 'New Invoice'}
            </Button>
          </div>
        </div>

        {/* Tab Selector Ribbon */}
        <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('invoices')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'invoices'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>{isRtl ? 'فواتير المبيعات' : 'Sales Invoices'} ({invoices.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('quotations')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'quotations'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{isRtl ? 'عروض الأسعار' : 'Quotations'} ({quotations.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('returns')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'returns'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isRtl ? 'مرتجعات المبيعات' : 'Sales Returns'} ({returns.length})</span>
          </button>
        </div>

        {/* Tab 1: Invoices Table */}
        {activeTab === 'invoices' && (
          <DataTable
            columns={invoiceColumns}
            data={invoices}
            keyExtractor={(r) => r.id}
            loading={loading}
            searchPlaceholder={isRtl ? 'بحث برقم الفاتورة أو اسم العميل...' : 'Search invoice # or customer...'}
            searchValue={search}
            onSearchChange={setSearch}
            emptyTitle={isRtl ? 'لا توجد فواتير مبيعات' : 'No sales invoices found'}
            emptyActionLabel={isRtl ? 'إصدار أول فاتورة' : 'Create First Invoice'}
            onEmptyAction={() => setShowInvoiceModal(true)}
          />
        )}

        {/* Tab 2: Quotations Table */}
        {activeTab === 'quotations' && (
          <DataTable
            columns={quotationColumns}
            data={quotations}
            keyExtractor={(r) => r.id}
            loading={loading}
            searchPlaceholder={isRtl ? 'بحث في عروض الأسعار...' : 'Search quotations...'}
            emptyTitle={isRtl ? 'لا توجد عروض أسعار مسجلة' : 'No quotations found'}
            emptyActionLabel={isRtl ? 'إنشاء عرض سعر جديد' : 'New Quote'}
            onEmptyAction={() => setShowQuotationModal(true)}
          />
        )}

        {/* Tab 3: Returns Table */}
        {activeTab === 'returns' && (
          <DataTable
            columns={returnColumns}
            data={returns}
            keyExtractor={(r) => r.id}
            loading={loading}
            searchPlaceholder={isRtl ? 'بحث في المرتجعات...' : 'Search returns...'}
            emptyTitle={isRtl ? 'لا توجد مرتجعات مبيعات' : 'No returns recorded'}
          />
        )}
      </div>

      {/* Create Sales Invoice Modal */}
      <Modal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        title={isRtl ? 'إصدار فاتورة مبيعات جديدة' : 'Create Sales Invoice'}
        maxWidth="4xl"
      >
        <form onSubmit={handleCreateInvoice} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label={isRtl ? 'العميل' : 'Customer'}
              value={selectedPartyId}
              onChange={(e) => setSelectedPartyId(e.target.value)}
            >
              <option value="">{isRtl ? 'عميل نقدي عام (افتراضي)' : 'Walk-in Cash Customer'}</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {isRtl ? p.nameAr || p.name : p.name}
                </option>
              ))}
            </Select>

            <Select
              label={isRtl ? 'مستودع الخصم' : 'Fulfillment Warehouse'}
              required
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {isRtl ? w.nameAr || w.name : w.name}
                </option>
              ))}
            </Select>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isRtl ? 'طريقة البيع' : 'Sale Type'}
              </label>
              <div className="flex items-center gap-2 h-9">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={isCashSale}
                    onChange={(e) => setIsCashSale(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>{isRtl ? 'بيع نقدي فوري (سداد مباشر)' : 'Cash Sale (Immediate Payment)'}</span>
                </label>
              </div>
            </div>
          </div>

          {isCashSale && accounts.length > 0 && (
            <div className="p-3 bg-sky-50 dark:bg-sky-950/40 rounded-lg border border-sky-200 dark:border-sky-800/40">
              <Select
                label={isRtl ? 'خزينة / حساب استلام النقدية' : 'Deposit Treasury Account'}
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {isRtl ? a.nameAr || a.name : a.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* Line Items Builder */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {isRtl ? 'بنود الفاتورة' : 'Invoice Items'} ({lines.length})
              </span>
              <Button size="sm" variant="outline" onClick={addLine} icon={<Plus className="w-3 h-3" />}>
                {isRtl ? 'إضافة بند' : 'Add Line'}
              </Button>
            </div>

            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 items-center bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  <div className="col-span-12 sm:col-span-4">
                    <SearchableItemSelect
                      items={items}
                      selectedItemId={line.itemId}
                      onSelect={(itemId: string) => handleItemChange(idx, itemId)}
                      placeholder={isRtl ? 'اختر الصنف...' : 'Select item...'}
                    />
                  </div>

                  <div className="col-span-3 sm:col-span-2">
                    <Input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(e) => updateLine(idx, 'quantity', Number(e.target.value))}
                      placeholder={isRtl ? 'الكمية' : 'Qty'}
                    />
                  </div>

                  <div className="col-span-3 sm:col-span-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(idx, 'unitPrice', Number(e.target.value))}
                      placeholder={isRtl ? 'السعر' : 'Price'}
                    />
                  </div>

                  <div className="col-span-3 sm:col-span-1">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={line.discountPercent}
                      onChange={(e) => updateLine(idx, 'discountPercent', Number(e.target.value))}
                      placeholder={isRtl ? 'خصم %' : 'Disc %'}
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={line.taxRate}
                      onChange={(e) => updateLine(idx, 'taxRate', Number(e.target.value))}
                      placeholder={isRtl ? 'ضريبة %' : 'Tax %'}
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      disabled={lines.length === 1}
                      onClick={() => removeLine(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals Summary */}
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-6 text-xs">
              <div>
                <span className="text-slate-400">{isRtl ? 'المجموع قبل الضريبة' : 'Subtotal'}: </span>
                <strong className="font-mono tabular-nums">{formatMoney(totals.subtotal)}</strong>
              </div>
              <div>
                <span className="text-slate-400">{isRtl ? 'الضريبة' : 'VAT'}: </span>
                <strong className="font-mono tabular-nums">{formatMoney(totals.taxTotal)}</strong>
              </div>
              <div className="text-sky-600 dark:text-sky-400 font-extrabold text-sm">
                <span>{isRtl ? 'الإجمالي' : 'Total'}: </span>
                <strong className="font-mono tabular-nums">{formatMoney(totals.grandTotal)}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" onClick={() => setShowInvoiceModal(false)}>
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="primary" type="submit" loading={submittingInvoice}>
              {isRtl ? 'اعتماد وترحيل الفاتورة' : 'Post Invoice'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Quotation Modal */}
      <Modal
        isOpen={showQuotationModal}
        onClose={() => setShowQuotationModal(false)}
        title={isRtl ? 'إنشاء عرض سعر جديد' : 'Create Quotation'}
        maxWidth="4xl"
      >
        <form onSubmit={handleCreateQuotation} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label={isRtl ? 'العميل' : 'Customer'}
              value={selectedPartyId}
              onChange={(e) => setSelectedPartyId(e.target.value)}
            >
              <option value="">{isRtl ? 'عميل عام' : 'General Customer'}</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {isRtl ? p.nameAr || p.name : p.name}
                </option>
              ))}
            </Select>

            <Input
              label={isRtl ? 'تاريخ انتهاء العرض' : 'Expiry Date'}
              type="date"
              value={quotationExpiry}
              onChange={(e) => setQuotationExpiry(e.target.value)}
            />
          </div>

          {/* Line items for quote */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold">{isRtl ? 'بنود العرض' : 'Quotation Items'} ({lines.length})</span>
              <Button size="sm" variant="outline" onClick={addLine} icon={<Plus className="w-3 h-3" />}>
                {isRtl ? 'إضافة بند' : 'Add Line'}
              </Button>
            </div>

            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 items-center bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  <div className="col-span-12 sm:col-span-4">
                    <SearchableItemSelect
                      items={items}
                      selectedItemId={line.itemId}
                      onSelect={(itemId: string) => handleItemChange(idx, itemId)}
                      placeholder={isRtl ? 'اختر الصنف...' : 'Select item...'}
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <Input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(e) => updateLine(idx, 'quantity', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(idx, 'unitPrice', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-1">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={line.discountPercent}
                      onChange={(e) => updateLine(idx, 'discountPercent', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={line.taxRate}
                      onChange={(e) => updateLine(idx, 'taxRate', Number(e.target.value))}
                      placeholder={isRtl ? 'ضريبة %' : 'Tax %'}
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      disabled={lines.length === 1}
                      onClick={() => removeLine(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Input
            label={isRtl ? 'شروط وملاحظات العرض' : 'Quotation Terms & Notes'}
            value={quotationNotes}
            onChange={(e) => setQuotationNotes(e.target.value)}
            placeholder={isRtl ? 'الأسعار شاملة التوصيل والتركيب' : 'Prices include delivery'}
          />

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" onClick={() => setShowQuotationModal(false)}>
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="primary" type="submit" loading={submittingQuotation}>
              {isRtl ? 'إنشاء عرض السعر' : 'Create Quotation'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Quick Payment Modal */}
      {quickPayInvoice && (
        <Modal
          isOpen={!!quickPayInvoice}
          onClose={() => setQuickPayInvoice(null)}
          title={isRtl ? `تسجيل دفعة نقدية للفاتورة #${quickPayInvoice.invoiceNumber}` : `Quick Payment - Invoice #${quickPayInvoice.invoiceNumber}`}
          maxWidth="md"
        >
          <form onSubmit={handleQuickPayment} className="space-y-3.5">
            <Input
              label={isRtl ? 'المبلغ المستلم' : 'Payment Amount'}
              type="number"
              step="0.01"
              required
              value={quickPayForm.amount}
              onChange={(e) => setQuickPayForm({ ...quickPayForm, amount: Number(e.target.value) })}
            />

            <Select
              label={isRtl ? 'الخزينة / الحساب المستلم' : 'Treasury Account'}
              required
              value={quickPayForm.accountId}
              onChange={(e) => setQuickPayForm({ ...quickPayForm, accountId: e.target.value })}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {isRtl ? a.nameAr || a.name : a.name}
                </option>
              ))}
            </Select>

            <Select
              label={isRtl ? 'طريقة الدفع' : 'Payment Method'}
              value={quickPayForm.paymentMethod}
              onChange={(e) => setQuickPayForm({ ...quickPayForm, paymentMethod: e.target.value })}
            >
              <option value="CASH">{isRtl ? 'نقداً (Cash)' : 'Cash'}</option>
              <option value="BANK_TRANSFER">{isRtl ? 'تحويل بنكي' : 'Bank Transfer'}</option>
              <option value="CARD">{isRtl ? 'شبكة / بطاقة' : 'Card'}</option>
            </Select>

            <Input
              label={isRtl ? 'الرقم المرجعي (اختياري)' : 'Reference # (Optional)'}
              value={quickPayForm.referenceNumber}
              onChange={(e) => setQuickPayForm({ ...quickPayForm, referenceNumber: e.target.value })}
            />

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button variant="outline" onClick={() => setQuickPayInvoice(null)}>
                {isRtl ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button variant="primary" type="submit" loading={submittingPayment}>
                {isRtl ? 'تسجيل السند والقبض' : 'Confirm Payment'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Sales Return Modal */}
      {returnInvoice && (
        <Modal
          isOpen={!!returnInvoice}
          onClose={() => setReturnInvoice(null)}
          title={isRtl ? `مرتجع مبيعات للفاتورة #${returnInvoice.invoiceNumber}` : `Sales Return - #${returnInvoice.invoiceNumber}`}
          maxWidth="2xl"
        >
          <form onSubmit={handleCreateSalesReturn} className="space-y-4">
            <p className="text-xs text-slate-500">
              {isRtl
                ? 'حدد الكميات المراد إرجاعها للمستودع وإلغاء استحقاقها:'
                : 'Specify quantities to return into warehouse inventory:'}
            </p>

            <div className="space-y-2">
              {returnLines.map((line, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <h5 className="font-bold text-slate-800 dark:text-slate-200">{line.item?.nameAr || line.item?.name}</h5>
                    <span className="text-2xs text-slate-400 font-mono">
                      {isRtl ? `الكمية الأصلية: ${line.originalQty}` : `Original Qty: ${line.originalQty}`} &bull; {formatMoney(line.unitPrice)}
                    </span>
                  </div>

                  <div className="w-28">
                    <Input
                      type="number"
                      min="0"
                      max={line.originalQty}
                      value={line.quantity}
                      onChange={(e) => {
                        const updated = [...returnLines];
                        updated[idx].quantity = Number(e.target.value);
                        setReturnLines(updated);
                      }}
                      placeholder="0"
                    />
                  </div>
                </div>
              ))}
            </div>

            <Input
              label={isRtl ? 'سبب الإرجاع وملاحظات' : 'Return Reason & Notes'}
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              placeholder={isRtl ? 'صنف تالف / استبدال' : 'Defective item / exchange'}
            />

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button variant="outline" onClick={() => setReturnInvoice(null)}>
                {isRtl ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button variant="danger" type="submit" loading={submittingReturn}>
                {isRtl ? 'اعتماد مرتجع المبيعات' : 'Post Return'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Printable Invoice Modal (A4 & POS Thermal 80mm) */}
      {printInvoice && (
        <PrintableInvoiceModal
          isOpen={!!printInvoice}
          onClose={() => setPrintInvoice(null)}
          invoice={printInvoice}
          companyInfo={companyProfile}
          type="sales"
        />
      )}
    </DashboardLayout>
  );
}
