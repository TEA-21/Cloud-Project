import React, { useState } from 'react';
import { useSecurity } from '../context/SecurityContext';
import { 
  Radar, 
  AlertOctagon, 
  Flame, 
  Crosshair, 
  ShieldAlert, 
  Cpu, 
  ChevronRight,
  RefreshCcw,
  Zap
} from 'lucide-react';

export default function AnomalyRadar() {
  const { radarEvents, metrics, revokeSessionNow } = useSecurity();
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Derive active event or fallback to the most critical
  const activeEvent = selectedEvent || radarEvents[0] || null;

  // Transform polar coordinates (angle in deg, distance 0-1) to SVG cartesian coordinates
  // SVG Center = (150, 150), Radius = 130
  const getCoordinates = (angle, distance) => {
    const rad = (angle - 90) * (Math.PI / 180);
    const r = distance * 125;
    const x = 150 + r * Math.cos(rad);
    const y = 150 + r * Math.sin(rad);
    return { x, y };
  };

  const getSeverityStyle = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return {
          fill: '#ff2a2a',
          stroke: '#ff2a2a',
          badge: 'border-cyber-crimson text-cyber-crimson bg-cyber-crimson/10',
          text: 'text-cyber-crimson'
        };
      case 'HIGH':
        return {
          fill: '#ffb000',
          stroke: '#ffb000',
          badge: 'border-cyber-amber text-cyber-amber bg-cyber-amber/10',
          text: 'text-cyber-amber'
        };
      default:
        return {
          fill: '#00f0ff',
          stroke: '#00f0ff',
          badge: 'border-cyber-cyan text-cyber-cyan bg-cyber-cyan/10',
          text: 'text-cyber-cyan'
        };
    }
  };

  return (
    <div className="border border-matrix-border bg-canvas-base flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-matrix-border bg-canvas-surface">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 bg-cyber-crimson animate-pulse" />
          <h2 className="font-sans font-bold text-sm tracking-wider uppercase text-white">
            Anomaly Radar // Heuristic Threat Detection
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-cyber-muted uppercase">REAL-TIME THREAT SCORE:</span>
          <span className={`text-xs font-mono font-extrabold px-2 py-0.5 border ${
            metrics.aggregateThreatIndex > 0.75 
              ? 'border-cyber-crimson bg-cyber-crimson/20 text-cyber-crimson' 
              : 'border-cyber-amber bg-cyber-amber/20 text-cyber-amber'
          }`}>
            {(metrics.aggregateThreatIndex * 100).toFixed(0)} / 100
          </span>
        </div>
      </div>

      <div className="p-5 flex flex-col xl:flex-row gap-6 items-center flex-1">
        {/* Custom SVG High-Tech Radar */}
        <div className="relative w-[300px] h-[300px] shrink-0 border border-matrix-border bg-canvas-deep flex items-center justify-center">
          {/* Subtle Grid crosshairs */}
          <div className="absolute inset-0 pointer-events-none opacity-25 flex items-center justify-center">
            <div className="w-full h-[1px] bg-cyber-cyan/40" />
            <div className="absolute h-full w-[1px] bg-cyber-cyan/40" />
          </div>

          <svg className="w-full h-full" viewBox="0 0 300 300">
            <defs>
              <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ff2a2a" stopOpacity="0.06" />
                <stop offset="100%" stopColor="#07080b" stopOpacity="0" />
              </radialGradient>
              
              <linearGradient id="sweepGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ff2a2a" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#ff2a2a" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Radar Background Glow */}
            <circle cx="150" cy="150" r="125" fill="url(#radarGlow)" />

            {/* Concentric Distance Rings */}
            <circle cx="150" cy="150" r="125" fill="none" stroke="#1f2536" strokeWidth="1" strokeDasharray="4 4" />
            <circle cx="150" cy="150" r="95" fill="none" stroke="#1f2536" strokeWidth="1" />
            <circle cx="150" cy="150" r="65" fill="none" stroke="#1f2536" strokeWidth="1" strokeDasharray="2 2" />
            <circle cx="150" cy="150" r="35" fill="none" stroke="#1f2536" strokeWidth="1" />
            <circle cx="150" cy="150" r="4" fill="#00f0ff" />

            {/* Angle Marker lines */}
            <line x1="150" y1="25" x2="150" y2="275" stroke="#181e2b" strokeWidth="1" />
            <line x1="25" y1="150" x2="275" y2="150" stroke="#181e2b" strokeWidth="1" />

            {/* Rotating Sweep Beam */}
            <g className="animate-radar-sweep origin-[150px_150px]">
              <path
                d="M 150 150 L 150 25 A 125 125 0 0 1 238 61 Z"
                fill="url(#sweepGradient)"
              />
              <line x1="150" y1="150" x2="150" y2="25" stroke="#ff2a2a" strokeWidth="1.5" opacity="0.8" />
            </g>

            {/* Radar Blips (Anomalies) */}
            {radarEvents.map((event) => {
              const { x, y } = getCoordinates(event.angle, event.distance);
              const style = getSeverityStyle(event.severity);
              const isSelected = activeEvent?.eventId === event.eventId;

              return (
                <g 
                  key={event.eventId} 
                  className="cursor-pointer transition-transform hover:scale-125"
                  onClick={() => setSelectedEvent(event)}
                >
                  {/* Ping Ring for Critical */}
                  {event.severity === 'CRITICAL' && (
                    <circle
                      cx={x}
                      cy={y}
                      r="12"
                      fill="none"
                      stroke="#ff2a2a"
                      strokeWidth="1"
                      className="animate-ping"
                      opacity="0.75"
                    />
                  )}

                  {/* Outer selection indicator */}
                  {isSelected && (
                    <circle
                      cx={x}
                      cy={y}
                      r="9"
                      fill="none"
                      stroke="#ccff00"
                      strokeWidth="1.5"
                    />
                  )}

                  {/* Blip Core */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isSelected ? "5" : "4"}
                    fill={style.fill}
                    className="filter drop-shadow-[0_0_4px_rgba(255,42,42,0.8)]"
                  />
                </g>
              );
            })}
          </svg>

          {/* Compass labels */}
          <span className="absolute top-1 text-[9px] font-mono text-zinc-500">000° CLOUD_TRAIL</span>
          <span className="absolute bottom-1 text-[9px] font-mono text-zinc-500">180° FLOW_LOGS</span>
          <span className="absolute left-1 text-[9px] font-mono text-zinc-500">270°</span>
          <span className="absolute right-1 text-[9px] font-mono text-zinc-500">090°</span>
        </div>

        {/* Threat Event Details Panel */}
        <div className="flex-1 w-full flex flex-col justify-between font-mono text-xs">
          {activeEvent ? (
            <div className="border border-matrix-border bg-canvas-surface p-4 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-matrix-border">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-[10px] font-extrabold uppercase border ${getSeverityStyle(activeEvent.severity).badge}`}>
                      {activeEvent.severity}
                    </span>
                    <span className="text-[11px] text-zinc-400">ID: {activeEvent.eventId}</span>
                  </div>
                  <div className="text-[11px] text-cyber-muted">
                    THREAT LEVEL: <span className="text-cyber-crimson font-extrabold">{activeEvent.threatScore}</span>
                  </div>
                </div>

                <h3 className="font-sans font-bold text-sm text-white mb-2">
                  {activeEvent.title}
                </h3>

                <div className="space-y-1.5 text-[11px] text-zinc-300">
                  <div className="flex items-start gap-2">
                    <span className="text-cyber-muted w-24 shrink-0">VECTOR:</span>
                    <span className="text-cyber-amber font-semibold">{activeEvent.vector}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-cyber-muted w-24 shrink-0">TARGET:</span>
                    <span className="text-zinc-200 break-all">{activeEvent.target}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-cyber-muted w-24 shrink-0">SOURCE IP:</span>
                    <span className="text-cyber-cyan font-bold">{activeEvent.srcIp}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-cyber-muted w-24 shrink-0">PRINCIPAL:</span>
                    <span className="text-white">{activeEvent.entityId}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-matrix-border flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 uppercase">
                  DISPATCH STEP FUNCTION QUARANTINE:
                </span>
                <button
                  id="btn-quarantine-anomaly-target"
                  onClick={() => revokeSessionNow(activeEvent.entityId, `ANOMALY_CONFIRMED_${activeEvent.vector}`)}
                  className="px-3 py-1.5 text-[11px] font-mono font-bold uppercase border border-cyber-crimson bg-cyber-crimson text-black hover:bg-white hover:border-white transition-all shadow-brutal-crimson"
                >
                  Quarantine Identity
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-zinc-500">
              AWAITING ANOMALOUS CLOUDTRAIL SIGNATURES...
            </div>
          )}

          {/* Quick list of recent radar hits */}
          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-[10px] text-cyber-muted uppercase shrink-0">RADAR BLIPS:</span>
            {radarEvents.map(evt => (
              <button
                key={evt.eventId}
                onClick={() => setSelectedEvent(evt)}
                className={`px-2 py-1 text-[10px] border font-mono shrink-0 transition-colors ${
                  activeEvent?.eventId === evt.eventId 
                    ? 'border-cyber-lime text-cyber-lime bg-cyber-lime/10' 
                    : 'border-matrix-border text-zinc-400 hover:text-white'
                }`}
              >
                {evt.eventId} [{evt.severity[0]}]
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
