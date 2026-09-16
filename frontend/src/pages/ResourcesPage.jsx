import React from 'react';
import { Layers, Database, Lock, Folder, CheckCircle } from 'lucide-react';

export default function ResourcesPage() {
  const resources = [
    {
      name: 'Financial Ledgers Vault',
      type: 'Amazon S3 Bucket',
      arn: 'arn:aws:s3:::prod-financial-ledgers-us-east-1/*',
      risk: 'Healthy',
      accessMode: 'Ephemeral Least-Privilege',
      connectedIdentities: 1
    },
    {
      name: 'Aurora DB Master Credentials',
      type: 'AWS Secrets Manager',
      arn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:db/aurora-creds-q7A',
      risk: 'Under Target Probe',
      accessMode: 'Quarantined',
      connectedIdentities: 1
    },
    {
      name: 'User Audit Trails Ledger',
      type: 'Amazon DynamoDB Table',
      arn: 'arn:aws:dynamodb:us-east-1:123456789012:table/UserAuditTrails',
      risk: 'Healthy',
      accessMode: 'Dynamic STS Scope',
      connectedIdentities: 1
    },
    {
      name: 'AELA Revocation Queue',
      type: 'Amazon SQS FIFO Queue',
      arn: 'arn:aws:sqs:us-east-1:123456789012:aela-revocation-queue.fifo',
      risk: 'Healthy',
      accessMode: 'Queue Processor Policy',
      connectedIdentities: 1
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight font-sans">
          Protected Cloud Resources
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Data-plane storage, databases, and secrets protected by zero-standing privilege enforcement.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {resources.map((res) => (
          <div key={res.name} className="bg-white border border-gray-200 rounded-xl p-5 shadow-card space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{res.name}</h3>
                <span className="text-xs text-gray-500">{res.type}</span>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                res.risk === 'Under Target Probe' 
                  ? 'bg-rose-50 text-rose-700 border-rose-200' 
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {res.risk}
              </span>
            </div>

            <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-200 font-mono text-[11px] text-gray-600 break-all select-all">
              {res.arn}
            </div>

            <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>Access: <strong className="text-gray-700">{res.accessMode}</strong></span>
              <span>Connected: {res.connectedIdentities} Principal</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
