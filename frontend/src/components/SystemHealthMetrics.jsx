import React from 'react';
import { useSecurity } from '../context/SecurityContext';
import { 
  Gauge, 
  Activity, 
  Clock3, 
  Zap, 
  Database, 
  TrendingUp, 
  AlertCircle, 
  ShieldCheck, 
  Cpu 
} from 'lucide-react';

export default function SystemHealthMetrics() {
  const { metrics } = useSecurity();

  // Generate SVG Sparkline from throughput history
  const history = metrics.historyThroughput;
  const minVal = Math.min(...history) * 0.9;
  const maxVal = Math.max(...history) * 1.1;
  const width = 220;
  const height = 45;

  const points = history.map((val, idx) => {
    const x = (idx / (history.length - 1)) * width;
    const y = height - ((val - minVal) / (maxVal - minVal || 1)) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="border border-matrix-border bg-canvas-base flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-matrix-border bg-canvas-surface">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 bg-cyber-cyan" />
          <h2 className="font-sans font-bold text-sm tracking-wider uppercase text-white">
            System Health // Telemetry & Burst Load Metrics
          </h2>
        </div>
        <span className="text-[11px] font-mono text-cyber-cyan bg-cyber-cyan/10 border border-cyber-cyan/40 px-2 py-0.5">
          {metrics.isBurstModeActive ? 'JMETER BURST TEST RUNNING' : 'BASELINE SYNTHETIC RUN'}
        </span>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
        {/* Metric 1: Throughput with Sparkline */}
        <div className="border border-matrix-border bg-canvas-surface p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-cyber-muted text-xs font-mono">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyber-lime" /> THROUGHPUT (RPS)
            </span>
            <span className="text-cyber-lime text-[10px] font-bold">API GATEWAY</span>
          </div>

          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-white tabular-nums">
              {metrics.throughputRps} <span className="text-xs text-cyber-muted font-normal">req/s</span>
            </div>
            <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
              TARGET: <span className="text-zinc-200">/jit/v1/assume-role</span>
            </div>
          </div>

          {/* Sparkline */}
          <div className="mt-1 pt-2 border-t border-matrix-border/80">
            <div className="flex justify-between text-[9px] text-zinc-500 font-mono mb-1">
              <span>BURST WINDOW (T-60s)</span>
              <span className="text-cyber-lime font-bold">LIVE</span>
            </div>
            <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
              <polyline
                fill="none"
                stroke={metrics.isBurstModeActive ? '#ff2a2a' : '#ccff00'}
                strokeWidth="2"
                points={points}
              />
            </svg>
          </div>
        </div>

        {/* Metric 2: Latency Percentiles */}
        <div className="border border-matrix-border bg-canvas-surface p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-cyber-muted text-xs font-mono">
            <span className="flex items-center gap-1.5">
              <Clock3 className="w-3.5 h-3.5 text-cyber-cyan" /> PROXY LATENCY
            </span>
            <span className="text-zinc-400 text-[10px]">AWS STS MINT</span>
          </div>

          <div className="grid grid-cols-3 gap-2 my-2 font-mono">
            <div className="border border-matrix-border bg-canvas-deep p-2 text-center">
              <span className="text-[10px] text-cyber-muted block">p50</span>
              <span className="text-sm font-bold text-cyber-lime tabular-nums">{metrics.latencyP50}ms</span>
            </div>
            <div className="border border-matrix-border bg-canvas-deep p-2 text-center">
              <span className="text-[10px] text-cyber-muted block">p95</span>
              <span className="text-sm font-bold text-cyber-cyan tabular-nums">{metrics.latencyP95}ms</span>
            </div>
            <div className={`border p-2 text-center ${
              metrics.latencyP99 > 40 ? 'border-cyber-crimson bg-cyber-crimson/10' : 'border-matrix-border bg-canvas-deep'
            }`}>
              <span className="text-[10px] text-cyber-muted block">p99</span>
              <span className={`text-sm font-bold tabular-nums ${metrics.latencyP99 > 40 ? 'text-cyber-crimson' : 'text-cyber-amber'}`}>
                {metrics.latencyP99}ms
              </span>
            </div>
          </div>

          <div className="text-[10px] font-mono text-zinc-400 border-t border-matrix-border/80 pt-2 flex items-center justify-between">
            <span>SLA BOUNDARY: 100ms</span>
            <span className="text-cyber-lime font-bold">100% COMPLIANT</span>
          </div>
        </div>

        {/* Metric 3: Ledger State & Quarantined Principals */}
        <div className="border border-matrix-border bg-canvas-surface p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-cyber-muted text-xs font-mono">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-cyber-purple" /> STATE LEDGER
            </span>
            <span className="text-cyber-purple text-[10px]">DYNAMODB</span>
          </div>

          <div className="my-2 space-y-1.5 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-[11px]">ACTIVE LEASES:</span>
              <span className="text-cyber-lime font-extrabold">{metrics.activeLeaseCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-[11px]">QUARANTINED IDENTITIES:</span>
              <span className="text-cyber-crimson font-extrabold">{metrics.quarantineTotal}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-[11px]">INACTIVITY DECAY LIMIT:</span>
              <span className="text-zinc-200">300s</span>
            </div>
          </div>

          <div className="text-[10px] font-mono text-zinc-400 border-t border-matrix-border/80 pt-2 flex items-center justify-between">
            <span>LEDGER CONSISTENCY:</span>
            <span className="text-cyber-cyan font-semibold">STRONG READS</span>
          </div>
        </div>

        {/* Metric 4: Closed-Loop Automation Engine */}
        <div className="border border-matrix-border bg-canvas-surface p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-cyber-muted text-xs font-mono">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyber-lime" /> CLOSED-LOOP ENGINE
            </span>
            <span className="text-cyber-lime text-[10px]">AUTONOMIC</span>
          </div>

          <div className="my-2 font-mono text-[11px] space-y-1 text-zinc-300">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-cyber-lime rounded-full" />
              <span>Step Functions Workflow: <b>READY</b></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-cyber-lime rounded-full" />
              <span>CloudWatch Tail Aggregator: <b>SYNCED</b></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-cyber-lime rounded-full" />
              <span>SNS Security Alerts: <b>DISPATCHED</b></span>
            </div>
          </div>

          <div className="text-[10px] font-mono text-zinc-400 border-t border-matrix-border/80 pt-2 flex items-center justify-between">
            <span>ZERO STANDING PRIVILEGE:</span>
            <span className="text-cyber-lime font-extrabold">ENFORCED</span>
          </div>
        </div>
      </div>
    </div>
  );
}
