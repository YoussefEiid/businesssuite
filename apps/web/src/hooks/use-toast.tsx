'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastContextType {
  toasts: ToastItem[];
  show: (type: ToastType, message: string, title?: string) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  remove: (id: string) => void;
}

const ToastContext = createContext<ToastContextType>({} as ToastContextType);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((type: ToastType, message: string, title?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newToast: ToastItem = { id, type, message, title };

    setToasts((prev) => [...prev.slice(-4), newToast]); // keep max 5 visible

    setTimeout(() => {
      remove(id);
    }, 4500);
  }, [remove]);

  const success = useCallback((message: string, title?: string) => show('success', message, title), [show]);
  const error = useCallback((message: string, title?: string) => show('error', message, title), [show]);
  const warning = useCallback((message: string, title?: string) => show('warning', message, title), [show]);
  const info = useCallback((message: string, title?: string) => show('info', message, title), [show]);

  return (
    <ToastContext.Provider value={{ toasts, show, success, error, warning, info, remove }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={remove} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 start-5 z-[99999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        let borderClass = 'border-sky-500/30 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100';
        let Icon = Info;
        let iconColor = 'text-sky-500';

        if (toast.type === 'success') {
          borderClass = 'border-emerald-500/30 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100';
          Icon = CheckCircle2;
          iconColor = 'text-emerald-500';
        } else if (toast.type === 'warning') {
          borderClass = 'border-amber-500/30 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100';
          Icon = AlertTriangle;
          iconColor = 'text-amber-500';
        } else if (toast.type === 'error') {
          borderClass = 'border-rose-500/30 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100';
          Icon = AlertCircle;
          iconColor = 'text-rose-500';
        }

        return (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-modal backdrop-blur-md transition-all duration-200 transform translate-y-0 ${borderClass}`}
          >
            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColor}`} />
            <div className="flex-1 min-w-0">
              {toast.title && <h4 className="text-xs font-bold leading-tight mb-0.5">{toast.title}</h4>}
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 break-words">{toast.message}</p>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded transition"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export const useToast = () => useContext(ToastContext);
