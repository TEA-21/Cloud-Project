import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  AELA_GRAPH_NODES, 
  INITIAL_SESSIONS, 
  INITIAL_ANOMALIES, 
  INITIAL_REVOCATION_LOGS 
} from '../data/mockSecurityData';

const SecurityContext = createContext(null);

export function SecurityProvider({ children }) {
  const [activeRoute, setActiveRoute] = useState('Overview');
  const [sessions, setSessions] = useState(INITIAL_SESSIONS);
  const [anomalies, setAnomalies] = useState(INITIAL_ANOMALIES);
  const [revocationLogs, setRevocationLogs] = useState(INITIAL_REVOCATION_LOGS);
  const [graphNodes, setGraphNodes] = useState(AELA_GRAPH_NODES);
  const [selectedNode, setSelectedNode] = useState(AELA_GRAPH_NODES[0]); // Aurora Auth Proxy Node selected by default
  const [isStreaming, setIsStreaming] = useState(true);
  const [streamHealth, setStreamHealth] = useState('Operational');

  // Real-time telemetry metrics
  const [metrics, setMetrics] = useState({
    throughputRps: 642,
    latencyP50: 3.8,
    latencyP95: 14.2,
    latencyP99: 27.6,
    activeLeaseCount: INITIAL_SESSIONS.length,
    quarantineTotal: 14,
    evaluatedRecordsPerSec: 1840,
    aggregateThreatIndex: 0.94,
    isBurstModeActive: false,
    historyThroughput: [520, 540, 560, 590, 610, 642, 630, 655, 640, 660, 642, 650]
  });

  // Recent operator alerts & toasts
  const [activeAlerts, setActiveAlerts] = useState([]);

  const addAlert = useCallback((type, title, description) => {
    const newAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type,
      title,
      description,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
    };
    setActiveAlerts(prev => [newAlert, ...prev.slice(0, 3)]);
  }, []);

  const dismissAlert = useCallback((id) => {
    setActiveAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const dismissAnomaly = useCallback((eventId) => {
    setAnomalies(prev => prev.filter(a => a.eventId !== eventId));
    addAlert('INFO', 'Incident dismissed', `Anomaly ${eventId} removed from active review queue.`);
  }, [addAlert]);

  // Session Countdown Interval
  useEffect(() => {
    if (!isStreaming) return;

    const timer = setInterval(() => {
      setSessions(prevSessions => {
        return prevSessions.map(sess => {
          if (sess.status === 'REVOKED' || sess.status === 'QUARANTINED') {
            return sess;
          }

          const newRemaining = sess.ttlRemaining - 1;

          if (newRemaining <= 0) {
            addAlert('WARNING', 'Lease expired', `Session ${sess.sessionId} reached 300s TTL. Access revoked.`);
            return {
              ...sess,
              ttlRemaining: 0,
              status: 'REVOKED'
            };
          }

          let newStatus = sess.status;
          if (newRemaining < 60) {
            newStatus = 'EXPIRING';
          }

          return {
            ...sess,
            ttlRemaining: newRemaining,
            status: newStatus
          };
        });
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isStreaming, addAlert]);

  // Simulated SSE stream updates
  useEffect(() => {
    if (!isStreaming) return;

    const sseInterval = setInterval(() => {
      setMetrics(prev => {
        const jitter = (Math.random() - 0.48) * 35;
        const currentRps = Math.max(320, Math.min(1850, Math.round(prev.throughputRps + jitter)));
        const newP50 = +(3.4 + Math.random() * 1.2).toFixed(1);
        const newP95 = +(12.5 + Math.random() * 3.0).toFixed(1);
        const newP99 = +(24.0 + (prev.isBurstModeActive ? 35 : 0) + Math.random() * 4.0).toFixed(1);

        const newHistory = [...prev.historyThroughput.slice(1), currentRps];

        return {
          ...prev,
          throughputRps: currentRps,
          latencyP50: newP50,
          latencyP95: newP95,
          latencyP99: newP99,
          evaluatedRecordsPerSec: Math.round(currentRps * 2.6),
          historyThroughput: newHistory
        };
      });
    }, 3000);

    return () => clearInterval(sseInterval);
  }, [isStreaming]);

  // Action: Revoke session immediately
  const revokeSessionNow = useCallback((sessionId, reason = 'Operator manual revocation') => {
    let affectedPrincipal = sessionId;
    let targetRole = 'arn:aws:iam::123456789012:role/TargetRole';

    setSessions(prev => prev.map(s => {
      if (s.sessionId === sessionId || s.entityId === sessionId) {
        affectedPrincipal = s.displayName || s.entityId;
        targetRole = s.roleArn;
        return {
          ...s,
          ttlRemaining: 0,
          status: 'REVOKED'
        };
      }
      return s;
    }));

    // Update graph nodes to reflect quarantine
    setGraphNodes(prev => prev.map(node => {
      if (node.id === 'node-proxy' || node.id === 'node-secret' || node.label.toLowerCase().includes(sessionId.toLowerCase())) {
        return { ...node, status: 'Revoked', severity: 'Resolved' };
      }
      return node;
    }));

    // Append to enforcement activity timeline
    const newLog = {
      id: `rev_log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      targetRole,
      entityName: affectedPrincipal,
      entityId: sessionId,
      eventType: 'Step Functions Enforcement',
      reason,
      stepFunctionArn: `arn:aws:states:us-east-1:123456789012:stateMachine:RevocationWorkflow:exec-${Math.random().toString(36).substr(2, 6)}`,
      enforcementPolicy: 'ExplicitAbsoluteDenyAll',
      status: 'Completed'
    };

    setRevocationLogs(prev => [newLog, ...prev]);
    setMetrics(m => ({ ...m, quarantineTotal: m.quarantineTotal + 1, aggregateThreatIndex: 0.35 }));

    // Mark related anomaly as resolved
    setAnomalies(prev => prev.filter(a => a.entityId !== sessionId && a.title !== sessionId));

    addAlert('SUCCESS', 'Identity quarantined', `${affectedPrincipal} had credentials revoked and ExplicitAbsoluteDenyAll attached.`);
  }, [addAlert]);

  // Action: Extend session TTL
  const extendSession = useCallback((sessionId, addSeconds = 120) => {
    setSessions(prev => prev.map(s => {
      if (s.sessionId === sessionId) {
        const newTtl = Math.min(300, s.ttlRemaining + addSeconds);
        return {
          ...s,
          ttlRemaining: newTtl,
          status: newTtl > 60 ? 'ACTIVE' : 'EXPIRING'
        };
      }
      return s;
    }));

    addAlert('INFO', 'Lease extended', `Session ${sessionId} granted an additional ${addSeconds} seconds.`);
  }, [addAlert]);

  // Action: Trigger burst load test
  const triggerBurstTest = useCallback(() => {
    setMetrics(m => ({
      ...m,
      isBurstModeActive: true,
      throughputRps: 1540,
      latencyP99: 58.4
    }));

    addAlert('INFO', 'Burst load test initiated', 'Simulating 1,500+ requests/sec via JMeter test runner.');

    setTimeout(() => {
      setMetrics(m => ({
        ...m,
        isBurstModeActive: false,
        throughputRps: 680,
        latencyP99: 26.8
      }));
      addAlert('SUCCESS', 'Burst test complete', 'Zero standing privilege maintained under peak traffic.');
    }, 7000);
  }, [addAlert]);

  // Action: Inject synthetic anomaly
  const injectManualAnomaly = useCallback(() => {
    const manualEvent = {
      eventId: `anom_manual_${Math.floor(100 + Math.random() * 900)}`,
      title: 'Suspicious privilege escalation vector',
      description: 'Principal attempted to invoke AssumeRole with wildcard administrator permissions across accounts.',
      entityName: 'Aurora Auth Proxy Node',
      entityId: 'node-k8s-pod-auth-proxy',
      target: 'arn:aws:iam::123456789012:role/AuroraAuthProxyRole',
      srcIp: '198.51.100.99',
      threatScore: 0.96,
      severity: 'CRITICAL',
      priority: 'High',
      assignee: 'SecOps Incident Response',
      timestamp: new Date().toISOString(),
      vector: 'ZERO_DAY_IMDS_ABUSE',
      recommendedAction: 'Immediate quarantine required to stop credential exfiltration.',
      actionTaken: 'AWAITING_OPERATOR'
    };

    setAnomalies(prev => [manualEvent, ...prev.filter(a => a.eventId !== manualEvent.eventId)]);
    setMetrics(m => ({ ...m, aggregateThreatIndex: 0.96 }));
    addAlert('CRITICAL', 'Critical threat injected', `${manualEvent.title} on ${manualEvent.entityName}.`);
  }, [addAlert]);

  const toggleStreaming = useCallback(() => {
    setIsStreaming(prev => !prev);
    setStreamHealth(prev => prev === 'Operational' ? 'Paused' : 'Operational');
  }, []);

  return (
    <SecurityContext.Provider
      value={{
        activeRoute,
        setActiveRoute,
        sessions,
        anomalies,
        revocationLogs,
        graphNodes,
        setGraphNodes,
        selectedNode,
        setSelectedNode,
        metrics,
        activeAlerts,
        isStreaming,
        streamHealth,
        revokeSessionNow,
        extendSession,
        dismissAnomaly,
        triggerBurstTest,
        injectManualAnomaly,
        toggleStreaming,
        dismissAlert
      }}
    >
      {children}
    </SecurityContext.Provider>
  );
}

export function useSecurity() {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
}
