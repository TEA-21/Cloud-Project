import React from 'react';

export default function StatusBadge({ status, size = 'sm' }) {
  const normalized = (status || '').toUpperCase();

  let colorClasses = 'bg-gray-100 text-gray-700 border-gray-200';
  let dotColor = 'bg-gray-400';
  let label = status;

  switch (normalized) {
    case 'ACTIVE':
    case 'OPERATIONAL':
    case 'HEALTHY':
    case 'RESOLVED':
      colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      dotColor = 'bg-emerald-500';
      label = status === 'OPERATIONAL' ? 'Operational' : status === 'ACTIVE' ? 'Active' : status;
      break;

    case 'EXPIRING':
    case 'EXPIRING SOON':
      colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
      dotColor = 'bg-amber-500 animate-pulse';
      label = 'Expiring soon';
      break;

    case 'REVOKED':
    case 'QUARANTINED':
      colorClasses = 'bg-gray-100 text-gray-600 border-gray-200';
      dotColor = 'bg-gray-400';
      label = 'Revoked';
      break;

    case 'CRITICAL':
    case 'FLAGGED':
    case 'VULNERABLE':
    case 'INCIDENT ACTIVE':
      colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
      dotColor = 'bg-rose-500';
      label = status === 'INCIDENT ACTIVE' ? 'Incident active' : status;
      break;

    case 'HIGH':
      colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
      dotColor = 'bg-amber-500';
      label = 'High risk';
      break;

    case 'MEDIUM':
      colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
      dotColor = 'bg-blue-500';
      label = 'Medium risk';
      break;

    default:
      label = status;
      break;
  }

  const sizeClasses = size === 'xs' 
    ? 'text-[11px] px-2 py-0.5' 
    : 'text-xs px-2.5 py-1';

  return (
    <span className={`inline-flex items-center gap-1.5 font-sans font-medium rounded-full border ${colorClasses} ${sizeClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
      <span>{label}</span>
    </span>
  );
}
