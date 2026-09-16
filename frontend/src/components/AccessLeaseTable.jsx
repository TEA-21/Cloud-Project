import React, { useState } from 'react';
import { useSecurity } from '../context/SecurityContext';
import StatusBadge from './StatusBadge';
import { 
  Search, 
  Key, 
  Clock, 
  ExternalLink, 
  MoreVertical, 
  ShieldOff, 
  Copy, 
  Check, 
  Filter,
  Info
} from 'lucide-react';

export default function AccessLeaseTable({ onInspectLease, onRevokeRequest }) {
  const { sessions } = useSecurity();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'EXPIRING' | 'REVOKED'
  const [copiedId, setCopiedId] = useState(null);

  const formatCountdown = (seconds) => {
    if (seconds <= 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const handleCopy = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const filteredSessions = sessions.filter(session => {
    const matchesSearch = 
      (session.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (session.entityId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (session.resourceName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (session.targetResource || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (session.srcIp || '').includes(searchQuery);

    if (!matchesSearch) return false;

    if (statusFilter === 'ACTIVE') return session.status === 'ACTIVE';
    if (statusFilter === 'EXPIRING') return session.status === 'EXPIRING';
    if (statusFilter === 'REVOKED') return session.status === 'REVOKED';
    return true;
  });

  return (
    <div className="bg-graphite-900 border border-graphite-700/70 rounded-xl overflow-hidden flex flex-col">
      {/* Table Header & Controls Bar */}
      <div className="p-4 sm:p-5 border-b border-graphite-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <span>Access leases</span>
            <span className="text-xs font-normal text-slate-400 bg-graphite-800 px-2 py-0.5 rounded-full border border-graphite-700">
              {filteredSessions.length} total
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Temporary JIT credentials provisioned with strict 300-second maximum lifetimes.
          </p>
        </div>

        {/* Filter & Search Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search identity or resource..."
              className="bg-graphite-850 border border-graphite-700 text-slate-200 text-xs rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-slate-500 w-48 sm:w-56 placeholder:text-slate-500"
            />
          </div>

          {/* Status Filter Chips */}
          <div className="flex items-center bg-graphite-850 rounded-lg p-0.5 border border-graphite-700 text-xs">
            {['ALL', 'ACTIVE', 'EXPIRING', 'REVOKED'].map(filter => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-2.5 py-1 rounded-md capitalize font-medium transition-all ${
                  statusFilter === filter
                    ? 'bg-graphite-700 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {filter.toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Element */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-graphite-800 bg-graphite-950/40 text-slate-400 font-medium">
              <th className="py-3 px-4 sm:px-5">Identity</th>
              <th className="py-3 px-4">Target resource</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Time remaining</th>
              <th className="py-3 px-4">Source IP</th>
              <th className="py-3 px-4 sm:px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-graphite-800/80">
            {filteredSessions.map((session) => {
              const isRevoked = session.status === 'REVOKED';
              const isExpiring = session.status === 'EXPIRING';
              const percentRemaining = Math.max(0, (session.ttlRemaining / session.maxTtl) * 100);

              return (
                <tr 
                  key={session.sessionId}
                  className={`hover:bg-graphite-850/50 transition-colors ${
                    isRevoked ? 'opacity-60 bg-graphite-950/20' : ''
                  }`}
                >
                  {/* Identity */}
                  <td className="py-3.5 px-4 sm:px-5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-graphite-800 flex items-center justify-center text-slate-400 shrink-0">
                        <Key className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-medium text-slate-200">
                          {session.displayName || session.entityId}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>{session.entityId}</span>
                          <button
                            onClick={() => handleCopy(session.entityId, session.sessionId + '_entity')}
                            title="Copy entity ID"
                            className="text-slate-500 hover:text-slate-300"
                          >
                            {copiedId === session.sessionId + '_entity' ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Target Resource */}
                  <td className="py-3.5 px-4 max-w-xs">
                    <div className="text-slate-200 font-medium">
                      {session.resourceName || 'Cloud Resource'}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono truncate mt-0.5" title={session.targetResource}>
                      {session.targetResource}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4">
                    <StatusBadge status={session.status} />
                  </td>

                  {/* Time Remaining */}
                  <td className="py-3.5 px-4 w-40">
                    <div className="flex items-center gap-1.5 font-mono text-xs mb-1.5">
                      <Clock className={`w-3.5 h-3.5 ${
                        isRevoked ? 'text-slate-500' : isExpiring ? 'text-amber-400' : 'text-emerald-400'
                      }`} />
                      <span className={`tabular-nums font-semibold ${
                        isRevoked ? 'text-slate-500 line-through' : isExpiring ? 'text-amber-400' : 'text-slate-200'
                      }`}>
                        {formatCountdown(session.ttlRemaining)}
                      </span>
                    </div>

                    {/* Subtle Progress Bar */}
                    <div className="w-full h-1 bg-graphite-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${
                          isRevoked 
                            ? 'w-0' 
                            : isExpiring 
                            ? 'bg-amber-400' 
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${percentRemaining}%` }}
                      />
                    </div>
                  </td>

                  {/* Source IP */}
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                    <span>{session.srcIp}</span>
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 sm:px-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onInspectLease(session)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-graphite-800 hover:bg-graphite-750 border border-graphite-700 rounded-md transition-all"
                        title="Inspect session policy details"
                      >
                        Inspect
                      </button>

                      {!isRevoked ? (
                        <button
                          onClick={() => onRevokeRequest(session)}
                          className="px-2.5 py-1 text-xs font-medium text-rose-300 hover:text-rose-100 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 rounded-md transition-all"
                          title="Immediately revoke credentials"
                        >
                          Revoke
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-medium px-2 py-1">
                          Revoked
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredSessions.length === 0 && (
          <div className="py-12 text-center text-slate-500 text-xs font-sans">
            No access leases match the current filter or search criteria.
          </div>
        )}
      </div>
    </div>
  );
}
