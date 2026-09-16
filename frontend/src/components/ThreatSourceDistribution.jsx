import React from 'react';
import { useSecurity } from '../context/SecurityContext';
import { ShieldAlert, Globe, Server, Network } from 'lucide-react';

export default function ThreatSourceDistribution() {
  const { anomalies } = useSecurity();

  const vectorStats = [
    { name: 'SSRF & Metadata Probing', count: 2, percentage: 48, color: 'bg-rose-500' },
    { name: 'Privilege Escalation Attempts', count: 1, percentage: 32, color: 'bg-amber-500' },
    { name: 'Anomalous Data Traversal', count: 1, percentage: 20, color: 'bg-sky-500' },
  ];

  return (
    <div className="bg-graphite-900 border border-graphite-700/70 rounded-xl p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-graphite-800">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Network className="w-4 h-4 text-slate-400" />
              <span>Threat vectors & source distribution</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Breakdown of heuristic anomalies detected across AWS CloudTrail and VPC ingress points.
            </p>
          </div>
        </div>

        {/* Vector Distribution Bars */}
        <div className="mt-4 space-y-3">
          {vectorStats.map((item) => (
            <div key={item.name} className="text-xs">
              <div className="flex items-center justify-between text-slate-300 mb-1">
                <span>{item.name}</span>
                <span className="font-mono text-slate-400">{item.percentage}% ({item.count})</span>
              </div>
              <div className="w-full h-1.5 bg-graphite-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${item.color}`} 
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Network Origin Summary */}
      <div className="mt-5 pt-3 border-t border-graphite-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-slate-500" />
          <span>VPC Private Enclave: <strong className="text-slate-200">10.240.0.0/16</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <Server className="w-3.5 h-3.5 text-slate-500" />
          <span>Isolated Nodes: <strong className="text-emerald-400">100% Enforced</strong></span>
        </div>
      </div>
    </div>
  );
}
