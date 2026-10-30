'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../src/hooks/use-auth';
import { ApiService } from '../src/services/api';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        const isDesktop = typeof window !== 'undefined' && !!(window as any).businessSuiteDesktop;
        if (user.isSuperAdmin && !isDesktop) {
          router.replace('/platform');
        } else {
          router.replace('/dashboard');
        }
      } else {
        ApiService.getSetupStatus()
          .then((status) => {
            if (status && status.needsSetup) {
              router.replace('/setup');
            } else {
              router.replace('/login');
            }
          })
          .catch(() => {
            router.replace('/login');
          });
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400 mx-auto mb-4"></div>
        <p className="text-slate-400">جاري تحميل BusinessSuite...</p>
      </div>
    </div>
  );
}
