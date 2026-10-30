'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  User,
  Coins,
  Sliders,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { ApiService } from '../../src/services/api';
import { useToast } from '../../src/hooks/use-toast';

export default function SetupWizardPage() {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Company
    companyName: '',
    companyNameAr: '',
    phone: '',
    commercialRegistration: '',
    // Step 2: Admin
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    confirmPassword: '',
    // Step 3: Currency
    currencyCode: 'EGP' as 'EGP' | 'SAR' | 'USD',
    // Step 4: Configuration
    taxNumber: '',
    address: '',
    city: '',
    defaultTaxRate: 0,
  });

  useEffect(() => {
    // Check if system is already set up
    ApiService.getSetupStatus()
      .then((status) => {
        if (!status.needsSetup) {
          router.replace('/login');
        }
      })
      .catch(() => {
        // Continue if offline or during first boot
      })
      .finally(() => {
        setCheckingStatus(false);
      });
  }, [router]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateStep = (currentStep: number): boolean => {
    if (currentStep === 1) {
      if (!formData.companyName.trim()) {
        toast.error('يرجى إدخال اسم الشركة / Please enter company name');
        return false;
      }
    } else if (currentStep === 2) {
      if (!formData.adminName.trim()) {
        toast.error('يرجى إدخال اسم المدير / Please enter admin name');
        return false;
      }
      if (!formData.adminEmail.trim() || !formData.adminEmail.includes('@')) {
        toast.error('يرجى إدخال بريد إلكتروني صحيح / Please enter a valid email');
        return false;
      }
      if (!formData.adminPassword || formData.adminPassword.length < 6) {
        toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل / Password must be at least 6 characters');
        return false;
      }
      if (formData.adminPassword !== formData.confirmPassword) {
        toast.error('كلمات المرور غير متطابقة / Passwords do not match');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const handlePrev = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await ApiService.initializeCompany({
        companyName: formData.companyName,
        companyNameAr: formData.companyNameAr || formData.companyName,
        adminName: formData.adminName,
        adminEmail: formData.adminEmail,
        adminPassword: formData.adminPassword,
        currencyCode: formData.currencyCode,
        taxNumber: formData.taxNumber,
        commercialRegistration: formData.commercialRegistration,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
      });

      if (res && res.accessToken) {
        localStorage.setItem('bs_access_token', res.accessToken);
        if (res.tenant?.id) {
          localStorage.setItem('bs_active_tenant_id', res.tenant.id);
        }
        toast.success('تمت تهيئة BusinessSuite بنجاح! جاري الدخول... / Setup completed successfully!');
        setTimeout(() => {
          router.replace('/dashboard');
        }, 1000);
      }
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء تهيئة النظام / Failed to initialize system');
      setSubmitting(false);
    }
  };

  if (checkingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">جاري فحص حالة النظام...</p>
        </div>
      </div>
    );
  }

  const stepsList = [
    { num: 1, title: 'الشركة', titleEn: 'Company', icon: Building2 },
    { num: 2, title: 'المدير', titleEn: 'Admin User', icon: User },
    { num: 3, title: 'العملة', titleEn: 'Currency', icon: Coins },
    { num: 4, title: 'الإعدادات', titleEn: 'Settings', icon: Sliders },
    { num: 5, title: 'التأكيد', titleEn: 'Finish', icon: CheckCircle2 },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-sky-500/20">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-950 via-slate-900 to-indigo-950 px-8 py-6 border-b border-slate-800 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">مرحباً بك في BusinessSuite</h1>
          <p className="text-sm text-slate-400 mt-1">
            إعداد النظام الأولي المستقل لسطح المكتب • Offline Standalone Desktop Edition
          </p>
        </div>

        {/* Steps Progress Bar */}
        <div className="grid grid-cols-5 border-b border-slate-800 bg-slate-900/50">
          {stepsList.map((s) => {
            const Icon = s.icon;
            const isActive = step === s.num;
            const isDone = step > s.num;
            return (
              <div
                key={s.num}
                className={`py-3 px-2 flex flex-col items-center justify-center text-center transition-colors ${
                  isActive
                    ? 'border-b-2 border-sky-500 text-sky-400 font-semibold bg-sky-500/5'
                    : isDone
                    ? 'text-emerald-400'
                    : 'text-slate-500'
                }`}
              >
                <Icon className="w-4 h-4 mb-1" />
                <span className="text-xs">{s.title}</span>
              </div>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="p-8">
          {/* STEP 1: Company */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-sky-400" />
                الخطوة 1: بيانات المنشأة / Company Information
              </h2>
              <p className="text-sm text-slate-400">
                أدخل اسم منشأتك وبيانات الاتصال الأساسية. يمكنك تعديلها لاحقاً من الإعدادات.
              </p>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    اسم الشركة / المؤسسة * (Company Name)
                  </label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => handleChange('companyName', e.target.value)}
                    placeholder="مثال: شركة الأمل للتجارة"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    الاسم بالإنجليزية (اختياري) / English Name
                  </label>
                  <input
                    type="text"
                    value={formData.companyNameAr}
                    onChange={(e) => handleChange('companyNameAr', e.target.value)}
                    placeholder="e.g. Al-Amal Trading Est."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      رقم الهاتف / Phone
                    </label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      placeholder="01000000000"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      السجل التجاري (اختياري) / C.R.
                    </label>
                    <input
                      type="text"
                      value={formData.commercialRegistration}
                      onChange={(e) => handleChange('commercialRegistration', e.target.value)}
                      placeholder="123456"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Admin User */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-sky-400" />
                الخطوة 2: حساب المدير المسؤول / System Administrator
              </h2>
              <p className="text-sm text-slate-400">
                هذا الحساب يمتلك الصلاحيات الكاملة لإدارة نقاط البيع والمخزون والمبيعات والمالية.
              </p>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    اسم المدير / Admin Name *
                  </label>
                  <input
                    type="text"
                    value={formData.adminName}
                    onChange={(e) => handleChange('adminName', e.target.value)}
                    placeholder="مثال: أحمد منصور"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    البريد الإلكتروني لتسجيل الدخول / Login Email *
                  </label>
                  <input
                    type="email"
                    value={formData.adminEmail}
                    onChange={(e) => handleChange('adminEmail', e.target.value)}
                    placeholder="admin@mycompany.com"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      كلمة المرور / Password *
                    </label>
                    <input
                      type="password"
                      value={formData.adminPassword}
                      onChange={(e) => handleChange('adminPassword', e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      تأكيد كلمة المرور / Confirm *
                    </label>
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleChange('confirmPassword', e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Currency */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Coins className="w-5 h-5 text-sky-400" />
                الخطوة 3: العملة الأساسية / Base Currency
              </h2>
              <p className="text-sm text-slate-400">
                اختر عملة الحسابات الأساسية للمنشأة. ستستخدم في الفواتير وتقارير الأرباح والأسعار.
              </p>

              <div className="grid grid-cols-3 gap-3 pt-2">
                {[
                  { code: 'EGP', nameAr: 'جنيه مصري', symbol: 'ج.م', desc: 'Egyptian Pound' },
                  { code: 'SAR', nameAr: 'ريال سعودي', symbol: 'ر.س', desc: 'Saudi Riyal' },
                  { code: 'USD', nameAr: 'دولار أمريكي', symbol: '$', desc: 'US Dollar' },
                ].map((cur) => {
                  const isSelected = formData.currencyCode === cur.code;
                  return (
                    <div
                      key={cur.code}
                      onClick={() => handleChange('currencyCode', cur.code)}
                      className={`cursor-pointer p-4 rounded-xl border text-center transition-all ${
                        isSelected
                          ? 'border-sky-500 bg-sky-500/10 shadow-lg shadow-sky-500/10'
                          : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-2xl font-black text-white mb-1">{cur.symbol}</div>
                      <div className="text-sm font-semibold text-sky-400">{cur.code}</div>
                      <div className="text-xs text-slate-300 mt-1">{cur.nameAr}</div>
                      <div className="text-[10px] text-slate-500">{cur.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: Configuration */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-sky-400" />
                الخطوة 4: الإعدادات والضرائب / System Configuration
              </h2>
              <p className="text-sm text-slate-400">
                إعدادات الفواتير والضريبة الافتراضية. (القيمة الافتراضية للضريبة هي 0% بدون ضريبة).
              </p>

              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      الرقم الضريبي (اختياري) / Tax No.
                    </label>
                    <input
                      type="text"
                      value={formData.taxNumber}
                      onChange={(e) => handleChange('taxNumber', e.target.value)}
                      placeholder="مثال: 300000000000003"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      المدينة / City
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                      placeholder="القاهرة / الرياض / ..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    العنوان التفصيلي / Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    placeholder="الشارع، الحي، المبنى"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="text-xs text-slate-400">
                    <span className="font-semibold text-white">الضريبة الافتراضية: 0%</span>
                    <p>لن يتم تطبيق ضريبة على الأصناف أو الفواتير إلا إذا قمت بتحديدها يدوياً.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Finish & Confirmation */}
          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                الخطوة 5: مراجعة البيانات والبدء / Finish Setup
              </h2>
              <p className="text-sm text-slate-400">
                راجع ملخص إعداد المنشأة أدناه ثم اضغط على إتمام التهيئة لفتح لوحة التحكم فوراً.
              </p>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">اسم المنشأة:</span>
                  <span className="font-semibold text-white">{formData.companyName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">المدير المسؤول:</span>
                  <span className="text-slate-200">{formData.adminName} ({formData.adminEmail})</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">العملة الأساسية:</span>
                  <span className="font-bold text-sky-400">{formData.currencyCode}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">نمط التشغيل:</span>
                  <span className="text-emerald-400 font-semibold">سطح المكتب بدون إنترنت (Offline Standalone)</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-slate-400">البيانات التجريبية:</span>
                  <span className="text-slate-300">قاعدة بيانات نظيفة 100% (No Demo Data)</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-800 mt-6">
            {step > 1 ? (
              <button
                type="button"
                onClick={handlePrev}
                disabled={submitting}
                className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 text-sm rounded-lg flex items-center gap-2 transition-colors"
              >
                <ArrowRight className="w-4 h-4 rtl:rotate-0 rotate-180" />
                السابق / Back
              </button>
            ) : (
              <div />
            )}

            {step < 5 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-lg flex items-center gap-2 shadow-lg shadow-sky-600/20 transition-colors"
              >
                التالي / Next
                <ArrowLeft className="w-4 h-4 rtl:rotate-0 rotate-180" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    جاري التهيئة...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    إتمام التهيئة وبدء الاستخدام / Finish Setup
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
