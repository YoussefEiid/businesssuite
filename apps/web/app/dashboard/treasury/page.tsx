'use client';

import React, { useState, useEffect } from 'react';
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
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Ban,
  Landmark,
  Coins,
  RefreshCw,
  Building2,
  FileText,
} from 'lucide-react';

export default function TreasuryPage() {
  const { isRtl } = useLanguage();
  const { formatMoney } = useCompany();
  const toast = useToast();
  const { confirm } = useConfirm();

  const [accounts, setAccounts] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'ALL' | 'RECEIPT' | 'PAYMENT' | 'CANCELLED'>('ALL');
  const [selectedAccountFilter, setSelectedAccountFilter] = useState('');

  // Modals
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [submittingVoucher, setSubmittingVoucher] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [submittingTransfer, setSubmittingTransfer] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [submittingAccount, setSubmittingAccount] = useState(false);
  const [voidingVoucher, setVoidingVoucher] = useState<any | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidSubmitting, setVoidSubmitting] = useState(false);

  // New Voucher Form
  const [voucherData, setVoucherData] = useState({
    type: 'RECEIPT',
    accountId: '',
    partyId: '',
    amount: 0,
    paymentMethod: 'CASH',
    referenceNumber: '',
    notes: '',
  });

  // Transfer Form
  const [transferData, setTransferData] = useState({
    sourceAccountId: '',
    destinationAccountId: '',
    amount: 0,
    referenceNumber: '',
    notes: '',
  });

  // New Account Form
  const [newAccount, setNewAccount] = useState({
    type: 'CASH',
    code: '',
    nameAr: '',
    name: '',
    accountNumber: '',
    bankName: '',
    openingBalance: 0,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [accs, vchs, pts] = await Promise.all([
        ApiService.listAccounts(),
        ApiService.listVouchers(),
        ApiService.listParties(),
      ]);
      setAccounts(accs || []);
      setVouchers(vchs || []);
      setParties(pts || []);

      if (accs && accs.length > 0) {
        setVoucherData((prev) => ({ ...prev, accountId: prev.accountId || accs[0].id }));
        setTransferData((prev) => ({
          ...prev,
          sourceAccountId: prev.sourceAccountId || accs[0].id,
          destinationAccountId: prev.destinationAccountId || accs[1]?.id || accs[0].id,
        }));
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load treasury data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter vouchers
  const filteredVouchers = vouchers.filter((v) => {
    if (selectedTypeFilter === 'RECEIPT' && (v.type !== 'RECEIPT' || v.status === 'CANCELLED')) return false;
    if (selectedTypeFilter === 'PAYMENT' && (v.type !== 'PAYMENT' || v.status === 'CANCELLED')) return false;
    if (selectedTypeFilter === 'CANCELLED' && v.status !== 'CANCELLED') return false;
    if (selectedAccountFilter && v.accountId !== selectedAccountFilter) return false;

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      const matchNum = v.voucherNumber?.toLowerCase().includes(q);
      const matchParty = (v.party?.nameAr || v.party?.name || '').toLowerCase().includes(q);
      const matchAccount = (v.account?.nameAr || v.account?.name || '').toLowerCase().includes(q);
      const matchRef = (v.referenceNumber || '').toLowerCase().includes(q);
      const matchNotes = (v.notes || '').toLowerCase().includes(q);
      if (!matchNum && !matchParty && !matchAccount && !matchRef && !matchNotes) return false;
    }
    return true;
  });

  // Create Voucher (Receipt or Payment)
  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (voucherData.amount <= 0) {
      toast.warning(isRtl ? 'يرجى إدخال مبلغ صحيح أكبر من الصفر' : 'Please enter valid amount');
      return;
    }

    setSubmittingVoucher(true);
    try {
      await ApiService.createVoucher({
        ...voucherData,
        amount: Number(voucherData.amount),
        partyId: voucherData.partyId || undefined,
      });
      toast.success(
        isRtl
          ? `تم حفظ ${voucherData.type === 'RECEIPT' ? 'سند القبض' : 'سند الصرف'} بنجاح`
          : 'Voucher created successfully',
      );
      setShowVoucherModal(false);
      setVoucherData({
        type: 'RECEIPT',
        accountId: accounts[0]?.id || '',
        partyId: '',
        amount: 0,
        paymentMethod: 'CASH',
        referenceNumber: '',
        notes: '',
      });
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create voucher');
    } finally {
      setSubmittingVoucher(false);
    }
  };

  // Fund Transfer
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferData.sourceAccountId === transferData.destinationAccountId) {
      toast.warning(isRtl ? 'لا يمكن التحويل لنفس الحساب' : 'Source and destination cannot be identical');
      return;
    }
    if (transferData.amount <= 0) {
      toast.warning(isRtl ? 'يرجى إدخال مبلغ تحويل صحيح' : 'Please enter valid transfer amount');
      return;
    }

    setSubmittingTransfer(true);
    try {
      await ApiService.transferTreasuryFunds({
        ...transferData,
        amount: Number(transferData.amount),
      });
      toast.success(isRtl ? 'تم تحويل الأموال وتحديث الأرصدة بنجاح' : 'Funds transferred successfully');
      setShowTransferModal(false);
      setTransferData({
        sourceAccountId: accounts[0]?.id || '',
        destinationAccountId: accounts[1]?.id || accounts[0]?.id || '',
        amount: 0,
        referenceNumber: '',
        notes: '',
      });
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to transfer funds');
    } finally {
      setSubmittingTransfer(false);
    }
  };

  // Create Account
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.nameAr.trim()) {
      toast.warning(isRtl ? 'يرجى إدخال اسم الحساب' : 'Please enter account name');
      return;
    }

    setSubmittingAccount(true);
    try {
      await ApiService.createAccount({
        ...newAccount,
        name: newAccount.name?.trim() || newAccount.nameAr.trim(),
        openingBalance: Number(newAccount.openingBalance) || 0,
      });
      toast.success(isRtl ? 'تمت إضافة الحساب / الخزينة بنجاح' : 'Account created successfully');
      setShowAccountModal(false);
      setNewAccount({
        type: 'CASH',
        code: '',
        nameAr: '',
        name: '',
        accountNumber: '',
        bankName: '',
        openingBalance: 0,
      });
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create account');
    } finally {
      setSubmittingAccount(false);
    }
  };

  // Void Voucher
  const handleVoidVoucher = async () => {
    if (!voidingVoucher) return;
    setVoidSubmitting(true);
    try {
      await ApiService.voidVoucher(voidingVoucher.id, { reason: voidReason });
      toast.success(isRtl ? 'تم إلغاء السند وعكس الحركة المالية بنجاح' : 'Voucher voided successfully');
      setVoidingVoucher(null);
      setVoidReason('');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to void voucher');
    } finally {
      setVoidSubmitting(false);
    }
  };

  // Total balance
  const totalBalance = accounts.reduce((acc, a) => acc + Number(a.currentBalance || 0), 0);

  // Table columns
  const columns: Column<any>[] = [
    {
      key: 'voucherNumber',
      header: isRtl ? 'رقم السند' : 'Voucher #',
      sortable: true,
      render: (v) => <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{v.voucherNumber}</span>,
    },
    {
      key: 'type',
      header: isRtl ? 'النوع' : 'Type',
      render: (v) => (
        <Badge variant={v.type === 'RECEIPT' ? 'success' : 'warning'} size="sm">
          {v.type === 'RECEIPT' ? (isRtl ? 'قبض' : 'Receipt') : isRtl ? 'صرف' : 'Payment'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: isRtl ? 'التاريخ' : 'Date',
      sortable: true,
      render: (v) => (
        <span className="font-mono text-slate-500">
          {new Date(v.createdAt).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US')}
        </span>
      ),
    },
    {
      key: 'account',
      header: isRtl ? 'الخزينة / الحساب' : 'Account',
      render: (v) => <span>{isRtl ? v.account?.nameAr || v.account?.name : v.account?.name}</span>,
    },
    {
      key: 'party',
      header: isRtl ? 'الطرف / المستفيد' : 'Party / Payee',
      render: (v) => <span>{v.party ? (isRtl ? v.party.nameAr || v.party.name : v.party.name) : (isRtl ? 'طرف عام' : 'General')}</span>,
    },
    {
      key: 'amount',
      header: isRtl ? 'المبلغ' : 'Amount',
      align: 'end',
      sortable: true,
      render: (v) => (
        <span
          className={`font-mono font-bold tabular-nums text-sm ${
            v.type === 'RECEIPT' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}
        >
          {v.type === 'RECEIPT' ? '+' : '-'}{formatMoney(v.amount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: isRtl ? 'الحالة' : 'Status',
      render: (v) => (
        <Badge variant={v.status === 'POSTED' ? 'success' : 'danger'} size="sm">
          {v.status === 'POSTED' ? (isRtl ? 'معتمد' : 'Posted') : isRtl ? 'ملغي' : 'Voided'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: isRtl ? 'الإجراءات' : 'Actions',
      align: 'end',
      render: (v) =>
        v.status === 'POSTED' ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setVoidingVoucher(v)}
            title={isRtl ? 'إلغاء السند وعكس القيد' : 'Void Voucher'}
            icon={<Ban className="w-3.5 h-3.5 text-rose-500" />}
          />
        ) : null,
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {isRtl ? 'الخزائن والمدفوعات' : 'Treasury & Payments'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isRtl
                ? 'إدارة الحسابات النقدية والبنكية، سندات القبض والصرف، والتحويلات الداخلية'
                : 'Manage cash boxes, bank accounts, receipt/payment vouchers and fund transfers'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAccountModal(true)}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              {isRtl ? 'خزينة / حساب بنكي' : 'New Account'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowTransferModal(true)}
              icon={<ArrowLeftRight className="w-3.5 h-3.5" />}
            >
              {isRtl ? 'تحويل أموال' : 'Transfer Funds'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setVoucherData({ ...voucherData, type: 'RECEIPT' });
                setShowVoucherModal(true);
              }}
              icon={<ArrowDownLeft className="w-3.5 h-3.5" />}
            >
              {isRtl ? 'سند قبض' : 'Receipt Voucher'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 active:bg-amber-800"
              onClick={() => {
                setVoucherData({ ...voucherData, type: 'PAYMENT' });
                setShowVoucherModal(true);
              }}
              icon={<ArrowUpRight className="w-3.5 h-3.5" />}
            >
              {isRtl ? 'سند صرف' : 'Payment Voucher'}
            </Button>
          </div>
        </div>

        {/* Treasury Accounts Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {accounts.map((acc) => {
            const isCash = acc.type === 'CASH';
            return (
              <div
                key={acc.id}
                className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between"
              >
                <div className="min-w-0 pr-2">
                  <span className="text-2xs font-semibold text-slate-400 block uppercase">
                    {isCash ? (isRtl ? 'خزينة نقدية' : 'Cash Box') : isRtl ? 'حساب بنكي' : 'Bank Account'}
                  </span>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate mt-0.5">
                    {isRtl ? acc.nameAr || acc.name : acc.name}
                  </h4>
                  <p className="text-base font-extrabold text-slate-900 dark:text-slate-100 font-mono tabular-nums mt-1">
                    {formatMoney(acc.currentBalance || 0)}
                  </p>
                </div>
                <div
                  className={`p-2.5 rounded-xl ${
                    isCash ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600' : 'bg-sky-50 dark:bg-sky-950/60 text-sky-600'
                  }`}
                >
                  {isCash ? <Coins className="w-5 h-5" /> : <Landmark className="w-5 h-5" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Vouchers Data Table */}
        <DataTable
          columns={columns}
          data={filteredVouchers}
          keyExtractor={(row) => row.id}
          loading={loading}
          searchPlaceholder={isRtl ? 'بحث برقم السند، الطرف، أو الملاحظات...' : 'Search by voucher #, party, notes...'}
          searchValue={search}
          onSearchChange={setSearch}
          filterElement={
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setSelectedTypeFilter('ALL')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                    selectedTypeFilter === 'ALL'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {isRtl ? 'الكل' : 'All'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTypeFilter('RECEIPT')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                    selectedTypeFilter === 'RECEIPT'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {isRtl ? 'سندات القبض' : 'Receipts'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTypeFilter('PAYMENT')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                    selectedTypeFilter === 'PAYMENT'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {isRtl ? 'سندات الصرف' : 'Payments'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTypeFilter('CANCELLED')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                    selectedTypeFilter === 'CANCELLED'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {isRtl ? 'الملغاة' : 'Voided'}
                </button>
              </div>

              {accounts.length > 0 && (
                <div className="w-36">
                  <Select
                    value={selectedAccountFilter}
                    onChange={(e) => setSelectedAccountFilter(e.target.value)}
                    className="h-8 text-xs"
                  >
                    <option value="">{isRtl ? 'كل الحسابات' : 'All Accounts'}</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {isRtl ? a.nameAr || a.name : a.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          }
          emptyTitle={isRtl ? 'لا توجد سندات مالية مسجلة' : 'No vouchers recorded'}
          emptyDescription={isRtl ? 'قم بإصدار سند قبض أو سند صرف لتسجيل التدفقات المالية.' : 'Create receipt or payment vouchers.'}
          emptyActionLabel={isRtl ? 'إصدار سند قبض' : 'Create Receipt Voucher'}
          onEmptyAction={() => {
            setVoucherData({ ...voucherData, type: 'RECEIPT' });
            setShowVoucherModal(true);
          }}
        />
      </div>

      {/* Create Voucher Modal */}
      <Modal
        isOpen={showVoucherModal}
        onClose={() => setShowVoucherModal(false)}
        title={
          voucherData.type === 'RECEIPT'
            ? isRtl
              ? 'إصدار سند قبض نقدية / بنك'
              : 'Create Receipt Voucher'
            : isRtl
            ? 'إصدار سند صرف نقدية / بنك'
            : 'Create Payment Voucher'
        }
        maxWidth="xl"
      >
        <form onSubmit={handleCreateVoucher} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label={isRtl ? 'نوع السند' : 'Voucher Type'}
              required
              value={voucherData.type}
              onChange={(e) => setVoucherData({ ...voucherData, type: e.target.value })}
            >
              <option value="RECEIPT">{isRtl ? 'سند قبض (Receipt)' : 'Receipt Voucher'}</option>
              <option value="PAYMENT">{isRtl ? 'سند صرف (Payment)' : 'Payment Voucher'}</option>
            </Select>

            <Select
              label={isRtl ? 'الحساب / الخزينة' : 'Account / Cash Box'}
              required
              value={voucherData.accountId}
              onChange={(e) => setVoucherData({ ...voucherData, accountId: e.target.value })}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {isRtl ? a.nameAr || a.name : a.name} ({formatMoney(a.currentBalance)})
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label={isRtl ? 'الطرف المرتبط (اختياري)' : 'Party / Payee (Optional)'}
              value={voucherData.partyId}
              onChange={(e) => setVoucherData({ ...voucherData, partyId: e.target.value })}
            >
              <option value="">{isRtl ? 'طرف عام / متنوع' : 'General / Unspecified'}</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {isRtl ? p.nameAr || p.name : p.name} ({p.type})
                </option>
              ))}
            </Select>

            <Input
              label={isRtl ? 'المبلغ' : 'Amount'}
              type="number"
              step="0.01"
              required
              value={voucherData.amount}
              onChange={(e) => setVoucherData({ ...voucherData, amount: Number(e.target.value) })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label={isRtl ? 'طريقة الدفع' : 'Payment Method'}
              value={voucherData.paymentMethod}
              onChange={(e) => setVoucherData({ ...voucherData, paymentMethod: e.target.value })}
            >
              <option value="CASH">{isRtl ? 'نقداً (Cash)' : 'Cash'}</option>
              <option value="BANK_TRANSFER">{isRtl ? 'تحويل بنكي' : 'Bank Transfer'}</option>
              <option value="CHECK">{isRtl ? 'شيك' : 'Check'}</option>
              <option value="CARD">{isRtl ? 'بطاقة مدى / شبكة' : 'Card'}</option>
            </Select>

            <Input
              label={isRtl ? 'الرقم المرجعي / رقم الشيك' : 'Reference / Check #'}
              value={voucherData.referenceNumber}
              onChange={(e) => setVoucherData({ ...voucherData, referenceNumber: e.target.value })}
              placeholder="REF-10029"
            />
          </div>

          <Input
            label={isRtl ? 'ملاحظات وتفاصيل السند' : 'Notes & Memo'}
            value={voucherData.notes}
            onChange={(e) => setVoucherData({ ...voucherData, notes: e.target.value })}
            placeholder={isRtl ? 'سداد دفعة نقدية تحت الحساب' : 'Payment note'}
          />

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" onClick={() => setShowVoucherModal(false)}>
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="primary" type="submit" loading={submittingVoucher}>
              {isRtl ? 'اعتماد وحفظ السند' : 'Post Voucher'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Transfer Funds Modal */}
      <Modal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        title={isRtl ? 'تحويل أموال بين الحسابات' : 'Internal Fund Transfer'}
        maxWidth="lg"
      >
        <form onSubmit={handleTransfer} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label={isRtl ? 'من حساب (المصدر)' : 'From Account (Source)'}
              required
              value={transferData.sourceAccountId}
              onChange={(e) => setTransferData({ ...transferData, sourceAccountId: e.target.value })}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {isRtl ? a.nameAr || a.name : a.name} ({Number(a.currentBalance).toLocaleString()})
                </option>
              ))}
            </Select>

            <Select
              label={isRtl ? 'إلى حساب (الوجهة)' : 'To Account (Destination)'}
              required
              value={transferData.destinationAccountId}
              onChange={(e) => setTransferData({ ...transferData, destinationAccountId: e.target.value })}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {isRtl ? a.nameAr || a.name : a.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={isRtl ? 'مبلغ التحويل' : 'Transfer Amount'}
              type="number"
              step="0.01"
              required
              value={transferData.amount}
              onChange={(e) => setTransferData({ ...transferData, amount: Number(e.target.value) })}
            />

            <Input
              label={isRtl ? 'الرقم المرجعي' : 'Reference #'}
              value={transferData.referenceNumber}
              onChange={(e) => setTransferData({ ...transferData, referenceNumber: e.target.value })}
              placeholder="TRF-001"
            />
          </div>

          <Input
            label={isRtl ? 'البيان / ملاحظات' : 'Memo'}
            value={transferData.notes}
            onChange={(e) => setTransferData({ ...transferData, notes: e.target.value })}
            placeholder={isRtl ? 'تغذية الخزينة النقدية من البنك' : 'Transfer memo'}
          />

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" onClick={() => setShowTransferModal(false)}>
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="primary" type="submit" loading={submittingTransfer}>
              {isRtl ? 'تنفيذ التحويل' : 'Execute Transfer'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Account Modal */}
      <Modal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        title={isRtl ? 'إضافة خزينة أو حساب بنكي جديد' : 'Create Treasury Account'}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateAccount} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label={isRtl ? 'نوع الحساب' : 'Account Type'}
              required
              value={newAccount.type}
              onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value })}
            >
              <option value="CASH">{isRtl ? 'خزينة نقدية (Cash Box)' : 'Cash Box'}</option>
              <option value="BANK">{isRtl ? 'حساب بنكي (Bank Account)' : 'Bank Account'}</option>
            </Select>

            <Input
              label={isRtl ? 'الكود المرجعي' : 'Account Code'}
              value={newAccount.code}
              onChange={(e) => setNewAccount({ ...newAccount, code: e.target.value })}
              placeholder={newAccount.type === 'CASH' ? 'CASH-01' : 'BNK-01'}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={isRtl ? 'الاسم بالعربية' : 'Arabic Name'}
              required
              value={newAccount.nameAr}
              onChange={(e) => setNewAccount({ ...newAccount, nameAr: e.target.value })}
              placeholder={isRtl ? 'خزينة الفرع الرئيسي' : 'Main Cash Box'}
            />

            <Input
              label={isRtl ? 'الاسم بالإنجليزية' : 'English Name'}
              value={newAccount.name}
              onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
              placeholder="Main Branch Cash"
            />
          </div>

          {newAccount.type === 'BANK' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label={isRtl ? 'اسم البنك' : 'Bank Name'}
                value={newAccount.bankName}
                onChange={(e) => setNewAccount({ ...newAccount, bankName: e.target.value })}
                placeholder={isRtl ? 'مصرف الراجحي' : 'Al Rajhi Bank'}
              />

              <Input
                label={isRtl ? 'رقم الحساب / الآيبان (IBAN)' : 'IBAN / Account Number'}
                value={newAccount.accountNumber}
                onChange={(e) => setNewAccount({ ...newAccount, accountNumber: e.target.value })}
                placeholder="SA0000000000000000000000"
              />
            </div>
          )}

          <Input
            label={isRtl ? 'الرصيد الافتتاحي' : 'Opening Balance'}
            type="number"
            step="0.01"
            value={newAccount.openingBalance}
            onChange={(e) => setNewAccount({ ...newAccount, openingBalance: Number(e.target.value) })}
          />

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" onClick={() => setShowAccountModal(false)}>
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="primary" type="submit" loading={submittingAccount}>
              {isRtl ? 'إنشاء الحساب' : 'Create Account'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Void Confirmation Modal */}
      {voidingVoucher && (
        <Modal
          isOpen={!!voidingVoucher}
          onClose={() => setVoidingVoucher(null)}
          title={isRtl ? 'تأكيد إلغاء السند وعكس الحركة المالية' : 'Void Voucher'}
          maxWidth="md"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {isRtl
                ? `أنت على وشك إلغاء السند #${voidingVoucher.voucherNumber} بمبلغ ${formatMoney(voidingVoucher.amount)}. سيتم عكس رصيد الخزينة فوراً.`
                : `You are voiding voucher #${voidingVoucher.voucherNumber} for ${formatMoney(voidingVoucher.amount)}. Account balance will be reversed immediately.`}
            </p>

            <Input
              label={isRtl ? 'سبب الإلغاء' : 'Void Reason'}
              required
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder={isRtl ? 'خطأ في إدخال المبلغ / شيك مرتجع' : 'Data entry error / returned check'}
            />

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button variant="outline" onClick={() => setVoidingVoucher(null)}>
                {isRtl ? 'تراجع' : 'Cancel'}
              </Button>
              <Button
                variant="danger"
                loading={voidSubmitting}
                onClick={handleVoidVoucher}
                disabled={!voidReason.trim()}
              >
                {isRtl ? 'تأكيد الإلغاء وعكس القيد' : 'Confirm Void'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
}
