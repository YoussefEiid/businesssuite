import './globals.css';
import { fontInter, fontArabic } from './fonts';
import { AuthProvider } from '../src/hooks/use-auth';
import { CompanyProvider } from '../src/hooks/use-company';
import { EntitlementsProvider } from '../src/hooks/use-entitlements';
import { ThemeProvider } from '../src/hooks/use-theme';
import { LanguageProvider } from '../src/hooks/use-language';
import { ToastProvider } from '../src/hooks/use-toast';
import { ConfirmDialogProvider } from '../src/hooks/use-confirm';

export const metadata = {
  title: 'BusinessSuite - Commercial ERP & Multi-Tenant SaaS',
  description: 'Enterprise Sales, Purchases, Inventory, CRM, and Treasury Management Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={`${fontArabic.variable} ${fontInter.variable}`}>
      <body className="min-h-screen bg-canvas text-content-primary antialiased selection:bg-sky-500/20 selection:text-sky-700 dark:selection:text-sky-300">
        <LanguageProvider>
          <ThemeProvider>
            <AuthProvider>
              <CompanyProvider>
                <EntitlementsProvider>
                  <ToastProvider>
                    <ConfirmDialogProvider>
                      {children}
                    </ConfirmDialogProvider>
                  </ToastProvider>
                </EntitlementsProvider>
              </CompanyProvider>
            </AuthProvider>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
