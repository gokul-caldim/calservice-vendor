import React, { useEffect } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export function ErrorState({
  title = '',
  message = '',
  type = 'error', // 'error', 'warning', 'info', 'success'
  onDismiss = null,
  autoDismissMs = 5000,
  className = '',
}) {
  useEffect(() => {
    if (onDismiss && autoDismissMs > 0 && (message || title)) {
      const timer = setTimeout(() => {
        onDismiss();
      }, autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [message, title, onDismiss, autoDismissMs]);

  if (!message && !title) return null;

  const configs = {
    error: {
      bg: 'bg-rose-50 border-rose-200 text-rose-800',
      icon: AlertCircle,
      iconColor: 'text-rose-600',
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200 text-amber-800',
      icon: AlertTriangle,
      iconColor: 'text-amber-600',
    },
    info: {
      bg: 'bg-blue-50 border-blue-200 text-blue-800',
      icon: Info,
      iconColor: 'text-blue-600',
    },
    success: {
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      icon: CheckCircle2,
      iconColor: 'text-emerald-600',
    },
  };

  const config = configs[type] || configs.error;
  const Icon = config.icon;

  return (
    <div
      className={`p-3 rounded border flex items-start justify-between gap-3 text-xs ${config.bg} ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${config.iconColor}`} />
        <div>
          {title && <p className="font-bold">{title}</p>}
          <p className="font-medium leading-relaxed">{message}</p>
        </div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-0.5 rounded hover:bg-black/5 text-current opacity-70 hover:opacity-100"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default ErrorState;
