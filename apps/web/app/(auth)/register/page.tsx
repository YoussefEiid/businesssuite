'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiService } from '../../../src/services/api';
import { useAuth } from '../../../src/hooks/use-auth';
import { useLanguage } from '../../../src/hooks/use-language';
import { useTheme } from '../../../src/hooks/use-theme';
import { useToast } from '../../../src/hooks/use-toast';
import { Input } from '../../../src/components/ui/Input';
import { Select } from '../../../src/components/ui/Select';
import { Button } from '../../../src/components/ui/Button';
import { SUPPORTED_CURRENCIES } from '../../../src/utils/currency';
import { Building2, User, Mail, Lock, Phone, Globe, Sun, Moon, ArrowRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const { isRtl, lang, toggleLang } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const toast = useToast();

  const [companyName, setCompanyName] = useState('');
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [currencyCode, setCurrencyCode] = useState('EGP');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await ApiService.register({
        companyName,
        userName,
        email,
        password,
        phone,
        currencyCode,
      });

      localStorage.setItem('bs_access_token', data.accessToken);
      if (data.user?.activeTenantId) {
        localStorage.setItem('bs_active_tenant_id', data.user.activeTenantId);
      }
      await refreshProfile();
      toast.success(
        isRtl ? 'تم إنشاء المنشأة بنجاح! مرحباً بك في BusinessSuite.' : 'Company registered successfully!',
      );
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err.message || (isRtl ? 'فشل إنشاء الحساب. يرجى مراجعة البيانات.' : 'Registration failed.');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-content-primary flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 select-none relative overflow-hidden">
      {/* Top Controls */}
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

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-sky-600 flex items-center justify-center font-bold text-white text-xl shadow-card mb-3">
            BS
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {isRtl ? 'تسجيل منشأة تجارية جديدة' : 'Register New Organization'}
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isRtl ? 'تجربة مجانية كاملة الميزات لمدة 14 يوماً' : 'Full-featured 14-day free trial'}
          </p>
        </div>

        <div className="mt-6 bg-white dark:bg-slate-900 py-8 px-6 sm:px-8 border border-slate-200 dark:border-slate-800 shadow-card rounded-2xl">
          <form className="space-y-3.5" onSubmit={handleSubmit}>
            {error && (
              <div
                role="alert"
                className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs leading-relaxed"
              >
                {error}
              </div>
            )}

            <Input
              label={isRtl ? 'اسم الشركة أو المؤسسة' : 'Company Name'}
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={isRtl ? 'شركة التجارة الحديثة' : 'Modern Trade Corp'}
              icon={<Building2 className="w-4 h-4" />}
            />

            <Input
              label={isRtl ? 'اسم المدير المسؤول' : 'Admin Name'}
              required
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder={isRtl ? 'محمد عبدالله' : 'Mohammed Ali'}
              icon={<User className="w-4 h-4" />}
            />

            <Input
              label={isRtl ? 'البريد الإلكتروني' : 'Email Address'}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@company.com"
              icon={<Mail className="w-4 h-4" />}
            />

            <Input
              label={isRtl ? 'كلمة المرور' : 'Password'}
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              icon={<Lock className="w-4 h-4" />}
            />

            <Input
              label={isRtl ? 'رقم الهاتف' : 'Phone Number'}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+966 50 000 0000"
              icon={<Phone className="w-4 h-4" />}
            />

            <Select
              label={isRtl ? 'العملة الأساسية للمنشأة' : 'Base Currency'}
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value)}
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {isRtl ? c.nameAr : c.nameEn} ({isRtl ? c.symbolAr : c.symbolEn})
                </option>
              ))}
            </Select>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full font-bold shadow-xs mt-3"
              icon={isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            >
              {isRtl ? 'إنهاء التسجيل وبدء الاستخدام' : 'Complete Registration'}
            </Button>
          </form>

          <div className="mt-5 text-center pt-4 border-t border-slate-100 dark:border-slate-800">
            <Link
              href="/login"
              className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-500 transition"
            >
              {isRtl ? 'لديك حساب بالفعل؟ تسجيل الدخول ←' : 'Already have an account? Sign in →'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
