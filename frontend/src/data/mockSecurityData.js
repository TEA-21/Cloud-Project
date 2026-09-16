/**
 * AELA Security - Centralized Mock Security Data & Metadata Schema
 * Automated Ephemeral Lease Architecture & Just-In-Time IAM Revocation System
 */

export const AELA_GRAPH_NODES = [
  {
    id: 'node-proxy',
    label: 'Aurora Auth Proxy Node',
    subLabel: 'Proxy Instance (K8s Pod)',
    nodeCategory: 'PROXY_INSTANCE',
    type: 'compute',
    iconType: 'cpu',
    color: '#3B82F6',
    bgColor: '#EFF6FF',
    x: 80,
    y: 220,
    badgeCount: 2,
    status: 'Flagged',
    severity: 'Critical',
    priority: 'High',
    assignee: 'SecOps Incident Response',
    assigneeInitials: 'IR',
    issueTracking: {
      title: 'Remediate Proxy IMDSv1 Probe & Rebind STS',
      status: 'IN PROGRESS',
      ticketId: 'AELA-409'
    },
    insights: [
      { label: 'IMDSv1 Probe Flagged', active: true },
      { label: 'Private VPC Ingress', active: false },
      { label: 'Zero-Standing Leased', active: true },
      { label: 'Quarantine Pending', active: false }
    ],
    properties: {
      platform: 'AWS Cloud Native (Amazon EKS)',
      organization: 'aela-sec-ops',
      account: 'aws-account-123456789012',
      infrastructure: 'aela-cloud-infrastructure',
      deploymentHash: 'a4224ca',
      principal: 'AELA SecOps Engine',
      evaluator: 'AWS Step Functions (Revocation Workflow)',
      targetArn: 'arn:aws:iam::123456789012:role/AuroraAuthProxyRole',
      vpc: 'vpc-07b9a02 (us-east-1a)',
      sourceIp: '192.168.1.45',
      workloadId: 'node-k8s-pod-auth-proxy'
    }
  },
  {
    id: 'node-secret',
    label: 'Aurora DB Master Credentials',
    subLabel: 'Secret Target Resource',
    nodeCategory: 'SECRET_VIOLATION',
    type: 'violation',
    iconType: 'aws',
    color: '#F59E0B',
    bgColor: '#FFFBEB',
    x: 280,
    y: 350,
    status: 'Critical',
    severity: 'Critical',
    priority: 'High',
    assignee: 'DBA SecOps Lead',
    assigneeInitials: 'DB',
    issueTracking: {
      title: 'Revoke Ephemeral Aurora Secret Lease',
      status: 'IN PROGRESS',
      ticketId: 'AELA-882'
    },
    insights: [
      { label: 'Target Resource Under Probe', active: true },
      { label: 'Scoped Session Active', active: true },
      { label: 'Strict KMS Encryption', active: false },
      { label: 'CloudWatch Monitored', active: false }
    ],
    properties: {
      platform: 'AWS IAM / Secrets Manager',
      organization: 'aela-sec-ops',
      account: 'aws-account-123456789012',
      infrastructure: 'jit-proxy-engine',
      deploymentHash: '3f7b9e1',
      principal: 'aela-admin-service',
      evaluator: 'JIT Revocation State Machine',
      targetArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:db/aurora-creds-q7A',
      secretType: 'RDS Aurora Master Password',
      exposure: 'Anomalous non-whitelisted AssumeRole query',
      state: 'Active STS Session (TTL decaying)'
    }
  },
  {
    id: 'node-dynamodb',
    label: 'AELALeaseTracker Table',
    subLabel: 'State Ledger (Node Inactivity)',
    nodeCategory: 'DYNAMODB_TABLE',
    type: 'database',
    iconType: 'table',
    color: '#0D9488',
    bgColor: '#F0FDFA',
    x: 240,
    y: 90,
    status: 'Active',
    severity: 'Low',
    priority: 'Medium',
    assignee: 'Data Platforms Lead',
    assigneeInitials: 'DP',
    issueTracking: {
      title: 'DynamoDB Strong Read Ledger Sync',
      status: 'COMPLETED',
      ticketId: 'AELA-102'
    },
    insights: [
      { label: 'Inactivity Decay Tracker', active: true },
      { label: 'Strong Consistency', active: false },
      { label: 'Private VPC Endpoint', active: true },
      { label: 'KMS Encrypted at Rest', active: false }
    ],
    properties: {
      platform: 'AWS Cloud Native / DynamoDB',
      organization: 'aela-sec-ops',
      account: 'aws-account-123456789012',
      infrastructure: 'aela-cloud-infrastructure',
      deploymentHash: 'e5874c',
      principal: 'AELA SecOps Engine',
      evaluator: 'AWS Lambda Decision Engine',
      targetArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/AELALeaseTracker',
      consistency: 'Strongly Consistent Reads',
      partitionKey: 'PrincipalId (String)',
      ttlAttribute: 'ExpirationTimestamp (Epoch)'
    }
  },
  {
    id: 'node-sqs',
    label: 'aela-revocation-queue',
    subLabel: 'Asynchronous Dispatch Queue',
    nodeCategory: 'SQS_QUEUE',
    type: 'queue',
    iconType: 'box',
    color: '#8B5CF6',
    bgColor: '#F5F3FF',
    x: 480,
    y: 160,
    status: 'Healthy',
    severity: 'Low',
    priority: 'Low',
    assignee: 'SecOps DevOps',
    assigneeInitials: 'DO',
    issueTracking: {
      title: 'FIFO Exactly-Once Revocation Dispatch',
      status: 'COMPLETED',
      ticketId: 'AELA-214'
    },
    insights: [
      { label: 'FIFO Ordering Guaranteed', active: true },
      { label: 'Zero Backlog Delay', active: false },
      { label: 'KMS Customer Managed Key', active: true },
      { label: 'Zero Public Ingress', active: false }
    ],
    properties: {
      platform: 'AWS Cloud Native / Amazon SQS',
      organization: 'aela-sec-ops',
      account: 'aws-account-123456789012',
      infrastructure: 'jit-proxy-engine',
      deploymentHash: '3f7b9e1',
      principal: 'aela-admin-service',
      evaluator: 'JIT Revocation State Machine',
      targetArn: 'arn:aws:sqs:us-east-1:123456789012:aela-revocation-queue.fifo',
      queueType: 'FIFO (First-In-First-Out)',
      deliveryDelay: '0 seconds',
      retentionPeriod: '345600 seconds (4 days)'
    }
  },
  {
    id: 'node-stepfunctions',
    label: 'AELA Step Functions',
    subLabel: 'ASL Revocation Workflow',
    nodeCategory: 'STEP_FUNCTIONS',
    type: 'automation',
    iconType: 'workflow',
    color: '#5B58F5',
    bgColor: '#EEEDFE',
    x: 740,
    y: 160,
    status: 'Ready',
    severity: 'Low',
    priority: 'High',
    assignee: 'Security Automation Team',
    assigneeInitials: 'SA',
    issueTracking: {
      title: 'Deterministic ASL Quarantine Enforcement',
      status: 'COMPLETED',
      ticketId: 'AELA-305'
    },
    insights: [
      { label: 'Closed-Loop Quarantine', active: true },
      { label: 'ExplicitAbsoluteDenyAll', active: true },
      { label: 'SNS Operator Alerting', active: false },
      { label: 'Zero Standing Privilege', active: false }
    ],
    properties: {
      platform: 'Terraform IaC (AWS Step Functions)',
      organization: 'aela-sec-ops',
      account: 'aws-account-123456789012',
      infrastructure: 'aela-cloud-infrastructure',
      deploymentHash: 'a4224ca',
      principal: 'AELA SecOps Engine',
      evaluator: 'AWS Step Functions (Revocation Workflow)',
      targetArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:RevocationWorkflow',
      enforcementPolicy: 'ExplicitAbsoluteDenyAll',
      aslSpec: 'revocation_workflow.asl.json',
      autonomicTriggerLatency: '24ms'
    }
  }
];

