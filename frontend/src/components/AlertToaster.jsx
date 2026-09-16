import React from 'react';
import { useSecurity } from '../context/SecurityContext';
import { AlertCircle, CheckCircle2, ShieldAlert, X, Zap } from 'lucide-react';

export default function AlertToaster() {
  const { activeAlerts, dismissAlert } = useSecurity();

  if (activeAlerts.length === 0) return null;

  const getAlertStyles = (type) => {
    switch (type) {
      case 'REVOKED':
        return {
          border: 'border-cyber-crimson',
          bg: 'bg-canvas-card border-l-4 border-l-cyber-crimson',
          text: 'text-cyber-crimson',
          icon: <ShieldAlert className="w-4 h-4 text-cyber-crimson shrink-0" />
        };
      case 'ANOMALY':
        return {
          border: 'border-cyber-crimson',
          bg: 'bg-canvas-card border-l-4 border-l-cyber-crimson',
          text: 'text-cyber-crimson',
          icon: <AlertCircle className="w-4 h-4 text-cyber-crimson shrink-0" />
        };
      case 'LEASE_GRANTED':
        return {
          border: 'border-cyber-lime',
          bg: 'bg-canvas-card border-l-4 border-l-cyber-lime',
          text: 'text-cyber-lime',
          icon: <CheckCircle2 className="w-4 h-4 text-cyber-lime shrink-0" />
        };
      default:
        return {
          border: 'border-cyber-cyan',
          bg: 'bg-canvas-card border-l-4 border-l-cyber-cyan',
          text: 'text-cyber-cyan',
          icon: <Zap className="w-4 h-4 text-cyber-cyan shrink-0" />
        };
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
      {activeAlerts.map((alert) => {
        const style = getAlertStyles(alert.type);

        return (
          <div
            key={alert.id}
            className={`pointer-events-auto p-3.5 border ${style.border} ${style.bg} shadow-brutal-dark transition-all duration-300 font-mono text-xs`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                {style.icon}
                <div>
                  <div className={`font-bold text-[11px] uppercase ${style.text}`}>
                    {alert.message}
                  </div>
                  {alert.details && (
                    <div className="text-[10px] text-zinc-400 mt-1 break-all">
                      {alert.details}
                    </div>
                  )}
                  <div className="text-[9px] text-zinc-500 mt-1">
                    {alert.timestamp} UTC // EVENT_DISPATCH
                  </div>
                </div>
              </div>
              <button
                onClick={() => dismissAlert(alert.id)}
                className="text-zinc-500 hover:text-white p-1"
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
