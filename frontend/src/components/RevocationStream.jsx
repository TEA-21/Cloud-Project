import React from 'react';
import { useSecurity } from '../context/SecurityContext';
import { 
  Terminal, 
  ShieldOff, 
  ArrowRight, 
  CheckCircle, 
  ExternalLink,
  Lock
} from 'lucide-react';

export default function RevocationStream() {
  const { revocationLogs } = useSecurity();

  return (
    <div className="border border-matrix-border bg-canvas-base flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-matrix-border bg-canvas-surface">
        <div className="flex items-center gap-3">
          <Terminal className="w-4 h-4 text-cyber-crimson" />
          <h2 className="font-sans font-bold text-sm tracking-wider uppercase text-white">
            Autonomic Enforcement // Step Functions Workflow Execution Log
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyber-crimson animate-ping" />
          <span className="text-[10px] font-mono text-zinc-400 uppercase">ASL State Machine: Active</span>
        </div>
      </div>

      {/* Terminal logs list */}
      <div className="p-4 space-y-3 font-mono text-xs overflow-y-auto max-h-[320px] flex-1">
        {revocationLogs.map((log) => (
          <div 
            key={log.id} 
            className="border border-matrix-border bg-canvas-surface/80 p-3 relative hover:border-cyber-crimson/60 transition-colors"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-matrix-border/80 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="text-cyber-crimson font-bold flex items-center gap-1">
                  <ShieldOff className="w-3.5 h-3.5" /> [QUARANTINE_ENFORCED]
                </span>
                <span className="text-zinc-400">TARGET: <span className="text-white font-bold">{log.entityId}</span></span>
              </div>
              <span className="text-zinc-500 text-[10px] tabular-nums">
                {new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false })} UTC
              </span>
            </div>

            <div className="space-y-1 text-[11px] text-zinc-300">
              <div className="flex items-start gap-1">
                <span className="text-cyber-muted w-28 shrink-0">REASON:</span>
                <span className="text-cyber-amber font-semibold">{log.reason}</span>
              </div>
              <div className="flex items-start gap-1">
                <span className="text-cyber-muted w-28 shrink-0">ATTACHED POLICY:</span>
                <span className="text-cyber-crimson font-bold bg-cyber-crimson/10 px-1 border border-cyber-crimson/30">
                  {log.enforcementPolicy}
                </span>
              </div>
              <div className="flex items-start gap-1">
                <span className="text-cyber-muted w-28 shrink-0">EXECUTION ARN:</span>
                <span className="text-zinc-400 text-[10px] break-all">{log.stepFunctionArn}</span>
              </div>
              <div className="flex items-start gap-1">
                <span className="text-cyber-muted w-28 shrink-0">BASE ROLE DETACH:</span>
                <span className="text-zinc-200 text-[10px] break-all">{log.targetRole}</span>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-matrix-border/50 flex items-center justify-between text-[10px] text-zinc-500">
              <span className="flex items-center gap-1 text-cyber-lime">
                <CheckCircle className="w-3 h-3" /> Zero-Standing Privilege Confirmed
              </span>
              <span className="text-zinc-400">STATUS: {log.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
