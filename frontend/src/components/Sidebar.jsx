import React from 'react';
import { useSecurity } from '../context/SecurityContext';
import { 
  LayoutDashboard, 
  ShieldAlert, 
  Key, 
  Users, 
  Layers, 
  GitFork, 
  Activity, 
  FileText, 
  Settings, 
  ChevronRight,
  ExternalLink
} from 'lucide-react';

export default function Sidebar() {
  const { activeRoute, setActiveRoute, anomalies, sessions } = useSecurity();

  const criticalIncidentCount = anomalies.filter(a => a.severity === 'CRITICAL').length;
  const activeLeaseCount = sessions.filter(s => s.status === 'ACTIVE').length;

  const NAV_ITEMS = [
    { id: 'Overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'Incidents', label: 'Incidents', icon: ShieldAlert, badge: criticalIncidentCount > 0 ? criticalIncidentCount : null, badgeColor: 'bg-rose-100 text-rose-700' },
    { id: 'Access Leases', label: 'Access Leases', icon: Key, badge: activeLeaseCount, badgeColor: 'bg-gray-100 text-gray-700' },
    { id: 'Identities', label: 'Identities', icon: Users },
    { id: 'Resources', label: 'Resources', icon: Layers },
    { id: 'Workflows', label: 'Workflows', icon: GitFork, isSpecial: true },
    { id: 'Activity', label: 'Activity', icon: Activity },
    { id: 'Policies', label: 'Policies', icon: FileText },
    { id: 'Settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col justify-between py-4 select-none shrink-0">
      <div className="space-y-6">
        {/* Navigation list */}
        <div className="px-3 space-y-1">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 font-sans">
            Security Core
          </div>

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeRoute === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveRoute(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#EEEDFE] text-[#5B58F5] shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#5B58F5]' : 'text-gray-400'}`} />
                  <span className="font-sans">{item.label}</span>
                </div>

                {item.badge && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}

                {item.isSpecial && !item.badge && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#5B58F5]/10 text-[#5B58F5] uppercase">
                    New
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom workspace footer */}
      <div className="px-4 pt-4 border-t border-gray-200">
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200/80">
          <div className="flex items-center justify-between text-xs font-medium text-gray-900">
            <span>AELA Enclave</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <p className="text-[11px] text-gray-500 mt-1 leading-snug">
            300s Ephemeral JIT & Step Functions quarantine active.
          </p>
        </div>
      </div>
    </aside>
  );
}
