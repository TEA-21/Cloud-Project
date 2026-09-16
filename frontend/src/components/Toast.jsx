import React from 'react';
import { useSecurity } from '../context/SecurityContext';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export default function Toast() {
  const { activeAlerts, dismissAlert } = useSecurity();

  if (activeAlerts.length === 0) return null;

  const getAlertConfig = (type) => {
    switch (type) {
      case 'SUCCESS':
        return {
          border: 'border-emerald-200',
          bg: 'bg-white',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />,
          titleColor: 'text-gray-900'
        };
      case 'CRITICAL':
        return {
          border: 'border-rose-200',
          bg: 'bg-white',
          icon: <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />,
          titleColor: 'text-rose-900'
        };
      case 'WARNING':
        return {
          border: 'border-amber-200',
          bg: 'bg-white',
          icon: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />,
          titleColor: 'text-amber-900'
        };
      default:
        return {
          border: 'border-gray-200',
          bg: 'bg-white',
          icon: <Info className="w-4 h-4 text-[#5B58F5] shrink-0 mt-0.5" />,
          titleColor: 'text-gray-900'
        };
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {activeAlerts.map((alert) => {
        const config = getAlertConfig(alert.type);

        return (
          <div
            key={alert.id}
            className={`pointer-events-auto p-3.5 rounded-xl border ${config.border} ${config.bg} shadow-panel transition-all text-xs font-sans`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                {config.icon}
                <div>
                  <h4 className={`font-semibold text-xs ${config.titleColor}`}>
                    {alert.title}
                  </h4>
                  {alert.description && (
                    <p className="text-gray-600 text-[11px] mt-0.5 leading-snug">
                      {alert.description}
                    </p>
                  )}
                  <span className="text-[10px] text-gray-400 font-mono block mt-1">
                    {alert.timestamp} UTC
                  </span>
                </div>
              </div>

              <button
                onClick={() => dismissAlert(alert.id)}
                className="text-gray-400 hover:text-gray-600 p-0.5 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
