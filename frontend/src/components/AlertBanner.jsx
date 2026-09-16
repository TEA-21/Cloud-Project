import React from 'react';
import { useSecurity } from '../context/SecurityContext';
import { ShieldAlert, ArrowRight, CheckCircle, ShieldCheck } from 'lucide-react';

export default function AlertBanner({ onReviewIncident }) {
  const { anomalies } = useSecurity();

  const activeThreat = anomalies.find(a => a.severity === 'CRITICAL') || anomalies[0];

  if (!activeThreat) {
    return (
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-emerald-900">Zero active security threats</h3>
            <p className="text-[11px] text-emerald-700">Autonomous ephemeral least-privilege enforcement active across all VPC workloads.</p>
          </div>
        </div>
        <span className="text-xs font-mono text-emerald-700 font-medium">100% Policy Compliant</span>
      </div>
    );
  }

  return (
    <div className="bg-white border border-rose-200 rounded-xl p-3.5 sm:px-4 sm:py-3 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-3 border-l-4 border-l-rose-500">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
          <ShieldAlert className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs sm:text-sm font-semibold text-gray-900">
              1 high-priority threat requires immediate review
            </h3>
            <span className="text-[10px] font-semibold bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded-full uppercase">
              Critical
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {activeThreat.title} &bull; Target: <span className="font-mono text-gray-700">{activeThreat.entityName || activeThreat.entityId}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 self-end md:self-center">
        {/* Infrastructure health indicators */}
        <div className="hidden lg:flex items-center gap-3 text-xs font-mono text-gray-500 pr-2 border-r border-gray-200">
          <span className="flex items-center gap-1 text-emerald-700">
            <CheckCircle className="w-3.5 h-3.5" /> Step Functions: Ready
          </span>
          <span className="flex items-center gap-1 text-emerald-700">
            <CheckCircle className="w-3.5 h-3.5" /> Ledger: Synced
          </span>
        </div>

        <button
          onClick={() => onReviewIncident(activeThreat)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#5B58F5] hover:bg-[#4B47E6] text-white transition-all shadow-xs"
        >
          <span>Review incident</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
