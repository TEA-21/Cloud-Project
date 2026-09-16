import React, { useState } from 'react';
import { useSecurity } from '../context/SecurityContext';
import StatusBadge from './StatusBadge';
import { 
  AlertTriangle, 
  ShieldAlert, 
  Check, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Globe, 
  Server, 
  Lock,
  ArrowRight
} from 'lucide-react';

export default function ActiveThreatPanel({ onQuarantineRequest }) {
  const { anomalies, dismissAnomaly } = useSecurity();
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  // Focus on highest severity threat first
  const activeThreat = anomalies.find(a => a.severity === 'CRITICAL') || anomalies[0];

  if (!activeThreat) {
    return (
      <div className="bg-graphite-900 border border-graphite-700/60 rounded-xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Check className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">No active threats detected</h3>
            <p className="text-xs text-slate-400 mt-0.5">Continuous telemetry ingestion running across CloudTrail and VPC logs.</p>
          </div>
        </div>
        <span className="text-xs font-mono text-slate-400">Heuristic Engine: Synced</span>
      </div>
    );
  }

  const isCritical = activeThreat.severity === 'CRITICAL';

  return (
    <div className={`rounded-xl border transition-all ${
      isCritical 
        ? 'bg-gradient-to-r from-graphite-900 via-graphite-900 to-rose-950/20 border-rose-800/80 shadow-soft' 
        : 'bg-graphite-900 border-graphite-700/80'
    } p-5`}>
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-graphite-800">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" /> Active security incident
          </span>
          <StatusBadge status={activeThreat.severity} size="xs" />
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Detected {new Date(activeThreat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span>•</span>
          <span>Threat Score: <strong className="text-rose-400 font-mono font-semibold">{Math.round(activeThreat.threatScore * 100)}%</strong></span>
        </div>
      </div>

      {/* Main Body */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Incident Summary (8 cols) */}
        <div className="lg:col-span-8 space-y-3">
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight">
              {activeThreat.title}
            </h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              {activeThreat.description}
            </p>
          </div>

          {/* Context Pills */}
          <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
            <div className="flex items-center gap-1.5 bg-graphite-850 px-2.5 py-1 rounded-md border border-graphite-700 text-slate-300">
              <Server className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Principal:</span>
              <strong className="text-slate-200 font-medium">{activeThreat.entityName || activeThreat.entityId}</strong>
            </div>

            <div className="flex items-center gap-1.5 bg-graphite-850 px-2.5 py-1 rounded-md border border-graphite-700 text-slate-300">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Source:</span>
              <span className="font-mono text-slate-200">{activeThreat.srcIp}</span>
            </div>

            <div className="flex items-center gap-1.5 bg-graphite-850 px-2.5 py-1 rounded-md border border-graphite-700 text-slate-300">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Vector:</span>
              <span className="text-amber-300 font-medium">{activeThreat.vector}</span>
            </div>
          </div>

          {/* Recommendation */}
          <div className="text-xs text-slate-300 bg-graphite-850/60 p-3 rounded-lg border border-graphite-700/60 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-200">Recommended action: </strong>
              <span>{activeThreat.recommendedAction}</span>
            </div>
          </div>
        </div>

        {/* Actions & Confirmation (4 cols) */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-3 self-stretch bg-graphite-850/70 p-4 rounded-lg border border-graphite-700/60">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Enforcement decision
            </span>
            <p className="text-xs text-slate-400 mb-3">
              Triggering quarantine invokes AWS Step Functions to revoke STS sessions and apply explicit deny.
            </p>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => onQuarantineRequest(activeThreat)}
              className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs py-2 px-4 rounded-lg transition-colors shadow-sm"
            >
              <span>Quarantine identity</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
              >
                <span>{showTechnicalDetails ? 'Hide technical details' : 'Technical details'}</span>
                {showTechnicalDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => dismissAnomaly(activeThreat.eventId)}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expandable Technical Details */}
      {showTechnicalDetails && (
        <div className="mt-4 pt-4 border-t border-graphite-800 font-mono text-xs text-slate-300 space-y-2 bg-graphite-950/70 p-3.5 rounded-lg border border-graphite-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-400 pb-1 border-b border-graphite-800">
            <span>EVENT ID: {activeThreat.eventId}</span>
            <span>TARGET RESOURCE:</span>
          </div>
          <p className="break-all text-[11px] text-slate-300 select-all">
            {activeThreat.target}
          </p>
          <div className="text-[11px] text-slate-400 pt-1">
            PRINCIPAL ARN: <span className="text-slate-300">arn:aws:iam::123456789012:role/{activeThreat.entityId}</span>
          </div>
        </div>
      )}
    </div>
  );
}
