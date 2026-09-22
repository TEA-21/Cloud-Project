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

  // Engine health polling via Vite proxy (/api/health)
  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (isMounted) {
          if (data.status === 'UP') {
            setStreamHealth('Operational');
          } else {
            setStreamHealth('Degraded');
          }
        }
      } catch (err) {
        console.error('[AELA Health Check] Mock server unreachable:', err);
        if (isMounted) {
          setStreamHealth('Degraded');
        }
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Action: Request new JIT lease via backend API (POST /api/jit/lease)
  const requestJitLease = useCallback(async ({
    serviceId = 'srv-prod-ingress-worker-02',
    requestedAction = 'state:read',
    targetRoleArn = 'arn:aws:iam::123456789012:role/aela-dev-base-service-role',
    resourceArn = 'arn:aws:dynamodb:us-east-1:123456789012:table/AppLedger',
    resourceName = 'DynamoDB AppLedger Lease'
  } = {}) => {
    try {
      const res = await fetch('/api/jit/lease', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          requested_action: requestedAction,
          target_role_arn: targetRoleArn,
          resource_arn: resourceArn
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText || res.statusText}`);
      }

      const data = await res.json();

      const newSession = {
        sessionId: `sess_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
        entityId: data.service_id || serviceId,
        displayName: `${serviceId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`,
        roleArn: targetRoleArn,
        targetResource: resourceArn,
        resourceName: resourceName,
        status: 'ACTIVE',
        ttlRemaining: data.lease_duration_seconds || 300,
        maxTtl: 300,
        srcIp: '10.240.14.92',
        actionScope: Array.isArray(data.scoped_policy?.Statement?.[0]?.Action)
          ? data.scoped_policy.Statement[0].Action.join(', ')
          : (data.requested_action || 'state:read'),
        credentials: data.credentials,
        scopedPolicy: data.scoped_policy
      };

      setSessions(prev => [newSession, ...prev]);
      setMetrics(m => ({ ...m, activeLeaseCount: m.activeLeaseCount + 1 }));
      addAlert('SUCCESS', 'JIT Lease Granted', `Minted 300s ephemeral STS credentials for ${serviceId} [${requestedAction}].`);
      return { success: true, data: newSession };
    } catch (err) {
      console.error('[AELA JIT Lease] Network request failed:', err);
      addAlert('CRITICAL', 'JIT Grant Failed', `Failed to mint STS credentials: ${err.message}`);
      return { success: false, error: err.message };
    }
  }, [addAlert]);

  // Action: Revoke session immediately via backend Step Functions simulation (POST /api/quarantine/trigger)
  const revokeSessionNow = useCallback(async (sessionId, reason = 'Operator manual revocation') => {
    let affectedPrincipal = sessionId;
    let targetRole = 'arn:aws:iam::123456789012:role/TargetRole';
    const targetSession = sessions.find(s => s.sessionId === sessionId || s.entityId === sessionId);
    if (targetSession) {
      affectedPrincipal = targetSession.displayName || targetSession.entityId;
      targetRole = targetSession.roleArn;
    }

    const roleName = targetRole.includes('/') ? targetRole.split('/').pop() : targetRole;
    const serviceId = targetSession?.entityId || sessionId;

    // Optimistically update local session state
    setSessions(prev => prev.map(s => {
      if (s.sessionId === sessionId || s.entityId === sessionId) {
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

    try {
      const res = await fetch('/api/quarantine/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          role_name: roleName,
          target_policy_arn: 'arn:aws:iam::123:policy/base',
          deny_policy_arn: 'arn:aws:iam::123:policy/deny',
          reason
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();

      // Append live Step Functions execution record to enforcement activity timeline
      const newLog = {
        id: `rev_log_${Date.now()}`,
        timestamp: data.timestamp || new Date().toISOString(),
        targetRole,
        entityName: affectedPrincipal,
        entityId: serviceId,
        eventType: 'Step Functions Enforcement',
        reason: data.quarantine_reason || reason,
        stepFunctionArn: data.execution_arn || `arn:aws:states:us-east-1:123456789012:execution:aela-dev-revocation-workflow:exec-${serviceId}`,
        enforcementPolicy: 'ExplicitAbsoluteDenyAll',
        status: 'Completed'
      };

      setRevocationLogs(prev => [newLog, ...prev]);
      setMetrics(m => ({ ...m, quarantineTotal: m.quarantineTotal + 1, aggregateThreatIndex: 0.35 }));

      // Mark related anomaly as resolved
      setAnomalies(prev => prev.filter(a => a.entityId !== sessionId && a.title !== sessionId));

      addAlert('SUCCESS', 'Identity quarantined', `${affectedPrincipal} had credentials revoked and ExplicitAbsoluteDenyAll attached.`);
      return { success: true, data };
    } catch (err) {
      console.error('[AELA Quarantine Trigger] Network request failed:', err);
      addAlert('CRITICAL', 'Quarantine API Error', `Failed to execute Step Functions quarantine: ${err.message}`);

      // Graceful fallback timeline entry
      const fallbackLog = {
        id: `rev_log_err_${Date.now()}`,
        timestamp: new Date().toISOString(),
        targetRole,
        entityName: affectedPrincipal,
        entityId: serviceId,
        eventType: 'Quarantine Dispatched (Degraded)',
        reason: `${reason} [Local fallback: ${err.message}]`,
        stepFunctionArn: 'arn:aws:states:local:offline-fallback',
        enforcementPolicy: 'ExplicitAbsoluteDenyAll',
        status: 'Degraded'
      };
      setRevocationLogs(prev => [fallbackLog, ...prev]);
      return { success: false, error: err.message };
    }
  }, [sessions, addAlert]);

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
        requestJitLease,
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