export const INITIAL_SESSIONS = [
  {
    sessionId: 'sess_9921e_aela',
    displayName: 'Ingress Worker Pod 02',
    entityId: 'srv-prod-ingress-worker-02',
    resourceName: 'Financial Ledgers Vault',
    resourceType: 'S3 Bucket',
    targetResource: 'arn:aws:s3:::prod-financial-ledgers-us-east-1/*',
    roleArn: 'arn:aws:iam::123456789012:role/DataEngJitLeaseRole',
    srcIp: '10.240.12.89',
    grantedAt: new Date(Date.now() - 65 * 1000).toISOString(),
    ttlRemaining: 235,
    maxTtl: 300,
    status: 'ACTIVE',
    actionScope: 's3:GetObject, s3:PutObject',
    authMechanism: 'AWS_STS_AssumeRole',
    threatScore: 0.12,
  },
  {
    sessionId: 'sess_4418b_aela',
    displayName: 'ETL Pipeline Sync Role',
    entityId: 'iam-role-etl-pipeline-sync',
    resourceName: 'AELALeaseTracker Ledger',
    resourceType: 'DynamoDB Table',
    targetResource: 'arn:aws:dynamodb:us-east-1:123456789012:table/AELALeaseTracker',
    roleArn: 'arn:aws:iam::123456789012:role/AnalyticsScopedLeaseRole',
    srcIp: '172.31.84.14',
    grantedAt: new Date(Date.now() - 190 * 1000).toISOString(),
    ttlRemaining: 110,
    maxTtl: 300,
    status: 'ACTIVE',
    actionScope: 'dynamodb:BatchWriteItem, dynamodb:UpdateItem',
    authMechanism: 'AWS_STS_AssumeRole',
    threatScore: 0.28,
  },
  {
    sessionId: 'sess_773x_aela',
    displayName: 'Aurora Auth Proxy Node',
    entityId: 'node-k8s-pod-auth-proxy',
    resourceName: 'Aurora DB Master Credentials',
    resourceType: 'Secrets Manager',
    targetResource: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:db/aurora-creds-q7A',
    roleArn: 'arn:aws:iam::123456789012:role/AuroraAuthProxyRole',
    srcIp: '192.168.1.45',
    grantedAt: new Date(Date.now() - 255 * 1000).toISOString(),
    ttlRemaining: 45,
    maxTtl: 300,
    status: 'EXPIRING',
    actionScope: 'secretsmanager:GetSecretValue',
    authMechanism: 'AWS_STS_AssumeRole',
    threatScore: 0.74,
  },
  {
    sessionId: 'sess_1082c_aela',
    displayName: 'Nightly Indexer Function',
    entityId: 'lambda-nightly-indexer-worker',
    resourceName: 'aela-revocation-queue',
    resourceType: 'SQS FIFO Queue',
    targetResource: 'arn:aws:sqs:us-east-1:123456789012:aela-revocation-queue.fifo',
    roleArn: 'arn:aws:iam::123456789012:role/QueueProcessorScopedRole',
    srcIp: '10.240.4.110',
    grantedAt: new Date(Date.now() - 15 * 1000).toISOString(),
    ttlRemaining: 285,
    maxTtl: 300,
    status: 'ACTIVE',
    actionScope: 'sqs:ReceiveMessage, sqs:DeleteMessage',
    authMechanism: 'AWS_STS_AssumeRole',
    threatScore: 0.05,
  }
];

