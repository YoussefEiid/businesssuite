'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../src/components/layout/DashboardLayout';
import { ApiService } from '../../../src/services/api';
import { useEntitlements } from '../../../src/hooks/use-entitlements';
import { useLanguage } from '../../../src/hooks/use-language';
import { useCompany } from '../../../src/hooks/use-company';
import { useToast } from '../../../src/hooks/use-toast';
import { DataTable, Column } from '../../../src/components/ui/DataTable';
import { Button } from '../../../src/components/ui/Button';
import { Badge } from '../../../src/components/ui/Badge';
import { Skeleton } from '../../../src/components/ui/Skeleton';
import {
  BarChart3,
  Package,
  Users,
  ShoppingBag,
  Download,
  Printer,
  Calendar,
  Lock,
  RefreshCw,
  TrendingUp,
  DollarSign,
  Building2,
} from 'lucide-react';

type DatePreset = 'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'THIS_QUARTER' | 'THIS_YEAR' | 'CUSTOM';

export default function ReportsPage() {
  const { hasFeature } = useEntitlements();
  const { isRtl } = useLanguage();
  const { formatMoney } = useCompany();
  const toast = useToast();

  const [activeReport, setActiveReport] = useState<'sales' | 'stock' | 'receivables' | 'payables'>('sales');
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyProfile, setCompanyProfile] = useState<any | null>(null);

  // Date Range Filters
  const [datePreset, setDatePreset] = useState<DatePreset>('THIS_MONTH');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const applyDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();

    if (preset === 'ALL') {
      setFromDate('');
      setToDate('');
      return;
    }

    if (preset === 'TODAY') {
      const todayStr = now.toISOString().slice(0, 10);
      setFromDate(todayStr);
      setToDate(todayStr);
      return;
    }

    if (preset === 'THIS_WEEK') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(now.setDate(diff));
      setFromDate(startOfWeek.toISOString().slice(0, 10));
      setToDate(new Date().toISOString().slice(0, 10));
      return;
    }

    if (preset === 'THIS_MONTH') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setFromDate(startOfMonth.toISOString().slice(0, 10));
      setToDate(endOfMonth.toISOString().slice(0, 10));
      return;
    }

    if (preset === 'THIS_QUARTER') {
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      const startOfQuarter = new Date(now.getFullYear(), quarterMonth, 1);
      const endOfQuarter = new Date(now.getFullYear(), quarterMonth + 3, 0);
      setFromDate(startOfQuarter.toISOString().slice(0, 10));
      setToDate(endOfQuarter.toISOString().slice(0, 10));
      return;
    }

    if (preset === 'THIS_YEAR') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const endOfYear = new Date(now.getFullYear(), 11, 31);
      setFromDate(startOfYear.toISOString().slice(0, 10));
      setToDate(endOfYear.toISOString().slice(0, 10));
      return;
    }
  };

  useEffect(() => {
    applyDatePreset('THIS_MONTH');
    ApiService.getCompanyProfile().then(setCompanyProfile).catch(() => {});
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      let res;
      if (activeReport === 'sales') {
        res = await ApiService.getSalesReport(fromDate || undefined, toDate || undefined);
      } else if (activeReport === 'stock') {
        res = await ApiService.getStockValuation();
      } else if (activeReport === 'receivables') {
        res = await ApiService.getCustomerReceivables();
      } else if (activeReport === 'payables') {
        res = await ApiService.getSupplierPayables();
      }
      setData(res);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [activeReport, fromDate, toDate]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!data) return;
    let csvRows: string[] = [];

    if (activeReport === 'sales') {
      csvRows.push('Invoice Number,Party,Date,Grand Total,Gross Margin,Status');
      (data.invoices || []).forEach((inv: any) => {
        csvRows.push(
          `"${inv.invoiceNumber}","${inv.party?.name || ''}","${inv.postedAt || inv.createdAt}","${inv.grandTotal}","${inv.grossMargin || 0}","${inv.status}"`,
        );
      });
    } else if (activeReport === 'stock') {
      csvRows.push('Item Code,Item Name,Category,Total Stock,WAC Cost,Total Valuation');
      (data.items || []).forEach((item: any) => {
        csvRows.push(
          `"${item.code}","${item.name}","${item.category?.name || ''}","${item.totalStock}","${item.costPrice || 0}","${item.valuation || 0}"`,
        );
      });
    } else if (activeReport === 'receivables') {
      csvRows.push('Customer Code,Customer Name,Phone,Current Receivable,Credit Limit');
      (data.customers || []).forEach((c: any) => {
        csvRows.push(
          `"${c.code}","${c.name}","${c.phone || ''}","${c.currentReceivable || 0}","${c.creditLimit || 0}"`,
        );
      });
    } else if (activeReport === 'payables') {
      csvRows.push('Supplier Code,Supplier Name,Phone,Current Payable');
      (data.suppliers || []).forEach((s: any) => {
        csvRows.push(`"${s.code}","${s.name}","${s.phone || ''}","${s.currentPayable || 0}"`);
      });
    }

    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `BusinessSuite-${activeReport}-report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(isRtl ? 'تم تصدير ملف التقرير بنجاح' : 'Report exported successfully');
  };

  // Define Columns for each report
  const salesColumns: Column<any>[] = [
    {
      key: 'invoiceNumber',
      header: isRtl ? 'رقم الفاتورة' : 'Invoice #',
      sortable: true,
      render: (r) => <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{r.invoiceNumber}</span>,
    },
    {
      key: 'party',
      header: isRtl ? 'العميل' : 'Customer',
      render: (r) => <span>{isRtl ? r.party?.nameAr || r.party?.name : r.party?.name}</span>,
    },
    {
      key: 'postedAt',
      header: isRtl ? 'تاريخ الترحيل' : 'Posting Date',
      sortable: true,
      render: (r) => (
        <span className="font-mono text-slate-500">
          {new Date(r.postedAt || r.createdAt).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US')}
        </span>
      ),
    },
    {
      key: 'grandTotal',
      header: isRtl ? 'إجمالي الفاتورة' : 'Invoice Total',
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
      header: isRtl ? 'مجمل الربح (WAC)' : 'Gross Margin',
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
        <Badge variant={r.paymentStatus === 'PAID' ? 'success' : 'warning'} size="sm">
          {r.paymentStatus === 'PAID' ? (isRtl ? 'مدفوعة' : 'Paid') : isRtl ? 'غير مدفوعة' : 'Unpaid'}
        </Badge>
      ),
    },
  ];

  const stockColumns: Column<any>[] = [
    {
      key: 'code',
      header: isRtl ? 'كود الصنف' : 'Item Code',
      sortable: true,
      render: (r) => <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{r.code}</span>,
    },
    {
      key: 'name',
      header: isRtl ? 'اسم الصنف' : 'Item Name',
      sortable: true,
      render: (r) => <span>{isRtl ? r.nameAr || r.name : r.name}</span>,
    },
    {
      key: 'category',
      header: isRtl ? 'التصنيف' : 'Category',
      render: (r) => <span>{r.category?.name || '—'}</span>,
    },
    {
      key: 'totalStock',
      header: isRtl ? 'الرصيد المتاح' : 'Available Stock',
      align: 'end',
      sortable: true,
      render: (r) => <span className="font-mono font-bold tabular-nums">{Number(r.totalStock).toLocaleString()}</span>,
    },
    {
      key: 'costPrice',
      header: isRtl ? 'متوسط التكلفة (WAC)' : 'Unit WAC Cost',
      align: 'end',
      sortable: true,
      render: (r) => (
        <span className="font-mono tabular-nums">
          {formatMoney(r.costPrice || 0)}
        </span>
      ),
    },
    {
      key: 'valuation',
      header: isRtl ? 'إجمالي التقييم' : 'Total Valuation',
      align: 'end',
      sortable: true,
      render: (r) => (
        <span className="font-mono font-bold text-sky-600 dark:text-sky-400 tabular-nums">
          {formatMoney(r.valuation || 0)}
        </span>
      ),
    },
  ];

  const receivablesColumns: Column<any>[] = [
    {
      key: 'code',
      header: isRtl ? 'كود العميل' : 'Customer Code',
      sortable: true,
      render: (r) => <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{r.code}</span>,
    },
    {
      key: 'name',
      header: isRtl ? 'اسم العميل' : 'Customer Name',
      sortable: true,
      render: (r) => <span>{isRtl ? r.nameAr || r.name : r.name}</span>,
    },
    {
      key: 'phone',
      header: isRtl ? 'الهاتف' : 'Phone',
      render: (r) => <span className="font-mono text-slate-500">{r.phone || '—'}</span>,
    },
    {
      key: 'creditLimit',
      header: isRtl ? 'الحد الائتماني' : 'Credit Limit',
      align: 'end',
      sortable: true,
      render: (r) => (
        <span className="font-mono tabular-nums">
          {formatMoney(r.creditLimit || 0)}
        </span>
      ),
    },
    {
      key: 'currentReceivable',
      header: isRtl ? 'المديونية المستحقة' : 'Outstanding Balance',
      align: 'end',
      sortable: true,
      render: (r) => (
        <span className="font-mono font-bold text-rose-600 dark:text-rose-400 tabular-nums">
          {formatMoney(r.currentReceivable || 0)}
        </span>
      ),
    },
  ];

  const payablesColumns: Column<any>[] = [
    {
      key: 'code',
      header: isRtl ? 'كود المورد' : 'Supplier Code',
      sortable: true,
      render: (r) => <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{r.code}</span>,
    },
    {
      key: 'name',
      header: isRtl ? 'اسم المورد' : 'Supplier Name',
      sortable: true,
      render: (r) => <span>{isRtl ? r.nameAr || r.name : r.name}</span>,
    },
    {
      key: 'phone',
      header: isRtl ? 'الهاتف' : 'Phone',
      render: (r) => <span className="font-mono text-slate-500">{r.phone || '—'}</span>,
    },
    {
      key: 'currentPayable',
      header: isRtl ? 'المستحقات الواجبة للمورد' : 'Payable Due',
      align: 'end',
      sortable: true,
      render: (r) => (
        <span className="font-mono font-bold text-amber-600 dark:text-amber-400 tabular-nums">
          {formatMoney(r.currentPayable || 0)}
        </span>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {isRtl ? 'التقارير والتحليلات المالية' : 'Financial Reports & Analytics'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isRtl
                ? 'تقارير المبيعات وهوامش الربح، تقييم المخزون بمتوسط التكلفة WAC، ومستحقات العملاء والموردين'
                : 'Sales margins, WAC inventory valuation, debtor receivables and creditor payables'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              icon={<Download className="w-3.5 h-3.5" />}
            >
              {isRtl ? 'تصدير CSV' : 'Export CSV'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              icon={<Printer className="w-3.5 h-3.5" />}
            >
              {isRtl ? 'طباعة التقرير' : 'Print View'}
            </Button>
          </div>
        </div>

        {/* Report Selector Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveReport('sales')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeReport === 'sales'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>{isRtl ? 'المبيعات وهوامش الربح' : 'Sales & Margins'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveReport('stock')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeReport === 'stock'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>{isRtl ? 'تقييم المخزون (WAC)' : 'Stock Valuation'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveReport('receivables')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeReport === 'receivables'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{isRtl ? 'مديونيات العملاء' : 'Customer Receivables'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveReport('payables')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeReport === 'payables'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>{isRtl ? 'مستحقات الموردين' : 'Supplier Payables'}</span>
          </button>
        </div>

        {/* Date Filter Bar (for Sales) */}
        {activeReport === 'sales' && (
          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
              <span className="font-semibold text-slate-400 me-1">{isRtl ? 'الفترة:' : 'Period:'}</span>
              {(['TODAY', 'THIS_WEEK', 'THIS_MONTH', 'THIS_QUARTER', 'THIS_YEAR', 'ALL'] as DatePreset[]).map(
                (p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => applyDatePreset(p)}
                    className={`px-2.5 py-1 rounded-md font-semibold text-2xs transition ${
                      datePreset === p
                        ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {p === 'TODAY'
                      ? isRtl ? 'اليوم' : 'Today'
                      : p === 'THIS_WEEK'
                      ? isRtl ? 'هذا الأسبوع' : 'This Week'
                      : p === 'THIS_MONTH'
                      ? isRtl ? 'هذا الشهر' : 'This Month'
                      : p === 'THIS_QUARTER'
                      ? isRtl ? 'الربع الحالي' : 'Quarter'
                      : p === 'THIS_YEAR'
                      ? isRtl ? 'هذا العام' : 'This Year'
                      : isRtl ? 'الكل' : 'All'}
                  </button>
                ),
              )}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setDatePreset('CUSTOM');
                }}
                className="h-8 px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
              />
              <span className="text-slate-400">&larr;</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setDatePreset('CUSTOM');
                }}
                className="h-8 px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
              />
            </div>
          </div>
        )}

        {/* Summary Metric Ribbon */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {activeReport === 'sales' && (
              <>
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-2xs text-slate-400 font-semibold block">{isRtl ? 'إجمالي المبيعات' : 'Total Revenue'}</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                    {formatMoney(data.totalSales || 0)}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-2xs text-slate-400 font-semibold block">{isRtl ? 'مجمل الربح التشغيلي' : 'Total Gross Profit'}</span>
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                    {formatMoney(data.totalGrossProfit || 0)}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-2xs text-slate-400 font-semibold block">{isRtl ? 'عدد الفواتير' : 'Invoices Count'}</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                    {data.invoices?.length || 0}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-2xs text-slate-400 font-semibold block">{isRtl ? 'متوسط قيمة الفاتورة' : 'Average Order'}</span>
                  <span className="text-lg font-bold text-sky-600 dark:text-sky-400 font-mono tabular-nums">
                    {formatMoney(data.invoices?.length > 0 ? Number(data.totalSales) / data.invoices.length : 0)}
                  </span>
                </div>
              </>
            )}

            {activeReport === 'stock' && (
              <>
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 col-span-2">
                  <span className="text-2xs text-slate-400 font-semibold block">{isRtl ? 'إجمالي تقييم المخزون (WAC)' : 'Total Inventory Valuation'}</span>
                  <span className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                    {formatMoney(data.totalValuation || 0)}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 col-span-2">
                  <span className="text-2xs text-slate-400 font-semibold block">{isRtl ? 'عدد الأصناف بالمستودعات' : 'Total Items Count'}</span>
                  <span className="text-xl font-bold text-sky-600 dark:text-sky-400 font-mono tabular-nums">
                    {data.items?.length || 0}
                  </span>
                </div>
              </>
            )}

            {activeReport === 'receivables' && (
              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 col-span-4 flex justify-between items-center">
                <div>
                  <span className="text-2xs text-slate-400 font-semibold block">{isRtl ? 'إجمالي الديون المستحقة على العملاء' : 'Total Customer Receivables'}</span>
                  <span className="text-xl font-bold text-rose-600 dark:text-rose-400 font-mono tabular-nums">
                    {formatMoney(data.totalReceivables || 0)}
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  {data.customers?.length || 0} {isRtl ? 'عملاء مدينين' : 'debtor customers'}
                </span>
              </div>
            )}

            {activeReport === 'payables' && (
              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 col-span-4 flex justify-between items-center">
                <div>
                  <span className="text-2xs text-slate-400 font-semibold block">{isRtl ? 'إجمالي المستحقات الواجبة للموردين' : 'Total Supplier Payables'}</span>
                  <span className="text-xl font-bold text-amber-600 dark:text-amber-400 font-mono tabular-nums">
                    {formatMoney(data.totalPayables || 0)}
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  {data.suppliers?.length || 0} {isRtl ? 'موردين دائنين' : 'creditor suppliers'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Report Active Table */}
        {activeReport === 'sales' && (
          <DataTable
            columns={salesColumns}
            data={data?.invoices || []}
            keyExtractor={(r) => r.id}
            loading={loading}
            emptyTitle={isRtl ? 'لا توجد مبيعات في الفترة المحددة' : 'No sales recorded in this period'}
          />
        )}

        {activeReport === 'stock' && (
          <DataTable
            columns={stockColumns}
            data={data?.items || []}
            keyExtractor={(r) => r.id}
            loading={loading}
            emptyTitle={isRtl ? 'لا توجد أصناف بالمخزون' : 'No stock items found'}
          />
        )}

        {activeReport === 'receivables' && (
          <DataTable
            columns={receivablesColumns}
            data={data?.customers || []}
            keyExtractor={(r) => r.id}
            loading={loading}
            emptyTitle={isRtl ? 'لا توجد مديونيات مستحقة على العملاء' : 'No customer receivables'}
          />
        )}

        {activeReport === 'payables' && (
          <DataTable
            columns={payablesColumns}
            data={data?.suppliers || []}
            keyExtractor={(r) => r.id}
            loading={loading}
            emptyTitle={isRtl ? 'لا توجد مبالغ مستحقة للموردين' : 'No supplier payables'}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
