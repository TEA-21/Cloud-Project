import React, { useState } from 'react';
import { useSecurity } from '../context/SecurityContext';
import { 
  Key, 
  Clock, 
  ShieldAlert, 
  ShieldOff, 
  Globe, 
  Cpu, 
  CheckCircle2, 
  ExternalLink,
  ChevronRight,
  Filter
} from 'lucide-react';

export default function JitAccessMatrix() {
  const { sessions, revokeSessionNow } = useSecurity();
  const [selectedSession, setSelectedSession] = useState(null);
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'REVOKED'

  const filteredSessions = sessions.filter(s => {
    if (filterMode === 'ACTIVE') return s.status === 'ACTIVE' || s.status === 'EXPIRING';
    if (filterMode === 'REVOKED') return s.status === 'REVOKED';
    return true;
  });

  const formatTimeRemaining = (seconds) => {
    if (seconds <= 0) return '00:00 (EXPIRED)';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="border border-matrix-border bg-canvas-base flex flex-col h-full">
      {/* Matrix Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-3.5 border-b border-matrix-border bg-canvas-surface gap-3">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 bg-cyber-lime" />
          <h2 className="font-sans font-bold text-sm tracking-wider uppercase text-white">
            JIT Access Matrix // Active IAM Leases
          </h2>
          <span className="text-[11px] font-mono text-cyber-muted bg-canvas-card px-2 py-0.5 border border-matrix-border">
            TTL: 300s HARD CAP
          </span>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1 font-mono text-xs">
          <span className="text-cyber-muted mr-1 flex items-center gap-1 text-[11px]">
            <Filter className="w-3 h-3" /> FILTER:
          </span>
          {['ALL', 'ACTIVE', 'REVOKED'].map(mode => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`px-2.5 py-1 text-[11px] border transition-colors ${
                filterMode === mode
                  ? 'border-cyber-lime text-cyber-lime bg-cyber-lime/10 font-bold'
                  : 'border-matrix-border text-cyber-muted hover:text-zinc-300'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left font-mono text-xs border-collapse">
          <thead>
            <tr className="border-b border-matrix-border bg-canvas-surface/60 text-cyber-muted text-[11px] uppercase tracking-wider">
              <th className="py-3 px-4 font-semibold">User / Entity ID</th>
              <th className="py-3 px-4 font-semibold">Target Resource (ARN)</th>
              <th className="py-3 px-4 font-semibold">Source IP</th>
              <th className="py-3 px-4 font-semibold">Time Remaining (TTL)</th>
              <th className="py-3 px-4 font-semibold text-center">Status</th>
              <th className="py-3 px-4 font-semibold text-right">Enforcement Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-matrix-border/70">
            {filteredSessions.map((session) => {
              const isRevoked = session.status === 'REVOKED';
              const isExpiring = session.status === 'EXPIRING';
              const percentLeft = Math.max(0, (session.ttlRemaining / session.maxTtl) * 100);

              return (
                <tr 
                  key={session.sessionId}
                  className={`transition-colors group hover:bg-canvas-surface/40 ${
                    isRevoked ? 'opacity-55 bg-canvas-deep/30' : ''
                  }`}
                >
                  {/* Entity ID */}
                  <td className="py-3.5 px-4 font-medium text-white">
                    <div className="flex items-center gap-2">
                      <Cpu className={`w-4 h-4 shrink-0 ${isRevoked ? 'text-zinc-500' : 'text-cyber-lime'}`} />
                      <div>
                        <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                          {session.entityId}
                        </div>
                        <div className="text-[10px] text-cyber-muted tracking-wide mt-0.5">
                          REQ: <span className="text-zinc-400">{session.sessionId}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Target Resource */}
                  <td className="py-3.5 px-4 max-w-xs">
                    <div className="text-zinc-200 font-mono text-[11px] truncate" title={session.targetResource}>
                      {session.targetResource}
                    </div>
                    <div className="text-[10px] text-cyber-cyan truncate mt-0.5" title={session.actionScope}>
                      [SCOPE] {session.actionScope}
                    </div>
                  </td>

                  {/* Source IP */}
                  <td className="py-3.5 px-4 tabular-nums">
                    <div className="flex items-center gap-1.5 text-zinc-300">
                      <Globe className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span>{session.srcIp}</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      VPC ENCLAVE
                    </div>
                  </td>

                  {/* Time Remaining with Visual Progress Bar */}
                  <td className="py-3.5 px-4 w-44">
                    <div className="flex items-center justify-between text-[11px] font-bold tabular-nums mb-1">
                      <span className="flex items-center gap-1">
                        <Clock className={`w-3.5 h-3.5 ${
                          isRevoked 
                            ? 'text-zinc-500' 
                            : isExpiring 
                            ? 'text-cyber-crimson animate-pulse' 
                            : 'text-cyber-lime'
                        }`} />
                        <span className={
                          isRevoked 
                            ? 'text-zinc-500 line-through' 
                            : isExpiring 
                            ? 'text-cyber-crimson font-extrabold' 
                            : 'text-cyber-lime'
                        }>
                          {formatTimeRemaining(session.ttlRemaining)}
                        </span>
                      </span>
                      <span className="text-[10px] text-zinc-500">{percentLeft.toFixed(0)}%</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-canvas-card border border-matrix-border overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${
                          isRevoked 
                            ? 'w-0' 
                            : isExpiring 
                            ? 'bg-cyber-crimson' 
                            : 'bg-cyber-lime'
                        }`}
                        style={{ width: `${percentLeft}%` }}
                      />
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3.5 px-4 text-center">
                    {isRevoked ? (
                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase border border-zinc-700 bg-zinc-900 text-zinc-400">
                        REVOKED
                      </span>
                    ) : isExpiring ? (
                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase border border-cyber-crimson/80 bg-cyber-crimson/10 text-cyber-crimson animate-pulse">
                        EXPIRING
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase border border-cyber-lime/80 bg-cyber-lime/10 text-cyber-lime">
                        ACTIVE
                      </span>
                    )}
                  </td>

                  {/* Revoke Action Button */}
                  <td className="py-3.5 px-4 text-right">
                    {isRevoked ? (
                      <button
                        disabled
                        className="px-3 py-1.5 text-[11px] font-mono border border-zinc-800 bg-canvas-deep text-zinc-600 uppercase cursor-not-allowed"
                      >
                        Quarantined
                      </button>
                    ) : (
                      <button
                        id={`btn-revoke-${session.sessionId}`}
                        onClick={() => revokeSessionNow(session.sessionId, 'OPERATOR_DISCRETION_REVOCATION')}
                        className="px-3 py-1.5 text-[11px] font-mono font-bold uppercase border border-cyber-crimson text-cyber-crimson bg-cyber-crimson/10 hover:bg-cyber-crimson hover:text-black transition-all active:translate-x-0.5 active:translate-y-0.5 shadow-brutal-crimson"
                      >
                        Revoke Now
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredSessions.length === 0 && (
          <div className="py-12 text-center text-zinc-500 font-mono text-xs">
            NO ACTIVE JIT LEASES DETECTED UNDER CURRENT FILTER
          </div>
        )}
      </div>

      {/* Footer Meta Summary */}
      <div className="px-5 py-2.5 bg-canvas-surface border-t border-matrix-border flex items-center justify-between text-[11px] font-mono text-cyber-muted">
        <div>
          ACTIVE LEASES: <span className="text-cyber-lime font-bold">{sessions.filter(s => s.status === 'ACTIVE' || s.status === 'EXPIRING').length}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>ENFORCEMENT MODE:</span>
          <span className="text-zinc-300 font-semibold uppercase">Step Functions Asynchronous Orchestration</span>
        </div>
      </div>
    </div>
  );
}