export const INITIAL_ANOMALIES = [
  {
    eventId: 'anom_993x',
    title: 'Credential extraction attempt via IMDSv1',
    description: 'Workload issued unauthenticated requests to instance metadata endpoint (169.254.169.254) attempting to read STS session credentials.',
    entityName: 'Aurora Auth Proxy Node',
    entityId: 'node-k8s-pod-auth-proxy',
    target: 'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
    srcIp: '192.168.1.45',
    threatScore: 0.94,
    severity: 'CRITICAL',
    priority: 'High',
    assignee: 'SecOps Incident Response',
    timestamp: new Date(Date.now() - 42 * 1000).toISOString(),
    vector: 'SSRF_CREDENTIAL_EXFIL',
    recommendedAction: 'Quarantine identity immediately to terminate temporary STS credentials and attach ExplicitAbsoluteDenyAll.',
    actionTaken: 'AWAITING_OPERATOR'
  },
  {
    eventId: 'anom_771b',
    title: 'Unauthorized IAM policy alteration',
    description: 'API request attempted to attach AdministratorAccess policy outside authorized Terraform deployment pipelines.',
    entityName: 'Ingress Worker Pod 02',
    entityId: 'srv-prod-ingress-worker-02',
    target: 'arn:aws:iam::123456789012:policy/AdminAccess',
    srcIp: '10.240.12.89',
    threatScore: 0.82,
    severity: 'HIGH',
    priority: 'Medium',
    assignee: 'SecOps Automation',
    timestamp: new Date(Date.now() - 180 * 1000).toISOString(),
    vector: 'PRIVILEGE_ESCALATION',
    recommendedAction: 'Audit deployment pipeline token and inspect CloudTrail event history.',
    actionTaken: 'DENIED_BY_POLICY'
  },
  {
    eventId: 'anom_334m',
    title: 'Unusual cross-region S3 traversal',
    description: 'Bulk GetObject requests targeted non-standard European backup replication bucket within a 10-second window.',
    entityName: 'ETL Pipeline Sync Role',
    entityId: 'iam-role-etl-pipeline-sync',
    target: 'arn:aws:s3:::backup-vault-eu-west-1/*',
    srcIp: '172.31.84.14',
    threatScore: 0.61,
    severity: 'MEDIUM',
    priority: 'Low',
    assignee: 'DevOps On-Call',
    timestamp: new Date(Date.now() - 360 * 1000).toISOString(),
    vector: 'DATA_EXFILTRATION_PATTERN',
    recommendedAction: 'Verify if scheduled multi-region disaster recovery audit is currently executing.',
    actionTaken: 'RATE_LIMITED'
  }
];

export const INITIAL_REVOCATION_LOGS = [
  {
    id: 'rev_log_001',
    timestamp: new Date(Date.now() - 180 * 1000).toISOString(),
    targetRole: 'arn:aws:iam::123456789012:role/LegacyBatchRunner',
    entityName: 'Batch Compute Worker 09',
    entityId: 'srv-batch-compute-09',
    eventType: 'Inactivity Decay Revocation',
    reason: 'Idle timeout threshold exceeded (300s scale-to-zero)',
    stepFunctionArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:RevocationWorkflow:exec-4f81',
    enforcementPolicy: 'ExplicitAbsoluteDenyAll',
    status: 'Completed'
  },
  {
    id: 'rev_log_002',
    timestamp: new Date(Date.now() - 420 * 1000).toISOString(),
    targetRole: 'arn:aws:iam::123456789012:role/TempAnalystDebugRole',
    entityName: 'External Auditor Session',
    entityId: 'usr-guest-external-audit',
    eventType: 'Heuristic Anomaly Quarantine',
    reason: 'Anomalous non-VPC source IP address burst detected',
    stepFunctionArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:RevocationWorkflow:exec-119c',
    enforcementPolicy: 'ExplicitAbsoluteDenyAll',
    status: 'Completed'
  }
];
