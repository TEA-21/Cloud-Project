import React, { useState } from 'react';
import { SecurityProvider, useSecurity } from './context/SecurityContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import OverviewPage from './pages/OverviewPage';
import IncidentsPage from './pages/IncidentsPage';
import AccessLeasesPage from './pages/AccessLeasesPage';
import IdentitiesPage from './pages/IdentitiesPage';
import ResourcesPage from './pages/ResourcesPage';
import WorkflowsPage from './pages/WorkflowsPage';
import ActivityPage from './pages/ActivityPage';
import PoliciesPage from './pages/PoliciesPage';
import SettingsPage from './pages/SettingsPage';
import LeaseDetailDrawer from './components/LeaseDetailDrawer';
import ConfirmActionDialog from './components/ConfirmActionDialog';
import Toast from './components/Toast';

function DashboardShell() {
  const { 
    activeRoute, 
    setActiveRoute, 
    revokeSessionNow, 
    injectManualAnomaly 
  } = useSecurity();

  const [selectedLease, setSelectedLease] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    confirmVariant: 'danger',
    onConfirm: () => {},
  });

  // Handler: Prompt quarantine confirmation
  const handleQuarantineRequest = (threatOrNode) => {
    const targetName = threatOrNode.entityName || threatOrNode.label || threatOrNode.entityId;
    const targetId = threatOrNode.entityId || threatOrNode.id;

    setConfirmDialog({
      isOpen: true,
      title: `Quarantine ${targetName}?`,
      message: `This will invoke AWS Step Functions to revoke active STS temporary credentials and attach the ExplicitAbsoluteDenyAll quarantine policy.`,
      confirmLabel: 'Quarantine identity',
      confirmVariant: 'danger',
      onConfirm: () => {
        revokeSessionNow(targetId, `OPERATOR_QUARANTINE_${threatOrNode.vector || 'WORKFLOW'}`);
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Handler: Prompt lease revoke confirmation
  const handleRevokeRequest = (session) => {
    setConfirmDialog({
      isOpen: true,
      title: `Revoke lease for ${session.displayName}?`,
      message: `Are you sure you want to terminate session ${session.sessionId}? The principal will immediately lose access to ${session.targetResource}.`,
      confirmLabel: 'Revoke lease',
      confirmVariant: 'danger',
      onConfirm: () => {
        revokeSessionNow(session.sessionId, 'OPERATOR_MANUAL_REVOCATION');
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Handler: Prompt synthetic threat injection confirmation
  const handleInjectThreatRequest = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Inject simulated threat vector?',
      message: 'This injects a synthetic SSRF IMDSv1 credential extraction event into the CloudTrail ingestion stream for demonstration purposes.',
      confirmLabel: 'Inject vector',
      confirmVariant: 'warning',
      onConfirm: () => {
        injectManualAnomaly();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Switch between routes
  const renderActivePage = () => {
    switch (activeRoute) {
      case 'Incidents':
        return <IncidentsPage onQuarantineRequest={handleQuarantineRequest} />;
      case 'Access Leases':
        return (
          <AccessLeasesPage 
            onInspectLease={(sess) => setSelectedLease(sess)}
            onRevokeRequest={handleRevokeRequest}
          />
        );
      case 'Identities':
        return <IdentitiesPage onQuarantineRequest={handleQuarantineRequest} />;
      case 'Resources':
        return <ResourcesPage />;
      case 'Workflows':
        return <WorkflowsPage />;
      case 'Activity':
        return <ActivityPage />;
      case 'Policies':
        return <PoliciesPage />;
      case 'Settings':
        return <SettingsPage />;
      case 'Overview':
      default:
        return (
          <OverviewPage
            onQuarantineRequest={handleQuarantineRequest}
            onReviewIncident={() => setActiveRoute('Incidents')}
            onViewTableToggle={() => setActiveRoute('Access Leases')}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col antialiased text-gray-900 font-sans">
      {/* 1. Fixed Top Header */}
      <Header onConfirmInjectThreat={handleInjectThreatRequest} />

      {/* 2. Main Workspace Layout: Left Sidebar + Center Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Persistent Left Sidebar Navigation */}
        <Sidebar />

        {/* Scrollable Center Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {renderActivePage()}
          </div>
        </main>
      </div>

      {/* Interactive Overlays & Drawers */}
      <LeaseDetailDrawer
        session={selectedLease}
        onClose={() => setSelectedLease(null)}
        onRevokeRequest={handleRevokeRequest}
      />

      <ConfirmActionDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        confirmVariant={confirmDialog.confirmVariant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />

      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <SecurityProvider>
      <DashboardShell />
    </SecurityProvider>
  );
}
