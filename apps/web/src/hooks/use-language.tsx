'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'ar' | 'en';
export type Direction = 'rtl' | 'ltr';

interface LanguageContextType {
  lang: Language;
  dir: Direction;
  isRtl: boolean;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: (key: string, fallback?: string) => string;
}

const DICTIONARY: Record<string, { ar: string; en: string }> = {
  // Brand & Shell
  'app.name': { ar: 'BusinessSuite', en: 'BusinessSuite' },
  'app.tagline': { ar: 'نظام إدارة المنشآت التجاري المتكامل', en: 'Commercial ERP & Multi-Tenant SaaS' },

  // Navigation
  'nav.dashboard': { ar: 'لوحة التحكم', en: 'Dashboard' },
  'nav.pos': { ar: 'نقطة البيع (POS)', en: 'Point of Sale (POS)' },
  'nav.sales': { ar: 'المبيعات والفواتير', en: 'Sales & Invoices' },
  'nav.purchases': { ar: 'المشتريات وفواتير الموردين', en: 'Purchases & Bills' },
  'nav.inventory': { ar: 'المخزون والمستودعات', en: 'Inventory & Stock' },
  'nav.parties': { ar: 'العملاء والموردون', en: 'Customers & Suppliers' },
  'nav.treasury': { ar: 'الخزائن والمدفوعات', en: 'Treasury & Payments' },
  'nav.crm': { ar: 'إدارة علاقات العملاء (CRM)', en: 'CRM & Pipeline' },
  'nav.reports': { ar: 'التقارير والتحليلات', en: 'Reports & Analytics' },
  'nav.settings': { ar: 'إعدادات المنشأة', en: 'Company Settings' },
  'nav.platform': { ar: 'لوحة مالك المنصة', en: 'Platform Admin' },

  // Module categories
  'nav.category.core': { ar: 'العمليات الرئيسية', en: 'Core Operations' },
  'nav.category.commercial': { ar: 'التجارة والمخزون', en: 'Commerce & Stock' },
  'nav.category.finance': { ar: 'المالية والعلاقات', en: 'Finance & CRM' },
  'nav.category.analytics': { ar: 'التحليلات والنظام', en: 'Analytics & System' },

  // Actions
  'action.save': { ar: 'حفظ', en: 'Save' },
  'action.cancel': { ar: 'إلغاء', en: 'Cancel' },
  'action.confirm': { ar: 'تأكيد', en: 'Confirm' },
  'action.delete': { ar: 'حذف', en: 'Delete' },
  'action.edit': { ar: 'تعديل', en: 'Edit' },
  'action.add': { ar: 'إضافة', en: 'Add' },
  'action.create': { ar: 'إنشاء جديد', en: 'Create New' },
  'action.search': { ar: 'بحث...', en: 'Search...' },
  'action.filter': { ar: 'تصفية', en: 'Filter' },
  'action.refresh': { ar: 'تحديث', en: 'Refresh' },
  'action.print': { ar: 'طباعة', en: 'Print' },
  'action.export': { ar: 'تصدير', en: 'Export' },
  'action.import': { ar: 'استيراد', en: 'Import' },
  'action.close': { ar: 'إغلاق', en: 'Close' },
  'action.back': { ar: 'رجوع', en: 'Back' },
  'action.login': { ar: 'تسجيل الدخول', en: 'Login' },
  'action.logout': { ar: 'تسجيل الخروج', en: 'Logout' },
  'action.post': { ar: 'ترحيل واعتماد', en: 'Post & Commit' },
  'action.checkout': { ar: 'إتمام البيع والدفع', en: 'Complete & Checkout' },

  // Statuses
  'status.all': { ar: 'الكل', en: 'All' },
  'status.active': { ar: 'نشط', en: 'Active' },
  'status.draft': { ar: 'مسودة', en: 'Draft' },
  'status.posted': { ar: 'مرحل ومكتمل', en: 'Posted' },
  'status.paid': { ar: 'مدفوع بالكامل', en: 'Paid' },
  'status.partial': { ar: 'مدفوع جزئياً', en: 'Partially Paid' },
  'status.unpaid': { ar: 'غير مدفوع', en: 'Unpaid' },
  'status.cancelled': { ar: 'ملغي / معكوس', en: 'Cancelled' },

  // Common Business Terms
  'term.total': { ar: 'الإجمالي', en: 'Total' },
  'term.subtotal': { ar: 'المجموع قبل الضريبة', en: 'Subtotal' },
  'term.tax': { ar: 'ضريبة القيمة المضافة', en: 'VAT (Tax)' },
  'term.discount': { ar: 'الخصم', en: 'Discount' },
  'term.balance': { ar: 'الرصيد', en: 'Balance' },
  'term.quantity': { ar: 'الكمية', en: 'Quantity' },
  'term.unitPrice': { ar: 'سعر الوحدة', en: 'Unit Price' },
  'term.currency': { ar: 'العملة', en: 'Currency' },
  'term.date': { ar: 'التاريخ', en: 'Date' },
  'term.reference': { ar: 'الرقم المرجعي', en: 'Reference #' },
  'term.notes': { ar: 'ملاحظات', en: 'Notes' },
  'term.warehouse': { ar: 'المستودع', en: 'Warehouse' },
  'term.account': { ar: 'الخزينة / الحساب', en: 'Account' },
  'term.cashier': { ar: 'الكاشير', en: 'Cashier' },
  'term.customer': { ar: 'العميل', en: 'Customer' },
  'term.supplier': { ar: 'المورد', en: 'Supplier' },

  // Messages & States
  'msg.loading': { ar: 'جاري التحميل...', en: 'Loading...' },
  'msg.noData': { ar: 'لا توجد بيانات مسجلة حتى الآن', en: 'No records found' },
  'msg.noResults': { ar: 'لم يتم العثور على نتائج مطابقة للبحث', en: 'No matching results found' },
  'msg.success': { ar: 'تمت العملية بنجاح', en: 'Operation completed successfully' },
  'msg.error': { ar: 'حدث خطأ أثناء تنفيذ العملية', en: 'An error occurred during operation' },
  'msg.confirmDelete': { ar: 'هل أنت متأكد من الحذف؟ لا يمكن التراجع عن هذه العملية.', en: 'Are you sure you want to delete? This action cannot be undone.' },
  'msg.upgradeRequired': { ar: 'هذه الميزة غير مشمولة في خطتك الحالية. يرجى الترقية لتفعيلها.', en: 'This feature is not included in your current plan. Please upgrade to unlock.' },
};

const LanguageContext = createContext<LanguageContextType>({} as LanguageContextType);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('ar');

  useEffect(() => {
    const saved = localStorage.getItem('bs_language') as Language;
    if (saved === 'ar' || saved === 'en') {
      setLangState(saved);
      document.documentElement.lang = saved;
      document.documentElement.dir = saved === 'ar' ? 'rtl' : 'ltr';
    } else {
      document.documentElement.lang = 'ar';
      document.documentElement.dir = 'rtl';
    }
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('bs_language', newLang);
    document.documentElement.lang = newLang;
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
  };

  const toggleLang = () => {
    setLang(lang === 'ar' ? 'en' : 'ar');
  };

  const t = (key: string, fallback?: string): string => {
    if (DICTIONARY[key]) {
      return DICTIONARY[key][lang] || DICTIONARY[key].en || fallback || key;
    }
    return fallback || key;
  };

  const dir: Direction = lang === 'ar' ? 'rtl' : 'ltr';
  const isRtl = dir === 'rtl';

  return (
    <LanguageContext.Provider value={{ lang, dir, isRtl, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
