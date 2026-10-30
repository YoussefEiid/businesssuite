'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../hooks/use-auth';
import { useLanguage } from '../../hooks/use-language';
import { useTheme } from '../../hooks/use-theme';
import {
  Menu,
  Sun,
  Moon,
  Laptop,
  Globe,
  ShoppingCart,
  ChevronDown,
  Building2,
  LogOut,
  User,
  ShieldAlert,
} from 'lucide-react';

interface HeaderProps {
  onToggleSidebar?: () => void;
  collapsed?: boolean;
}

const ROUTE_NAMES: Record<string, { ar: string; en: string }> = {
  '/dashboard': { ar: 'لوحة التحكم', en: 'Dashboard' },
  '/dashboard/pos': { ar: 'نقطة البيع (POS)', en: 'Point of Sale' },
  '/dashboard/sales': { ar: 'المبيعات والفواتير', en: 'Sales & Invoices' },
  '/dashboard/purchases': { ar: 'المشتريات وفواتير الموردين', en: 'Purchases & Bills' },
  '/dashboard/inventory': { ar: 'المخزون والمستودعات', en: 'Inventory & Stock' },
  '/dashboard/parties': { ar: 'العملاء والموردون', en: 'Customers & Suppliers' },
  '/dashboard/treasury': { ar: 'الخزائن والمدفوعات', en: 'Treasury & Payments' },
  '/dashboard/crm': { ar: 'إدارة علاقات العملاء CRM', en: 'CRM & Pipeline' },
  '/dashboard/reports': { ar: 'التقارير والتحليلات', en: 'Reports & Analytics' },
  '/dashboard/settings': { ar: 'إعدادات المنشأة', en: 'Company Settings' },
  '/platform': { ar: 'لوحة مالك المنصة', en: 'Platform Admin' },
};

export function Header({ onToggleSidebar }: HeaderProps) {
  const pathname = usePathname();
  const { user, activeTenantId, logout } = useAuth();
  const { lang, isRtl, toggleLang } = useLanguage();
  const { theme, setTheme, isDark } = useTheme();

  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);

  const activeMembership = user?.memberships?.find((m) => m.tenantId === activeTenantId);
  const currentCompanyName = activeMembership?.tenantName || 'BusinessSuite';

  const routeLabel = ROUTE_NAMES[pathname]
    ? isRtl
      ? ROUTE_NAMES[pathname].ar
      : ROUTE_NAMES[pathname].en
    : isRtl
    ? 'الرئيسية'
    : 'Overview';

  return (
    <header
      data-electron-drag
      className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between shadow-2xs z-30 flex-shrink-0 select-none"
    >
      {/* Left section: Sidebar toggle & Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0" data-electron-no-drag>
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          aria-label="Toggle Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Link
            href={user?.isSuperAdmin ? '/platform' : '/dashboard'}
            className="hover:text-sky-600 dark:hover:text-sky-400 transition font-medium"
          >
            {user?.isSuperAdmin ? (isRtl ? 'لوحة المنصة' : 'Platform') : (isRtl ? 'الرئيسية' : 'Home')}
          </Link>
          <span>/</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
            {routeLabel}
          </span>
        </nav>
      </div>

      {/* Right section: Quick actions, Theme, Lang, User */}
      <div className="flex items-center gap-2 sm:gap-3" data-electron-no-drag>
        {/* Quick Cashier POS Button (Tenants Only) */}
        {!user?.isSuperAdmin && pathname !== '/dashboard/pos' && (
          <Link
            href="/dashboard/pos"
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/40 hover:bg-sky-100 dark:hover:bg-sky-900/40 transition shadow-2xs"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>{isRtl ? 'شاشة الكاشير (POS)' : 'Cashier POS'}</span>
          </Link>
        )}

        {/* Language Switcher */}
        <button
          type="button"
          onClick={toggleLang}
          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5"
          title={isRtl ? 'التحويل إلى الإنجليزية' : 'Switch to Arabic'}
        >
          <Globe className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          <span>{lang === 'ar' ? 'English' : 'عربي'}</span>
        </button>

        {/* Theme Switcher Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Theme selector"
          >
            {isDark ? <Moon className="w-4 h-4 text-sky-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
          </button>

          {themeDropdownOpen && (
            <div className="absolute top-full end-0 mt-1.5 w-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-dropdown py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={() => {
                  setTheme('light');
                  setThemeDropdownOpen(false);
                }}
                className={`w-full text-start px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition ${
                  theme === 'light' ? 'text-sky-600 dark:text-sky-400 font-bold' : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>{isRtl ? 'فاتح' : 'Light'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTheme('dark');
                  setThemeDropdownOpen(false);
                }}
                className={`w-full text-start px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition ${
                  theme === 'dark' ? 'text-sky-600 dark:text-sky-400 font-bold' : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>{isRtl ? 'داكن' : 'Dark'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTheme('system');
                  setThemeDropdownOpen(false);
                }}
                className={`w-full text-start px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition ${
                  theme === 'system' ? 'text-sky-600 dark:text-sky-400 font-bold' : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>{isRtl ? 'تلقائي' : 'System'}</span>
              </button>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-2 p-1 sm:ps-2.5 sm:pe-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <div className="w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center text-xs font-bold">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <span className="hidden sm:inline text-xs font-semibold text-slate-800 dark:text-slate-200 max-w-[120px] truncate">
              {user?.name || 'Account'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {userDropdownOpen && (
            <div className="absolute top-full end-0 mt-1.5 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-dropdown py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-700">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{user?.name}</p>
                <p className="text-2xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                {user?.isSuperAdmin ? (
                  <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-semibold bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                    <ShieldAlert className="w-3 h-3" />
                    <span>{isRtl ? 'مالك المنصة (Super Admin)' : 'Platform Owner'}</span>
                  </div>
                ) : (
                  <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-semibold bg-sky-50 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/40">
                    <Building2 className="w-3 h-3" />
                    <span className="truncate">{currentCompanyName}</span>
                  </div>
                )}
              </div>

              {user?.isSuperAdmin ? (
                <Link
                  href="/platform"
                  onClick={() => setUserDropdownOpen(false)}
                  className="w-full text-start px-3.5 py-2 text-xs flex items-center gap-2 text-amber-600 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition font-semibold"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>{isRtl ? 'لوحة مالك المنصة' : 'Platform Owner Portal'}</span>
                </Link>
              ) : (
                <Link
                  href="/dashboard/settings"
                  onClick={() => setUserDropdownOpen(false)}
                  className="w-full text-start px-3.5 py-2 text-xs flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  <User className="w-4 h-4" />
                  <span>{isRtl ? 'إعدادات المنشأة' : 'Company Settings'}</span>
                </Link>
              )}

              <button
                type="button"
                onClick={() => {
                  setUserDropdownOpen(false);
                  logout();
                }}
                className="w-full text-start px-3.5 py-2 text-xs flex items-center gap-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition border-t border-slate-100 dark:border-slate-700 mt-1"
              >
                <LogOut className="w-4 h-4" />
                <span>{isRtl ? 'تسجيل الخروج' : 'Logout'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
