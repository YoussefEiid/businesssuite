'use client';

import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../../src/components/layout/DashboardLayout';
import { ApiService } from '../../src/services/api';
import { DashboardSummary } from '../../src/types';
import { useLanguage } from '../../src/hooks/use-language';
import { useToast } from '../../src/hooks/use-toast';
import { useCompany } from '../../src/hooks/use-company';
import { StatCard } from '../../src/components/ui/StatCard';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Badge';
import {
  TrendingUp,
  ShoppingCart,
  ShoppingBag,
  Users,
  Wallet,
  Package,
  AlertTriangle,
  RefreshCw,
  Plus,
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  FileText,
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { isRtl } = useLanguage();
  const toast = useToast();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sumData, lowStock] = await Promise.all([
        ApiService.getDashboardSummary(),
        ApiService.getLowStockItems().catch(() => []),
      ]);
      setSummary(sumData);
      setLowStockItems(lowStock || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatNumber = (num: number | string | null | undefined) => {
    if (num === undefined || num === null) return '0.00';
    return Number(num).toLocaleString(isRtl ? 'ar-SA' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const { currencySymbol } = useCompany();
  const currencyLabel = currencySymbol;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {isRtl ? 'مؤشرات الأداء التشغيلية' : 'Executive Operations Dashboard'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isRtl
                ? 'نظرة شاملة ومباشرة على المبيعات، المشتريات، المخزون، والسيولة النقدية'
                : 'Comprehensive real-time overview of revenue, inventory, receivables and liquidity'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={loading}
              onClick={loadData}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              {isRtl ? 'تحديث البيانات' : 'Refresh Metrics'}
            </Button>

            <Link href="/dashboard/pos">
              <Button
                variant="primary"
                size="sm"
                icon={<ShoppingCart className="w-3.5 h-3.5" />}
              >
                {isRtl ? 'شاشة الكاشير (POS)' : 'Open POS'}
              </Button>
            </Link>
          </div>
        </div>

        {/* Primary Operational KPIs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title={isRtl ? 'مبيعات الشهر الحالي' : 'Monthly Sales Revenue'}
            value={formatNumber(summary?.monthlySalesTotal)}
            unit={currencyLabel}
            subtext={
              isRtl
                ? `${summary?.monthlySalesCount || 0} فاتورة مبيعات معتمدة`
                : `${summary?.monthlySalesCount || 0} posted invoices`
            }
            icon={<ShoppingCart className="w-5 h-5" />}
            iconBg="bg-sky-50 dark:bg-sky-950/60"
            iconColor="text-sky-600 dark:text-sky-400"
            loading={loading}
          />

          <StatCard
            title={isRtl ? 'مشتريات الشهر الحالي' : 'Monthly Purchases Total'}
            value={formatNumber(summary?.monthlyPurchasesTotal)}
            unit={currencyLabel}
            subtext={isRtl ? 'إجمالي فواتير التوريد المعتمدة' : 'Committed vendor bills'}
            icon={<ShoppingBag className="w-5 h-5" />}
            iconBg="bg-indigo-50 dark:bg-indigo-950/60"
            iconColor="text-indigo-600 dark:text-indigo-400"
            loading={loading}
          />

          <StatCard
            title={isRtl ? 'مديونيات العملاء المستحقة' : 'Outstanding Receivables'}
            value={formatNumber(summary?.totalReceivables)}
            unit={currencyLabel}
            subtext={isRtl ? 'مستحقات واجبة التحصيل' : 'Due customer balances'}
            icon={<Users className="w-5 h-5" />}
            iconBg="bg-amber-50 dark:bg-amber-950/60"
            iconColor="text-amber-600 dark:text-amber-400"
            loading={loading}
          />

          <StatCard
            title={isRtl ? 'رصيد الخزائن والبنوك' : 'Treasury & Bank Liquidity'}
            value={formatNumber(summary?.treasuryBalance)}
            unit={currencyLabel}
            subtext={isRtl ? 'السيولة النقدية المتاحة' : 'Total liquid cash balance'}
            icon={<Wallet className="w-5 h-5" />}
            iconBg="bg-emerald-50 dark:bg-emerald-950/60"
            iconColor="text-emerald-600 dark:text-emerald-400"
            loading={loading}
          />
        </div>

        {/* Secondary Detailed Cards: Profit & Valuation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Gross Margin */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-900 dark:to-slate-950 p-5 rounded-xl border border-slate-700/80 text-white shadow-card flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
                  {isRtl ? 'مجمل الربح التشغيلي (الشهر الحالي)' : 'Monthly Gross Operating Margin'}
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold mt-1.5 tabular-nums text-white">
                  {formatNumber(summary?.monthlyGrossProfit)} <span className="text-sm font-normal text-slate-300">{currencyLabel}</span>
                </h3>
              </div>
              <div className="p-2.5 rounded-xl bg-white/10 text-sky-300">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
            <p className="text-2xs text-slate-400 mt-4 leading-relaxed">
              {isRtl
                ? 'محسوب بدقة وفق متوسط التكلفة المرجح (WAC) المسجل وقت ترحيل كل فاتورة مبيعات'
                : 'Calculated using Moving Weighted Average Cost (WAC) snapshot at sales invoice posting'}
            </p>
          </div>

          {/* Stock Valuation */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-card flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {isRtl ? 'تقييم المخزون الحالي (WAC)' : 'Current Inventory Valuation'}
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold mt-1.5 tabular-nums text-slate-900 dark:text-slate-100">
                  {formatNumber(summary?.inventoryValuation)} <span className="text-sm font-normal text-slate-500">{currencyLabel}</span>
                </h3>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <Package className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-2xs text-slate-500 dark:text-slate-400">
                {isRtl ? 'إجمالي قيمة البضاعة المتاحة في كافة المستودعات' : 'Total valuation across all company warehouses'}
              </span>
              <Link
                href="/dashboard/inventory"
                className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1"
              >
                <span>{isRtl ? 'إدارة المستودعات' : 'View Warehouses'}</span>
                {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
              </Link>
            </div>
          </div>
        </div>

        {/* Low Stock Warnings Block */}
        {lowStockItems.length > 0 && (
          <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h4 className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200">
                  {isRtl
                    ? `تنبيهات نقص المخزون (${lowStockItems.length} أصناف وصلت أو تجاوزت حد إعادة الطلب)`
                    : `Low Stock Alerts (${lowStockItems.length} items reached reorder threshold)`}
                </h4>
              </div>
              <Link href="/dashboard/purchases">
                <Button variant="outline" size="sm" className="bg-white dark:bg-slate-900 text-xs">
                  {isRtl ? 'إنشاء أمر شراء' : 'Create Purchase Order'}
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {lowStockItems.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-amber-200/80 dark:border-amber-800/40 shadow-2xs flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {isRtl ? item.nameAr || item.name : item.name}
                    </p>
                    <span className="text-[10px] text-slate-400 font-mono">{item.code}</span>
                  </div>
                  <Badge variant="warning" size="sm">
                    {isRtl ? `الرصيد: ${item.totalStock}` : `Stock: ${item.totalStock}`}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Action Dock */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3 uppercase tracking-wider">
            {isRtl ? 'الوصول السريع للعمليات المتكررة' : 'Quick Operations Navigation'}
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link
              href="/dashboard/sales"
              className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-sky-50/40 dark:hover:bg-sky-950/30 transition flex flex-col items-center text-center gap-1.5 group"
            >
              <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 group-hover:scale-105 transition">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {isRtl ? 'فاتورة مبيعات جديدة' : 'New Sales Invoice'}
              </span>
            </Link>

            <Link
              href="/dashboard/purchases"
              className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 transition flex flex-col items-center text-center gap-1.5 group"
            >
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {isRtl ? 'فاتورة شراء / توريد' : 'New Purchase Bill'}
              </span>
            </Link>

            <Link
              href="/dashboard/treasury"
              className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30 transition flex flex-col items-center text-center gap-1.5 group"
            >
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition">
                <Wallet className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {isRtl ? 'سند قبض أو صرف' : 'Receipt / Payment'}
              </span>
            </Link>

            <Link
              href="/dashboard/reports"
              className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-amber-50/40 dark:hover:bg-amber-950/30 transition flex flex-col items-center text-center gap-1.5 group"
            >
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {isRtl ? 'التقارير التحليلية' : 'Financial Reports'}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
