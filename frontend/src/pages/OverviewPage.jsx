import React, { useState } from 'react';
import { useSecurity } from '../context/SecurityContext';
import MetricCard from '../components/MetricCard';
import AlertBanner from '../components/AlertBanner';
import GraphCanvas from '../components/GraphCanvas';
import ContextualDetailPanel from '../components/ContextualDetailPanel';
import { Activity, Clock, Key, ShieldAlert, Calendar, RefreshCw, Filter, ChevronDown } from 'lucide-react';

export default function OverviewPage({ onQuarantineRequest, onReviewIncident, onViewTableToggle }) {
  const { metrics, sessions, anomalies, selectedNode, setSelectedNode } = useSecurity();
  const [timeRange, setTimeRange] = useState('Last 24 hours');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const activeLeaseCount = sessions.filter(s => s.status === 'ACTIVE' || s.status === 'EXPIRING').length;
  const criticalThreatCount = anomalies.filter(a => a.severity === 'CRITICAL').length;
  const threatScorePercent = Math.round(metrics.aggregateThreatIndex * 100);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight font-sans">
            Security Overview
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time zero-trust posture, active JIT leases, and autonomic quarantine execution graphs.
          </p>
        </div>

        {/* Header Controls: Time range, refresh, filters */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-2xs font-medium text-gray-700 cursor-pointer hover:bg-gray-50">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span>{timeRange}</span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </div>

          <button
            onClick={handleRefresh}
            className={`flex items-center gap-1.5 bg-white border border-gray-200 px-2.5 py-1.5 rounded-lg shadow-2xs font-medium text-gray-700 hover:bg-gray-50 transition-all ${
              isRefreshing ? 'opacity-70' : ''
            }`}
            title="Refresh graph telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Alert Banner */}
      <AlertBanner onReviewIncident={onReviewIncident} />

      {/* 3. Four Key Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Proxy throughput"
          value={metrics.throughputRps}
          unit="req/s"
          context={`${metrics.evaluatedRecordsPerSec.toLocaleString()} events evaluated/s`}
          status={metrics.isBurstModeActive ? "Burst Active" : "Healthy"}
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
          status="Zero Standing"
          statusType="success"
          icon={Key}
        />

        <MetricCard
          label="Threat severity score"
          value={threatScorePercent}
          unit="/ 100"
          context={criticalThreatCount > 0 ? "Adversarial vector active" : "Baseline heuristic"}
          status={threatScorePercent > 80 ? "Critical" : threatScorePercent > 50 ? "Elevated" : "Low"}
          statusType={threatScorePercent > 80 ? "danger" : threatScorePercent > 50 ? "warning" : "success"}
          icon={ShieldAlert}
        />
      </div>

      {/* 4. Main Visualization Area: Dribbble Workflow Canvas + Contextual Detail Panel */}
      <div className="flex flex-col lg:flex-row items-stretch gap-0 rounded-xl overflow-hidden border border-gray-200 bg-white shadow-card">
        {/* Left / Center: Interactive Graph Canvas */}
        <div className="flex-1 min-w-0">
          <GraphCanvas
            onSelectNode={(node) => setSelectedNode(node)}
            selectedNode={selectedNode}
            onViewTableToggle={onViewTableToggle}
          />
        </div>

        {/* Right: Contextual Detail Panel */}
        {selectedNode && (
          <ContextualDetailPanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            onQuarantineRequest={onQuarantineRequest}
          />
        )}
      </div>
    </div>
  );
}
