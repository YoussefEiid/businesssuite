'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../src/components/layout/DashboardLayout';
import { ApiService } from '../../../src/services/api';
import { useLanguage } from '../../../src/hooks/use-language';
import { useToast } from '../../../src/hooks/use-toast';
import { useConfirm } from '../../../src/hooks/use-confirm';
import { useCompany } from '../../../src/hooks/use-company';
import { SUPPORTED_CURRENCIES } from '../../../src/utils/currency';
import { DesktopConfig, DEFAULT_DESKTOP_CONFIG } from '@business-suite/shared';
import { DataTable, Column } from '../../../src/components/ui/DataTable';
import { Modal } from '../../../src/components/ui/Modal';
import { Button } from '../../../src/components/ui/Button';
import { Input } from '../../../src/components/ui/Input';
import { Select } from '../../../src/components/ui/Select';
import { Badge } from '../../../src/components/ui/Badge';
import {
  Building2,
  FileText,
  Store,
  Users,
  Shield,
  Plus,
  Pencil,
  Trash2,
  Palette,
  Check,
  CheckCircle2,
  Monitor,
  Printer,
  HardDrive,
  RefreshCw,
} from 'lucide-react';

const SYSTEM_ROLES = [
  { key: 'COMPANY_ADMIN', nameAr: 'مدير المنشأة (Admin)', nameEn: 'Company Admin', desc: 'Full company access' },
  { key: 'SALES_AGENT', nameAr: 'مسؤول مبيعات (Sales)', nameEn: 'Sales Agent', desc: 'Invoices, quotes, customer accounts' },
  { key: 'WAREHOUSE_KEEPER', nameAr: 'أمين مستودع (Inventory)', nameEn: 'Warehouse Keeper', desc: 'Stock receipts, adjustments, transfers' },
  { key: 'CASHIER', nameAr: 'كاشير / أمين صندوق', nameEn: 'Cashier', desc: 'POS terminal, receipt vouchers' },
  { key: 'REPORTS_VIEWER', nameAr: 'مستعرض تقارير فقط', nameEn: 'Viewer', desc: 'Read-only financial reports' },
];

