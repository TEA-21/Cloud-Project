import React, { useState } from 'react';
import { useSecurity } from '../context/SecurityContext';
import StatusBadge from '../components/StatusBadge';
import { 
  Search, 
  Key, 
  Clock, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldOff, 
  Filter, 
  Plus,
  Network,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  X,
  ShieldCheck
} from 'lucide-react';

export default function AccessLeasesPage({ onInspectLease, onRevokeRequest }) {
  const { sessions, revocationLogs, requestJitLease } = useSecurity();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [copiedId, setCopiedId] = useState(null);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [leaseForm, setLeaseForm] = useState({
    serviceId: 'srv-prod-ingress-worker-02',
    requestedAction: 'state:read',
    resourceArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/AppLedger'
  });

  const formatCountdown = (seconds) => {
    if (seconds <= 0) return '00:00 (Expired)';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const handleCopy = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const filteredSessions = sessions.filter(s => {
    const matchesSearch = 
      (s.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.entityId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.targetResource || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.srcIp.includes(searchQuery);

    if (!matchesSearch) return false;
    if (statusFilter === 'ACTIVE') return s.status === 'ACTIVE';
    if (statusFilter === 'EXPIRING') return s.status === 'EXPIRING';
    if (statusFilter === 'REVOKED') return s.status === 'REVOKED';
    return true;
  });

  const handleMintSubmit = async (e) => {
    e.preventDefault();
    setIsMinting(true);
    try {
      await requestJitLease({
        serviceId: leaseForm.serviceId,
        requestedAction: leaseForm.requestedAction,
        resourceArn: leaseForm.resourceArn
      });
      setIsGrantModalOpen(false);
    } finally {
      setIsMinting(false);
    }
  };

  const vectorStats = [
    { name: 'SSRF & Metadata Probing', count: 2, percentage: 48, color: 'bg-rose-500' },
    { name: 'Privilege Escalation Attempts', count: 1, percentage: 32, color: 'bg-amber-500' },
    { name: 'Anomalous Cross-Region Traversal', count: 1, percentage: 20, color: 'bg-blue-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight font-sans">
            Access Leases
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Active Just-In-Time (JIT) ephemeral credentials with autonomic 300s TTL limits.
          </p>
        </div>

        {/* Filter, Search Bar & Mint Action */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsGrantModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#5B58F5] hover:bg-[#4F46E5] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Mint JIT Lease</span>
          </button>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search identity, ARN or IP..."
              className="bg-white border border-gray-200 text-gray-900 text-xs rounded-lg pl-9 pr-3 py-1.5 focus:outline-none focus:border-[#5B58F5] w-48 shadow-2xs"
            />
          </div>

          <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs">
            {['ALL', 'ACTIVE', 'EXPIRING', 'REVOKED'].map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-2.5 py-1 rounded-md font-medium capitalize transition-all ${
                  statusFilter === filter
                    ? 'bg-white text-[#5B58F5] shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {filter.toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/70 text-gray-500 font-medium">
                <th className="py-3 px-5">Identity / Principal</th>
                <th className="py-3 px-4">Target Resource</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Time Remaining</th>
                <th className="py-3 px-4">Source IP</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSessions.map((session) => {
                const isRevoked = session.status === 'REVOKED';
                const isExpiring = session.status === 'EXPIRING';
                const percent = Math.max(0, (session.ttlRemaining / session.maxTtl) * 100);

                return (
                  <tr 
                    key={session.sessionId}
                    className={`hover:bg-gray-50/80 transition-colors ${
                      isRevoked ? 'bg-gray-50/40 opacity-60' : ''
                    }`}
                  >
                    {/* Identity */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                          <Key className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 font-sans">
                            {session.displayName}
                          </div>
                          <div className="text-[11px] font-mono text-gray-500 flex items-center gap-1 mt-0.5">
                            <span>{session.entityId}</span>
                            <button
                              onClick={() => handleCopy(session.entityId, session.sessionId)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              {copiedId === session.sessionId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Target Resource */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-medium text-gray-800 font-sans">
                        {session.resourceName}
                      </div>
                      <div className="text-[11px] font-mono text-gray-500 truncate mt-0.5" title={session.targetResource}>
                        {session.targetResource}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <StatusBadge status={session.status} />
                    </td>

                    {/* Time Remaining */}
                    <td className="py-3.5 px-4 w-40">
                      <div className="flex items-center gap-1.5 font-mono text-xs mb-1">
                        <Clock className={`w-3.5 h-3.5 ${
                          isRevoked ? 'text-gray-400' : isExpiring ? 'text-amber-500' : 'text-emerald-600'
                        }`} />
                        <span className={`tabular-nums font-semibold ${
                          isRevoked ? 'text-gray-400 line-through' : isExpiring ? 'text-amber-600' : 'text-gray-900'
                        }`}>
                          {formatCountdown(session.ttlRemaining)}
                        </span>
                      </div>
                      <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${
                            isRevoked ? 'w-0' : isExpiring ? 'bg-amber-500' : 'bg-[#5B58F5]'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </td>

                    {/* Source IP */}
                    <td className="py-3.5 px-4 font-mono text-xs text-gray-600">
                      {session.srcIp}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onInspectLease(session)}
                          className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-md transition-all shadow-2xs"
                        >
                          Inspect
                        </button>
                        {!isRevoked && (
                          <button
                            onClick={() => onRevokeRequest(session)}
                            className="px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-all"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two Lower Visualization Cards: Timeline & Threat Vectors */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Card 1: Enforcement Activity Timeline (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-gray-200 rounded-xl shadow-card p-5">
          <div className="flex items-center justify-between pb-3.5 border-b border-gray-200">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Enforcement Activity Timeline</h3>
              <p className="text-xs text-gray-500 mt-0.5">Automated AWS Step Functions policy isolation audit trail.</p>
            </div>
            <span className="text-xs font-mono text-emerald-600 font-medium">State Machine: Active</span>
          </div>

          <div className="mt-4 space-y-3.5">
            {revocationLogs.map((log) => (
              <div key={log.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{log.eventType}</span>
                    <span className="text-gray-400">&bull;</span>
                    <span className="text-gray-700 font-medium">{log.entityName}</span>
                  </div>
                  <span className="font-mono text-[11px] text-gray-400">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-gray-600 mt-1">{log.reason}</p>
                <div className="mt-2 text-[11px] font-mono text-gray-500 break-all select-all">
                  ARN: {log.stepFunctionArn}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Threat Vectors & Source Distribution (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-gray-200 rounded-xl shadow-card p-5">
          <div className="pb-3.5 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Threat Vectors & Distribution</h3>
            <p className="text-xs text-gray-500 mt-0.5">Anomalies detected across VPC ingress routes.</p>
          </div>

          <div className="mt-4 space-y-3.5 text-xs">
            {vectorStats.map((item) => (
              <div key={item.name}>
                <div className="flex justify-between text-gray-700 mb-1">
                  <span>{item.name}</span>
                  <span className="font-mono text-gray-500">{item.percentage}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-3 border-t border-gray-100 text-xs text-gray-500 flex justify-between">
            <span>Enclave CIDR: <strong className="text-gray-800 font-mono">10.240.0.0/16</strong></span>
            <span>Zero-Standing: <strong className="text-emerald-600">Enforced</strong></span>
          </div>
        </div>
      </div>

      {/* Interactive JIT Lease Minting Modal */}
      {isGrantModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden animate-in fade-in duration-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#EEEDFE] text-[#5B58F5] flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Request Ephemeral JIT Lease</h3>
                  <p className="text-[11px] text-gray-500">Mints dynamic 300s least-privilege STS credentials via backend.</p>
                </div>
              </div>
              <button 
                onClick={() => setIsGrantModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleMintSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-gray-700 mb-1">Microservice / Identity ID</label>
                <input
                  type="text"
                  required
                  value={leaseForm.serviceId}
                  onChange={(e) => setLeaseForm({ ...leaseForm, serviceId: e.target.value })}
                  placeholder="e.g. srv-prod-ingress-worker-02"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-[#5B58F5]"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Requested Scoped Action</label>
                <select
                  value={leaseForm.requestedAction}
                  onChange={(e) => setLeaseForm({ ...leaseForm, requestedAction: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-[#5B58F5]"
                >
                  <option value="state:read">state:read (dynamodb:GetItem, dynamodb:Query)</option>
                  <option value="state:write">state:write (dynamodb:PutItem, dynamodb:UpdateItem)</option>
                  <option value="storage:read">storage:read (s3:GetObject, s3:ListBucket)</option>
                  <option value="storage:write">storage:write (s3:PutObject)</option>
                  <option value="telemetry:write">telemetry:write (logs:CreateLogStream, logs:PutLogEvents)</option>
                  <option value="compute:describe">compute:describe (ec2:DescribeInstances, ec2:DescribeTags)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Target Resource ARN</label>
                <input
                  type="text"
                  required
                  value={leaseForm.resourceArn}
                  onChange={(e) => setLeaseForm({ ...leaseForm, resourceArn: e.target.value })}
                  placeholder="arn:aws:dynamodb:..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-[#5B58F5] font-mono text-[11px]"
                />
              </div>

              <div className="bg-[#EEEDFE]/40 border border-[#5B58F5]/20 rounded-lg p-3 text-[11px] text-gray-600 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[#5B58F5] shrink-0 mt-0.5" />
                <span>Enforces strict zero-standing privilege. Lease auto-expires in 300 seconds.</span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsGrantModalOpen(false)}
                  className="px-3 py-1.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isMinting}
                  className="px-4 py-1.5 bg-[#5B58F5] hover:bg-[#4F46E5] text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {isMinting ? 'Minting...' : 'Mint Ephemeral Lease'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
