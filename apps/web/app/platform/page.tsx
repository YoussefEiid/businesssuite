'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '../../src/components/layout/DashboardLayout';
import { ApiService } from '../../src/services/api';
import { FEATURE_CATALOG } from '@business-suite/shared';
import { SUPPORTED_CURRENCIES, formatMoney, getCurrencySymbol } from '../../src/utils/currency';
import { useLanguage } from '../../src/hooks/use-language';
import { useAuth } from '../../src/hooks/use-auth';
import { useToast } from '../../src/hooks/use-toast';
import { useConfirm } from '../../src/hooks/use-confirm';
import { DataTable, Column } from '../../src/components/ui/DataTable';
import { Modal } from '../../src/components/ui/Modal';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Select } from '../../src/components/ui/Select';
import { Badge } from '../../src/components/ui/Badge';
import { StatCard } from '../../src/components/ui/StatCard';
import {
  ShieldAlert,
  Building2,
  Layers,
  History,
  Plus,
  RefreshCw,
  Copy,
  Archive,
  Calendar,
  Users,
  Activity,
  Sliders,
  DollarSign,
  Ban,
  CheckCircle2,
} from 'lucide-react';

export default function PlatformPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { isRtl } = useLanguage();
  const toast = useToast();
  const { confirm } = useConfirm();

  const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'plans' | 'audit'>('overview');
  const [overview, setOverview] = useState<any | null>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchivedPlans, setShowArchivedPlans] = useState(false);

  // Modals
  const [isAddTenantOpen, setIsAddTenantOpen] = useState(false);
  const [isClonePlanOpen, setIsClonePlanOpen] = useState(false);
  const [planToClone, setPlanToClone] = useState<any | null>(null);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [planFeatures, setPlanFeatures] = useState<string[]>([]);
  const [savingPlan, setSavingPlan] = useState(false);

  // Tenant Details & Renewal
  const [selectedTenantDetails, setSelectedTenantDetails] = useState<any | null>(null);
  const [renewTenant, setRenewTenant] = useState<any | null>(null);
  const [overrideTenant, setOverrideTenant] = useState<any | null>(null);

  // New Tenant Form
  const [newTenant, setNewTenant] = useState({
    companyName: '',
    slug: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
    phone: '',
    planId: '',
    subscriptionStatus: 'ACTIVE',
    durationDays: 365,
    currencyCode: 'EGP',
    notes: '',
  });
  const [creatingTenant, setCreatingTenant] = useState(false);

  // Clone Plan Form
  const [cloneData, setCloneData] = useState({
    newCode: '',
    newNameAr: '',
    newNameEn: '',
    priceMonthly: 0,
    priceYearly: 0,
  });
  const [cloningPlan, setCloningPlan] = useState(false);

  // Renew Form
  const [renewData, setRenewData] = useState({
    planId: '',
    status: 'ACTIVE',
    extensionOption: '365',
    customEndDate: '',
    paymentAmount: 0,
    paymentMethod: 'MANUAL_BANK_TRANSFER',
    notes: '',
  });
  const [submittingRenewal, setSubmittingRenewal] = useState(false);

  // Feature Override Form
  const [selectedFeatureOverride, setSelectedFeatureOverride] = useState('');
  const [overrideEffect, setOverrideEffect] = useState<'ALLOW' | 'DENY'>('ALLOW');
  const [overrideReason, setOverrideReason] = useState('');

  const handleTabSelect = (tab: 'overview' | 'tenants' | 'plans' | 'audit') => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.pushState({}, '', url.toString());
    }
  };

  const loadData = async () => {
    if (!authLoading && user && !user.isSuperAdmin) {
      router.replace('/dashboard');
      return;
    }

    setLoading(true);
    try {
      const [ov, tens, pls, logs] = await Promise.all([
        ApiService.getPlatformOverview().catch(() => null),
        ApiService.listPlatformTenants().catch(() => []),
        ApiService.listPlatformPlans(showArchivedPlans).catch(() => []),
        ApiService.listAuditLogs(50).catch(() => []),
      ]);
      setOverview(ov);
      setTenants(tens || []);
      setPlans(pls || []);
      setAuditLogs(logs || []);

      if (pls && pls.length > 0 && !newTenant.planId) {
        setNewTenant((prev) => ({ ...prev, planId: pls[0].id }));
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load platform data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace('/login');
        return;
      }
      if (!user.isSuperAdmin) {
        router.replace('/dashboard');
        return;
      }
      loadData();
    }
  }, [authLoading, user, showArchivedPlans]);

  useEffect(() => {
    const syncTab = () => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab === 'overview' || tab === 'tenants' || tab === 'plans' || tab === 'audit') {
          setActiveTab(tab);
        }
      }
    };
    syncTab();

    const handleSwitchEvent = (e: any) => {
      if (e.detail && ['overview', 'tenants', 'plans', 'audit'].includes(e.detail)) {
        setActiveTab(e.detail);
      }
    };

    window.addEventListener('popstate', syncTab);
    window.addEventListener('bs:switch_platform_tab', handleSwitchEvent);
    return () => {
      window.removeEventListener('popstate', syncTab);
      window.removeEventListener('bs:switch_platform_tab', handleSwitchEvent);
    };
  }, []);

  // Handlers
  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenant.companyName || !newTenant.ownerEmail) return;

    setCreatingTenant(true);
    try {
      await ApiService.createPlatformTenant({
        ...newTenant,
        durationDays: Number(newTenant.durationDays),
      });
      toast.success(isRtl ? 'تم إنشاء المنشأة والاشتراك بنجاح' : 'Tenant organization provisioned successfully');
      setIsAddTenantOpen(false);
      setNewTenant({
        companyName: '',
        slug: '',
        ownerName: '',
        ownerEmail: '',
        ownerPassword: '',
        phone: '',
        planId: plans[0]?.id || '',
        subscriptionStatus: 'ACTIVE',
        durationDays: 365,
        currencyCode: 'EGP',
        notes: '',
      });
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to provision tenant');
    } finally {
      setCreatingTenant(false);
    }
  };

  const handleToggleTenantStatus = async (tenant: any) => {
    const isSuspending = tenant.status === 'ACTIVE';
    const ok = await confirm({
      title: isRtl ? (isSuspending ? 'تعطيل المنشأة' : 'تفعيل المنشأة') : isSuspending ? 'Suspend Organization' : 'Activate Organization',
      message: isRtl
        ? `هل تريد ${isSuspending ? 'تعطيل' : 'تفعيل'} المنشأة "${tenant.name}"؟`
        : `Are you sure you want to ${isSuspending ? 'suspend' : 'activate'} "${tenant.name}"?`,
      isDestructive: isSuspending,
    });
    if (!ok) return;

    try {
      await ApiService.updateTenantStatus(tenant.id, isSuspending ? 'SUSPENDED' : 'ACTIVE', 'Platform Owner Action');
      toast.success(isRtl ? 'تم تحديث حالة المنشأة بنجاح' : 'Tenant status updated');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update tenant status');
    }
  };

  const handleClonePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planToClone || !cloneData.newCode) return;

    setCloningPlan(true);
    try {
      await ApiService.clonePlan(planToClone.id, {
        code: cloneData.newCode.trim().toUpperCase(),
        nameAr: cloneData.newNameAr.trim() || cloneData.newCode,
        nameEn: cloneData.newNameEn.trim() || cloneData.newCode,
        priceMonthly: Number(cloneData.priceMonthly),
        priceYearly: Number(cloneData.priceYearly),
      });
      toast.success(isRtl ? 'تم استنساخ الباقة بنجاح' : 'Plan cloned successfully');
      setIsClonePlanOpen(false);
      setPlanToClone(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to clone plan');
    } finally {
      setCloningPlan(false);
    }
  };

  const handleToggleArchivePlan = async (plan: any) => {
    try {
      await ApiService.toggleArchivePlan(plan.id);
      toast.success(isRtl ? 'تم تغيير حالة أرشفة الباقة' : 'Plan archive state toggled');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle archive');
    }
  };

  const handleRenewSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewTenant) return;

    setSubmittingRenewal(true);
    try {
      await ApiService.manageTenantSubscription(renewTenant.id, {
        planId: renewData.planId || renewTenant.subscription?.planId || plans[0]?.id,
        status: renewData.status,
        extensionDays: renewData.extensionOption !== 'custom' ? Number(renewData.extensionOption) : undefined,
        customEndDate: renewData.extensionOption === 'custom' && renewData.customEndDate ? new Date(renewData.customEndDate).toISOString() : undefined,
        paymentAmount: Number(renewData.paymentAmount),
        paymentMethod: renewData.paymentMethod,
        notes: renewData.notes || undefined,
      });
      toast.success(isRtl ? 'تم تجديد الاشتراك وتسجيل الحركة بنجاح' : 'Subscription renewed successfully');
      setRenewTenant(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to renew subscription');
    } finally {
      setSubmittingRenewal(false);
    }
  };

  const handleSaveFeatureOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideTenant || !selectedFeatureOverride) return;

    try {
      await ApiService.setTenantFeatureOverride(overrideTenant.id, {
        featureKey: selectedFeatureOverride,
        effect: overrideEffect,
        reason: overrideReason || undefined,
      });
      toast.success(isRtl ? 'تم تطبيق الاستثناء البرمجي للمنشأة فوراً' : 'Feature override committed');
      setOverrideTenant(null);
      setSelectedFeatureOverride('');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to commit override');
    }
  };

  // Columns for Tenants
  const tenantColumns: Column<any>[] = [
    {
      key: 'name',
      header: isRtl ? 'اسم المنشأة' : 'Company Name',
      sortable: true,
      render: (r) => (
        <div>
          <p className="font-bold text-slate-800 dark:text-slate-100">{r.name}</p>
          <span className="text-2xs font-mono text-slate-400">{r.slug}</span>
        </div>
      ),
    },
    {
      key: 'plan',
      header: isRtl ? 'الباقة الحالية' : 'Plan',
      render: (r) => (
        <span className="font-semibold text-sky-600 dark:text-sky-400">
          {isRtl ? r.subscription?.plan?.nameAr || r.subscription?.plan?.code : r.subscription?.plan?.nameEn || r.subscription?.plan?.code || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: isRtl ? 'حالة المنشأة' : 'Status',
      render: (r) => (
        <Badge variant={r.status === 'ACTIVE' ? 'success' : 'danger'} size="sm">
          {r.status === 'ACTIVE' ? (isRtl ? 'نشط' : 'Active') : isRtl ? 'معطل' : 'Suspended'}
        </Badge>
      ),
    },
    {
      key: 'subscriptionEnd',
      header: isRtl ? 'تاريخ انتهاء الاشتراك' : 'Subscription Expiry',
      render: (r) => (
        <span className="font-mono text-slate-500">
          {r.subscription?.endDate ? new Date(r.subscription.endDate).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US') : '—'}
        </span>
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
            variant="outline"
            className="text-2xs h-7"
            onClick={() => {
              setRenewTenant(r);
              setRenewData({
                planId: r.subscription?.planId || plans[0]?.id || '',
                status: 'ACTIVE',
                extensionOption: '365',
                customEndDate: '',
                paymentAmount: 0,
                paymentMethod: 'MANUAL_BANK_TRANSFER',
                notes: '',
              });
            }}
          >
            {isRtl ? 'تجديد / تمديد' : 'Renew'}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setOverrideTenant(r)}
            title={isRtl ? 'استثناء ميزات خاصة' : 'Feature Override'}
            icon={<Sliders className="w-3.5 h-3.5 text-amber-500" />}
          />

          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleToggleTenantStatus(r)}
            title={r.status === 'ACTIVE' ? (isRtl ? 'تعطيل' : 'Suspend') : isRtl ? 'تفعيل' : 'Activate'}
            icon={<Ban className={`w-3.5 h-3.5 ${r.status === 'ACTIVE' ? 'text-rose-500' : 'text-emerald-500'}`} />}
          />
        </div>
      ),
    },
  ];

  // Columns for Plans
  const planColumns: Column<any>[] = [
    {
      key: 'code',
      header: isRtl ? 'كود الباقة' : 'Plan Code',
      sortable: true,
      render: (r) => <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{r.code}</span>,
    },
    {
      key: 'name',
      header: isRtl ? 'اسم الباقة' : 'Plan Name',
      render: (r) => (
        <div>
          <p className="font-bold text-slate-800 dark:text-slate-100">{isRtl ? r.nameAr : r.nameEn || r.nameAr}</p>
          <span className="text-2xs text-slate-400 font-mono">v{r.version}</span>
        </div>
      ),
    },
    {
      key: 'priceYearly',
      header: isRtl ? 'السعر السنوي' : 'Yearly Price',
      align: 'end',
      sortable: true,
      render: (r) => (
        <span className="font-mono font-bold tabular-nums">
          {formatMoney(r.priceYearly || 0, (r.currency as any) || 'USD', isRtl)}
        </span>
      ),
    },
    {
      key: 'status',
      header: isRtl ? 'الحالة' : 'Status',
      render: (r) => (
        <Badge variant={!r.isArchived ? 'success' : 'neutral'} size="sm">
          {!r.isArchived ? (isRtl ? 'نشطة للترقية' : 'Active') : isRtl ? 'مؤرشفة' : 'Archived'}
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
            onClick={() => {
              setPlanToClone(r);
              setCloneData({
                newCode: `${r.code}-V2`,
                newNameAr: `${r.nameAr} (محدث)`,
                newNameEn: `${r.nameEn || r.code} V2`,
                priceMonthly: Number(r.priceMonthly || 0),
                priceYearly: Number(r.priceYearly || 0),
              });
              setIsClonePlanOpen(true);
            }}
            title={isRtl ? 'استنساخ باقة' : 'Clone Plan'}
            icon={<Copy className="w-3.5 h-3.5 text-sky-600" />}
          />

          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleToggleArchivePlan(r)}
            title={!r.isArchived ? (isRtl ? 'أرشفة الباقة' : 'Archive Plan') : isRtl ? 'إلغاء الأرشفة' : 'Unarchive'}
            icon={<Archive className="w-3.5 h-3.5 text-slate-400" />}
          />
        </div>
      ),
    },
  ];

  // Columns for Audit Logs
  const auditColumns: Column<any>[] = [
    {
      key: 'createdAt',
      header: isRtl ? 'الوقت والتاريخ' : 'Timestamp',
      sortable: true,
      render: (r) => (
        <span className="font-mono text-slate-500 text-2xs">
          {new Date(r.createdAt).toLocaleString(isRtl ? 'ar-SA' : 'en-US')}
        </span>
      ),
    },
    {
      key: 'action',
      header: isRtl ? 'العملية' : 'Action',
      render: (r) => <Badge variant="neutral" size="sm">{r.action}</Badge>,
    },
    {
      key: 'actor',
      header: isRtl ? 'المنفذ' : 'Actor',
      render: (r) => <span className="font-mono text-slate-600 dark:text-slate-300">{r.user?.name || r.user?.email || 'System'}</span>,
    },
    {
      key: 'entityType',
      header: isRtl ? 'الكيان' : 'Entity',
      render: (r) => <span>{r.entityType} ({r.entityId?.slice(0, 8)})</span>,
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-amber-500" />
              <span>{isRtl ? 'لوحة مالك المنصة (Platform Owner)' : 'Platform Owner Admin'}</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isRtl
                ? 'إدارة المنشآت المشتركة، باقات الأسعار والإمكانيات، تجديد الاشتراكات، وسجلات التدقيق'
                : 'Manage tenant SaaS organizations, subscription plans, quotas and system audit trail'}
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddTenantOpen(true)}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            {isRtl ? 'إضافة منشأة تجارية جديدة' : 'Provision Organization'}
          </Button>
        </div>

        {/* Tab Selector Ribbon */}
        <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => handleTabSelect('overview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{isRtl ? 'نظرة عامة على المنصة' : 'Platform Overview'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSelect('tenants')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'tenants'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>{isRtl ? 'المنشآت المشتركة' : 'Tenants'} ({tenants.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSelect('plans')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'plans'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isRtl ? 'باقات الاشتراك' : 'Subscription Plans'} ({plans.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSelect('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'audit'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>{isRtl ? 'سجل العمليات والتدقيق' : 'Audit Logs'}</span>
          </button>
        </div>

        {/* Tab 1: Overview KPIs */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                title={isRtl ? 'إجمالي المنشآت المسجلة' : 'Total Tenants'}
                value={overview?.totalTenants || tenants.length}
                icon={<Building2 className="w-5 h-5" />}
                iconBg="bg-sky-50 dark:bg-sky-950/60"
                iconColor="text-sky-600"
              />
              <StatCard
                title={isRtl ? 'الاشتراكات النشطة' : 'Active Subscriptions'}
                value={overview?.activeTenants || tenants.filter((t) => t.status === 'ACTIVE').length}
                icon={<CheckCircle2 className="w-5 h-5" />}
                iconBg="bg-emerald-50 dark:bg-emerald-950/60"
                iconColor="text-emerald-600"
              />
              <StatCard
                title={isRtl ? 'إجمالي المستخدمين' : 'Total System Users'}
                value={overview?.totalUsers || '—'}
                icon={<Users className="w-5 h-5" />}
                iconBg="bg-indigo-50 dark:bg-indigo-950/60"
                iconColor="text-indigo-600"
              />
              <StatCard
                title={isRtl ? 'باقات الاشتراك المتاحة' : 'Active Plan Models'}
                value={plans.length}
                icon={<Layers className="w-5 h-5" />}
                iconBg="bg-amber-50 dark:bg-amber-950/60"
                iconColor="text-amber-600"
              />
            </div>
          </div>
        )}

        {/* Tab 2: Tenants Table */}
        {activeTab === 'tenants' && (
          <DataTable
            columns={tenantColumns}
            data={tenants}
            keyExtractor={(r) => r.id}
            loading={loading}
            emptyTitle={isRtl ? 'لا توجد منشآت مسجلة' : 'No tenants found'}
          />
        )}

        {/* Tab 3: Plans Table */}
        {activeTab === 'plans' && (
          <DataTable
            columns={planColumns}
            data={plans}
            keyExtractor={(r) => r.id}
            loading={loading}
            emptyTitle={isRtl ? 'لا توجد باقات اشتراك' : 'No plans found'}
          />
        )}

        {/* Tab 4: Audit Logs Table */}
        {activeTab === 'audit' && (
          <DataTable
            columns={auditColumns}
            data={auditLogs}
            keyExtractor={(r) => r.id}
            loading={loading}
            emptyTitle={isRtl ? 'لا توجد سجلات تدقيق' : 'No audit records'}
          />
        )}
      </div>

      {/* Provision Tenant Modal */}
      <Modal
        isOpen={isAddTenantOpen}
        onClose={() => setIsAddTenantOpen(false)}
        title={isRtl ? 'إنشاء منشأة تجارية جديدة واشتراك' : 'Provision New Tenant'}
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateTenant} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={isRtl ? 'اسم المنشأة' : 'Company Name'}
              required
              value={newTenant.companyName}
              onChange={(e) => {
                const name = e.target.value;
                setNewTenant({
                  ...newTenant,
                  companyName: name,
                  slug: newTenant.slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20),
                });
              }}
            />

            <Input
              label={isRtl ? 'المعرف الفريد (Slug)' : 'Unique Slug'}
              required
              value={newTenant.slug}
              onChange={(e) => setNewTenant({ ...newTenant, slug: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label={isRtl ? 'اسم المالك' : 'Owner Name'}
              required
              value={newTenant.ownerName}
              onChange={(e) => setNewTenant({ ...newTenant, ownerName: e.target.value })}
            />

            <Input
              label={isRtl ? 'البريد الإلكتروني' : 'Owner Email'}
              type="email"
              required
              value={newTenant.ownerEmail}
              onChange={(e) => setNewTenant({ ...newTenant, ownerEmail: e.target.value })}
            />

            <Input
              label={isRtl ? 'كلمة المرور الأولية' : 'Initial Password'}
              type="password"
              required
              value={newTenant.ownerPassword}
              onChange={(e) => setNewTenant({ ...newTenant, ownerPassword: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label={isRtl ? 'باقة الاشتراك الأولية' : 'Subscription Plan'}
              required
              value={newTenant.planId}
              onChange={(e) => setNewTenant({ ...newTenant, planId: e.target.value })}
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {isRtl ? p.nameAr : p.nameEn || p.code} ({p.code})
                </option>
              ))}
            </Select>

            <Select
              label={isRtl ? 'العملة الأساسية' : 'Base Currency'}
              value={newTenant.currencyCode}
              onChange={(e) => setNewTenant({ ...newTenant, currencyCode: e.target.value })}
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {isRtl ? c.nameAr : c.nameEn}
                </option>
              ))}
            </Select>

            <Input
              label={isRtl ? 'مدة الاشتراك (أيام)' : 'Duration (Days)'}
              type="number"
              value={newTenant.durationDays}
              onChange={(e) => setNewTenant({ ...newTenant, durationDays: Number(e.target.value) })}
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" onClick={() => setIsAddTenantOpen(false)}>
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="primary" type="submit" loading={creatingTenant}>
              {isRtl ? 'إنشاء المنشأة' : 'Provision'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Renew Subscription Modal */}
      {renewTenant && (
        <Modal
          isOpen={!!renewTenant}
          onClose={() => setRenewTenant(null)}
          title={isRtl ? `تجديد اشتراك: ${renewTenant.name}` : `Renew Subscription: ${renewTenant.name}`}
          maxWidth="md"
        >
          <form onSubmit={handleRenewSubscription} className="space-y-3.5">
            <Select
              label={isRtl ? 'الباقة' : 'Plan'}
              value={renewData.planId}
              onChange={(e) => setRenewData({ ...renewData, planId: e.target.value })}
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {isRtl ? p.nameAr : p.nameEn || p.code}
                </option>
              ))}
            </Select>

            <Select
              label={isRtl ? 'مدة التمديد' : 'Extension'}
              value={renewData.extensionOption}
              onChange={(e) => setRenewData({ ...renewData, extensionOption: e.target.value })}
            >
              <option value="30">{isRtl ? '30 يوماً (شهر)' : '30 Days'}</option>
              <option value="90">{isRtl ? '90 يوماً (ربع سنوي)' : '90 Days'}</option>
              <option value="365">{isRtl ? '365 يوماً (سنة كاملة)' : '365 Days'}</option>
            </Select>

            <Input
              label={
                isRtl
                  ? `المبلغ المستلم (${getCurrencySymbol((renewTenant?.currencyCode as any) || 'EGP', isRtl)})`
                  : `Payment Received (${getCurrencySymbol((renewTenant?.currencyCode as any) || 'EGP', isRtl)})`
              }
              type="number"
              value={renewData.paymentAmount}
              onChange={(e) => setRenewData({ ...renewData, paymentAmount: Number(e.target.value) })}
            />

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button variant="outline" onClick={() => setRenewTenant(null)}>
                {isRtl ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button variant="primary" type="submit" loading={submittingRenewal}>
                {isRtl ? 'تأكيد التجديد' : 'Commit Renewal'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Feature Override Modal */}
      {overrideTenant && (
        <Modal
          isOpen={!!overrideTenant}
          onClose={() => setOverrideTenant(null)}
          title={isRtl ? `استثناء ميزات: ${overrideTenant.name}` : `Feature Override`}
          maxWidth="md"
        >
          <form onSubmit={handleSaveFeatureOverride} className="space-y-3.5">
            <Select
              label={isRtl ? 'الميزة البرمجية' : 'Feature'}
              required
              value={selectedFeatureOverride}
              onChange={(e) => setSelectedFeatureOverride(e.target.value)}
            >
              <option value="">{isRtl ? 'اختر ميزة...' : 'Select feature...'}</option>
              {Object.values(FEATURE_CATALOG).map((f) => (
                <option key={f.key} value={f.key}>
                  {isRtl ? f.nameAr : f.nameEn} ({f.key})
                </option>
              ))}
            </Select>

            <Select
              label={isRtl ? 'نوع الاستثناء' : 'Override Effect'}
              value={overrideEffect}
              onChange={(e) => setOverrideEffect(e.target.value as any)}
            >
              <option value="ALLOW">{isRtl ? 'منح وتفعيل الميزة (ALLOW)' : 'Allow Feature'}</option>
              <option value="DENY">{isRtl ? 'حظر الميزة ومنعها (DENY)' : 'Deny Feature'}</option>
            </Select>

            <Input
              label={isRtl ? 'سبب الاستثناء' : 'Reason'}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder={isRtl ? 'موافقة خاصة من الإدارة' : 'Special agreement'}
            />

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button variant="outline" onClick={() => setOverrideTenant(null)}>
                {isRtl ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button variant="primary" type="submit">
                {isRtl ? 'حفظ الاستثناء' : 'Apply Override'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Clone Plan Modal */}
      {isClonePlanOpen && (
        <Modal
          isOpen={isClonePlanOpen}
          onClose={() => setIsClonePlanOpen(false)}
          title={isRtl ? `استنساخ الباقة: ${planToClone?.nameAr || planToClone?.code}` : `Clone Plan`}
          maxWidth="md"
        >
          <form onSubmit={handleClonePlan} className="space-y-3.5">
            <Input
              label={isRtl ? 'كود الباقة الجديد' : 'New Plan Code'}
              required
              value={cloneData.newCode}
              onChange={(e) => setCloneData({ ...cloneData, newCode: e.target.value })}
            />

            <Input
              label={isRtl ? 'الاسم بالعربية' : 'Arabic Name'}
              required
              value={cloneData.newNameAr}
              onChange={(e) => setCloneData({ ...cloneData, newNameAr: e.target.value })}
            />

            <Input
              label={isRtl ? 'الاسم بالإنجليزية' : 'English Name'}
              value={cloneData.newNameEn}
              onChange={(e) => setCloneData({ ...cloneData, newNameEn: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-2.5">
              <Input
                label={isRtl ? 'السعر الشهري' : 'Monthly Price'}
                type="number"
                value={cloneData.priceMonthly}
                onChange={(e) => setCloneData({ ...cloneData, priceMonthly: Number(e.target.value) })}
              />

              <Input
                label={isRtl ? 'السعر السنوي' : 'Yearly Price'}
                type="number"
                value={cloneData.priceYearly}
                onChange={(e) => setCloneData({ ...cloneData, priceYearly: Number(e.target.value) })}
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button variant="outline" onClick={() => setIsClonePlanOpen(false)}>
                {isRtl ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button variant="primary" type="submit" loading={cloningPlan}>
                {isRtl ? 'استنساخ وإنشاء' : 'Clone Plan'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </DashboardLayout>
  );
}
