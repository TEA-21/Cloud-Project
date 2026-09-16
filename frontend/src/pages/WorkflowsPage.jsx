import React, { useState } from 'react';
import { useSecurity } from '../context/SecurityContext';
import { 
  Play, 
  Plus, 
  Check, 
  Save, 
  Layers, 
  GitFork, 
  Workflow, 
  Zap, 
  ShieldCheck, 
  ShieldAlert, 
  ShieldOff, 
  Bell, 
  FileCode, 
  ArrowRight,
  RotateCcw,
  Sliders,
  Settings,
  Info
} from 'lucide-react';

const WORKFLOW_STEPS = [
  {
    id: 'wf-1',
    name: 'Event Ingested',
    type: 'trigger',
    category: 'Trigger',
    icon: Zap,
    color: '#3B82F6',
    bgColor: '#EFF6FF',
    x: 60,
    y: 120,
    status: 'Active',
    config: {
      source: 'AWS CloudTrail & VPC Flow Logs',
      filter: 'Management & Data Plane Events'
    }
  },
  {
    id: 'wf-2',
    name: 'Heuristic Anomaly Detector',
    type: 'decision',
    category: 'Analytics',
    icon: ShieldAlert,
    color: '#8B5CF6',
    bgColor: '#F5F3FF',
    x: 280,
    y: 120,
    status: 'Active',
    config: {
      engine: 'Lambda Inactive Time-Decay & SSRF Signature Detector',
      threshold: '0.75 Threat Severity Score'
    }
  },
  {
    id: 'wf-3',
    name: 'Evaluate DynamoDB Ledger',
    type: 'check',
    category: 'Ledger',
    icon: Layers,
    color: '#0D9488',
    bgColor: '#F0FDFA',
    x: 520,
    y: 60,
    status: 'Active',
    config: {
      table: 'DynamoDB NodeStateLedger',
      query: 'Check if Principal Status == QUARANTINED'
    }
  },
  {
    id: 'wf-4',
    name: 'Step Functions Quarantine',
    type: 'enforcement',
    category: 'Enforcement',
    icon: ShieldOff,
    color: '#EF4444',
    bgColor: '#FEF2F2',
    x: 520,
    y: 220,
    status: 'Active',
    config: {
      action: 'Detach Operational Policies & Attach ExplicitAbsoluteDenyAll',
      asl: 'revocation_workflow.asl.json'
    }
  },
  {
    id: 'wf-5',
    name: 'Dispatch SNS Security Alert',
    type: 'notification',
    category: 'Alerting',
    icon: Bell,
    color: '#F59E0B',
    bgColor: '#FFFBEB',
    x: 760,
    y: 220,
    status: 'Active',
    config: {
      topic: 'arn:aws:sns:us-east-1:123456789012:AELASecurityAlerts',
      recipients: 'SecOps On-Call & PagerDuty'
    }
  }
];

