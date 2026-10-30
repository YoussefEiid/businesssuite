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
  FileText,
  Phone,
  Mail,
  Printer,
  Pencil,
  Trash2,
  Users,
  Building2,
  DollarSign,
  Calendar,
} from 'lucide-react';

export default function PartiesPage() {
  const { isRtl } = useLanguage();
  const { formatMoney } = useCompany();
  const toast = useToast();
  const { confirm } = useConfirm();

  const [parties, setParties] = useState<any[]>([]);
  const [partyType, setPartyType] = useState<'ALL' | 'CUSTOMER' | 'SUPPLIER'>('ALL');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const [loading, setLoading] = useState(true);

  // Create Party Modal
  const [showModal, setShowModal] = useState(false);
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [formData, setFormData] = useState({
    type: 'CUSTOMER',
    code: '',
    nameAr: '',
    name: '',
    phone: '',
    email: '',
    taxNumber: '',
    creditLimit: 0,
    openingReceivable: 0,
    openingPayable: 0,
    address: '',
  });

  // Edit Party Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingParty, setEditingParty] = useState<any | null>(null);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Statement Modal
  const [statementData, setStatementData] = useState<any | null>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await ApiService.listParties(
        partyType === 'ALL' ? undefined : partyType,
        debouncedSearch || undefined,
      );
      setParties(data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load parties list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [partyType, debouncedSearch]);

  const handleCreateParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nameAr.trim()) {
      toast.warning(isRtl ? 'يرجى إدخال اسم الطرف' : 'Please enter party name');
      return;
    }

    setSubmittingCreate(true);
    try {
      const generatedCode =
        formData.code.trim() ||
        `${formData.type === 'CUSTOMER' ? 'C' : 'S'}-${Date.now().toString().slice(-4)}`;

      const payload: any = {
        type: formData.type,
        code: generatedCode,
        nameAr: formData.nameAr.trim(),
        name: formData.name?.trim() || formData.nameAr.trim(),
        creditLimit: Number(formData.creditLimit) || 0,
        openingReceivable: Number(formData.openingReceivable) || 0,
        openingPayable: Number(formData.openingPayable) || 0,
      };

      if (formData.phone?.trim()) payload.phone = formData.phone.trim();
      if (formData.email?.trim()) payload.email = formData.email.trim();
      if (formData.taxNumber?.trim()) payload.taxNumber = formData.taxNumber.trim();
      if (formData.address?.trim()) payload.address = formData.address.trim();

      await ApiService.createParty(payload);
      toast.success(
        isRtl ? 'تمت إضافة الطرف بنجاح' : 'Party created successfully',
      );
      setShowModal(false);
      setFormData({
        type: 'CUSTOMER',
        code: '',
        nameAr: '',
        name: '',
        phone: '',
        email: '',
        taxNumber: '',
        creditLimit: 0,
        openingReceivable: 0,
        openingPayable: 0,
        address: '',
      });
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create party');
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleOpenEdit = (p: any) => {
    setEditingParty({
      id: p.id,
      type: p.type,
      code: p.code,
      nameAr: p.nameAr || p.name,
      name: p.name || p.nameAr,
      phone: p.phone || '',
      email: p.email || '',
      taxNumber: p.taxNumber || '',
      creditLimit: p.creditLimit || 0,
      address: p.address || '',
      notes: p.notes || '',
      isActive: p.isActive ?? true,
    });
    setShowEditModal(true);
  };

  const handleUpdateParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParty) return;

    setSubmittingEdit(true);
    try {
      const payload: any = {
        type: editingParty.type,
        nameAr: editingParty.nameAr?.trim(),
        name: editingParty.name?.trim() || editingParty.nameAr?.trim(),
        creditLimit: Number(editingParty.creditLimit) || 0,
        phone: editingParty.phone?.trim() || undefined,
        email: editingParty.email?.trim() || undefined,
        taxNumber: editingParty.taxNumber?.trim() || undefined,
        address: editingParty.address?.trim() || undefined,
        notes: editingParty.notes?.trim() || undefined,
        isActive: editingParty.isActive,
      };

      await ApiService.updateParty(editingParty.id, payload);
      toast.success(isRtl ? 'تم تحديث بيانات الطرف بنجاح' : 'Party updated successfully');
      setShowEditModal(false);
      setEditingParty(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update party');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDeleteParty = async (p: any) => {
    const isCustomer = p.type === 'CUSTOMER';
    const ok = await confirm({
      title: isRtl ? 'تأكيد حذف الحساب' : 'Confirm Account Deletion',
      message: isRtl
        ? `هل أنت متأكد من حذف ${isCustomer ? 'العميل' : 'المورد'} "${p.nameAr || p.name}"؟ في حال وجود فواتير مرتبطة به، سيتم أرشفته لحماية القيود.`
        : `Are you sure you want to delete ${isCustomer ? 'customer' : 'supplier'} "${p.name}"? If past transactions exist, it will be archived safely.`,
      isDestructive: true,
      confirmLabel: isRtl ? 'حذف' : 'Delete',
    });

    if (!ok) return;

    try {
      const res = await ApiService.deleteParty(p.id);
      if (res.archived) {
        toast.info(
          isRtl
            ? 'تم أرشفة الحساب لوجود حركات مالية مرتبطة به'
            : 'Account archived to preserve historical records',
        );
      } else {
        toast.success(isRtl ? 'تم حذف الحساب بنجاح' : 'Account deleted successfully');
      }
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete account');
    }
  };

  const openStatement = async (partyId: string) => {
    setLoadingStatement(true);
    try {
      const data = await ApiService.getPartyStatement(partyId);
      setStatementData(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load statement');
    } finally {
      setLoadingStatement(false);
    }
  };

  // Define columns for DataTable
  const columns: Column<any>[] = [
    {
      key: 'code',
      header: isRtl ? 'الكود' : 'Code',
      sortable: true,
      render: (row) => <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{row.code}</span>,
    },
    {
      key: 'name',
      header: isRtl ? 'الاسم' : 'Name',
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-bold text-slate-800 dark:text-slate-100">{isRtl ? row.nameAr || row.name : row.name || row.nameAr}</p>
          {row.phone && (
            <p className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
              <Phone className="w-3 h-3" />
              <span>{row.phone}</span>
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      header: isRtl ? 'النوع' : 'Type',
      render: (row) => (
        <Badge variant={row.type === 'CUSTOMER' ? 'default' : 'warning'} size="sm">
          {row.type === 'CUSTOMER' ? (isRtl ? 'عميل' : 'Customer') : isRtl ? 'مورد' : 'Supplier'}
        </Badge>
      ),
    },
    {
      key: 'taxNumber',
      header: isRtl ? 'الرقم الضريبي' : 'Tax ID',
      render: (row) => <span className="font-mono text-slate-500">{row.taxNumber || '—'}</span>,
    },
    {
      key: 'creditLimit',
      header: isRtl ? 'الحد الائتماني' : 'Credit Limit',
      align: 'end',
      sortable: true,
      render: (row) => (
        <span className="font-mono tabular-nums">
          {formatMoney(row.creditLimit || 0)}
        </span>
      ),
    },
    {
      key: 'currentReceivable',
      header: isRtl ? 'الرصيد المدين' : 'Receivable',
      align: 'end',
      sortable: true,
      render: (row) => (
        <span
          className={`font-mono font-bold tabular-nums ${
            Number(row.currentReceivable) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'
          }`}
        >
          {formatMoney(row.currentReceivable || 0)}
        </span>
      ),
    },
    {
      key: 'currentPayable',
      header: isRtl ? 'الرصيد الدائن' : 'Payable',
      align: 'end',
      sortable: true,
      render: (row) => (
        <span
          className={`font-mono font-bold tabular-nums ${
            Number(row.currentPayable) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'
          }`}
        >
          {formatMoney(row.currentPayable || 0)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: isRtl ? 'الإجراءات' : 'Actions',
      align: 'end',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => openStatement(row.id)}
            title={isRtl ? 'عرض كشف الحساب' : 'View Statement'}
            icon={<FileText className="w-3.5 h-3.5 text-sky-600" />}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleOpenEdit(row)}
            title={isRtl ? 'تعديل' : 'Edit'}
            icon={<Pencil className="w-3.5 h-3.5 text-slate-500" />}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDeleteParty(row)}
            title={isRtl ? 'حذف' : 'Delete'}
            icon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
          />
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {isRtl ? 'العملاء والموردون' : 'Customers & Suppliers'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isRtl
                ? 'إدارة الحسابات التجارية، الأرصدة الافتتاحية، الحدود الائتمانية، وكشوفات الحساب'
                : 'Manage customer accounts, supplier debts, credit limits and financial statements'}
            </p>
          </div>

          <Button
            variant="primary"
            onClick={() => setShowModal(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            {isRtl ? 'إضافة عميل أو مورد جديد' : 'Add Party / Contact'}
          </Button>
        </div>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={parties}
          keyExtractor={(row) => row.id}
          loading={loading}
          searchPlaceholder={isRtl ? 'بحث بالاسم، الكود، الهاتف، أو الرقم الضريبي...' : 'Search by name, code, phone, tax ID...'}
          searchValue={search}
          onSearchChange={setSearch}
          filterElement={
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setPartyType('ALL')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                  partyType === 'ALL'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {isRtl ? 'الكل' : 'All'}
              </button>
              <button
                type="button"
                onClick={() => setPartyType('CUSTOMER')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                  partyType === 'CUSTOMER'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {isRtl ? 'العملاء' : 'Customers'}
              </button>
              <button
                type="button"
                onClick={() => setPartyType('SUPPLIER')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                  partyType === 'SUPPLIER'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {isRtl ? 'الموردون' : 'Suppliers'}
              </button>
            </div>
          }
          emptyTitle={isRtl ? 'لا يوجد عملاء أو موردون مسجلون' : 'No parties registered'}
          emptyDescription={isRtl ? 'ابدأ بإضافة أول حساب عميل أو مورد لربط الفواتير والمدفوعات به.' : 'Start adding customer or supplier accounts.'}
          emptyActionLabel={isRtl ? 'إضافة طرف جديد' : 'Add New Party'}
          onEmptyAction={() => setShowModal(true)}
        />
      </div>

      {/* Create Party Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={isRtl ? 'إضافة عميل أو مورد جديد' : 'Create New Customer / Supplier'}
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateParty} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label={isRtl ? 'نوع الطرف' : 'Party Type'}
              required
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            >
              <option value="CUSTOMER">{isRtl ? 'عميل (Customer)' : 'Customer'}</option>
              <option value="SUPPLIER">{isRtl ? 'مورد (Supplier)' : 'Supplier'}</option>
            </Select>

            <Input
              label={isRtl ? 'الكود المرجعي (اختياري)' : 'Reference Code (Optional)'}
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder={formData.type === 'CUSTOMER' ? 'C-1001' : 'S-2001'}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={isRtl ? 'الاسم باللغة العربية' : 'Arabic Name'}
              required
              value={formData.nameAr}
              onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
              placeholder={isRtl ? 'شركة الأفق للتجارة' : 'Al-Ofok Trading'}
            />

            <Input
              label={isRtl ? 'الاسم باللغة الإنجليزية' : 'English / Latin Name'}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Al-Ofok Trading Co."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label={isRtl ? 'رقم الهاتف' : 'Phone Number'}
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+966 50 000 0000"
            />

            <Input
              label={isRtl ? 'البريد الإلكتروني' : 'Email Address'}
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="contact@company.com"
            />

            <Input
              label={isRtl ? 'الرقم الضريبي (VAT)' : 'Tax Number (VAT)'}
              value={formData.taxNumber}
              onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
              placeholder="300000000000003"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label={isRtl ? 'الحد الائتماني' : 'Credit Limit'}
              type="number"
              value={formData.creditLimit}
              onChange={(e) => setFormData({ ...formData, creditLimit: Number(e.target.value) })}
            />

            <Input
              label={isRtl ? 'رصيد افتتاحي (مدين)' : 'Opening Receivable'}
              type="number"
              value={formData.openingReceivable}
              onChange={(e) => setFormData({ ...formData, openingReceivable: Number(e.target.value) })}
            />

            <Input
              label={isRtl ? 'رصيد افتتاحي (دائن)' : 'Opening Payable'}
              type="number"
              value={formData.openingPayable}
              onChange={(e) => setFormData({ ...formData, openingPayable: Number(e.target.value) })}
            />
          </div>

          <Input
            label={isRtl ? 'العنوان الوطني أو التفصيلي' : 'Address'}
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder={isRtl ? 'الرياض - حي الملز' : 'Riyadh, Al-Malaz District'}
          />

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="primary" type="submit" loading={submittingCreate}>
              {isRtl ? 'حفظ الحساب' : 'Save Party'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Party Modal */}
      {showEditModal && editingParty && (
        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title={isRtl ? 'تعديل بيانات الحساب' : 'Edit Party Profile'}
          maxWidth="2xl"
        >
          <form onSubmit={handleUpdateParty} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label={isRtl ? 'الاسم باللغة العربية' : 'Arabic Name'}
                required
                value={editingParty.nameAr}
                onChange={(e) => setEditingParty({ ...editingParty, nameAr: e.target.value })}
              />
              <Input
                label={isRtl ? 'الاسم باللغة الإنجليزية' : 'English Name'}
                value={editingParty.name}
                onChange={(e) => setEditingParty({ ...editingParty, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label={isRtl ? 'رقم الهاتف' : 'Phone'}
                value={editingParty.phone}
                onChange={(e) => setEditingParty({ ...editingParty, phone: e.target.value })}
              />
              <Input
                label={isRtl ? 'البريد الإلكتروني' : 'Email'}
                value={editingParty.email}
                onChange={(e) => setEditingParty({ ...editingParty, email: e.target.value })}
              />
              <Input
                label={isRtl ? 'الرقم الضريبي' : 'Tax ID'}
                value={editingParty.taxNumber}
                onChange={(e) => setEditingParty({ ...editingParty, taxNumber: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label={isRtl ? 'الحد الائتماني' : 'Credit Limit'}
                type="number"
                value={editingParty.creditLimit}
                onChange={(e) => setEditingParty({ ...editingParty, creditLimit: Number(e.target.value) })}
              />
              <Input
                label={isRtl ? 'العنوان' : 'Address'}
                value={editingParty.address}
                onChange={(e) => setEditingParty({ ...editingParty, address: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button variant="outline" onClick={() => setShowEditModal(false)}>
                {isRtl ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button variant="primary" type="submit" loading={submittingEdit}>
                {isRtl ? 'حفظ التعديلات' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Statement Modal */}
      {statementData && (
        <Modal
          isOpen={!!statementData}
          onClose={() => setStatementData(null)}
          title={isRtl ? 'كشف حساب تفصيلي' : 'Account Statement'}
          maxWidth="4xl"
          footer={
            <Button variant="outline" onClick={() => window.print()} icon={<Printer className="w-4 h-4" />}>
              {isRtl ? 'طباعة كشف الحساب' : 'Print Statement'}
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
              <div>
                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  {isRtl ? statementData.party?.nameAr || statementData.party?.name : statementData.party?.name}
                </h4>
                <p className="text-slate-500 font-mono mt-0.5">{statementData.party?.code}</p>
              </div>
              <div className="text-end">
                <span className="text-slate-400 block">{isRtl ? 'صافي الرصيد المستحق' : 'Net Balance'}:</span>
                <span className="font-extrabold text-base text-sky-600 dark:text-sky-400 font-mono tabular-nums">
                  {formatMoney(statementData.netBalance || 0)}
                </span>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-2.5 font-bold text-slate-600 dark:text-slate-300">{isRtl ? 'التاريخ' : 'Date'}</th>
                    <th className="p-2.5 font-bold text-slate-600 dark:text-slate-300">{isRtl ? 'نوع المعاملة' : 'Type'}</th>
                    <th className="p-2.5 font-bold text-slate-600 dark:text-slate-300">{isRtl ? 'المرجع' : 'Reference'}</th>
                    <th className="p-2.5 font-bold text-slate-600 dark:text-slate-300 text-end">{isRtl ? 'مدين' : 'Debit'}</th>
                    <th className="p-2.5 font-bold text-slate-600 dark:text-slate-300 text-end">{isRtl ? 'دائن' : 'Credit'}</th>
                    <th className="p-2.5 font-bold text-slate-600 dark:text-slate-300 text-end">{isRtl ? 'الرصيد' : 'Balance'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {statementData.lines?.map((line: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-2.5 font-mono text-slate-500">
                        {new Date(line.date).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US')}
                      </td>
                      <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200">{line.description}</td>
                      <td className="p-2.5 font-mono text-slate-600 dark:text-slate-400">{line.reference}</td>
                      <td className="p-2.5 text-end font-mono text-rose-600 dark:text-rose-400">
                        {Number(line.debit || 0) > 0 ? Number(line.debit).toLocaleString() : '—'}
                      </td>
                      <td className="p-2.5 text-end font-mono text-emerald-600 dark:text-emerald-400">
                        {Number(line.credit || 0) > 0 ? Number(line.credit).toLocaleString() : '—'}
                      </td>
                      <td className="p-2.5 text-end font-mono font-bold text-slate-900 dark:text-slate-100">
                        {Number(line.balance || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
}
