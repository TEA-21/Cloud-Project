import React from 'react';
import { useSecurity } from '../context/SecurityContext';
import { Activity, ShieldCheck, ShieldOff, Clock, CheckCircle2 } from 'lucide-react';

export default function ActivityPage() {
  const { revocationLogs } = useSecurity();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight font-sans">
          Security Activity Log
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Chronological audit timeline of automated Step Functions enforcement, heuristic anomaly detections, and user interventions.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-card space-y-4">
        {revocationLogs.map((log) => (
          <div key={log.id} className="flex gap-4 items-start pb-4 border-b border-gray-100 last:border-0 last:pb-0">
            <div className="w-8 h-8 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0 mt-0.5">
              <ShieldOff className="w-4 h-4" />
            </div>
            <div className="flex-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900 text-sm">{log.eventType}</span>
                <span className="text-gray-400 font-mono text-[11px] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
              <p className="text-gray-700 mt-1">
                Autonomic revocation executed on <strong className="text-gray-900">{log.entityName}</strong>: {log.reason}
              </p>
              <div className="mt-2 bg-gray-50 p-2.5 rounded-lg border border-gray-200 font-mono text-[11px] text-gray-600 space-y-1">
                <div>EXECUTION: {log.stepFunctionArn}</div>
                <div>ATTACHED: {log.enforcementPolicy}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
