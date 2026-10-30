/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--color-bg-canvas)',
        surface: {
          DEFAULT: 'var(--color-bg-surface)',
          raised: 'var(--color-bg-surface-raised)',
          subtle: 'var(--color-bg-surface-subtle)',
          input: 'var(--color-bg-input)',
        },
        border: {
          subtle: 'var(--color-border-subtle)',
          DEFAULT: 'var(--color-border-default)',
          strong: 'var(--color-border-strong)',
        },
        content: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          inverse: 'var(--color-text-inverse)',
        },
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          DEFAULT: 'var(--color-brand-primary)',
          hover: 'var(--color-brand-primary-hover)',
          light: 'var(--color-brand-light)',
        },
        status: {
          success: {
            DEFAULT: 'var(--color-success)',
            bg: 'var(--color-success-bg)',
            border: 'var(--color-success-border)',
            text: 'var(--color-success-text)',
          },
          warning: {
            DEFAULT: 'var(--color-warning)',
            bg: 'var(--color-warning-bg)',
            border: 'var(--color-warning-border)',
            text: 'var(--color-warning-text)',
          },
          danger: {
            DEFAULT: 'var(--color-danger)',
            bg: 'var(--color-danger-bg)',
            border: 'var(--color-danger-border)',
            text: 'var(--color-danger-text)',
          },
          info: {
            DEFAULT: 'var(--color-info)',
            bg: 'var(--color-info-bg)',
            border: 'var(--color-info-border)',
            text: 'var(--color-info-text)',
          },
        },
      },
      fontFamily: {
        sans: ['var(--font-arabic)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        subtle: 'var(--shadow-subtle)',
        card: 'var(--shadow-card)',
        dropdown: 'var(--shadow-dropdown)',
        modal: 'var(--shadow-modal)',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '0.875rem' }],
      },
    },
  },
  plugins: [],
};
