import React from 'react';
import { FileText, ShieldCheck, Check } from 'lucide-react';

export default function PoliciesPage() {
  const policies = [
    {
      name: 'ExplicitAbsoluteDenyAll',
      type: 'Quarantine Boundary Policy',
      description: 'Applied via AWS Step Functions to instantly block all STS operations across all AWS resources.',
      status: 'Enforced'
    },
    {
      name: 'Ephemeral 300s Inactivity Decay Policy',
      type: 'Time-Decay Evaluation',
      description: 'Monitors CloudTrail timestamps. If idle gap exceeds 300 seconds, credentials scale-to-zero automatically.',
      status: 'Active'
    },
    {
      name: 'Scoped DynamoDB Batch Lease Policy',
      type: 'Least-Privilege Session Mint',
      description: 'Restricts permissions strictly to table arn and specific CRUD operations.',
      status: 'Active'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight font-sans">
          Zero-Standing Privilege Policies
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Declared declarative IAM boundaries and automated Step Functions quarantine rules.
        </p>
      </div>

      <div className="space-y-3">
        {policies.map(p => (
          <div key={p.name} className="bg-white border border-gray-200 rounded-xl p-5 shadow-card flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">{p.name}</h3>
                <span className="text-[10px] font-semibold text-[#5B58F5] bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                  {p.type}
                </span>
              </div>
              <p className="text-xs text-gray-500">{p.description}</p>
            </div>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> {p.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
