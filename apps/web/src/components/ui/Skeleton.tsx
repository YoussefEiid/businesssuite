import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'rectangular' | 'circular' | 'rounded';
}

export function Skeleton({ className, variant = 'rounded', ...props }: SkeletonProps) {
  const variantStyles = {
    rectangular: '',
    circular: 'rounded-full',
    rounded: 'rounded-lg',
  };

  return (
    <div
      className={twMerge(
        clsx(
          'animate-pulse bg-slate-200 dark:bg-slate-800/80',
          variantStyles[variant],
          className,
        ),
      )}
      {...props}
    />
  );
}

export function TableSkeletonRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="border-b border-slate-100 dark:border-slate-800/60">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <td key={cIdx} className="p-3">
              <Skeleton className="h-4 w-full max-w-[140px]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
