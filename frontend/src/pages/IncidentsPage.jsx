import React, { useState } from 'react';
import { useSecurity } from '../context/SecurityContext';
import StatusBadge from '../components/StatusBadge';
import { 
  ShieldAlert, 
  Flame, 
  Search, 
  Filter, 
  ArrowRight, 
  CheckCircle, 
  Clock, 
  Globe, 
  Server, 
  Lock, 
  ExternalLink,
  ChevronRight,
  ShieldOff
} from 'lucide-react';

export default function IncidentsPage({ onQuarantineRequest }) {
  const { anomalies, dismissAnomaly } = useSecurity();
  const [selectedIncident, setSelectedIncident] = useState(anomalies[0] || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');

  const filteredIncidents = anomalies.filter(incident => {
    const matchesSearch = 
      incident.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.entityName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.srcIp.includes(searchQuery) ||
      incident.vector.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (severityFilter === 'CRITICAL') return incident.severity === 'CRITICAL';
    if (severityFilter === 'HIGH') return incident.severity === 'HIGH';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight font-sans">
            Security Incidents
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            CloudTrail anomaly detections, privilege escalation attempts, and autonomous enforcement actions.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search incidents or IPs..."
              className="bg-white border border-gray-200 text-gray-900 text-xs rounded-lg pl-9 pr-3 py-1.5 focus:outline-none focus:border-[#5B58F5] w-52 shadow-2xs"
            />
          </div>

          <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs">
            {['ALL', 'CRITICAL', 'HIGH'].map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  severityFilter === sev
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Layout: Incident List on Left (5 cols) + Incident Propagation & Details on Right (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Incident List */}
        <div className="lg:col-span-5 space-y-3">
          {filteredIncidents.map((inc) => {
            const isSelected = selectedIncident?.eventId === inc.eventId;
            const isCritical = inc.severity === 'CRITICAL';

            return (
              <div
                key={inc.eventId}
                onClick={() => setSelectedIncident(inc)}
                className={`p-4 rounded-xl border transition-all cursor-pointer bg-white ${
                  isSelected
                    ? 'border-[#5B58F5] shadow-card-hover ring-2 ring-[#5B58F5]/10'
                    : 'border-gray-200 hover:border-gray-300 shadow-card'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={inc.severity} size="xs" />
                    <span className="text-xs font-mono text-gray-400">{inc.eventId}</span>
                  </div>
                  <span className="text-[11px] font-mono text-gray-400">
                    {new Date(inc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <h3 className="text-xs font-semibold text-gray-900 mt-2 line-clamp-1">
                  {inc.title}
                </h3>
                <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                  {inc.description}
                </p>

                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-100 text-[11px]">
                  <span className="text-gray-600 font-medium">{inc.entityName}</span>
                  <span className="font-mono text-gray-400">{inc.srcIp}</span>
                </div>
              </div>
            );
          })}

          {filteredIncidents.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-xs text-gray-400">
              No incidents match the selected filter.
            </div>
          )}
        </div>

        {/* Selected Incident Detail & Propagation Flow */}
        <div className="lg:col-span-7">
          {selectedIncident ? (
            <div className="bg-white border border-gray-200 rounded-xl shadow-card p-6 space-y-6">
              {/* Incident Header */}
              <div className="flex items-start justify-between pb-4 border-b border-gray-200">
                <div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={selectedIncident.severity} />
                    <span className="text-xs font-mono text-gray-400">ID: {selectedIncident.eventId}</span>
                    <span className="text-xs text-gray-400">&bull; Priority: {selectedIncident.priority || 'High'}</span>
                  </div>
                  <h2 className="text-base font-bold text-gray-900 mt-1.5 tracking-tight">
                    {selectedIncident.title}
                  </h2>
                </div>

                <button
                  onClick={() => onQuarantineRequest(selectedIncident)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs shadow-xs transition-colors shrink-0"
                >
                  <ShieldOff className="w-3.5 h-3.5" />
                  <span>Quarantine identity</span>
                </button>
              </div>

              {/* Propagation Flow Workflow: Source -> Detection -> Affected Identity -> Resource -> Enforcement Action */}
              <div>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-3">
                  INCIDENT PROPAGATION GRAPH
                </span>

                <div className="grid grid-cols-5 gap-2 text-center text-xs">
                  {/* Step 1: Source */}
                  <div className="bg-gray-50 border border-gray-200 p-2.5 rounded-lg flex flex-col items-center justify-center">
                    <Globe className="w-4 h-4 text-purple-600 mb-1" />
                    <span className="text-[10px] text-gray-400 uppercase font-semibold">1. Source</span>
                    <span className="font-mono text-[11px] text-gray-900 mt-0.5 truncate w-full">{selectedIncident.srcIp}</span>
                  </div>

                  {/* Step 2: Detection */}
                  <div className="bg-gray-50 border border-gray-200 p-2.5 rounded-lg flex flex-col items-center justify-center">
                    <ShieldAlert className="w-4 h-4 text-amber-600 mb-1" />
                    <span className="text-[10px] text-gray-400 uppercase font-semibold">2. Detection</span>
                    <span className="text-[11px] text-gray-900 font-medium mt-0.5 truncate w-full">CloudTrail API</span>
                  </div>

                  {/* Step 3: Identity */}
                  <div className="bg-gray-50 border border-gray-200 p-2.5 rounded-lg flex flex-col items-center justify-center">
                    <Server className="w-4 h-4 text-blue-600 mb-1" />
                    <span className="text-[10px] text-gray-400 uppercase font-semibold">3. Identity</span>
                    <span className="text-[11px] text-gray-900 font-medium mt-0.5 truncate w-full">{selectedIncident.entityName}</span>
                  </div>

                  {/* Step 4: Resource */}
                  <div className="bg-gray-50 border border-gray-200 p-2.5 rounded-lg flex flex-col items-center justify-center">
                    <Lock className="w-4 h-4 text-rose-600 mb-1" />
                    <span className="text-[10px] text-gray-400 uppercase font-semibold">4. Target</span>
                    <span className="text-[11px] text-gray-900 font-medium mt-0.5 truncate w-full">STS / IMDS</span>
                  </div>

                  {/* Step 5: Enforcement */}
                  <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg flex flex-col items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-emerald-600 mb-1" />
                    <span className="text-[10px] text-emerald-600 uppercase font-semibold">5. Quarantine</span>
                    <span className="text-[11px] text-emerald-900 font-semibold mt-0.5 truncate w-full">Step Functions</span>
                  </div>
                </div>
              </div>

              {/* Threat Narrative & Recommendations */}
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-gray-500 font-medium block mb-1">Incident Summary</span>
                  <p className="text-gray-800 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-200">
                    {selectedIncident.description}
                  </p>
                </div>

                <div>
                  <span className="text-gray-500 font-medium block mb-1">Recommended Enforcement</span>
                  <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-amber-900">
                    {selectedIncident.recommendedAction}
                  </div>
                </div>

                <div>
                  <span className="text-gray-500 font-medium block mb-1">Technical Target URI / ARN</span>
                  <div className="font-mono text-[11px] text-gray-700 bg-gray-50 p-2 rounded-lg border border-gray-200 break-all select-all">
                    {selectedIncident.target}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-xs text-gray-400">
              Select an incident to view technical propagation details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
