'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../src/hooks/use-auth';
import { useLanguage } from '../../../src/hooks/use-language';
import { useTheme } from '../../../src/hooks/use-theme';
import { useToast } from '../../../src/hooks/use-toast';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { Lock, Mail, Globe, Sun, Moon, ArrowRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { isRtl, lang, toggleLang } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError(null);

    try {
      const data = await login(email, password);
      toast.success(
        isRtl ? 'تم تسجيل الدخول بنجاح' : 'Logged in successfully',
      );

      if (data.user?.isSuperAdmin) {
        router.push('/platform');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      const message =
        err.message ||
        (isRtl
          ? 'فشل تسجيل الدخول. يرجى التحقق من صحة البريد الإلكتروني وكلمة المرور.'
          : 'Authentication failed. Please check your email and password.');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-content-primary flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 select-none relative overflow-hidden">
      {/* Top Controls: Language & Theme */}
      <div className="absolute top-4 end-4 flex items-center gap-2 z-10">
        <button
          type="button"
          onClick={toggleLang}
          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5 shadow-2xs"
        >
          <Globe className="w-3.5 h-3.5 text-slate-500" />
          <span>{lang === 'ar' ? 'English' : 'عربي'}</span>
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-2xs"
          aria-label="Toggle theme"
        >
          {isDark ? <Moon className="w-4 h-4 text-sky-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
        </button>
      </div>

      {/* Main Login Container */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo and Tagline */}
        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-sky-600 flex items-center justify-center font-bold text-white text-xl shadow-card mb-3">
            BS
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            BusinessSuite
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isRtl
              ? 'نظام إدارة المبيعات، المخزون، والعمليات التجارية'
              : 'Commercial Sales, Inventory & Operations Platform'}
          </p>
        </div>

        {/* Card */}
        <div className="mt-6 bg-white dark:bg-slate-900 py-8 px-6 sm:px-8 border border-slate-200 dark:border-slate-800 shadow-card rounded-2xl">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div
                role="alert"
                className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs leading-relaxed"
              >
                {error}
              </div>
            )}

            <div>
              <Input
                label={isRtl ? 'البريد الإلكتروني' : 'Email Address'}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                icon={<Mail className="h-4 w-4" />}
                autoComplete="email"
                autoFocus
              />
            </div>

            <div>
              <Input
                label={isRtl ? 'كلمة المرور' : 'Password'}
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                icon={<Lock className="h-4 w-4" />}
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full font-bold shadow-xs mt-2"
              icon={isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            >
              {isRtl ? 'تسجيل الدخول' : 'Sign In'}
            </Button>
          </form>

          {/* Registration Link */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center">
            <Link
              href="/register"
              className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-500 transition"
            >
              {isRtl ? 'إنشاء حساب منشأة جديدة وتجربة مجانية ←' : 'Register a new company for free trial →'}
            </Link>
          </div>
        </div>

        {/* Footer info */}
        <p className="mt-6 text-center text-2xs text-slate-400 dark:text-slate-500">
          BusinessSuite v1.0 &bull; Secure Enterprise Platform
        </p>
      </div>
    </div>
  );
}
