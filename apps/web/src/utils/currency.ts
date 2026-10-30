export type CurrencyCode = 'EGP' | 'SAR' | 'USD';

export interface CurrencyOption {
  code: CurrencyCode;
  nameAr: string;
  nameEn: string;
  symbolAr: string;
  symbolEn: string;
}

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  {
    code: 'EGP',
    nameAr: 'جنيه مصري',
    nameEn: 'Egyptian Pound',
    symbolAr: 'ج.م',
    symbolEn: 'EGP',
  },
  {
    code: 'SAR',
    nameAr: 'ريال سعودي',
    nameEn: 'Saudi Riyal',
    symbolAr: 'ر.س',
    symbolEn: 'SAR',
  },
  {
    code: 'USD',
    nameAr: 'دولار أمريكي',
    nameEn: 'US Dollar',
    symbolAr: '$',
    symbolEn: '$',
  },
];

/**
 * Resolves the display symbol for a given currency code and direction.
 */
export function getCurrencySymbol(
  currencyCode?: string | null,
  isRtlOrLocale: boolean | string = true,
): string {
  const isRtl = typeof isRtlOrLocale === 'boolean' ? isRtlOrLocale : isRtlOrLocale === 'ar';
  const code = (currencyCode || 'EGP').toUpperCase();

  if (isRtl) {
    switch (code) {
      case 'EGP':
        return 'ج.م';
      case 'SAR':
        return 'ر.س';
      case 'USD':
        return '$';
      default:
        return code;
    }
  } else {
    switch (code) {
      case 'EGP':
        return 'EGP';
      case 'SAR':
        return 'SAR';
      case 'USD':
        return '$';
      default:
        return code;
    }
  }
}

/**
 * Standard centralized money formatter across BusinessSuite.
 * Format examples:
 * - Arabic:
 *   - EGP: 500.00 ج.م
 *   - SAR: 500.00 ر.س
 *   - USD: 500.00 $
 * - English:
 *   - EGP: EGP 500.00
 *   - SAR: SAR 500.00
 *   - USD: $500.00
 */
export function formatMoney(
  amount: number | string | null | undefined,
  currencyCode?: string | null,
  isRtlOrLocale: boolean | string = true,
): string {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount || '0')) || 0;
  const isRtl = typeof isRtlOrLocale === 'boolean' ? isRtlOrLocale : isRtlOrLocale === 'ar';
  const formattedNumber = num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const code = (currencyCode || 'EGP').toUpperCase();

  if (isRtl) {
    switch (code) {
      case 'EGP':
        return `${formattedNumber} ج.م`;
      case 'SAR':
        return `${formattedNumber} ر.س`;
      case 'USD':
        return `${formattedNumber} $`;
      default:
        return `${formattedNumber} ${code}`;
    }
  } else {
    switch (code) {
      case 'EGP':
        return `EGP ${formattedNumber}`;
      case 'SAR':
        return `SAR ${formattedNumber}`;
      case 'USD':
        return `$${formattedNumber}`;
      default:
        return `${code} ${formattedNumber}`;
    }
  }
}
