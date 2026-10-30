import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  iconPosition?: 'start' | 'end';
  requiredStar?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      icon,
      iconPosition = 'start',
      requiredStar,
      required,
      id,
      ...props
    },
    ref,
  ) => {
    const inputId = id || (label ? `input-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

    return (
      <div className="w-full space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            {label}
            {(required || requiredStar) && <span className="text-rose-500 ms-1">*</span>}
          </label>
        )}

        <div className="relative rounded-lg shadow-2xs">
          {icon && iconPosition === 'start' && (
            <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-slate-400">
              {icon}
            </div>
          )}

          <input
            id={inputId}
            ref={ref}
            required={required}
            className={twMerge(
              clsx(
                'block w-full h-9 rounded-lg border text-sm transition placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed',
                'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700',
                icon && iconPosition === 'start' ? 'ps-9 pe-3' : '',
                icon && iconPosition === 'end' ? 'ps-3 pe-9' : '',
                !icon ? 'px-3' : '',
                error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/30',
                className,
              ),
            )}
            {...props}
          />

          {icon && iconPosition === 'end' && (
            <div className="absolute inset-y-0 end-0 pe-3 flex items-center pointer-events-none text-slate-400">
              {icon}
            </div>
          )}
        </div>

        {error ? (
          <p className="text-2xs text-rose-600 dark:text-rose-400">{error}</p>
        ) : helperText ? (
          <p className="text-2xs text-slate-500 dark:text-slate-400">{helperText}</p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';