export default function WorkflowsPage() {
  const { addAlert } = useSecurity();
  const [selectedStep, setSelectedStep] = useState(WORKFLOW_STEPS[3]); // Quarantine step selected
  const [isRunningTest, setIsRunningTest] = useState(false);

  const handleTestRun = () => {
    setIsRunningTest(true);
    addAlert('INFO', 'Workflow execution test started', 'Simulating execution of ASL state machine...');
    setTimeout(() => {
      setIsRunningTest(false);
      addAlert('SUCCESS', 'Workflow test successful', 'All Step Functions states completed with 0 errors.');
    }, 2000);
  };

  const renderCurve = (startX, startY, endX, endY, isDashed = false) => {
    const deltaX = endX - startX;
    const cp1X = startX + deltaX * 0.5;
    const cp1Y = startY;
    const cp2X = startX + deltaX * 0.5;
    const cp2Y = endY;

    return (
      <path
        key={`${startX}-${startY}-${endX}-${endY}`}
        d={`M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`}
        fill="none"
        stroke="#CBD5E1"
        strokeWidth="2"
        strokeDasharray={isDashed ? "5 5" : undefined}
        className={isRunningTest ? "animate-flow-dash stroke-[#5B58F5]" : ""}
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-gray-200 p-4 rounded-xl shadow-card">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#5B58F5] flex items-center justify-center text-white">
            <Workflow className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-gray-900 font-sans">
                Zero-Trust Ephemeral Revocation Workflow
              </h1>
              <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full uppercase">
                Active &bull; ASL v1.2
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Closed-loop AWS Step Functions automation triggered on idle decay & anomaly thresholds.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={handleTestRun}
            disabled={isRunningTest}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
              isRunningTest
                ? 'bg-purple-100 text-purple-700 cursor-wait'
                : 'bg-[#5B58F5] hover:bg-[#4B47E6] text-white shadow-xs'
            }`}
          >
            <Play className={`w-3.5 h-3.5 ${isRunningTest ? 'animate-spin' : ''}`} />
            <span>{isRunningTest ? 'Executing...' : 'Run test execution'}</span>
          </button>
        </div>
      </div>

      {/* 2. Main Workflow Builder Canvas Grid (Left Toolbox + Center Canvas + Right Inspector) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch h-[560px]">
        {/* Left: Node Toolbox (2 cols) */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-3.5 shadow-card flex flex-col justify-between overflow-y-auto">
          <div className="space-y-3">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
              AVAILABLE ACTIONS
            </span>

            <div className="space-y-2 text-xs">
              {[
                { name: 'Event Ingestion', icon: Zap, color: 'text-blue-600 bg-blue-50' },
                { name: 'Threat Detector', icon: ShieldAlert, color: 'text-purple-600 bg-purple-50' },
                { name: 'Policy Evaluator', icon: Layers, color: 'text-teal-600 bg-teal-50' },
                { name: 'Quarantine Action', icon: ShieldOff, color: 'text-rose-600 bg-rose-50' },
                { name: 'Dispatch SNS Alert', icon: Bell, color: 'text-amber-600 bg-amber-50' },
              ].map((tool) => {
                const Icon = tool.icon;
                return (
                  <div
                    key={tool.name}
                    className="p-2 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-2 cursor-grab hover:bg-gray-100 transition-colors"
                  >
                    <div className={`w-6 h-6 rounded flex items-center justify-center ${tool.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-medium text-gray-700 text-[11px] truncate">{tool.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[10px] text-gray-500">
            Drag nodes or click to inspect connection properties.
          </div>
        </div>

        {/* Center: Graph Canvas (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-gray-200 rounded-xl shadow-card relative canvas-dotted-grid overflow-hidden flex flex-col justify-between">
          <div className="p-3 flex items-center justify-between text-xs z-10">
            <span className="bg-white/90 border border-gray-200 px-2.5 py-1 rounded-md text-gray-600 font-medium shadow-2xs">
              AWS Step Functions Canvas
            </span>
            <span className="text-gray-400 font-mono text-[11px]">Auto-saved 1m ago</span>
          </div>

          {/* SVG Connecting Paths */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {/* Step 1 -> Step 2 */}
            {renderCurve(180, 155, 280, 155)}
            {/* Step 2 -> Step 3 */}
            {renderCurve(400, 140, 520, 95)}
            {/* Step 2 -> Step 4 */}
            {renderCurve(400, 170, 520, 255)}
            {/* Step 4 -> Step 5 */}
            {renderCurve(640, 255, 760, 255)}
          </svg>

          {/* Placed Workflow Nodes */}
          <div className="w-full h-full relative">
            {WORKFLOW_STEPS.map((step) => {
              const Icon = step.icon;
              const isSelected = selectedStep?.id === step.id;

              return (
                <div
                  key={step.id}
                  onClick={() => setSelectedStep(step)}
                  style={{ left: `${step.x}px`, top: `${step.y}px` }}
                  className={`absolute w-44 bg-white rounded-xl border p-3 flex items-center gap-2.5 cursor-pointer transition-all shadow-card ${
                    isSelected
                      ? 'border-[#5B58F5] shadow-node-active ring-2 ring-[#5B58F5]/10'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: step.bgColor, color: step.color }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold text-gray-900 truncate font-sans">
                      {step.name}
                    </div>
                    <div className="text-[10px] text-gray-500 font-sans">
                      {step.category}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 text-[11px] text-gray-400 font-mono z-10 flex items-center justify-between">
            <span>Deterministic Isolation: Enforced</span>
            <span>Target: ExplicitAbsoluteDenyAll</span>
          </div>
        </div>

        {/* Right: Step Inspector Panel (3 cols) */}
        <div className="lg:col-span-3 bg-white border border-gray-200 rounded-xl p-4 shadow-card flex flex-col justify-between overflow-y-auto text-xs">
          {selectedStep ? (
            <div className="space-y-4">
              <div className="pb-3 border-b border-gray-200">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
                  STEP CONFIGURATION
                </span>
                <h3 className="text-sm font-bold text-gray-900 mt-1 font-sans">
                  {selectedStep.name}
                </h3>
                <p className="text-gray-500 text-[11px] mt-0.5">
                  Category: {selectedStep.category}
                </p>
              </div>

              {/* Configurations */}
              <div className="space-y-3 font-sans">
                {Object.entries(selectedStep.config).map(([key, val]) => (
                  <div key={key}>
                    <span className="text-gray-500 capitalize block mb-0.5 text-[11px]">
                      {key}
                    </span>
                    <div className="bg-gray-50 border border-gray-200 p-2 rounded-lg text-gray-800 font-mono text-[11px] break-all">
                      {val}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-gray-100">
                <span className="text-gray-500 text-[11px] block mb-1">State Machine Language</span>
                <span className="font-mono text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  Amazon States Language (ASL)
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              Select a step in the workflow to configure parameters.
            </div>
          )}

          <div className="pt-3 border-t border-gray-200">
            <button
              onClick={handleTestRun}
              className="w-full py-2 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg text-xs transition-colors"
            >
              Verify ASL Schema
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
