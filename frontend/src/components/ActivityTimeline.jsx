import React, { useState } from 'react';
import { useSecurity } from '../context/SecurityContext';
import StatusBadge from './StatusBadge';
import { 
  GitCommit, 
  ShieldCheck, 
  ShieldOff, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Server, 
  CheckCircle2 
} from 'lucide-react';

export default function ActivityTimeline() {
  const { revocationLogs } = useSecurity();
  const [expandedLogId, setExpandedLogId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedLogId(prev => prev === id ? null : id);
  };

  return (
    <div className="bg-graphite-900 border border-graphite-700/70 rounded-xl p-5 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-graphite-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <span>Enforcement activity</span>
            <span className="text-xs font-normal text-slate-400 bg-graphite-800 px-2 py-0.5 rounded-full border border-graphite-700">
              AWS Step Functions
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit trail of autonomic role detachments and zero-standing quarantine actions.
          </p>
        </div>

        <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> State machine active
        </span>
      </div>

      {/* Vertical Timeline Feed */}
      <div className="mt-5 space-y-4">
        {revocationLogs.map((log, index) => {
          const isExpanded = expandedLogId === log.id;
          const isLast = index === revocationLogs.length - 1;

          return (
            <div key={log.id} className="relative flex gap-4">
              {/* Timeline Connector Line */}
              {!isLast && (
                <div className="absolute left-3.5 top-7 bottom-0 w-px bg-graphite-800" />
              )}

              {/* Timeline Dot Icon */}
              <div className="relative z-10 w-7 h-7 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 mt-0.5">
                <ShieldOff className="w-3.5 h-3.5" />
              </div>

              {/* Event Content Card */}
              <div className="flex-1 bg-graphite-850 border border-graphite-700/60 rounded-lg p-3.5 hover:border-graphite-600 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-200 text-xs">
                      {log.eventType || 'Access Revocation'}
                    </span>
                    <span className="text-[11px] text-slate-400">•</span>
                    <span className="text-xs text-slate-300 font-medium">
                      {log.entityName || log.entityId}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 mt-1 leading-normal">
                  {log.reason}
                </p>

                {/* Footer Bar & Accordion trigger */}
                <div className="mt-2.5 pt-2 border-t border-graphite-800 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Attached {log.enforcementPolicy}
                  </span>

                  <button
                    onClick={() => toggleExpand(log.id)}
                    className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                  >
                    <span>{isExpanded ? 'Hide details' : 'Execution details'}</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {/* Expandable Technical Execution Trace */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-graphite-800 text-[11px] font-mono text-slate-300 space-y-1.5 bg-graphite-950/60 p-3 rounded border border-graphite-800">
                    <div className="text-slate-400">
                      STEP FUNCTION EXECUTION:
                      <div className="text-slate-300 break-all select-all mt-0.5">
                        {log.stepFunctionArn}
                      </div>
                    </div>
                    <div className="text-slate-400 pt-1">
                      DETACHED OPERATIONAL ROLE:
                      <div className="text-slate-300 break-all select-all mt-0.5">
                        {log.targetRole}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
