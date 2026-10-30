'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { ApiService } from '../services/api';
import { UserProfile } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  activeTenantId: string | null;
  login: (email: string, pass: string, tenantId?: string) => Promise<any>;
  logout: () => void;
  switchTenant: (tenantId: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);

  const refreshProfile = async () => {
    const token = localStorage.getItem('bs_access_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const profile = await ApiService.getProfile();
      setUser(profile);
      const storedTenant = localStorage.getItem('bs_active_tenant_id');
      if (storedTenant) {
        setActiveTenantId(storedTenant);
      } else if (profile.memberships && profile.memberships.length > 0) {
        const firstTenant = profile.memberships[0].tenantId;
        setActiveTenantId(firstTenant);
        localStorage.setItem('bs_active_tenant_id', firstTenant);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      localStorage.removeItem('bs_access_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  const login = async (email: string, pass: string, tenantId?: string) => {
    const data = await ApiService.login({ email, password: pass, tenantId });
    localStorage.setItem('bs_access_token', data.accessToken);
    if (data.user?.activeTenantId) {
      localStorage.setItem('bs_active_tenant_id', data.user.activeTenantId);
      setActiveTenantId(data.user.activeTenantId);
    }
    await refreshProfile();
    return data;
  };

  const logout = () => {
    localStorage.removeItem('bs_access_token');
    localStorage.removeItem('bs_active_tenant_id');
    setUser(null);
    setActiveTenantId(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  const switchTenant = async (targetTenantId: string) => {
    const res = await ApiService.switchTenant(targetTenantId);
    localStorage.setItem('bs_access_token', res.accessToken);
    localStorage.setItem('bs_active_tenant_id', targetTenantId);
    setActiveTenantId(targetTenantId);
    await refreshProfile();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        activeTenantId,
        login,
        logout,
        switchTenant,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
