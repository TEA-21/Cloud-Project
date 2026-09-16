import React from 'react';
import { useSecurity } from '../context/SecurityContext';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Activity, 
  Zap, 
  Radio, 
  Pause, 
  Play, 
  RefreshCw, 
  Terminal, 
  AlertTriangle 
} from 'lucide-react';

export default function DashboardHeader() {
  const { 
    isStreaming, 
    streamHealth, 
    toggleStreaming, 
    triggerBurstTest, 
    injectManualAnomaly, 
    metrics 
  } = useSecurity();

  const isCriticalThreat = metrics.aggregateThreatIndex > 0.75;

  return (
    <header className="border border-matrix-border bg-canvas-base/95 backdrop-blur px-5 py-3.5 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Brand & Status */}
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center w-10 h-10 bg-canvas-card border border-matrix-borderLight">
            <ShieldCheck className="w-6 h-6 text-cyber-lime" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyber-lime animate-ping" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-sans font-extrabold tracking-wider text-lg text-white uppercase">
                AELA <span className="text-cyber-lime font-mono text-xs font-normal border border-cyber-lime/40 px-1.5 py-0.5 ml-1">JIT PROXY v2.4</span>
              </h1>
              <span className="text-[10px] tracking-widest text-cyber-muted px-2 py-0.5 border border-matrix-border uppercase">
                Zero Standing Privilege
              </span>
            </div>
            <p className="text-xs text-cyber-muted font-mono flex items-center gap-2 mt-0.5">
              <span>ENCLAVE: AWS::US-EAST-1</span>
              <span>•</span>
              <span className="text-zinc-400">AUTONOMOUS REVOCATION ENGINE</span>
            </p>
          </div>
        </div>

        {/* Center: Live Telemetry Status Badges */}
        <div className="flex items-center flex-wrap gap-2 text-xs font-mono">
          <div className="flex items-center gap-2 bg-canvas-surface px-3 py-1.5 border border-matrix-border">
            <Radio className={`w-3.5 h-3.5 ${isStreaming ? 'text-cyber-lime animate-pulse' : 'text-zinc-500'}`} />
            <span className="text-cyber-muted">SSE STREAM:</span>
            <span className={isStreaming ? 'text-cyber-lime font-semibold' : 'text-zinc-400'}>
              {streamHealth}
            </span>
          </div>

          <div className="flex items-center gap-2 bg-canvas-surface px-3 py-1.5 border border-matrix-border">
            <Activity className="w-3.5 h-3.5 text-cyber-cyan" />
            <span className="text-cyber-muted">INGEST RATE:</span>
            <span className="text-cyber-cyan font-bold tabular-nums">
              {metrics.evaluatedRecordsPerSec.toLocaleString()} evt/s
            </span>
          </div>

          <div className={`flex items-center gap-2 bg-canvas-surface px-3 py-1.5 border ${
            isCriticalThreat ? 'border-cyber-crimson/80 bg-cyber-crimson/10' : 'border-matrix-border'
          }`}>
            <AlertTriangle className={`w-3.5 h-3.5 ${isCriticalThreat ? 'text-cyber-crimson animate-bounce' : 'text-cyber-amber'}`} />
            <span className="text-cyber-muted">THREAT INDEX:</span>
            <span className={`font-bold tabular-nums ${isCriticalThreat ? 'text-cyber-crimson' : 'text-cyber-amber'}`}>
              {(metrics.aggregateThreatIndex * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Right: Simulation Controls */}
        <div className="flex items-center gap-2">
          <button
            id="btn-burst-traffic"
            onClick={triggerBurstTest}
            disabled={metrics.isBurstModeActive}
            title="Simulate burst traffic from Apache JMeter load test"
            className={`flex items-center gap-1.5 text-xs font-mono px-3 py-2 border transition-all uppercase font-semibold ${
              metrics.isBurstModeActive
                ? 'border-cyber-cyan bg-cyber-cyan/20 text-cyber-cyan cursor-wait'
                : 'border-matrix-borderLight bg-canvas-surface hover:border-cyber-cyan hover:text-cyber-cyan text-zinc-300'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{metrics.isBurstModeActive ? 'Burst Active...' : 'Simulate Burst'}</span>
          </button>

          <button
            id="btn-inject-anomaly"
            onClick={injectManualAnomaly}
            title="Inject an adversarial SSRF privilege-escalation vector"
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-2 border border-matrix-borderLight bg-canvas-surface hover:border-cyber-crimson hover:text-cyber-crimson text-zinc-300 transition-all uppercase font-semibold"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-cyber-crimson" />
            <span>Inject Threat</span>
          </button>

          <button
            id="btn-toggle-stream"
            onClick={toggleStreaming}
            title={isStreaming ? "Pause simulated SSE stream" : "Resume simulated SSE stream"}
            className="flex items-center justify-center w-9 h-9 border border-matrix-borderLight bg-canvas-surface hover:border-zinc-500 text-zinc-300 transition-all"
          >
            {isStreaming ? <Pause className="w-4 h-4 text-cyber-amber" /> : <Play className="w-4 h-4 text-cyber-lime" />}
          </button>
        </div>
      </div>
    </header>
  );
}
