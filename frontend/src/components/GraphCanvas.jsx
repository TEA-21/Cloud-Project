import React, { useState } from 'react';
import { useSecurity } from '../context/SecurityContext';
import { 
  ChevronLeft, 
  ChevronRight, 
  BookOpen, 
  Code, 
  Layers, 
  Table, 
  Plus, 
  Minus, 
  RotateCcw,
  Cpu,
  Database,
  Box,
  Key,
  Workflow,
  Lock
} from 'lucide-react';

export default function GraphCanvas({ onSelectNode, selectedNode, onViewTableToggle }) {
  const { graphNodes } = useSecurity();
  const [viewMode, setViewMode] = useState('graph');
  const [zoomLevel, setZoomLevel] = useState(1);

  // SVG curved path helper connecting two (x, y) coordinates with a smooth cubic bezier curve
  const renderCurvedEdge = (startX, startY, endX, endY, badgeCount = null, isActivePulse = false) => {
    const deltaX = endX - startX;
    const cp1X = startX + deltaX * 0.5;
    const cp1Y = startY;
    const cp2X = startX + deltaX * 0.5;
    const cp2Y = endY;

    const pathData = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;

    return (
      <g key={`edge-${startX}-${startY}-${endX}-${endY}`}>
        {/* Background static curve */}
        <path
          d={pathData}
          fill="none"
          stroke="#CBD5E1"
          strokeWidth="1.8"
        />

        {/* Active animated pulse if threat vector */}
        {isActivePulse && (
          <path
            d={pathData}
            fill="none"
            stroke="#EF4444"
            strokeWidth="2"
            strokeDasharray="6 6"
            className="animate-flow-dash"
          />
        )}

        {/* Badge circle with count (e.g. '2' from reference screenshot) */}
        {badgeCount && (
          <g transform={`translate(${midX}, ${midY})`}>
            <circle cx="0" cy="0" r="10" fill="#EF4444" />
            <text
              x="0"
              y="3.5"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="10"
              fontWeight="bold"
              fontFamily="sans-serif"
            >
              {badgeCount}
            </text>
          </g>
        )}
      </g>
    );
  };

  const getNodeIcon = (node) => {
    switch (node.iconType) {
      case 'aws':
        return <span className="font-mono font-bold text-amber-700 text-xs">aws</span>;
      case 'table':
        return <Database className="w-4 h-4 text-teal-600" />;
      case 'box':
        return <Box className="w-4 h-4 text-purple-600" />;
      case 'cpu':
        return <Cpu className="w-4 h-4 text-blue-600" />;
      default:
        return <Workflow className="w-4 h-4 text-[#5B58F5]" />;
    }
  };

  return (
    <div className="flex-1 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col h-[580px] shadow-card relative select-none">
      {/* 1. Top Breadcrumb & Switcher Bar matching Dribbble reference */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between gap-4 z-10">
        {/* Breadcrumb path */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1 text-gray-400">
            <button className="p-1 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button className="p-1 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-gray-200" />

          <div className="flex items-center gap-2 text-gray-700 font-medium">
            <BookOpen className="w-3.5 h-3.5 text-gray-400" />
            <div className="flex items-center gap-1 font-mono text-[11px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
              <Code className="w-3 h-3 text-gray-400" />
              <span>{selectedNode?.label || 'Security Graph Topology'}</span>
            </div>
          </div>
        </div>

        {/* View Switcher: Graph vs Table */}
        <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs">
          <button
            onClick={() => setViewMode('graph')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
              viewMode === 'graph'
                ? 'bg-white text-[#5B58F5] shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Graph</span>
          </button>

          <button
            onClick={() => {
              setViewMode('table');
              if (onViewTableToggle) onViewTableToggle();
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
              viewMode === 'table'
                ? 'bg-white text-[#5B58F5] shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Table</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive SVG Canvas Area */}
      <div className="flex-1 relative canvas-dotted-grid overflow-hidden">
        {/* Floating Zoom & Pan Controls */}
        <div className="absolute bottom-4 left-4 z-20 flex items-center bg-white rounded-lg border border-gray-200 shadow-card p-0.5 text-xs text-gray-600">
          <button
            onClick={() => setZoomLevel(prev => Math.min(1.4, prev + 0.1))}
            className="p-1.5 hover:bg-gray-100 rounded hover:text-gray-900"
            title="Zoom in"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <span className="px-2 font-mono text-[11px] text-gray-500">{Math.round(zoomLevel * 100)}%</span>
          <button
            onClick={() => setZoomLevel(prev => Math.max(0.7, prev - 0.1))}
            className="p-1.5 hover:bg-gray-100 rounded hover:text-gray-900"
            title="Zoom out"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <div className="h-3 w-px bg-gray-200 mx-0.5" />
          <button
            onClick={() => setZoomLevel(1)}
            className="p-1.5 hover:bg-gray-100 rounded hover:text-gray-900"
            title="Reset view"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Legend */}
        <div className="absolute top-4 left-4 z-20 hidden sm:flex items-center gap-3 bg-white/90 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-gray-200 shadow-2xs text-[11px] text-gray-600 font-medium font-sans">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> Proxy Workload
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Secret Target
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-500" /> DynamoDB Ledger
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#5B58F5]" /> Step Functions
          </span>
        </div>

        {/* Graph Transform Container */}
        <div 
          className="w-full h-full relative"
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center', transition: 'transform 0.15s ease-out' }}
        >
          {/* SVG Connection Layer */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minWidth: '900px', minHeight: '520px' }}>
            {/* Connection: Aurora Auth Proxy Node (x=180, y=240) -> AELALeaseTracker Table (x=280, y=110) */}
            {renderCurvedEdge(180, 240, 260, 110)}

            {/* Connection: Aurora Auth Proxy Node (x=200, y=250) -> aela-revocation-queue (x=480, y=180) with badge '2' */}
            {renderCurvedEdge(200, 250, 480, 180, 2, true)}

            {/* Connection: AELALeaseTracker Table (x=340, y=110) -> aela-revocation-queue (x=480, y=180) */}
            {renderCurvedEdge(340, 110, 480, 180)}

            {/* Connection: Aurora Auth Proxy Node (x=180, y=280) -> Aurora DB Master Credentials (x=280, y=360) */}
            {renderCurvedEdge(180, 280, 280, 360)}

            {/* Connection: aela-revocation-queue (x=560, y=185) -> AELA Step Functions (x=740, y=185) */}
            {renderCurvedEdge(600, 185, 740, 185)}
          </svg>

          {/* Node Cards Layer */}
          {graphNodes.map((node) => {
            const isSelected = selectedNode?.id === node.id;
            const isCritical = node.status === 'Critical' || node.status === 'Flagged';

            return (
              <div
                key={node.id}
                onClick={() => onSelectNode(node)}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
                className={`absolute w-52 sm:w-56 bg-white rounded-xl border transition-all cursor-pointer p-3 flex items-center gap-3 z-10 ${
                  isSelected
                    ? 'border-[#5B58F5] shadow-node-active scale-102 ring-2 ring-[#5B58F5]/10'
                    : isCritical
                    ? 'border-gray-200 shadow-card hover:shadow-card-hover hover:border-gray-300'
                    : 'border-gray-200 shadow-card hover:shadow-card-hover hover:border-gray-300'
                }`}
              >
                {/* Colored Icon box */}
                <div 
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border border-black/5"
                  style={{ backgroundColor: node.bgColor }}
                >
                  {getNodeIcon(node)}
                </div>

                {/* Text Content */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-900 truncate font-sans">
                    {node.label}
                  </div>
                  <div className="text-[11px] text-gray-500 truncate font-sans">
                    {node.subLabel}
                  </div>
                </div>

                {/* Status dot */}
                <div className="shrink-0">
                  {node.status === 'Critical' || node.status === 'Flagged' ? (
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block ring-2 ring-rose-200" />
                  ) : node.status === 'Active' ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
