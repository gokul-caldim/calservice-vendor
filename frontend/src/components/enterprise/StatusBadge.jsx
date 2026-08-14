import React from 'react';

const STATUS_CONFIGS = {
  // Application & Verification statuses
  approved: {
    label: 'Approved',
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  active: {
    label: 'Active',
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  online: {
    label: 'Online',
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500 animate-pulse',
  },
  available: {
    label: 'Available',
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  submitted: {
    label: 'Submitted',
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
  },
  under_review: {
    label: 'Under Review',
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
  },
  pending: {
    label: 'Pending',
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
  },
  correction_required: {
    label: 'Correction Required',
    bg: 'bg-orange-50 text-orange-800 border-orange-200',
    dot: 'bg-orange-500',
  },
  rejected: {
    label: 'Rejected',
    bg: 'bg-rose-50 text-rose-800 border-rose-200',
    dot: 'bg-rose-500',
  },
  offline: {
    label: 'Offline',
    bg: 'bg-slate-100 text-slate-700 border-slate-300',
    dot: 'bg-slate-400',
  },
  not_started: {
    label: 'Not Started',
    bg: 'bg-slate-100 text-slate-700 border-slate-300',
    dot: 'bg-slate-400',
  },
  
  // Job & Dispatch statuses
  assigned: {
    label: 'Assigned',
    bg: 'bg-blue-50 text-blue-800 border-blue-200',
    dot: 'bg-blue-500',
  },
  accepted: {
    label: 'Accepted',
    bg: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    dot: 'bg-indigo-500',
  },
  on_the_way: {
    label: 'On The Way',
    bg: 'bg-sky-50 text-sky-800 border-sky-200',
    dot: 'bg-sky-500',
  },
  arrived: {
    label: 'Arrived',
    bg: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    dot: 'bg-cyan-500',
  },
  in_progress: {
    label: 'In Progress',
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
  },
  completed: {
    label: 'Completed',
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'bg-slate-100 text-slate-700 border-slate-300',
    dot: 'bg-slate-400',
  },

  // Payment statuses
  collected: {
    label: 'Cash Collected',
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  pending_collection: {
    label: 'COD Pending',
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
  },
};

export function StatusBadge({ status = '', label = '', size = 'sm', showDot = true, className = '' }) {
  const normalizedKey = String(status || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
  const config = STATUS_CONFIGS[normalizedKey] || {
    label: label || status.replace(/_/g, ' ') || 'Unknown',
    bg: 'bg-slate-100 text-slate-700 border-slate-300',
    dot: 'bg-slate-400',
  };

  const displayLabel = label || config.label;
  const isXs = size === 'xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 border font-medium uppercase tracking-wider rounded ${
        isXs ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
      } ${config.bg} ${className}`}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />}
      <span className="truncate">{displayLabel}</span>
    </span>
  );
}

export default StatusBadge;