export default function SettingsPage() {
  const { isRtl } = useLanguage();
  const toast = useToast();
  const { confirm } = useConfirm();
  const { refreshCompanyProfile } = useCompany();

  const [activeTab, setActiveTab] = useState<'profile' | 'invoices' | 'branches' | 'warehouses' | 'staff' | 'desktop'>('profile');
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [initialCurrencyCode, setInitialCurrencyCode] = useState('EGP');
  const [hasTransactions, setHasTransactions] = useState(false);

  // Desktop Application Hardware State
  const [isDesktopApp, setIsDesktopApp] = useState(false);
  const [printers, setPrinters] = useState<any[]>([]);
  const [testingPrint, setTestingPrint] = useState(false);
  const [savingDesktop, setSavingDesktop] = useState(false);
  const [desktopConfig, setDesktopConfig] = useState<DesktopConfig>(DEFAULT_DESKTOP_CONFIG);

  const [backupsList, setBackupsList] = useState<any[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState<any>(null);

  const loadDesktopData = async () => {
    if (typeof window !== 'undefined' && window.businessSuiteDesktop?.isDesktop) {
      setIsDesktopApp(true);
      try {
        const [cfg, prns] = await Promise.all([
          window.businessSuiteDesktop.getDesktopConfig(),
          window.businessSuiteDesktop.getPrinters(),
        ]);
        if (cfg) {
          setDesktopConfig(cfg);
        }
        if (Array.isArray(prns)) {
          setPrinters(prns);
        }
        if (window.businessSuiteDesktop.getLicenseStatus) {
          const lic = await window.businessSuiteDesktop.getLicenseStatus();
          setLicenseInfo(lic);
        }
        if (window.businessSuiteDesktop.listBackups) {
          const list = await window.businessSuiteDesktop.listBackups();
          setBackupsList(list || []);
        }
      } catch (e) {
        console.error('Failed to load desktop settings:', e);
      }
    }
  };

  const handleCreateBackup = async () => {
    if (typeof window !== 'undefined' && window.businessSuiteDesktop?.createBackup) {
      setCreatingBackup(true);
      try {
        const res = await window.businessSuiteDesktop.createBackup();
        if (res.success) {
          toast.success(isRtl ? 'تم إنشاء النسخة الاحتياطية بنجاح' : 'Database backup created successfully');
          if (window.businessSuiteDesktop.listBackups) {
            const list = await window.businessSuiteDesktop.listBackups();
            setBackupsList(list || []);
          }
        } else {
          toast.error(res.error || 'Backup creation failed');
        }
      } catch (err: any) {
        toast.error(err.message || 'Backup failed');
      } finally {
        setCreatingBackup(false);
      }
    }
  };

  const handleRestoreBackup = async (filePath: string) => {
    const ok = await confirm({
      title: isRtl ? 'استعادة النسخة الاحتياطية' : 'Restore Database Backup',
      message: isRtl
        ? 'تحذير: ستؤدي استعادة النسخة الاحتياطية إلى إيقاف العمليات مؤقتاً واستبدال البيانات الحالية بالنسخة المحددة. هل تريد بالتأكيد المتابعة؟'
        : 'Warning: Restoring will overwrite the current live database with the selected backup. Proceed?',
      isDestructive: true,
    });
    if (!ok) return;

    if (typeof window !== 'undefined' && window.businessSuiteDesktop?.restoreBackup) {
      setRestoringBackup(true);
      try {
        const res = await window.businessSuiteDesktop.restoreBackup(filePath);
        if (res.success) {
          toast.success(isRtl ? 'تمت استعادة النسخة الاحتياطية بنجاح! جاري إعادة التحميل...' : 'Backup restored successfully! Reloading...');
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          toast.error(res.error || 'Restore failed');
          setRestoringBackup(false);
        }
      } catch (err: any) {
        toast.error(err.message || 'Restore failed');
        setRestoringBackup(false);
      }
    }
  };

  const handleOpenDataFolder = () => {
    if (typeof window !== 'undefined' && window.businessSuiteDesktop?.openDataFolder) {
      window.businessSuiteDesktop.openDataFolder();
    }
  };

  const handleOpenBackupsFolder = () => {
    if (typeof window !== 'undefined' && window.businessSuiteDesktop?.openBackupsFolder) {
      window.businessSuiteDesktop.openBackupsFolder();
    }
  };

  const handleSaveDesktopConfig = async () => {
    if (typeof window !== 'undefined' && window.businessSuiteDesktop) {
      setSavingDesktop(true);
      try {
        await window.businessSuiteDesktop.saveDesktopConfig(desktopConfig);
        toast.success(isRtl ? 'تم حفظ إعدادات تطبيق سطح المكتب بنجاح' : 'Desktop settings saved successfully');
      } catch (err: any) {
        toast.error(err.message || 'Failed to save desktop settings');
      } finally {
        setSavingDesktop(false);
      }
    }
  };

  const handleTestPrint = async () => {
    if (typeof window !== 'undefined' && window.businessSuiteDesktop) {
      setTestingPrint(true);
      try {
        await window.businessSuiteDesktop.printReceipt({
          invoiceNumber: 'TEST-001',
          date: new Date().toLocaleTimeString(isRtl ? 'ar-SA' : 'en-US'),
          companyName: companyForm.name || 'BusinessSuite Test',
          companyTaxNumber: companyForm.taxNumber,
          companyPhone: companyForm.phone,
          companyAddress: companyForm.address,
          currency: companyForm.currencyCode || 'SAR',
          items: [
            {
              name: 'تجربة طابعة سطح المكتب',
              nameAr: 'تجربة طابعة سطح المكتب',
              quantity: 1,
              unitPrice: 100,
              total: 100,
              taxRate: 0,
            },
          ],
          subtotal: 100,
          taxTotal: 0,
          grandTotal: 100,
          notes: 'Test print from BusinessSuite Desktop Settings',
          paperWidth: desktopConfig.receiptPaperWidth,
          silent: false,
        });
        toast.success(isRtl ? 'تم إرسال أمر الطباعة التجريبية' : 'Test print sent successfully');
      } catch (err: any) {
        toast.error(err.message || 'Test print failed');
      } finally {
        setTestingPrint(false);
      }
    }
  };

  const handleTestCashDrawer = async () => {
    if (typeof window !== 'undefined' && window.businessSuiteDesktop) {
      try {
        await window.businessSuiteDesktop.openCashDrawer();
        toast.success(isRtl ? 'تم إرسال نبضة فتح درج النقدية' : 'Cash drawer pulse sent');
      } catch (err: any) {
        toast.error(err.message || 'Failed to pulse cash drawer');
      }
    }
  };

  const handleResetDesktopConfig = async () => {
    const ok = await confirm({
      title: isRtl ? 'استعادة ضبط سطح المكتب' : 'Reset Desktop Settings',
      message: isRtl ? 'هل تريد استعادة الإعدادات الافتراضية لتطبيق سطح المكتب؟' : 'Reset desktop settings to defaults?',
      isDestructive: true,
    });
    if (!ok) return;

    if (typeof window !== 'undefined' && window.businessSuiteDesktop) {
      try {
        await window.businessSuiteDesktop.resetDesktopConfig();
        const def = await window.businessSuiteDesktop.getDesktopConfig();
        if (def) {
          setDesktopConfig(def);
        }
        toast.success(isRtl ? 'تمت استعادة الإعدادات الافتراضية' : 'Desktop settings reset');
      } catch (err: any) {
        toast.error(err.message || 'Reset failed');
      }
    }
  };

  // Profile Form
  const [companyForm, setCompanyForm] = useState({
    name: '',
    taxNumber: '',
    commercialReg: '',
    phone: '',
    email: '',
    address: '',
    logoUrl: '',
    currencyCode: 'EGP',
    invoiceHeader: '',
    invoiceFooter: '',
    invoiceFooterAr: '',
    termsAndConditions: '',
    themeColor: '#0ea5e9',
  });

  // Branches & Warehouses
  const [branches, setBranches] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [branchForm, setBranchForm] = useState({ code: '', name: '', nameAr: '', phone: '', address: '', isDefault: false });
  const [submittingBranch, setSubmittingBranch] = useState(false);

  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [warehouseForm, setWarehouseForm] = useState({ code: '', name: '', nameAr: '', branchId: '', address: '', isDefault: false });
  const [submittingWarehouse, setSubmittingWarehouse] = useState(false);

  // Staff & Members
  const [members, setMembers] = useState<any[]>([]);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [memberForm, setMemberForm] = useState({
    name: '',
    email: '',
    phone: '',
    initialPassword: '',
    roleName: 'SALES_AGENT',
    status: 'ACTIVE',
  });
  const [submittingMember, setSubmittingMember] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prof, brs, whs, mems] = await Promise.all([
        ApiService.getCompanyProfile().catch(() => null),
        ApiService.listBranches().catch(() => []),
        ApiService.listWarehouses().catch(() => []),
        ApiService.listMembers().catch(() => []),
      ]);

      if (prof) {
        const cur = prof.currencyCode || 'EGP';
        setInitialCurrencyCode(cur);
        setHasTransactions(Boolean(prof.hasTransactions));
        setCompanyForm({
          name: prof.name || '',
          taxNumber: prof.taxNumber || '',
          commercialReg: prof.commercialReg || '',
          phone: prof.phone || '',
          email: prof.email || '',
          address: prof.address || '',
          logoUrl: prof.logoUrl || '',
          currencyCode: cur,
          invoiceHeader: prof.settings?.invoiceHeader || '',
          invoiceFooter: prof.settings?.invoiceFooter || '',
          invoiceFooterAr: prof.settings?.invoiceFooterAr || '',
          termsAndConditions: prof.settings?.termsAndConditions || '',
          themeColor: prof.settings?.themeColor || '#0ea5e9',
        });
      }

      setBranches(brs || []);
      setWarehouses(whs || []);
      setMembers(mems || []);
      if (brs && brs.length > 0) {
        setWarehouseForm((prev) => ({ ...prev, branchId: prev.branchId || brs[0].id }));
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load company settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadDesktopData();
  }, []);

  // Save Company Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (companyForm.currencyCode !== initialCurrencyCode && hasTransactions) {
      const ok = await confirm({
        title: isRtl ? 'تحذير تغيير العملة الأساسية' : 'Base Currency Change Warning',
        message: isRtl
          ? 'تغيير العملة الأساسية لا يقوم بتحويل الأرصدة أو الفواتير السابقة. تأكد من صحة القرار قبل المتابعة.'
          : 'Changing the base currency does not convert existing balances or historical invoices.',
        confirmLabel: isRtl ? 'تأكيد التغيير' : 'Confirm Change',
        cancelLabel: isRtl ? 'إلغاء' : 'Cancel',
        isDestructive: true,
      });
      if (!ok) {
        return;
      }
    }

    setSavingProfile(true);
    try {
      await ApiService.updateCompanyProfile({
        name: companyForm.name,
        taxNumber: companyForm.taxNumber || undefined,
        commercialReg: companyForm.commercialReg || undefined,
        phone: companyForm.phone || undefined,
        email: companyForm.email || undefined,
        address: companyForm.address || undefined,
        logoUrl: companyForm.logoUrl || undefined,
        currencyCode: companyForm.currencyCode,
        invoiceHeader: companyForm.invoiceHeader || undefined,
        invoiceFooter: companyForm.invoiceFooter || undefined,
        invoiceFooterAr: companyForm.invoiceFooterAr || undefined,
        termsAndConditions: companyForm.termsAndConditions || undefined,
        themeColor: companyForm.themeColor || undefined,
      });
      setInitialCurrencyCode(companyForm.currencyCode);
      await refreshCompanyProfile();
      toast.success(isRtl ? 'تم حفظ بيانات المنشأة بنجاح' : 'Company profile saved successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save company profile');
    } finally {
      setSavingProfile(false);
    }
  };

  // Branch CRUD
  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingBranch(true);
    try {
      await ApiService.createBranch({
        code: branchForm.code.trim() || `BR-${Date.now().toString().slice(-4)}`,
        name: branchForm.name.trim() || branchForm.nameAr.trim(),
        nameAr: branchForm.nameAr.trim() || branchForm.name.trim(),
        phone: branchForm.phone.trim() || undefined,
        address: branchForm.address.trim() || undefined,
        isDefault: branchForm.isDefault,
      });
      toast.success(isRtl ? 'تمت إضافة الفرع بنجاح' : 'Branch added successfully');
      setIsBranchModalOpen(false);
      setBranchForm({ code: '', name: '', nameAr: '', phone: '', address: '', isDefault: false });
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add branch');
    } finally {
      setSubmittingBranch(false);
    }
  };

  const handleDeleteBranch = async (branch: any) => {
    const ok = await confirm({
      title: isRtl ? 'حذف الفرع' : 'Delete Branch',
      message: isRtl ? `هل تريد حذف الفرع "${branch.nameAr || branch.name}"؟` : `Delete branch "${branch.name}"?`,
      isDestructive: true,
    });
    if (!ok) return;

    try {
      await ApiService.deleteBranch(branch.id);
      toast.success(isRtl ? 'تم حذف الفرع بنجاح' : 'Branch deleted');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete branch');
    }
  };

  // Warehouse CRUD
  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingWarehouse(true);
    try {
      await ApiService.createWarehouse({
        code: warehouseForm.code.trim() || `WH-${Date.now().toString().slice(-4)}`,
        name: warehouseForm.name.trim() || warehouseForm.nameAr.trim(),
        nameAr: warehouseForm.nameAr.trim() || warehouseForm.name.trim(),
        branchId: warehouseForm.branchId || undefined,
        address: warehouseForm.address.trim() || undefined,
        isDefault: warehouseForm.isDefault,
      });
      toast.success(isRtl ? 'تمت إضافة المستودع بنجاح' : 'Warehouse created');
      setIsWarehouseModalOpen(false);
      setWarehouseForm({ code: '', name: '', nameAr: '', branchId: branches[0]?.id || '', address: '', isDefault: false });
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add warehouse');
    } finally {
      setSubmittingWarehouse(false);
    }
  };

  const handleDeleteWarehouse = async (warehouse: any) => {
    const ok = await confirm({
      title: isRtl ? 'حذف المستودع' : 'Delete Warehouse',
      message: isRtl ? `هل تريد حذف المستودع "${warehouse.nameAr || warehouse.name}"؟` : `Delete warehouse "${warehouse.name}"?`,
      isDestructive: true,
    });
    if (!ok) return;

    try {
      await ApiService.deleteWarehouse(warehouse.id);
      toast.success(isRtl ? 'تم حذف المستودع بنجاح' : 'Warehouse deleted');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete warehouse');
    }
  };

  // Staff CRUD
  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingMember(true);
    try {
      await ApiService.inviteMember(memberForm);
      toast.success(isRtl ? 'تمت إضافة الموظف وتعيين الصلاحيات بنجاح' : 'Staff member invited successfully');
      setIsMemberModalOpen(false);
      setMemberForm({
        name: '',
        email: '',
        phone: '',
        initialPassword: '',
        roleName: 'SALES_AGENT',
        status: 'ACTIVE',
      });
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add member');
    } finally {
      setSubmittingMember(false);
    }
  };

  const handleRemoveMember = async (member: any) => {
    const ok = await confirm({
      title: isRtl ? 'حذف الموظف' : 'Remove Staff Member',
      message: isRtl ? `هل تريد إزالة الموظف "${member.user?.name}" من المنشأة؟` : `Remove "${member.user?.name}"?`,
      isDestructive: true,
    });
    if (!ok) return;

    try {
      await ApiService.removeMember(member.id);
      toast.success(isRtl ? 'تمت إزالة الموظف بنجاح' : 'Member removed');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove member');
    }
  };

  // Branches Columns
  const branchColumns: Column<any>[] = [
    {
      key: 'code',
      header: isRtl ? 'الكود' : 'Code',
      render: (r) => <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{r.code}</span>,
    },
    {
      key: 'name',
      header: isRtl ? 'اسم الفرع' : 'Branch Name',
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800 dark:text-slate-100">{isRtl ? r.nameAr || r.name : r.name}</span>
          {r.isDefault && <Badge variant="success" size="sm">{isRtl ? 'افتراضي' : 'Default'}</Badge>}
        </div>
      ),
    },
    {
      key: 'phone',
      header: isRtl ? 'الهاتف' : 'Phone',
      render: (r) => <span className="font-mono text-slate-500">{r.phone || '—'}</span>,
    },
    {
      key: 'address',
      header: isRtl ? 'العنوان' : 'Address',
      render: (r) => <span className="text-slate-500">{r.address || '—'}</span>,
    },
    {
      key: 'actions',
      header: isRtl ? 'الإجراءات' : 'Actions',
      align: 'end',
      render: (r) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleDeleteBranch(r)}
          icon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
        />
      ),
    },
  ];

  // Warehouses Columns
  const warehouseColumns: Column<any>[] = [
    {
      key: 'code',
      header: isRtl ? 'الكود' : 'Code',
      render: (r) => <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{r.code}</span>,
    },
    {
      key: 'name',
      header: isRtl ? 'اسم المستودع' : 'Warehouse Name',
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800 dark:text-slate-100">{isRtl ? r.nameAr || r.name : r.name}</span>
          {r.isDefault && <Badge variant="success" size="sm">{isRtl ? 'رئيسي' : 'Primary'}</Badge>}
        </div>
      ),
    },
    {
      key: 'branch',
      header: isRtl ? 'الفرع التابع له' : 'Branch',
      render: (r) => <span>{r.branch ? (isRtl ? r.branch.nameAr || r.branch.name : r.branch.name) : '—'}</span>,
    },
    {
      key: 'actions',
      header: isRtl ? 'الإجراءات' : 'Actions',
      align: 'end',
      render: (r) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleDeleteWarehouse(r)}
          icon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
        />
      ),
    },
  ];

  // Staff Columns
  const staffColumns: Column<any>[] = [
    {
      key: 'user',
      header: isRtl ? 'اسم الموظف' : 'Staff Member',
      render: (r) => (
        <div>
          <p className="font-bold text-slate-800 dark:text-slate-100">{r.user?.name}</p>
          <p className="text-2xs text-slate-400 font-mono">{r.user?.email}</p>
        </div>
      ),
    },
    {
      key: 'roleName',
      header: isRtl ? 'الدور الوظيفي' : 'System Role',
      render: (r) => {
        const found = SYSTEM_ROLES.find((s) => s.key === r.roleName);
        return (
          <Badge variant={r.roleName === 'COMPANY_ADMIN' ? 'default' : 'neutral'} size="sm">
            {isRtl ? found?.nameAr || r.roleName : found?.nameEn || r.roleName}
          </Badge>
        );
      },
    },
    {
      key: 'status',
      header: isRtl ? 'الحالة' : 'Status',
      render: (r) => (
        <Badge variant={r.status === 'ACTIVE' ? 'success' : 'danger'} size="sm">
          {r.status === 'ACTIVE' ? (isRtl ? 'نشط' : 'Active') : isRtl ? 'معطل' : 'Suspended'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: isRtl ? 'الإجراءات' : 'Actions',
      align: 'end',
      render: (r) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleRemoveMember(r)}
          icon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
        />
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Page Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {isRtl ? 'إعدادات المنشأة والنظام' : 'Company & System Settings'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isRtl
              ? 'إدارة الهوية الضريبية والتجارية، الفروع، المستودعات، صلاحيات الموظفين، وقوالب الطباعة'
              : 'Corporate identity, tax numbers, branch network, warehouses, roles and invoice print layouts'}
          </p>
        </div>

        {/* Tab Selector Ribbon */}
        <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'profile'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>{isRtl ? 'الهوية والبيانات التجارية' : 'Company Profile'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('invoices')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'invoices'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{isRtl ? 'قوالب طباعة الفواتير' : 'Invoice Print Layout'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('branches')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'branches'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>{isRtl ? 'الفروع' : 'Branches'} ({branches.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('warehouses')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'warehouses'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>{isRtl ? 'المستودعات' : 'Warehouses'} ({warehouses.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('staff')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'staff'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{isRtl ? 'فريق العمل والصلاحيات' : 'Staff & Roles'} ({members.length})</span>
          </button>

          {isDesktopApp && (
            <button
              type="button"
              onClick={() => setActiveTab('desktop')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'desktop'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>{isRtl ? 'تطبيق سطح المكتب' : 'Desktop App'}</span>
            </button>
          )}
        </div>

        {/* Tab 1: Profile Form */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4 max-w-4xl">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2">
              {isRtl ? 'البيانات الرسمية للمنشأة' : 'Official Organization Information'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label={isRtl ? 'الاسم التجاري للمنشأة' : 'Company Legal Name'}
                required
                value={companyForm.name}
                onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
              />

              <Input
                label={isRtl ? 'الرقم الضريبي (VAT)' : 'Tax Identification Number'}
                value={companyForm.taxNumber}
                onChange={(e) => setCompanyForm({ ...companyForm, taxNumber: e.target.value })}
                placeholder="300000000000003"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label={isRtl ? 'رقم السجل التجاري (CR)' : 'Commercial Registration'}
                value={companyForm.commercialReg}
                onChange={(e) => setCompanyForm({ ...companyForm, commercialReg: e.target.value })}
                placeholder="1010000000"
              />

              <Input
                label={isRtl ? 'رقم الهاتف المعتمد' : 'Official Phone'}
                value={companyForm.phone}
                onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                placeholder="+966 11 000 0000"
              />

              <Input
                label={isRtl ? 'البريد الإلكتروني' : 'Official Email'}
                type="email"
                value={companyForm.email}
                onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                placeholder="info@company.com"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Input
                  label={isRtl ? 'العنوان الوطني / المقر الرئيسي' : 'Registered Address'}
                  value={companyForm.address}
                  onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                  placeholder={isRtl ? 'المقر الرئيسي للمنشأة' : 'Company headquarters address'}
                />
              </div>

              <Select
                label={isRtl ? 'العملة الأساسية للنظام' : 'Base Currency'}
                value={companyForm.currencyCode}
                onChange={(e) => setCompanyForm({ ...companyForm, currencyCode: e.target.value })}
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {isRtl ? c.nameAr : c.nameEn} ({isRtl ? c.symbolAr : c.symbolEn})
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button type="submit" variant="primary" loading={savingProfile}>
                {isRtl ? 'حفظ التعديلات' : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}

        {/* Tab 2: Invoices Print Customization */}
        {activeTab === 'invoices' && (
          <form onSubmit={handleSaveProfile} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4 max-w-4xl">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2">
              {isRtl ? 'تخصيص ترويسة وتذييل الفواتير المطبوعة' : 'Invoice Print Header & Footer'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label={isRtl ? 'رابط شعار المنشأة (Logo URL)' : 'Logo Image URL'}
                value={companyForm.logoUrl}
                onChange={(e) => setCompanyForm({ ...companyForm, logoUrl: e.target.value })}
                placeholder="https://example.com/logo.png"
              />

              <Input
                label={isRtl ? 'لون السمة والطباعة الرئيسي' : 'Theme Accent Hex Color'}
                value={companyForm.themeColor}
                onChange={(e) => setCompanyForm({ ...companyForm, themeColor: e.target.value })}
                placeholder="#0ea5e9"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label={isRtl ? 'الترويسة العلوية للفاتورة' : 'Invoice Header Text'}
                value={companyForm.invoiceHeader}
                onChange={(e) => setCompanyForm({ ...companyForm, invoiceHeader: e.target.value })}
                placeholder={isRtl ? 'فاتورة ضريبية مبسطة معتمدة' : 'Official Tax Invoice'}
              />

              <Input
                label={isRtl ? 'التذييل السفلي (بالعربية)' : 'Arabic Footer Note'}
                value={companyForm.invoiceFooterAr}
                onChange={(e) => setCompanyForm({ ...companyForm, invoiceFooterAr: e.target.value })}
                placeholder={isRtl ? 'شكراً لتعاملكم معنا - البضاعة المباعة ترد خلال 7 أيام' : 'Thank you for your business'}
              />
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button type="submit" variant="primary" loading={savingProfile}>
                {isRtl ? 'حفظ إعدادات الطباعة' : 'Save Print Settings'}
              </Button>
            </div>
          </form>
        )}

        {/* Tab 3: Branches Table */}
        {activeTab === 'branches' && (
          <DataTable
            columns={branchColumns}
            data={branches}
            keyExtractor={(r) => r.id}
            loading={loading}
            searchable={false}
            actionElement={
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsBranchModalOpen(true)}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                {isRtl ? 'إضافة فرع جديد' : 'New Branch'}
              </Button>
            }
            emptyTitle={isRtl ? 'لا توجد فروع مسجلة' : 'No branches registered'}
            emptyActionLabel={isRtl ? 'إضافة فرع' : 'Add Branch'}
            onEmptyAction={() => setIsBranchModalOpen(true)}
          />
        )}

        {/* Tab 4: Warehouses Table */}
        {activeTab === 'warehouses' && (
          <DataTable
            columns={warehouseColumns}
            data={warehouses}
            keyExtractor={(r) => r.id}
            loading={loading}
            searchable={false}
            actionElement={
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsWarehouseModalOpen(true)}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                {isRtl ? 'إضافة مستودع جديد' : 'New Warehouse'}
              </Button>
            }
            emptyTitle={isRtl ? 'لا توجد مستودعات مسجلة' : 'No warehouses registered'}
            emptyActionLabel={isRtl ? 'إضافة مستودع' : 'Add Warehouse'}
            onEmptyAction={() => setIsWarehouseModalOpen(true)}
          />
        )}

        {/* Tab 5: Staff Table */}
        {activeTab === 'staff' && (
          <DataTable
            columns={staffColumns}
            data={members}
            keyExtractor={(r) => r.id}
            loading={loading}
            searchable={false}
            actionElement={
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsMemberModalOpen(true)}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                {isRtl ? 'إضافة موظف جديد' : 'Invite Staff'}
              </Button>
            }
            emptyTitle={isRtl ? 'لا يوجد موظفون' : 'No staff members'}
          />
        )}

        {/* Tab 6: Desktop App Settings */}
        {activeTab === 'desktop' && isDesktopApp && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-5 max-w-4xl">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Monitor className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                <span>{isRtl ? 'إعدادات طابعات وأجهزة سطح المكتب' : 'Desktop Hardware & Terminal Settings'}</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isRtl
                  ? 'تهيئة طابعات الإيصالات الحرارية، طابعات فواتير A4 الضريبية، فتح درج النقدية التلقائي، والطباعة الصامتة السريعة'
                  : 'Configure thermal POS receipt printers, A4 tax invoice printers, automatic cash drawer kicks, and silent printing.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Receipt Printer Selection */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  {isRtl ? 'طابعة الإيصالات الحرارية (POS)' : 'Thermal Receipt Printer (POS)'}
                </label>
                <Select
                  value={desktopConfig.receiptPrinter}
                  onChange={(e) => setDesktopConfig({ ...desktopConfig, receiptPrinter: e.target.value })}
                >
                  <option value="">{isRtl ? 'الطابعة الافتراضية للنظام' : 'System Default Printer'}</option>
                  {printers.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.displayName || p.name} {p.isDefault ? (isRtl ? '(الافتراضية)' : '(Default)') : ''}
                    </option>
                  ))}
                </Select>
                <p className="text-[11px] text-slate-400 mt-1">
                  {isRtl ? 'تُستخدم لطباعة بونات الكاشير الحرارية السريعة' : 'Used for instant POS cashier thermal receipts'}
                </p>
              </div>

              {/* Invoice Printer Selection */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  {isRtl ? 'طابعة الفواتير الضريبية (A4)' : 'Tax Invoice Printer (A4)'}
                </label>
                <Select
                  value={desktopConfig.invoicePrinter}
                  onChange={(e) => setDesktopConfig({ ...desktopConfig, invoicePrinter: e.target.value })}
                >
                  <option value="">{isRtl ? 'الطابعة الافتراضية للنظام' : 'System Default Printer'}</option>
                  {printers.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.displayName || p.name} {p.isDefault ? (isRtl ? '(الافتراضية)' : '(Default)') : ''}
                    </option>
                  ))}
                </Select>
                <p className="text-[11px] text-slate-400 mt-1">
                  {isRtl ? 'تُستخدم لفواتير المبيعات والمشتريات الرسمية بحجم A4' : 'Used for formal A4 tax sales and purchase invoices'}
                </p>
              </div>
            </div>

            {/* Paper Width & Hardware Toggles */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  {isRtl ? 'عرض ورق الإيصالات الحراري' : 'Thermal Receipt Width'}
                </label>
                <Select
                  value={desktopConfig.receiptPaperWidth}
                  onChange={(e) => setDesktopConfig({ ...desktopConfig, receiptPaperWidth: e.target.value as any })}
                >
                  <option value="80mm">80mm ({isRtl ? 'القياسي الشائع' : 'Standard Thermal'})</option>
                  <option value="58mm">58mm ({isRtl ? 'المضغوط الصغير' : 'Compact'})</option>
                </Select>
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={desktopConfig.silentPrinting}
                    onChange={(e) => setDesktopConfig({ ...desktopConfig, silentPrinting: e.target.checked })}
                    className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                  />
                  <span>{isRtl ? 'طباعة صامتة سريعة (بدون نافذة تأكيد)' : 'Silent Instant Printing (Skip dialog)'}</span>
                </label>
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={desktopConfig.openCashDrawerOnSale}
                    onChange={(e) => setDesktopConfig({ ...desktopConfig, openCashDrawerOnSale: e.target.checked })}
                    className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                  />
                  <span>{isRtl ? 'فتح درج النقدية تلقائياً عند الدفع النقدي' : 'Kick cash drawer on cash sale'}</span>
                </label>
              </div>
            </div>

            {/* Desktop Offline Standalone Status Card */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-sky-400" />
                    {isRtl ? 'نمط التشغيل: سطح المكتب المستقل (Offline Standalone)' : 'Runtime: Offline Standalone Desktop'}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isRtl
                      ? 'يعمل التطبيق بالكامل محلياً ضد قاعدة بيانات PostgreSQL المدمجة بدون الحاجة للإنترنت.'
                      : 'Running fully locally with bundled PostgreSQL and loopback API. No internet required.'}
                  </p>
                </div>
                <Badge variant="success">
                  {isRtl ? 'متصل محلياً (100% Offline)' : 'Local Loopback Active'}
                </Badge>
              </div>

              {/* Data & Backup Folder Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleOpenDataFolder}
                >
                  {isRtl ? 'فتح مجلد البيانات (Open Data Folder)' : 'Open Data Folder'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleOpenBackupsFolder}
                >
                  {isRtl ? 'فتح مجلد النسخ الاحتياطي (Open Backup Folder)' : 'Open Backup Folder'}
                </Button>
              </div>
            </div>

            {/* Database Backup & Restore Section */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-emerald-400" />
                    {isRtl ? 'النسخ الاحتياطي واستعادة البيانات (.bsbak)' : 'Database Backup & Restore'}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isRtl
                      ? 'إنشاء نسخ احتياطية آمنة ومحمية من قاعدة البيانات المحلية واستعادتها في أي وقت.'
                      : 'Generate safe binary database backups and restore them whenever needed.'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleCreateBackup}
                  loading={creatingBackup}
                  icon={<HardDrive className="w-3.5 h-3.5" />}
                >
                  {isRtl ? 'نسخ احتياطي الآن (Backup Now)' : 'Backup Database Now'}
                </Button>
              </div>

              {/* Backups List */}
              <div className="space-y-2 pt-2">
                <div className="text-xs font-semibold text-slate-300">
                  {isRtl ? 'النسخ الاحتياطية المتوفرة محلياً:' : 'Available Local Backups:'}
                </div>
                {backupsList.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">
                    {isRtl ? 'لا توجد نسخ احتياطية سابقة بعد.' : 'No backup files found yet.'}
                  </p>
                ) : (
                  <div className="divide-y divide-slate-800 max-h-48 overflow-y-auto">
                    {backupsList.map((bk, idx) => (
                      <div key={idx} className="py-2 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-mono text-slate-200">{bk.fileName}</div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(bk.createdAt).toLocaleString(isRtl ? 'ar-SA' : 'en-US')} • {bk.sizeFormatted}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestoreBackup(bk.filePath)}
                          loading={restoringBackup}
                          className="text-amber-400 hover:text-amber-300 border-amber-500/30 text-xs"
                        >
                          {isRtl ? 'استعادة (Restore)' : 'Restore'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Offline Commercial License Card */}
            {licenseInfo && (
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-sky-400" />
                    {isRtl ? 'الترخيص وبصمة الجهاز (Commercial License)' : 'Commercial License'}
                  </h4>
                  <Badge variant={licenseInfo.isValid ? 'success' : 'danger'}>
                    {licenseInfo.isValid
                      ? (isRtl ? 'ترخيص نشط وموثق' : 'Active Licensed')
                      : (isRtl ? 'ترخيص تجريبي / غير مفعل' : 'Trial / Inactive')}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-slate-400">{isRtl ? 'الجهة المرخصة: ' : 'Licensee: '}</span>
                    <span className="text-white font-medium">{licenseInfo.licensee || 'Local Commercial Client'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">{isRtl ? 'بصمة الجهاز (Hardware ID): ' : 'Hardware ID: '}</span>
                    <span className="font-mono text-sky-400">{licenseInfo.hardwareId || 'HW-BIND-001'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Hardware Test Actions & Save */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestPrint}
                  loading={testingPrint}
                  icon={<Printer className="w-3.5 h-3.5" />}
                >
                  {isRtl ? 'طباعة إيصال تجريبي' : 'Test Receipt Print'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestCashDrawer}
                  icon={<HardDrive className="w-3.5 h-3.5" />}
                >
                  {isRtl ? 'اختبار نبضة درج النقدية' : 'Test Cash Drawer'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetDesktopConfig}
                  className="text-slate-500 hover:text-rose-600"
                  icon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  {isRtl ? 'استعادة الافتراضي' : 'Reset Defaults'}
                </Button>
              </div>

              <Button
                type="button"
                variant="primary"
                onClick={handleSaveDesktopConfig}
                loading={savingDesktop}
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                {isRtl ? 'حفظ إعدادات سطح المكتب' : 'Save Desktop Settings'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add Branch Modal */}
      <Modal
        isOpen={isBranchModalOpen}
        onClose={() => setIsBranchModalOpen(false)}
        title={isRtl ? 'إضافة فرع تجاري جديد' : 'Add New Branch'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveBranch} className="space-y-3.5">
          <Input
            label={isRtl ? 'اسم الفرع بالعربية' : 'Branch Arabic Name'}
            required
            value={branchForm.nameAr}
            onChange={(e) => setBranchForm({ ...branchForm, nameAr: e.target.value })}
            placeholder={isRtl ? 'فرع طريق الملك عبدالعزيز' : 'King Abdulaziz Branch'}
          />

          <Input
            label={isRtl ? 'اسم الفرع بالإنجليزية' : 'Branch English Name'}
            value={branchForm.name}
            onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
            placeholder="King Abdulaziz St Branch"
          />

          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label={isRtl ? 'كود الفرع' : 'Branch Code'}
              value={branchForm.code}
              onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value })}
              placeholder="BR-01"
            />

            <Input
              label={isRtl ? 'رقم الهاتف' : 'Phone'}
              value={branchForm.phone}
              onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
            />
          </div>

          <Input
            label={isRtl ? 'العنوان' : 'Address'}
            value={branchForm.address}
            onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
          />

          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={branchForm.isDefault}
              onChange={(e) => setBranchForm({ ...branchForm, isDefault: e.target.checked })}
              className="rounded text-sky-600 focus:ring-sky-500"
            />
            <span>{isRtl ? 'تعيين كفرع رئيسي وافتراضي' : 'Set as primary default branch'}</span>
          </label>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" onClick={() => setIsBranchModalOpen(false)}>
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="primary" type="submit" loading={submittingBranch}>
              {isRtl ? 'حفظ الفرع' : 'Save Branch'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Warehouse Modal */}
      <Modal
        isOpen={isWarehouseModalOpen}
        onClose={() => setIsWarehouseModalOpen(false)}
        title={isRtl ? 'إضافة مستودع جديد' : 'Add New Warehouse'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveWarehouse} className="space-y-3.5">
          <Input
            label={isRtl ? 'اسم المستودع بالعربية' : 'Warehouse Arabic Name'}
            required
            value={warehouseForm.nameAr}
            onChange={(e) => setWarehouseForm({ ...warehouseForm, nameAr: e.target.value })}
            placeholder={isRtl ? 'مستودع السلي المركزي' : 'Al-Sulai Central Warehouse'}
          />

          <Input
            label={isRtl ? 'اسم المستودع بالإنجليزية' : 'Warehouse English Name'}
            value={warehouseForm.name}
            onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
            placeholder="Al-Sulai Central Warehouse"
          />

          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label={isRtl ? 'كود المستودع' : 'Warehouse Code'}
              value={warehouseForm.code}
              onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value })}
              placeholder="WH-01"
            />

            <Select
              label={isRtl ? 'الفرع التابع له' : 'Associated Branch'}
              value={warehouseForm.branchId}
              onChange={(e) => setWarehouseForm({ ...warehouseForm, branchId: e.target.value })}
            >
              <option value="">{isRtl ? 'مستودع مركزي عام' : 'General Central'}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {isRtl ? b.nameAr || b.name : b.name}
                </option>
              ))}
            </Select>
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={warehouseForm.isDefault}
              onChange={(e) => setWarehouseForm({ ...warehouseForm, isDefault: e.target.checked })}
              className="rounded text-sky-600 focus:ring-sky-500"
            />
            <span>{isRtl ? 'تعيين كمستودع افتراضي للعمليات' : 'Set as primary default warehouse'}</span>
          </label>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" onClick={() => setIsWarehouseModalOpen(false)}>
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="primary" type="submit" loading={submittingWarehouse}>
              {isRtl ? 'حفظ المستودع' : 'Save Warehouse'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Invite Member Modal */}
      <Modal
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        title={isRtl ? 'إضافة وتعيين موظف جديد' : 'Invite Staff Member'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveMember} className="space-y-3.5">
          <Input
            label={isRtl ? 'اسم الموظف' : 'Staff Name'}
            required
            value={memberForm.name}
            onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
            placeholder={isRtl ? 'سعد الغامدي' : 'Saad Al-Ghamdi'}
          />

          <Input
            label={isRtl ? 'البريد الإلكتروني' : 'Email Address'}
            type="email"
            required
            value={memberForm.email}
            onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
            placeholder="saad@company.com"
          />

          <Input
            label={isRtl ? 'كلمة المرور الأولية' : 'Initial Password'}
            type="password"
            required
            value={memberForm.initialPassword}
            onChange={(e) => setMemberForm({ ...memberForm, initialPassword: e.target.value })}
            placeholder="••••••••"
          />

          <Select
            label={isRtl ? 'الدور والصلاحيات الوظيفية' : 'Role & Permissions'}
            value={memberForm.roleName}
            onChange={(e) => setMemberForm({ ...memberForm, roleName: e.target.value })}
          >
            {SYSTEM_ROLES.map((r) => (
              <option key={r.key} value={r.key}>
                {isRtl ? r.nameAr : r.nameEn}
              </option>
            ))}
          </Select>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" onClick={() => setIsMemberModalOpen(false)}>
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="primary" type="submit" loading={submittingMember}>
              {isRtl ? 'إضافة الموظف' : 'Invite Member'}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
