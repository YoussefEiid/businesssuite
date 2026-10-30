import React from 'react';
import { Skeleton } from './Skeleton';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  icon: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  loading?: boolean;
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  unit,
  subtext,
  icon,
  iconBg = 'bg-sky-50 dark:bg-sky-950/50',
  iconColor = 'text-sky-600 dark:text-sky-400',
  loading = false,
  trend,
  onClick,
}: StatCardProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
        <div className="mt-4">
          <Skeleton className="h-8 w-36 mb-2" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition hover:border-slate-300 dark:hover:border-slate-700 ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{title}</span>
        <div className={`p-2 rounded-lg ${iconBg} ${iconColor}`}>
          {icon}
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-baseline gap-1.5">
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums tracking-tight">
            {value}
          </h3>
          {unit && (
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{unit}</span>
          )}
        </div>

        {(subtext || trend) && (
          <div className="mt-1 flex items-center justify-between text-2xs">
            {subtext && <span className="text-slate-500 dark:text-slate-400">{subtext}</span>}
            {trend && (
              <span
                className={`inline-flex items-center gap-0.5 font-bold ${
                  trend.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {trend.isPositive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {trend.value}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
