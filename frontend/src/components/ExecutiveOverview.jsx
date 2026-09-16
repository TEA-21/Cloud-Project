import React from 'react';
import { useSecurity } from '../context/SecurityContext';
import MetricCard from './MetricCard';
import { Activity, Clock, Key, ShieldCheck, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function ExecutiveOverview() {
  const { metrics, sessions, anomalies } = useSecurity();

  const activeLeaseCount = sessions.filter(s => s.status === 'ACTIVE' || s.status === 'EXPIRING').length;
  const criticalThreatCount = anomalies.filter(a => a.severity === 'CRITICAL').length;
  const threatScorePercent = Math.round(metrics.aggregateThreatIndex * 100);

  return (
    <section className="space-y-4">
      {/* Executive Quick Summary Strip */}
      <div className="bg-graphite-900 border border-graphite-700/70 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start md:items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
            criticalThreatCount > 0 
              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          }`}>
            {criticalThreatCount > 0 ? (
              <ShieldAlert className="w-5 h-5" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              {criticalThreatCount > 0
                ? `${criticalThreatCount} high-priority threat requires immediate review`
                : 'All ephemeral access controls are functioning normally'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Zero-standing privilege active • Automatic 300s scale-to-zero enforcement verified
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-slate-400 self-end md:self-center">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Step Functions: Active</span>
          </div>
          <div className="h-3 w-px bg-graphite-700" />
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>DynamoDB Ledger: Synced</span>
          </div>
        </div>
      </div>

      {/* 4 Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Proxy throughput"
          value={metrics.throughputRps}
          unit="req/s"
          context={`${metrics.evaluatedRecordsPerSec.toLocaleString()} events evaluated/s`}
          status={metrics.isBurstModeActive ? "Burst test" : "Normal"}
          statusType={metrics.isBurstModeActive ? "warning" : "success"}
          icon={Activity}
          sparklineData={metrics.historyThroughput}
        />

        <MetricCard
          label="Proxy latency (p99)"
          value={metrics.latencyP99}
          unit="ms"
          context={`p50: ${metrics.latencyP50}ms · p95: ${metrics.latencyP95}ms`}
          status={metrics.latencyP99 > 40 ? "Elevated" : "Fast"}
          statusType={metrics.latencyP99 > 40 ? "warning" : "success"}
          icon={Clock}
        />

        <MetricCard
          label="Active temporary leases"
          value={activeLeaseCount}
          context={`${metrics.quarantineTotal} total identities quarantined`}
          status="Enforced"
          statusType="success"
          icon={Key}
        />

        <MetricCard
          label="Threat severity score"
          value={threatScorePercent}
          unit="/ 100"
          context={criticalThreatCount > 0 ? "Adversarial signature detected" : "Baseline heuristic"}
          status={threatScorePercent > 80 ? "Critical" : threatScorePercent > 50 ? "Elevated" : "Low"}
          statusType={threatScorePercent > 80 ? "danger" : threatScorePercent > 50 ? "warning" : "success"}
          icon={ShieldAlert}
        />
      </div>
    </section>
  );
}
