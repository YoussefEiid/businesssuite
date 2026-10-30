'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { ApiService } from '../services/api';
import { TenantEntitlements } from '../types';
import { useAuth } from './use-auth';

interface EntitlementsContextType {
  entitlements: TenantEntitlements | null;
  loading: boolean;
  hasFeature: (featureKey: string) => boolean;
  getQuota: (quotaKey: string) => number;
  refreshEntitlements: () => Promise<void>;
}

const EntitlementsContext = createContext<EntitlementsContextType>({} as EntitlementsContextType);

export function EntitlementsProvider({ children }: { children: React.ReactNode }) {
  const { user, activeTenantId } = useAuth();
  const [entitlements, setEntitlements] = useState<TenantEntitlements | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshEntitlements = async () => {
    if (!user || !activeTenantId) {
      setEntitlements(null);
      setLoading(false);
      return;
    }

    try {
      const data = await ApiService.getMyEntitlements();
      setEntitlements(data);
    } catch (err) {
      console.error('Failed to load entitlements:', err);
      setEntitlements(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshEntitlements();
  }, [user?.id, activeTenantId]);

  const hasFeature = (featureKey: string): boolean => {
    if (!entitlements) return false;
    if (entitlements.isSingleTenant) return true;
    if (user?.isSuperAdmin && !activeTenantId) return true;
    if (!entitlements.isSubscriptionActive) return false;
    return entitlements.features.includes(featureKey);
  };

  const getQuota = (quotaKey: string): number => {
    if (!entitlements) return -1;
    return entitlements.quotas[quotaKey] ?? -1;
  };

  return (
    <EntitlementsContext.Provider
      value={{
        entitlements,
        loading,
        hasFeature,
        getQuota,
        refreshEntitlements,
      }}
    >
      {children}
    </EntitlementsContext.Provider>
  );
}

export const useEntitlements = () => useContext(EntitlementsContext);
