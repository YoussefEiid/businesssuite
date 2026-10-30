'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useLanguage } from '../../hooks/use-language';
import { useAuth } from '../../hooks/use-auth';
import { Loader2, Server, ShieldAlert } from 'lucide-react';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isRtl, dir } = useLanguage();
  const { loading: authLoading, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace('/login');
      } else if (user.isSuperAdmin && (pathname === '/dashboard' || pathname.startsWith('/dashboard/'))) {
        router.replace('/platform');
      } else if (!user.isSuperAdmin && (pathname === '/platform' || pathname.startsWith('/platform/'))) {
        router.replace('/dashboard');
      }
    }
  }, [authLoading, user, pathname, router]);

  // If user is not yet loaded, render a clean branded loading screen (handles Render cold start seamlessly)
  if (authLoading || !user) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-canvas text-content-primary p-4 select-none">
        <div className="flex flex-col items-center max-w-sm text-center animate-in fade-in duration-300">
          <div className="w-12 h-12 rounded-xl bg-sky-600 flex items-center justify-center font-bold text-white text-xl shadow-card mb-4 animate-pulse">
            BS
          </div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
            BusinessSuite ERP
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isRtl ? 'جاري الاتصال بالخادم وتحميل مساحة العمل...' : 'Connecting to workspace server...'}
          </p>
          <div className="mt-4 flex items-center gap-2 text-2xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
            <Server className="w-3.5 h-3.5 text-sky-500 animate-spin" />
            <span>{isRtl ? 'تهيئة الجلسة السحابية' : 'Initializing cloud session'}</span>
          </div>
        </div>
      </div>
    );
  }

  // Prevent unauthorized view flash during redirect: Platform Owner attempting /dashboard/*
  if (user.isSuperAdmin && (pathname === '/dashboard' || pathname.startsWith('/dashboard/'))) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-canvas text-content-primary p-4 select-none">
        <div className="flex flex-col items-center max-w-sm text-center animate-in fade-in duration-300">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
            {isRtl ? 'لوحة مالك المنصة' : 'Platform Owner Portal'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isRtl ? 'جاري التحويل إلى لوحة إدارة المنصة...' : 'Redirecting to platform administration...'}
          </p>
        </div>
      </div>
    );
  }

  // Prevent unauthorized view flash during redirect: Tenant user attempting /platform/*
  if (!user.isSuperAdmin && (pathname === '/platform' || pathname.startsWith('/platform/'))) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-canvas text-content-primary p-4 select-none">
        <div className="flex flex-col items-center max-w-sm text-center animate-in fade-in duration-300">
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center mb-4">
            <Server className="w-6 h-6 animate-spin" />
          </div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
            {isRtl ? 'مساحة عمل المنشأة' : 'Tenant Workspace'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isRtl ? 'جاري التحويل إلى مساحة عمل المنشأة...' : 'Redirecting to tenant dashboard...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-canvas text-content-primary flex" dir={dir}>
      {/* Sidebar Navigation */}
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header */}
        <Header
          onToggleSidebar={() => {
            if (typeof window !== 'undefined' && window.innerWidth < 1024) {
              setMobileOpen(!mobileOpen);
            } else {
              setCollapsed(!collapsed);
            }
          }}
          collapsed={collapsed}
        />

        {/* Scrollable View Area with Electron Scroll Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0 bg-canvas">
          {children}
        </main>
      </div>
    </div>
  );
}
