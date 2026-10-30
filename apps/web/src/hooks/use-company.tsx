'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ApiService } from '../services/api';
import { useAuth } from './use-auth';
import { useLanguage } from './use-language';
import { CurrencyCode, formatMoney as formatMoneyUtil, getCurrencySymbol as getCurrencySymbolUtil } from '../utils/currency';

interface CompanyContextType {
  company: any | null;
  currencyCode: CurrencyCode;
  currencySymbol: string;
  hasTransactions: boolean;
  loading: boolean;
  formatMoney: (amount: number | string | null | undefined, customCurrency?: string) => string;
  refreshCompanyProfile: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType>({
  company: null,
  currencyCode: 'EGP',
  currencySymbol: 'ج.م',
  hasTransactions: false,
  loading: false,
  formatMoney: (amt) => String(amt || 0),
  refreshCompanyProfile: async () => {},
});

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { user, activeTenantId } = useAuth();
  const { isRtl } = useLanguage();
  const [company, setCompany] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshCompanyProfile = useCallback(async () => {
    if (!user || !activeTenantId) {
      setCompany(null);
      setLoading(false);
      return;
    }

    try {
      const data = await ApiService.getCompanyProfile();
      setCompany(data);
    } catch (err) {
      console.error('Failed to load company profile:', err);
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id, activeTenantId]);

  useEffect(() => {
    refreshCompanyProfile();
  }, [refreshCompanyProfile]);

  const rawCode = (company?.currencyCode || 'EGP').toUpperCase();
  const currencyCode: CurrencyCode =
    rawCode === 'SAR' ? 'SAR' : rawCode === 'USD' ? 'USD' : 'EGP';

  const currencySymbol = getCurrencySymbolUtil(currencyCode, isRtl);

  const formatMoney = useCallback(
    (amount: number | string | null | undefined, customCurrency?: string) => {
      const code = customCurrency || currencyCode;
      return formatMoneyUtil(amount, code, isRtl);
    },
    [currencyCode, isRtl],
  );

  return (
    <CompanyContext.Provider
      value={{
        company,
        currencyCode,
        currencySymbol,
        hasTransactions: Boolean(company?.hasTransactions),
        loading,
        formatMoney,
        refreshCompanyProfile,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
