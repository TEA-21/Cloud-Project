import React from 'react';
import { useSecurity } from '../context/SecurityContext';
import StatusBadge from './StatusBadge';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Search, 
  Bell, 
  Zap, 
  Play, 
  Pause, 
  ChevronDown, 
  Activity, 
  Layers,
  HelpCircle,
  Command
} from 'lucide-react';

export default function Header({ onConfirmInjectThreat }) {
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
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40 px-4 sm:px-6 py-2.5 shadow-xs">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Brand Identity & Environment */}
        <div className="flex items-center gap-3">
          {/* Geometric Brand Mark from Reference */}
          <div className="w-8 h-8 rounded-lg bg-[#5B58F5] flex items-center justify-center text-white shadow-xs">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="font-bold text-gray-900 tracking-tight text-base font-sans">
              AELA <span className="font-medium text-[#5B58F5]">Security</span>
            </span>
          </div>

          <div className="h-4 w-px bg-gray-200 hidden sm:block mx-1" />

          {/* Environment Selector */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-700 bg-gray-50 hover:bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200 cursor-pointer transition-colors font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Production (us-east-1)</span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-0.5" />
          </div>

          {/* Incident Status Pill */}
          <StatusBadge status={systemStatus} />
        </div>

        {/* Center: Global Command / Search Input */}
        <div className="hidden md:flex items-center flex-1 max-w-md mx-4">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search resources, identities, cloud graphs..."
              className="w-full bg-gray-50 hover:bg-white focus:bg-white border border-gray-200 focus:border-[#5B58F5] text-gray-900 text-xs rounded-lg pl-9 pr-12 py-1.5 focus:outline-none transition-colors shadow-2xs placeholder:text-gray-400 font-sans"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[10px] text-gray-400 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded font-mono">
              <Command className="w-3 h-3" />
              <span>K</span>
            </div>
          </div>
        </div>

        {/* Right: Actions, Notifications & Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Telemetry Actions */}
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg p-0.5">
            <button
              onClick={triggerBurstTest}
              disabled={metrics.isBurstModeActive}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                metrics.isBurstModeActive
                  ? 'bg-amber-100 text-amber-800'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-white'
              }`}
              title="Simulate burst traffic to test JIT token issuance"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden lg:inline">{metrics.isBurstModeActive ? 'Bursting...' : 'Simulate burst'}</span>
            </button>

            <button
              onClick={onConfirmInjectThreat}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md text-gray-700 hover:text-gray-900 hover:bg-white transition-all"
              title="Inject synthetic credential extraction event"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
              <span className="hidden lg:inline">Inject threat</span>
            </button>

            <button
              onClick={toggleStreaming}
              className="p-1 text-gray-600 hover:text-gray-900 hover:bg-white rounded-md transition-all"
              title={isStreaming ? "Pause telemetry feed" : "Resume telemetry feed"}
            >
              {isStreaming ? (
                <Pause className="w-3.5 h-3.5 text-gray-500" />
              ) : (
                <Play className="w-3.5 h-3.5 text-emerald-600" />
              )}
            </button>
          </div>

          <div className="h-4 w-px bg-gray-200 hidden sm:block" />

          {/* Notifications */}
          <button 
            className="relative p-1.5 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
          </button>

          {/* User Profile */}
          <div className="flex items-center gap-2 pl-1">
            <div className="relative">
              <div className="w-7 h-7 rounded-full bg-[#EEEDFE] border border-[#5B58F5]/30 flex items-center justify-center text-[#5B58F5] font-semibold text-xs">
                TG
              </div>
              <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white" />
            </div>
            <div className="hidden xl:block text-left">
              <div className="text-xs font-semibold text-gray-900 leading-none">Tim Grater</div>
              <div className="text-[10px] text-gray-500 font-sans mt-0.5">SecOps Lead</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
