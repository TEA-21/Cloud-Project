import React, { useState } from 'react';
import { useSecurity } from '../context/SecurityContext';
import { 
  X, 
  Flame, 
  ChevronsUp, 
  ShieldAlert, 
  ShieldOff, 
  ExternalLink, 
  Info, 
  GitBranch, 
  Clock, 
  User, 
  CheckCircle,
  Copy,
  Check,
  Server,
  Terminal,
  Cpu,
  Layers,
  FileCode,
  Lock,
  Workflow
} from 'lucide-react';

export default function ContextualDetailPanel({ node, onClose, onQuarantineRequest }) {
  const [activeTab, setActiveTab] = useState('Overview');
  const [copiedKey, setCopiedKey] = useState(null);

  if (!node) return null;

  const handleCopy = (text, key) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const isCritical = node.severity === 'Critical' || node.status === 'Critical' || node.type === 'violation';
  const properties = node.properties || {};

  const renderPlatformBadge = (platform) => {
    if (platform?.includes('Terraform')) {
      return (
        <span className="flex items-center gap-1 text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded text-[10px] font-medium">
          <Layers className="w-3 h-3" />
          <span>Terraform IaC</span>
        </span>
      );
    }
    if (platform?.includes('AWS IAM') || platform?.includes('Cloud Native')) {
      return (
        <span className="flex items-center gap-1 text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] font-medium font-mono">
          <span className="font-bold">AWS</span>
          <span className="text-gray-600 font-sans">{platform}</span>
        </span>
      );
    }
    return <span className="font-medium text-gray-800">{platform || 'AWS Cloud Native'}</span>;
  };

  return (
    <div className="w-full lg:w-96 bg-white border-l border-gray-200 flex flex-col justify-between h-full overflow-y-auto shadow-panel shrink-0 select-none">
      {/* Header section */}
      <div className="p-5 border-b border-gray-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Provider / Category icon */}
            <div className="w-10 h-10 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center font-bold text-xs">
              {node.iconType === 'aws' ? (
                <span className="font-mono text-amber-600 font-bold">aws</span>
              ) : node.iconType === 'cpu' ? (
                <Cpu className="w-5 h-5 text-blue-600" />
              ) : node.iconType === 'workflow' ? (
                <Workflow className="w-5 h-5 text-[#5B58F5]" />
              ) : node.iconType === 'table' ? (
                <Layers className="w-5 h-5 text-teal-600" />
              ) : (
                <span className="text-[#5B58F5] font-mono font-bold uppercase">{node.type?.slice(0, 3)}</span>
              )}
            </div>

            <div>
              <h3 className="font-semibold text-sm text-gray-900 leading-tight">
                {node.label}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5 font-sans">
                {node.subLabel}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Severity, Priority, Assignee Grid */}
        <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-gray-100 text-xs">
          <div>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              SEVERITY
            </span>
            <div className="flex items-center gap-1 font-medium text-rose-600">
              <Flame className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
              <span>{node.severity || 'Critical'}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              PRIORITY
            </span>
            <div className="flex items-center gap-1 font-medium text-amber-600">
              <ChevronsUp className="w-3.5 h-3.5 text-amber-500" />
              <span>{node.priority || 'High'}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              ASSIGNEE
            </span>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-[#5B58F5] text-white flex items-center justify-center text-[9px] font-bold">
                {node.assigneeInitials || 'SA'}
              </div>
              <span className="text-gray-800 font-medium truncate" title={node.assignee}>
                {node.assignee || 'SecOps Lead'}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs Row */}
        <div className="flex items-center gap-6 mt-5 -mb-5 border-b border-gray-200 text-xs font-medium">
          {['Overview', 'Activity Log', 'Relationships'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2.5 transition-all ${
                activeTab === tab
                  ? 'border-b-2 border-[#5B58F5] text-[#5B58F5] font-semibold'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main Tab Body */}
      <div className="p-5 flex-1 space-y-5 text-xs font-sans">
        {activeTab === 'Overview' ? (
          <>
            {/* INSIGHTS Section */}
            <div>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-2.5">
                INSIGHTS
              </span>

              <div className="grid grid-cols-2 gap-2">
                {(node.insights || [
                  { label: 'Zero-Standing Leased', active: true },
                  { label: 'Private VPC Ingress', active: false },
                  { label: 'STS Session Monitored', active: true },
                  { label: 'Step Functions Bound', active: false }
                ]).map((ins, idx) => (
                  <div key={idx} className="bg-white border border-gray-200 p-2.5 rounded-lg flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-1 h-3.5 rounded-full shrink-0 ${ins.active ? 'bg-[#5B58F5]' : 'bg-gray-300'}`} />
                      <span className="text-gray-800 font-medium truncate text-[11px]">{ins.label}</span>
                    </div>
                    <Info className="w-3 h-3 text-gray-400 shrink-0 ml-1" />
                  </div>
                ))}
              </div>
            </div>

            {/* ISSUE TRACKING Section */}
            <div>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-2.5">
                ISSUE TRACKING
              </span>

              <div className="bg-white border border-gray-200 p-3 rounded-lg flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-bold text-[10px]">
                    <GitBranch className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900 block text-xs">
                      {node.issueTracking?.title || 'Enforce Ephemeral Quarantine'}
                    </span>
                    <span className="text-[10px] font-mono text-gray-400">
                      {node.issueTracking?.ticketId || 'AELA-409'}
                    </span>
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase ${
                  node.issueTracking?.status === 'COMPLETED' 
                    ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' 
                    : 'text-blue-700 bg-blue-50 border border-blue-200'
                }`}>
                  {node.issueTracking?.status || 'IN PROGRESS'}
                </span>
              </div>
            </div>

            {/* PROPERTIES Section: Refactored Cloud-Native Schema */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  PROPERTIES & CLOUD METADATA
                </span>
                <span className="text-[10px] font-mono text-gray-400">AWS us-east-1</span>
              </div>

              <div className="divide-y divide-gray-100 text-xs font-sans">
                {/* 1. Source / Platform */}
                <div className="py-2 flex items-center justify-between gap-2">
                  <span className="text-gray-500 shrink-0">Source / Platform</span>
                  <div className="text-right">
                    {renderPlatformBadge(properties.platform)}
                  </div>
                </div>

                {/* 2. Organization / Account */}
                <div className="py-2 flex items-center justify-between gap-2">
                  <span className="text-gray-500 shrink-0">Organization / Account</span>
                  <div className="flex items-center gap-1.5 text-gray-800 font-mono text-[11px] truncate">
                    <span className="text-gray-400">#</span>
                    <span className="font-semibold text-[#5B58F5]">{properties.organization || 'aela-sec-ops'}</span>
                    <span className="text-gray-400">({properties.account || 'aws-account-123456789012'})</span>
                  </div>
                </div>

                {/* 3. Repository / Infrastructure */}
                <div className="py-2 flex items-center justify-between gap-2">
                  <span className="text-gray-500 shrink-0">Infrastructure Repo</span>
                  <div className="flex items-center gap-1.5 text-gray-800 font-mono text-[11px]">
                    <span className="text-gray-400">📁</span>
                    <span className="bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
                      {properties.infrastructure || 'aela-cloud-infrastructure'}
                    </span>
                  </div>
                </div>

                {/* 4. Commit / Deployment Hash */}
                <div className="py-2 flex items-center justify-between gap-2">
                  <span className="text-gray-500 shrink-0">Deployment Hash</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-gray-800 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200 text-[11px]">
                      {properties.deploymentHash || 'a4224ca'}
                    </span>
                    <button
                      onClick={() => handleCopy(properties.deploymentHash || 'a4224ca', 'hash')}
                      className="text-gray-400 hover:text-gray-600 p-0.5"
                      title="Copy deployment hash"
                    >
                      {copiedKey === 'hash' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                {/* 5. Author / Principal */}
                <div className="py-2 flex items-center justify-between gap-2">
                  <span className="text-gray-500 shrink-0">Author / Principal</span>
                  <div className="flex items-center gap-1.5 text-gray-800 font-medium">
                    <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-[9px] font-bold">
                      A
                    </div>
                    <span>{properties.principal || 'AELA SecOps Engine'}</span>
                  </div>
                </div>

                {/* 6. Committer / Evaluator */}
                <div className="py-2 flex items-center justify-between gap-2">
                  <span className="text-gray-500 shrink-0">Evaluator Engine</span>
                  <div className="flex items-center gap-1.5 text-gray-800 text-[11px] text-right font-medium">
                    <Workflow className="w-3.5 h-3.5 text-[#5B58F5] shrink-0" />
                    <span>{properties.evaluator || 'AWS Step Functions (Revocation Workflow)'}</span>
                  </div>
                </div>

                {/* 7. Target Resource ARN */}
                <div className="py-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-500">Target Resource ARN</span>
                    <button
                      onClick={() => handleCopy(properties.targetArn || 'arn:aws:iam::123456789012:role/AuroraAuthProxyRole', 'arn')}
                      className="text-[11px] text-[#5B58F5] hover:underline flex items-center gap-1"
                    >
                      {copiedKey === 'arn' ? (
                        <span className="text-emerald-600 flex items-center gap-1"><Check className="w-3 h-3" /> Copied</span>
                      ) : (
                        <span className="flex items-center gap-1"><Copy className="w-3 h-3" /> Copy ARN</span>
                      )}
                    </button>
                  </div>
                  <div className="font-mono text-[10px] text-gray-800 bg-gray-50 p-2 rounded border border-gray-200 break-all select-all">
                    {properties.targetArn || 'arn:aws:iam::123456789012:role/AuroraAuthProxyRole'}
                  </div>
                </div>

                {/* Dynamic Node-Specific Fields */}
                {properties.vpc && (
                  <div className="py-2 flex items-center justify-between gap-2">
                    <span className="text-gray-500">VPC Enclave</span>
                    <span className="font-mono text-gray-800 text-[11px]">{properties.vpc}</span>
                  </div>
                )}

                {properties.sourceIp && (
                  <div className="py-2 flex items-center justify-between gap-2">
                    <span className="text-gray-500">Source IP</span>
                    <span className="font-mono text-gray-800 text-[11px] font-semibold">{properties.sourceIp}</span>
                  </div>
                )}

                {properties.secretType && (
                  <div className="py-2 flex items-center justify-between gap-2">
                    <span className="text-gray-500">Secret Type</span>
                    <span className="text-gray-800 font-medium text-[11px]">{properties.secretType}</span>
                  </div>
                )}

                {properties.enforcementPolicy && (
                  <div className="py-2 flex items-center justify-between gap-2">
                    <span className="text-gray-500">Enforcement Policy</span>
                    <span className="font-mono text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 text-[10px] font-bold">
                      {properties.enforcementPolicy}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : activeTab === 'Activity Log' ? (
          <div className="space-y-3 font-sans">
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between text-[11px] text-gray-500">
                <span>AWS CloudTrail Ingestion</span>
                <span>2 mins ago</span>
              </div>
              <p className="text-gray-900 font-medium mt-1">
                sts:AssumeRole requested with 300s ephemeral lease duration from {properties.sourceIp || '192.168.1.45'}.
              </p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between text-[11px] text-gray-500">
                <span>AELA Heuristic Detector</span>
                <span>42s ago</span>
              </div>
              <p className="text-gray-900 font-medium mt-1">
                Flagged: Non-whitelisted instance metadata inspection (IMDSv1) targeting {properties.targetArn || 'AuroraAuthProxyRole'}.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 font-sans">
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="text-xs font-semibold text-gray-900">Connected Upstream Services</div>
              <p className="text-gray-600 text-[11px] mt-1">
                Linked to <strong>AELA Step Functions (RevocationWorkflow)</strong> and <strong>AELALeaseTracker DynamoDB</strong>.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center gap-2">
        <button
          onClick={() => onQuarantineRequest(node)}
          className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-lg transition-colors shadow-xs flex items-center justify-center gap-1.5"
        >
          <ShieldOff className="w-3.5 h-3.5" />
          <span>Quarantine identity</span>
        </button>

        <button
          onClick={() => handleCopy(JSON.stringify(node, null, 2), 'node_all')}
          className="py-2 px-3 bg-white hover:bg-gray-100 text-gray-700 font-medium text-xs border border-gray-200 rounded-lg transition-colors flex items-center justify-center"
          title="Export node cloud JSON"
        >
          {copiedKey === 'node_all' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
