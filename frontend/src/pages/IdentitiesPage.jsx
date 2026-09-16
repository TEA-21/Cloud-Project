import React, { useState } from 'react';
import { useSecurity } from '../context/SecurityContext';
import StatusBadge from '../components/StatusBadge';
import { Users, Server, ShieldAlert, Key, Search, ExternalLink, ShieldOff } from 'lucide-react';

export default function IdentitiesPage({ onQuarantineRequest }) {
  const { sessions } = useSecurity();
  const [search, setSearch] = useState('');

  const identities = [
    {
      id: 'id-1',
      name: 'Aurora Auth Proxy Node',
      entityId: 'node-k8s-pod-auth-proxy',
      type: 'Kubernetes Pod / Node',
      env: 'Production (us-east-1)',
      status: 'Critical',
      riskScore: 94,
      leases: 1,
      lastActivity: '12s ago'
    },
    {
      id: 'id-2',
      name: 'Ingress Worker Pod 02',
      entityId: 'srv-prod-ingress-worker-02',
      type: 'EC2 Microservice Worker',
      env: 'Production (us-east-1)',
      status: 'Active',
      riskScore: 12,
      leases: 1,
      lastActivity: '65s ago'
    },
    {
      id: 'id-3',
      name: 'ETL Pipeline Sync Role',
      entityId: 'iam-role-etl-pipeline-sync',
      type: 'AWS IAM Role',
      env: 'Production (us-east-1)',
      status: 'Active',
      riskScore: 28,
      leases: 1,
      lastActivity: '3m ago'
    },
    {
      id: 'id-4',
      name: 'Nightly Indexer Worker',
      entityId: 'lambda-nightly-indexer-worker',
      type: 'Serverless Lambda Execution',
      env: 'Production (us-east-1)',
      status: 'Active',
      riskScore: 5,
      leases: 1,
      lastActivity: '15s ago'
    }
  ];

  const filtered = identities.filter(i => 
    i.name.toLowerCase().includes(search.toLowerCase()) || 
    i.entityId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight font-sans">
            Workload & Identity Directory
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Registered AWS IAM roles, compute nodes, and ephemeral token principals.
          </p>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search identity..."
            className="bg-white border border-gray-200 text-gray-900 text-xs rounded-lg pl-9 pr-3 py-1.5 focus:outline-none focus:border-[#5B58F5] w-52 shadow-2xs"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-card overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/70 text-gray-500 font-medium">
              <th className="py-3 px-5">Principal Name</th>
              <th className="py-3 px-4">Workload Type</th>
              <th className="py-3 px-4">Environment</th>
              <th className="py-3 px-4">Risk Score</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50/70 transition-colors">
                <td className="py-3.5 px-5">
                  <div className="font-semibold text-gray-900 font-sans">{item.name}</div>
                  <div className="text-[11px] font-mono text-gray-500">{item.entityId}</div>
                </td>
                <td className="py-3.5 px-4 text-gray-700">{item.type}</td>
                <td className="py-3.5 px-4 text-gray-500">{item.env}</td>
                <td className="py-3.5 px-4">
                  <span className={`font-mono font-semibold ${item.riskScore > 75 ? 'text-rose-600' : 'text-gray-900'}`}>
                    {item.riskScore}%
                  </span>
                </td>
                <td className="py-3.5 px-4">
                  <StatusBadge status={item.status} />
                </td>
                <td className="py-3.5 px-5 text-right">
                  <button
                    onClick={() => onQuarantineRequest({ entityName: item.name, entityId: item.entityId, vector: 'MANUAL_ISOLATION' })}
                    className="px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-all"
                  >
                    Quarantine
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
