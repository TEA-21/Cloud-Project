import React, { useState } from 'react';
import { useSecurity } from '../context/SecurityContext';
import StatusBadge from './StatusBadge';
import { X, Copy, Check, ShieldOff, Clock, Key, Plus } from 'lucide-react';

export default function LeaseDetailDrawer({ session, onClose, onRevokeRequest }) {
  const { extendSession } = useSecurity();
  const [copiedKey, setCopiedKey] = useState(null);

  if (!session) return null;

  const handleCopy = (text, key) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const isRevoked = session.status === 'REVOKED';

  const actionList = session.actionScope
    ? (typeof session.actionScope === 'string' ? session.actionScope.split(',').map(s => s.trim()) : session.actionScope)
    : (session.scopedPolicy?.Statement?.[0]?.Action || ['dynamodb:GetItem', 'dynamodb:Query']);

  const policyDocument = session.scopedPolicy || {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "AELAEphemeralScopedLease",
        Effect: "Allow",
        Action: actionList,
        Resource: [session.targetResource || "*"],
        Condition: {
          IpAddress: {
            "aws:SourceIp": session.srcIp || "10.240.0.0/16"
          },
          NumericLessThanEquals: {
            "aws:MultiFactorAuthAge": 3600
          }
        }
      }
    ]
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity" 
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white border-l border-gray-200 p-6 flex flex-col justify-between shadow-2xl">
          {/* Header */}
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#EEEDFE] border border-[#5B58F5]/30 flex items-center justify-center text-[#5B58F5]">
                  <Key className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-gray-900 font-sans">Lease Details</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Principal & Resource */}
            <div className="mt-5 space-y-4 text-xs">
              <div>
                <span className="text-gray-500 block mb-1">Workload Identity</span>
                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <div>
                    <span className="font-semibold text-gray-900 block">{session.displayName}</span>
                    <span className="font-mono text-[11px] text-gray-500">{session.entityId}</span>
                  </div>
                  <StatusBadge status={session.status} size="xs" />
                </div>
              </div>

              <div>
                <span className="text-gray-500 block mb-1">Target Resource</span>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-1">
                  <span className="text-gray-900 font-medium block">{session.resourceName}</span>
                  <div className="flex items-center justify-between font-mono text-[11px] text-gray-500">
                    <span className="break-all">{session.targetResource}</span>
                    <button
                      onClick={() => handleCopy(session.targetResource, 'resource')}
                      className="ml-2 text-gray-400 hover:text-gray-700 shrink-0"
                    >
                      {copiedKey === 'resource' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                  <span className="text-gray-500 block mb-0.5">Source IP</span>
                  <span className="font-mono text-gray-900 font-medium">{session.srcIp}</span>
                </div>
                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                  <span className="text-gray-500 block mb-0.5">Time Remaining</span>
                  <span className="font-mono text-emerald-600 font-semibold">{session.ttlRemaining}s</span>
                </div>
              </div>

              {/* Policy Statement */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-500">Scoped IAM Session Policy</span>
                    <button
                      onClick={() => handleCopy(JSON.stringify(policyDocument, null, 2), 'policy')}
                      className="text-gray-400 hover:text-gray-600 font-sans"
                    >
                      {copiedKey === 'policy' ? (
                        <span className="text-emerald-600 flex items-center gap-1"><Check className="w-3 h-3" /> Copied</span>
                      ) : (
                        <span className="flex items-center gap-1"><Copy className="w-3 h-3" /> Copy JSON</span>
                      )}
                    </button>
                  </div>
                  <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-[10px] font-mono overflow-x-auto max-h-48 border border-gray-800">
                    {JSON.stringify(policyDocument, null, 2)}
                  </pre>
              </div>
            </div>
          </div>

          {/* Drawer Actions */}
          <div className="pt-4 border-t border-gray-200 space-y-2">
            {!isRevoked && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => extendSession(session.sessionId, 120)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Extend (+2 min)</span>
                </button>

                <button
                  onClick={() => {
                    onClose();
                    onRevokeRequest(session);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors shadow-xs"
                >
                  <ShieldOff className="w-3.5 h-3.5" />
                  <span>Revoke Access</span>
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full py-2 px-3 text-xs font-medium text-gray-500 hover:text-gray-800 bg-white border border-gray-200 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
