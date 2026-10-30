'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { DashboardLayout } from '../../../src/components/layout/DashboardLayout';
import { ApiService } from '../../../src/services/api';
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
  ShoppingBag,
  FileText,
  Printer,
  RotateCcw,
  DollarSign,
  ArrowRightLeft,
  Paperclip,
  Trash2,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { SearchableItemSelect } from '../../../src/components/ui/SearchableItemSelect';

const PrintableInvoiceModal = dynamic(
  () => import('../../../src/components/ui/PrintableInvoiceModal').then((m) => m.PrintableInvoiceModal),
  { ssr: false },
);

export default function PurchasesPage() {
  const { isRtl } = useLanguage();
  const { formatMoney } = useCompany();
  const toast = useToast();
  const { confirm } = useConfirm();

  const [activeTab, setActiveTab] = useState<'bills' | 'orders' | 'returns'>('bills');

  // Main Data States
  const [purchases, setPurchases] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);

  // 1. Create Purchase Bill Modal
  const [showBillModal, setShowBillModal] = useState(false);
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [billNotes, setBillNotes] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<{ name: string; type: string; dataUrl: string } | null>(null);
  const [lines, setLines] = useState<any[]>([{ itemId: '', quantity: 1, unitPrice: 0, taxRate: 0 }]);
  const [submittingBill, setSubmittingBill] = useState(false);

  // 2. Attachment Viewer Modal
  const [viewingAttachment, setViewingAttachment] = useState<{ name: string; type: string; dataUrl: string; billNumber?: string } | null>(null);

  // 3. Create Purchase Order Modal
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderDeliveryDate, setOrderDeliveryDate] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // 4. Quick Payment Modal
  const [quickPayBill, setQuickPayBill] = useState<any | null>(null);
  const [quickPayForm, setQuickPayForm] = useState({
    amount: 0,
    accountId: '',
    paymentMethod: 'BANK_TRANSFER',
    referenceNumber: '',
    notes: '',
  });
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // 5. Purchase Return Modal
  const [returnBill, setReturnBill] = useState<any | null>(null);
  const [returnLines, setReturnLines] = useState<any[]>([]);
  const [returnNotes, setReturnNotes] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  // 6. Print Modal
  const [printBill, setPrintBill] = useState<any | null>(null);

  const parseInvoiceNotes = (rawNotes?: string): { text: string; attachment: { name: string; type: string; dataUrl: string } | null } => {
    if (!rawNotes) return { text: '', attachment: null };
    try {
      const parsed = JSON.parse(rawNotes);
      if (parsed && typeof parsed === 'object' && ('text' in parsed || 'attachment' in parsed)) {
        return {
          text: parsed.text || '',
          attachment: parsed.attachment || null,
        };
      }
    } catch {
      // not json
    }
    return { text: rawNotes, attachment: null };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.warning(isRtl ? 'حجم الملف كبير جداً (الحد الأقصى 25 ميجابايت)' : 'File size too large (max 25MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result as string;
      setAttachmentFile({
        name: file.name,
        type: file.type,
        dataUrl: result,
      });
      toast.info(isRtl ? `تم إرفاق الملف: ${file.name}` : `Attached: ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [purchs, ords, rets, pts, itms, whs, accs, prof] = await Promise.all([
        ApiService.listPurchases(undefined, debouncedSearch || undefined),
        ApiService.listOrders().catch(() => []),
        ApiService.listPurchaseReturns().catch(() => []),
        ApiService.listParties('SUPPLIER'),
        ApiService.listItems(),
        ApiService.listWarehouses(),
        ApiService.listAccounts().catch(() => []),
        ApiService.getCompanyProfile().catch(() => null),
      ]);
      setPurchases(purchs || []);
      setOrders(ords || []);
      setReturns(rets || []);
      setParties(pts || []);
      setItems(itms || []);
      setWarehouses(whs || []);
      setAccounts(accs || []);
      setCompanyProfile(prof);

      if (whs.length > 0 && !selectedWarehouseId) setSelectedWarehouseId(whs[0].id);
      if (accs.length > 0 && !quickPayForm.accountId) {
        setQuickPayForm((prev) => ({ ...prev, accountId: accs[0].id }));
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load purchases data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [debouncedSearch]);

  // Line item helpers
  const addLine = () => {
    setLines([...lines, { itemId: '', quantity: 1, unitPrice: 0, taxRate: 0 }]);
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
      unitPrice: Number(selected?.purchasePrice || 0),
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
      const lineSub = Number(l.quantity || 0) * Number(l.unitPrice || 0);
      const lineTax = lineSub * (Number(l.taxRate || 0) / 100);
      subtotal += lineSub;
      taxTotal += lineTax;
    });
    return { subtotal, taxTotal, grandTotal: subtotal + taxTotal };
  };

  // Submit Purchase Bill
  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = lines.filter((l) => l.itemId && l.quantity > 0);
    if (validLines.length === 0) {
      toast.warning(isRtl ? 'يرجى اختيار صنف وكمية صحيحة' : 'Please select at least one item');
      return;
    }
    if (!selectedPartyId) {
      toast.warning(isRtl ? 'يرجى اختيار المورد' : 'Please select supplier');
      return;
    }
    if (!selectedWarehouseId) {
      toast.warning(isRtl ? 'يرجى اختيار المستودع لاستلام البضاعة' : 'Please select receiving warehouse');
      return;
    }

    setSubmittingBill(true);
    try {
      const notesPayload = JSON.stringify({
        text: billNotes || '',
        attachment: attachmentFile || null,
      });

      const payload: any = {
        partyId: selectedPartyId,
        warehouseId: selectedWarehouseId,
        supplierInvoiceNumber: supplierInvoiceNumber || undefined,
        notes: notesPayload,
        items: validLines.map((l) => ({
          itemId: l.itemId,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          taxRate: Number(l.taxRate || 0),
        })),
      };

      const res = await ApiService.createPurchase(payload);
      toast.success(
        isRtl
          ? `تم إنشاء فاتورة الشراء #${res.billNumber} وتحديث متوسط التكلفة WAC بنجاح`
          : `Purchase bill #${res.billNumber} posted and WAC updated`,
      );
      setShowBillModal(false);
      setLines([{ itemId: '', quantity: 1, unitPrice: 0, taxRate: 0 }]);
      setAttachmentFile(null);
      setSupplierInvoiceNumber('');
      setBillNotes('');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create bill');
    } finally {
      setSubmittingBill(false);
    }
  };

  // Convert Order to Bill
  const handleConvertOrder = async (id: string) => {
    const ok = await confirm({
      title: isRtl ? 'تحويل أمر الشراء إلى فاتورة مورد' : 'Convert Purchase Order to Bill',
      message: isRtl
        ? 'هل تريد تحويل أمر الشراء إلى فاتورة شراء معتمدة وإضافة الأصناف للمخزون؟'
        : 'Convert this PO to a posted vendor bill and increment stock inventory?',
    });
    if (!ok) return;

    try {
      const bill = await ApiService.convertOrder(id);
      toast.success(isRtl ? `تم تحويل أمر الشراء إلى فاتورة #${bill.billNumber}` : `Converted to bill #${bill.billNumber}`);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to convert order');
    }
  };

  // Quick Bill Payment
  const handleQuickPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPayBill || quickPayForm.amount <= 0) return;

    setSubmittingPayment(true);
    try {
      await ApiService.quickBillPayment(quickPayBill.id, {
        amount: Number(quickPayForm.amount),
        accountId: quickPayForm.accountId,
        paymentMethod: quickPayForm.paymentMethod,
        referenceNumber: quickPayForm.referenceNumber || undefined,
        notes: quickPayForm.notes || undefined,
      });
      toast.success(isRtl ? 'تم تسجيل سداد فاتورة المورد وإصدار سند الصرف بنجاح' : 'Payment recorded successfully');
      setQuickPayBill(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record bill payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Purchase Return
  const openReturnModal = (bill: any) => {
    setReturnBill(bill);
    const returnable = (bill.items || bill.lines || []).map((l: any) => ({
      invoiceLineId: l.id,
      itemId: l.itemId,
      item: l.item || items.find((i: any) => i.id === l.itemId),
      originalQty: Number(l.quantity),
      quantity: 0,
      unitPrice: Number(l.unitPrice),
      taxRate: Number(l.taxRate || 0),
    }));
    setReturnLines(returnable);
    setReturnNotes('');
  };

  const handleCreatePurchaseReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeReturns = returnLines.filter((l) => Number(l.quantity) > 0);
    if (activeReturns.length === 0) {
      toast.warning(isRtl ? 'يرجى تحديد كمية مرتجع لصنف واحد على الأقل' : 'Please specify return quantity');
      return;
    }

    setSubmittingReturn(true);
    try {
      await ApiService.createPurchaseReturn({
        purchaseInvoiceId: returnBill.id,
        notes: returnNotes || undefined,
        items: activeReturns.map((l) => ({
          itemId: l.itemId,
          quantity: Number(l.quantity),
        })),
      });
      toast.success(isRtl ? 'تم تسجيل مرتجع المشتريات وخصم البضاعة من المخزون بنجاح' : 'Purchase return posted successfully');
      setReturnBill(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to post purchase return');
    } finally {
      setSubmittingReturn(false);
    }
  };

  // Bills Columns
  const billColumns: Column<any>[] = [
    {
      key: 'billNumber',
      header: isRtl ? 'رقم الفاتورة' : 'Bill #',
      sortable: true,
      render: (r) => <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{r.billNumber}</span>,
    },
    {
      key: 'party',
      header: isRtl ? 'المورد' : 'Supplier',
      render: (r) => <span>{isRtl ? r.party?.nameAr || r.party?.name : r.party?.name}</span>,
    },
    {
      key: 'supplierInvoiceNumber',
      header: isRtl ? 'فاتورة المورد' : 'Supplier Ref',
      render: (r) => <span className="font-mono text-slate-500">{r.supplierInvoiceNumber || '—'}</span>,
    },
    {
      key: 'postedAt',
      header: isRtl ? 'تاريخ الاستلام' : 'Receipt Date',
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
      key: 'attachment',
      header: isRtl ? 'المرفقات' : 'Attachment',
      align: 'center',
      render: (r) => {
        const parsed = parseInvoiceNotes(r.notes);
        if (!parsed.attachment) return <span className="text-slate-300 dark:text-slate-700">—</span>;
        return (
          <button
            type="button"
            onClick={() => setViewingAttachment({ ...parsed.attachment!, billNumber: r.billNumber })}
            className="p-1 rounded text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition"
            title={parsed.attachment.name}
          >
            <Paperclip className="w-4 h-4" />
          </button>
        );
      },
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
            onClick={() => setPrintBill(r)}
            title={isRtl ? 'معاينة وطباعة الفاتورة' : 'Print Bill'}
            icon={<Printer className="w-3.5 h-3.5 text-indigo-600" />}
          />
          {r.paymentStatus !== 'PAID' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setQuickPayBill(r);
                setQuickPayForm({
                  amount: Number(r.grandTotal) - Number(r.paidAmount || 0),
                  accountId: accounts[0]?.id || '',
                  paymentMethod: 'BANK_TRANSFER',
                  referenceNumber: '',
                  notes: '',
                });
              }}
              title={isRtl ? 'سداد المورد / سند صرف' : 'Pay Bill'}
              icon={<DollarSign className="w-3.5 h-3.5 text-emerald-600" />}
            />
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => openReturnModal(r)}
            title={isRtl ? 'مرتجع مشتريات' : 'Purchase Return'}
            icon={<RotateCcw className="w-3.5 h-3.5 text-amber-500" />}
          />
        </div>
      ),
    },
  ];

  // Orders Columns
  const orderColumns: Column<any>[] = [
    {
      key: 'orderNumber',
      header: isRtl ? 'رقم الأمر' : 'PO #',
      sortable: true,
      render: (r) => <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{r.orderNumber}</span>,
    },
    {
      key: 'party',
      header: isRtl ? 'المورد' : 'Supplier',
      render: (r) => <span>{isRtl ? r.party?.nameAr || r.party?.name : r.party?.name}</span>,
    },
    {
      key: 'deliveryDate',
      header: isRtl ? 'موعد التوريد' : 'Expected Delivery',
      sortable: true,
      render: (r) => (
        <span className="font-mono text-slate-500">
          {r.deliveryDate ? new Date(r.deliveryDate).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US') : '—'}
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
          onClick={() => handleConvertOrder(r.id)}
          icon={<ArrowRightLeft className="w-3 h-3 text-indigo-600" />}
        >
          {isRtl ? 'استلام وتوريد' : 'Receive & Bill'}
        </Button>
      ),
    },
  ];

  // Returns Columns
  const returnColumns: Column<any>[] = [
    {
      key: 'returnNumber',
      header: isRtl ? 'رقم المرتجع' : 'Return #',
      sortable: true,
      render: (r) => <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{r.returnNumber}</span>,
    },
    {
      key: 'party',
      header: isRtl ? 'المورد' : 'Supplier',
      render: (r) => <span>{isRtl ? r.party?.nameAr || r.party?.name : r.party?.name}</span>,
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
              {isRtl ? 'المشتريات وفواتير الموردين' : 'Purchases & Vendor Bills'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isRtl
                ? 'إدارة أوامر الشراء، فواتير التوريد، استلام البضائع وتحديث متوسط التكلفة WAC'
                : 'Purchase orders, vendor bills, receiving inventory and moving average cost tracking'}
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800"
            onClick={() => {
              setLines([{ itemId: '', quantity: 1, unitPrice: 0, taxRate: 0 }]);
              setShowBillModal(true);
            }}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            {isRtl ? 'فاتورة شراء / توريد جديدة' : 'New Purchase Bill'}
          </Button>
        </div>

        {/* Tab Selector Ribbon */}
        <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('bills')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'bills'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{isRtl ? 'فواتير التوريد والشراء' : 'Vendor Bills'} ({purchases.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'orders'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{isRtl ? 'أوامر الشراء' : 'Purchase Orders'} ({orders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('returns')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'returns'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isRtl ? 'مرتجعات المشتريات' : 'Purchase Returns'} ({returns.length})</span>
          </button>
        </div>

        {/* Tab 1: Bills Table */}
        {activeTab === 'bills' && (
          <DataTable
            columns={billColumns}
            data={purchases}
            keyExtractor={(r) => r.id}
            loading={loading}
            searchPlaceholder={isRtl ? 'بحث برقم الفاتورة أو المورد...' : 'Search bill # or supplier...'}
            searchValue={search}
            onSearchChange={setSearch}
            emptyTitle={isRtl ? 'لا توجد فواتير شراء مسجلة' : 'No purchase bills found'}
            emptyActionLabel={isRtl ? 'إصدار أول فاتورة شراء' : 'Create First Bill'}
            onEmptyAction={() => setShowBillModal(true)}
          />
        )}

        {/* Tab 2: Orders Table */}
        {activeTab === 'orders' && (
          <DataTable
            columns={orderColumns}
            data={orders}
            keyExtractor={(r) => r.id}
            loading={loading}
            searchPlaceholder={isRtl ? 'بحث في أوامر الشراء...' : 'Search purchase orders...'}
            emptyTitle={isRtl ? 'لا توجد أوامر شراء' : 'No purchase orders found'}
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
            emptyTitle={isRtl ? 'لا توجد مرتجعات مشتريات' : 'No purchase returns'}
          />
        )}
      </div>

      {/* Create Purchase Bill Modal */}
      <Modal
        isOpen={showBillModal}
        onClose={() => setShowBillModal(false)}
        title={isRtl ? 'إصدار فاتورة مشتريات وتوريد بضاعة' : 'Create Purchase Bill'}
        maxWidth="4xl"
      >
        <form onSubmit={handleCreateBill} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label={isRtl ? 'المورد' : 'Supplier'}
              required
              value={selectedPartyId}
              onChange={(e) => setSelectedPartyId(e.target.value)}
            >
              <option value="">{isRtl ? 'اختر المورد...' : 'Select supplier...'}</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {isRtl ? p.nameAr || p.name : p.name}
                </option>
              ))}
            </Select>

            <Select
              label={isRtl ? 'مستودع الاستلام' : 'Receiving Warehouse'}
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

            <Input
              label={isRtl ? 'رقم فاتورة المورد الأصلية' : 'Supplier Invoice Ref #'}
              value={supplierInvoiceNumber}
              onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
              placeholder="INV-99482"
            />
          </div>

          {/* Line items */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {isRtl ? 'الأصناف الموردة' : 'Items to Receive'} ({lines.length})
              </span>
              <Button size="sm" variant="outline" onClick={addLine} icon={<Plus className="w-3 h-3" />}>
                {isRtl ? 'إضافة صنف' : 'Add Line'}
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
                      placeholder={isRtl ? 'سعر الشراء' : 'Cost Price'}
                    />
                  </div>

                  <div className="col-span-3 sm:col-span-2">
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

            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-6 text-xs">
              <div>
                <span className="text-slate-400">{isRtl ? 'المجموع قبل الضريبة' : 'Subtotal'}: </span>
                <strong className="font-mono tabular-nums">{formatMoney(totals.subtotal)}</strong>
              </div>
              <div>
                <span className="text-slate-400">{isRtl ? 'الضريبة' : 'Tax'}: </span>
                <strong className="font-mono tabular-nums">{formatMoney(totals.taxTotal)}</strong>
              </div>
              <div className="text-indigo-600 dark:text-indigo-400 font-extrabold text-sm">
                <span>{isRtl ? 'الإجمالي' : 'Total'}: </span>
                <strong className="font-mono tabular-nums">{formatMoney(totals.grandTotal)}</strong>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={isRtl ? 'ملاحظات الفاتورة' : 'Bill Notes'}
              value={billNotes}
              onChange={(e) => setBillNotes(e.target.value)}
              placeholder={isRtl ? 'تم الاستلام مطابقة لأمر التوريد' : 'Receipt notes'}
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isRtl ? 'إرفاق صورة الفاتورة الورقية' : 'Attach Bill Document / Image'}
              </label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileUpload}
                className="block w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-950/60 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" onClick={() => setShowBillModal(false)}>
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="primary" type="submit" loading={submittingBill} className="bg-indigo-600 hover:bg-indigo-700">
              {isRtl ? 'اعتماد الفاتورة وإضافة المخزون' : 'Post Bill & Receive Stock'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Quick Bill Payment Modal */}
      {quickPayBill && (
        <Modal
          isOpen={!!quickPayBill}
          onClose={() => setQuickPayBill(null)}
          title={isRtl ? `سداد فاتورة المورد #${quickPayBill.billNumber}` : `Pay Vendor Bill #${quickPayBill.billNumber}`}
          maxWidth="md"
        >
          <form onSubmit={handleQuickPayment} className="space-y-3.5">
            <Input
              label={isRtl ? 'المبلغ المراد سداده' : 'Payment Amount'}
              type="number"
              step="0.01"
              required
              value={quickPayForm.amount}
              onChange={(e) => setQuickPayForm({ ...quickPayForm, amount: Number(e.target.value) })}
            />

            <Select
              label={isRtl ? 'الخزينة أو الحساب البنكي' : 'Paid From Account'}
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
              label={isRtl ? 'طريقة السداد' : 'Payment Method'}
              value={quickPayForm.paymentMethod}
              onChange={(e) => setQuickPayForm({ ...quickPayForm, paymentMethod: e.target.value })}
            >
              <option value="BANK_TRANSFER">{isRtl ? 'تحويل بنكي' : 'Bank Transfer'}</option>
              <option value="CASH">{isRtl ? 'نقداً (Cash)' : 'Cash'}</option>
              <option value="CHECK">{isRtl ? 'شيك مصرفي' : 'Check'}</option>
            </Select>

            <Input
              label={isRtl ? 'الرقم المرجعي للتحويل' : 'Transfer Reference #'}
              value={quickPayForm.referenceNumber}
              onChange={(e) => setQuickPayForm({ ...quickPayForm, referenceNumber: e.target.value })}
            />

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button variant="outline" onClick={() => setQuickPayBill(null)}>
                {isRtl ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button variant="primary" type="submit" loading={submittingPayment} className="bg-emerald-600 hover:bg-emerald-700">
                {isRtl ? 'تأكيد السداد وسند الصرف' : 'Confirm Payment'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Attachment Viewer */}
      {viewingAttachment && (
        <Modal
          isOpen={!!viewingAttachment}
          onClose={() => setViewingAttachment(null)}
          title={isRtl ? `مرفق الفاتورة #${viewingAttachment.billNumber}` : `Attachment - #${viewingAttachment.billNumber}`}
          maxWidth="3xl"
        >
          <div className="p-2 flex flex-col items-center">
            {viewingAttachment.type?.includes('pdf') ? (
              <iframe src={viewingAttachment.dataUrl} className="w-full h-96 rounded-lg" title="Attachment PDF" />
            ) : (
              <img
                src={viewingAttachment.dataUrl}
                alt={viewingAttachment.name}
                className="max-h-[70vh] rounded-lg object-contain shadow-xs"
              />
            )}
            <span className="text-xs text-slate-400 mt-2 font-mono">{viewingAttachment.name}</span>
          </div>
        </Modal>
      )}

      {/* Printable Purchase Bill Modal */}
      {printBill && (
        <PrintableInvoiceModal
          isOpen={!!printBill}
          onClose={() => setPrintBill(null)}
          invoice={printBill}
          companyInfo={companyProfile}
          type="purchase"
        />
      )}
    </DashboardLayout>
  );
}
