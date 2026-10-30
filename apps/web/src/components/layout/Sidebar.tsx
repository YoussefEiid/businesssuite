'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../hooks/use-auth';
import { useEntitlements } from '../../hooks/use-entitlements';
import { useLanguage } from '../../hooks/use-language';
import { useToast } from '../../hooks/use-toast';
import {
  LayoutDashboard,
  ShoppingCart,
  ShoppingBag,
  Package,
  Users,
  Wallet,
  TrendingUp,
  BarChart3,
  ShieldAlert,
  Building2,
  Settings,
  ChevronDown,
  Lock,
  ChevronLeft,
  ChevronRight,
  Zap,
  Activity,
  Layers,
  History,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItemDef {
  nameAr: string;
  nameEn: string;
  href: string;
  icon: any;
  featureKey?: string;
  superAdminOnly?: boolean;
}

interface NavGroup {
  groupNameAr: string;
  groupNameEn: string;
  items: NavItemDef[];
}

const TENANT_NAV_GROUPS: NavGroup[] = [
  {
    groupNameAr: 'العمليات الرئيسية',
    groupNameEn: 'Core Operations',
    items: [
      { nameAr: 'لوحة التحكم', nameEn: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { nameAr: 'نقطة البيع (POS)', nameEn: 'Point of Sale', href: '/dashboard/pos', icon: ShoppingCart, featureKey: 'sales.core' },
    ],
  },
  {
    groupNameAr: 'التجارة والمخزون',
    groupNameEn: 'Commerce & Stock',
    items: [
      { nameAr: 'المبيعات والفواتير', nameEn: 'Sales & Invoices', href: '/dashboard/sales', icon: ShoppingCart, featureKey: 'sales.core' },
      { nameAr: 'المشتريات وفواتير الموردين', nameEn: 'Purchases & Bills', href: '/dashboard/purchases', icon: ShoppingBag, featureKey: 'purchases.core' },
      { nameAr: 'المخزون والمستودعات', nameEn: 'Inventory & Stock', href: '/dashboard/inventory', icon: Package, featureKey: 'inventory.core' },
    ],
  },
  {
    groupNameAr: 'المالية والعلاقات',
    groupNameEn: 'Finance & CRM',
    items: [
      { nameAr: 'العملاء والموردون', nameEn: 'Parties & Contacts', href: '/dashboard/parties', icon: Users, featureKey: 'crm.contacts' },
      { nameAr: 'الخزائن والمدفوعات', nameEn: 'Treasury & Payments', href: '/dashboard/treasury', icon: Wallet, featureKey: 'finance.cashbank' },
      { nameAr: 'إدارة علاقات العملاء CRM', nameEn: 'CRM & Pipeline', href: '/dashboard/crm', icon: TrendingUp, featureKey: 'crm.pipeline' },
    ],
  },
  {
    groupNameAr: 'التقارير والإدارة',
    groupNameEn: 'Analytics & Admin',
    items: [
      { nameAr: 'التقارير والتحليلات', nameEn: 'Reports & Analytics', href: '/dashboard/reports', icon: BarChart3, featureKey: 'reports.basic' },
      { nameAr: 'إعدادات المنشأة', nameEn: 'Company Settings', href: '/dashboard/settings', icon: Settings },
    ],
  },
];

const PLATFORM_NAV_GROUPS: NavGroup[] = [
  {
    groupNameAr: 'إدارة المنصة والسحاب',
    groupNameEn: 'Platform Administration',
    items: [
      { nameAr: 'نظرة عامة على المنصة', nameEn: 'Platform Overview', href: '/platform?tab=overview', icon: Activity },
      { nameAr: 'المنشآت المشتركة', nameEn: 'Tenants & Orgs', href: '/platform?tab=tenants', icon: Building2 },
      { nameAr: 'باقات الاشتراك', nameEn: 'Subscription Plans', href: '/platform?tab=plans', icon: Layers },
      { nameAr: 'سجلات تدقيق المنصة', nameEn: 'Platform Audit Logs', href: '/platform?tab=audit', icon: History },
    ],
  },
];

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const { user, activeTenantId, switchTenant } = useAuth();
  const { entitlements, hasFeature } = useEntitlements();
  const { isRtl } = useLanguage();
  const toast = useToast();

  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);

  const activeMembership = user?.memberships?.find((m) => m.tenantId === activeTenantId);
  const currentCompanyName = activeMembership?.tenantName || 'BusinessSuite';
  const navGroups = user?.isSuperAdmin ? PLATFORM_NAV_GROUPS : TENANT_NAV_GROUPS;

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-xs"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed lg:static top-0 bottom-0 start-0 z-40 bg-slate-950 text-slate-100 flex flex-col border-e border-slate-800/80 shadow-2xl transition-all duration-200 select-none ${
          collapsed ? 'w-18' : 'w-64'
        } ${
          mobileOpen ? 'translate-x-0' : isRtl ? 'translate-x-full lg:translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Bar */}
        <div className="h-14 p-4 border-b border-slate-800/80 flex items-center justify-between flex-shrink-0">
          {!collapsed ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-sky-600 flex items-center justify-center font-bold text-white shadow-xs">
                BS
              </div>
              <div className="truncate">
                <h1 className="text-base font-bold text-white tracking-tight truncate leading-none">
                  BusinessSuite
                </h1>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">
                  {user?.isSuperAdmin
                    ? isRtl ? 'إدارة المنصة والسحاب' : 'Platform Administration'
                    : isRtl ? 'نظام إدارة المنشآت ERP' : 'Enterprise ERP'}
                </p>
              </div>
            </div>
          ) : (
            <div className={`mx-auto w-8 h-8 rounded-lg ${user?.isSuperAdmin ? 'bg-amber-600' : 'bg-sky-600'} flex items-center justify-center font-bold text-white shadow-xs`}>
              {user?.isSuperAdmin ? <ShieldAlert className="w-4 h-4" /> : 'BS'}
            </div>
          )}

          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title={collapsed ? (isRtl ? 'توسيع القائمة' : 'Expand Sidebar') : isRtl ? 'طي القائمة' : 'Collapse Sidebar'}
          >
            {collapsed ? (
              isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
            ) : isRtl ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Company Selector (Tenants Only) */}
        {!collapsed && !user?.isSuperAdmin && user?.memberships && user.memberships.length > 0 && (
          <div className="p-3 border-b border-slate-800/80 relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setTenantDropdownOpen(!tenantDropdownOpen)}
              className="w-full text-start flex items-center justify-between p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 text-xs transition"
            >
              <div className="flex items-center gap-2 truncate">
                <Building2 className="w-4 h-4 text-sky-400 flex-shrink-0" />
                <span className="font-semibold text-slate-200 truncate">{currentCompanyName}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            </button>

            {tenantDropdownOpen && (
              <div className="absolute top-full start-3 end-3 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-dropdown py-1 z-50">
                <div className="px-3 py-1.5 text-2xs font-bold text-slate-400 border-b border-slate-800">
                  {isRtl ? 'تبديل المنشأة' : 'Switch Organization'}
                </div>
                {user.memberships.map((m) => (
                  <button
                    key={m.tenantId}
                    type="button"
                    onClick={() => {
                      switchTenant(m.tenantId);
                      setTenantDropdownOpen(false);
                    }}
                    className={`w-full text-start px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800 transition ${
                      m.tenantId === activeTenantId ? 'text-sky-400 font-bold bg-slate-800/60' : 'text-slate-300'
                    }`}
                  >
                    <span className="truncate">{m.tenantName}</span>
                    <span className="text-2xs text-slate-500 font-mono">({m.roleName})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Navigation items grouped */}
        <nav className="flex-1 p-2 space-y-4 overflow-y-auto">
          {navGroups.map((group, gIdx) => {
            // Filter out items user has no access to
            const visibleItems = group.items.filter((item) => {
              if (item.superAdminOnly && !user?.isSuperAdmin) return false;
              return true;
            });

            if (visibleItems.length === 0) return null;

            return (
              <div key={gIdx} className="space-y-1">
                {!collapsed && (
                  <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {isRtl ? group.groupNameAr : group.groupNameEn}
                  </div>
                )}

                {visibleItems.map((item) => {
                  const isLocked = item.featureKey ? !hasFeature(item.featureKey) : false;
                  const isPlatformTab = item.href.includes('tab=');
                  const currentSearch = typeof window !== 'undefined' ? window.location.search : '';
                  const isActive = isPlatformTab
                    ? pathname === '/platform' &&
                      (currentSearch.includes(item.href.slice(item.href.indexOf('?'))) ||
                        (!currentSearch && item.href.includes('tab=overview')))
                    : pathname === item.href;
                  const Icon = item.icon;
                  const title = isRtl ? item.nameAr : item.nameEn;

                  return (
                    <Link
                      key={item.href}
                      href={isLocked ? '#' : item.href}
                      onClick={(e) => {
                        if (isLocked) {
                          e.preventDefault();
                          toast.warning(
                            isRtl
                              ? `هذه الميزة غير مشمولة في باقتك الحالية (${entitlements?.planNameAr || 'الأساسية'}).`
                              : `This feature is not in your current plan (${entitlements?.planNameEn || 'Starter'}).`,
                            isRtl ? 'ترقية الباقة مطلوبة' : 'Plan Upgrade Required',
                          );
                        } else {
                          onCloseMobile();
                          if (user?.isSuperAdmin && item.href.includes('tab=')) {
                            const tab = item.href.split('tab=')[1];
                            if (typeof window !== 'undefined') {
                              const event = new CustomEvent('bs:switch_platform_tab', { detail: tab });
                              window.dispatchEvent(event);
                            }
                          }
                        }
                      }}
                      title={collapsed ? title : undefined}
                      className={`group flex items-center ${
                        collapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2'
                      } rounded-lg text-xs font-semibold transition ${
                        isActive
                          ? 'bg-sky-600 text-white shadow-xs'
                          : isLocked
                          ? 'text-slate-500 hover:bg-slate-900/60 opacity-60 cursor-not-allowed'
                          : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon
                          className={`w-4 h-4 flex-shrink-0 ${
                            isActive ? 'text-white' : isLocked ? 'text-slate-600' : 'text-slate-400 group-hover:text-slate-200'
                          }`}
                        />
                        {!collapsed && <span className="truncate">{title}</span>}
                      </div>

                      {!collapsed && isLocked && (
                        <Lock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Plan Status Footer (Tenants) */}
        {!collapsed && !user?.isSuperAdmin && entitlements && (
          <div className="p-3 border-t border-slate-800/80 bg-slate-950/90 flex-shrink-0">
            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-2xs">{isRtl ? 'الباقة الحالية' : 'Current Plan'}</span>
                <span className="font-bold text-sky-400 text-2xs">
                  {isRtl ? entitlements.planNameAr : entitlements.planNameEn}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-slate-800">
                <div className="flex items-center gap-1 text-2xs text-slate-400">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>{isRtl ? 'حالة الاشتراك' : 'Status'}</span>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    entitlements.isSubscriptionActive
                      ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/40'
                      : 'bg-rose-950/80 text-rose-400 border border-rose-800/40'
                  }`}
                >
                  {entitlements.subscriptionStatus}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Platform Super Admin Footer */}
        {!collapsed && user?.isSuperAdmin && (
          <div className="p-3 border-t border-slate-800/80 bg-slate-950/90 flex-shrink-0">
            <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/40 text-xs">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold text-2xs">
                <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{isRtl ? 'صلاحيات مالك المنصة' : 'Platform Super Admin'}</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {isRtl ? 'إدارة المنشآت والاشتراكات السحابية' : 'Full cloud tenant & plan authority'}
              </p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
