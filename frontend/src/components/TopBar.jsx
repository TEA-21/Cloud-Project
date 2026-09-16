import React from 'react';
import { useSecurity } from '../context/SecurityContext';
import StatusBadge from './StatusBadge';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Zap, 
  Play, 
  Pause, 
  ChevronDown, 
  UserCircle2, 
  AlertTriangle 
} from 'lucide-react';

export default function TopBar({ onConfirmInjectThreat }) {
  const { 
    isStreaming, 
    toggleStreaming, 
    triggerBurstTest, 
    metrics, 
    anomalies 
  } = useSecurity();

  const hasCriticalIncident = anomalies.some(a => a.severity === 'CRITICAL');
  const systemStatus = hasCriticalIncident ? 'INCIDENT ACTIVE' : 'OPERATIONAL';

  return (
    <header className="bg-graphite-900 border-b border-graphite-700/80 px-4 sm:px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Product Identity & Environment */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-slate-100 tracking-tight text-sm">
                AELA <span className="font-normal text-slate-400">Security</span>
              </span>
            </div>
          </div>

          <div className="h-4 w-px bg-graphite-700 hidden sm:block" />

          {/* Environment Selector */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-300 bg-graphite-850 px-2.5 py-1 rounded-md border border-graphite-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Production (us-east-1)</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
          </div>

          {/* Overall System Status */}
          <StatusBadge status={systemStatus} />
        </div>

        {/* Right: Actions & Profile */}
        <div className="flex items-center gap-2.5">
          {/* Streamlined Live Controls */}
          <div className="flex items-center bg-graphite-850 rounded-lg p-0.5 border border-graphite-700">
            <button
              onClick={triggerBurstTest}
              disabled={metrics.isBurstModeActive}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                metrics.isBurstModeActive
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'text-slate-300 hover:text-white hover:bg-graphite-700'
              }`}
              title="Simulate burst traffic to test temporary lease issuance"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">{metrics.isBurstModeActive ? 'Burst Active' : 'Simulate burst'}</span>
            </button>

            <button
              onClick={onConfirmInjectThreat}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-slate-300 hover:text-white hover:bg-graphite-700 transition-all"
              title="Inject simulated credential extraction attempt"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden md:inline">Inject threat</span>
            </button>

            <button
              onClick={toggleStreaming}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-graphite-700 rounded-md transition-all"
              title={isStreaming ? "Pause telemetry feed" : "Resume telemetry feed"}
            >
              {isStreaming ? (
                <Pause className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <Play className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </button>
          </div>

          <div className="h-4 w-px bg-graphite-700 hidden sm:block" />

          {/* User Profile */}
          <div className="flex items-center gap-2 text-xs text-slate-300 pl-1">
            <div className="w-7 h-7 rounded-full bg-graphite-700 flex items-center justify-center text-slate-300 font-medium text-xs">
              SA
            </div>
            <span className="hidden lg:inline font-medium text-slate-200">SecOps Admin</span>
          </div>
        </div>
      </div>
    </header>
  );
}
