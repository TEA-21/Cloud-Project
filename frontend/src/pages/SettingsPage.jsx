import React from 'react';
import { Settings, Sliders, ShieldCheck } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight font-sans">
          Security Platform Settings
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Configure AELA Enclave parameters, Step Functions state machine ARN, and SNS alert topics.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-card space-y-5 text-xs max-w-2xl">
        <div>
          <label className="font-medium text-gray-700 block mb-1">AWS Region Enclave</label>
          <input
            type="text"
            defaultValue="us-east-1"
            readOnly
            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 font-mono text-gray-800"
          />
        </div>

        <div>
          <label className="font-medium text-gray-700 block mb-1">Ephemeral Token TTL (Seconds)</label>
          <input
            type="number"
            defaultValue={300}
            readOnly
            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 font-mono text-gray-800"
          />
          <p className="text-[11px] text-gray-500 mt-1">Hard cap: 300 seconds (5 minutes) scale-to-zero enforcement.</p>
        </div>

        <div>
          <label className="font-medium text-gray-700 block mb-1">Step Functions State Machine ARN</label>
          <input
            type="text"
            defaultValue="arn:aws:states:us-east-1:123456789012:stateMachine:AELARevocationWorkflow"
            readOnly
            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 font-mono text-gray-800"
          />
        </div>

        <div className="pt-3 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            className="px-4 py-2 bg-[#5B58F5] text-white font-semibold rounded-lg text-xs hover:bg-[#4B47E6] transition-colors"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
