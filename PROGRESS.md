# AELA - Project Progress & Execution State

## Current Active Phase
- **Phase 3: State-Machine Loop Engineering & JIT Proxy Integration (Completed)**
- **Transitioning to Phase 4: Empirical Load Testing & Validation (Weeks 7-8)**

## Completed Steps & Exact Techniques/Libraries Used
1. **Phase 1: Declarative Infrastructure Coding (Completed):**
   - Initialized modular repository structure and `.gitignore`.
   - Provisioned isolated VPC, subnets, route tables, quarantine security group (`aws_security_group.quarantine_sg`), and target EC2 micro instance (`aws_instance.target_test_node` with IMDSv2 enforced).
   - Provisioned private VPC Endpoints (AWS STS, CloudWatch Logs, CloudTrail Interface endpoints; Amazon S3 and DynamoDB Gateway endpoints).
   - Provisioned S3 CloudTrail audit storage and CloudWatch telemetry stream log group (`/aws/aela/${var.environment}/telemetry`).
   - Provisioned S3 remote state bucket, DynamoDB state lock table, and modular `backend.tf`.
   - Configured base IAM operational role and dynamic explicit-Deny isolation role (`aws_iam_role.deny_isolation_role`).

2. **Phase 2: Event Stream Integration & Analytics Engine (Completed):**
   - Stream parsing and decompression for CloudWatch Logs (`gzip` + `base64`), Kinesis, and direct CloudTrail JSON.
   - Time-decay gap calculations (`idle_duration_seconds = current_time - last_activity_time`) against configurable 300s threshold.
   - Anomaly and risk signature detector (`anomaly_detector.py`) for unauthorized operations, sensitive IAM mutations, and security group tampering.
   - DynamoDB state tracking with offline in-memory fallback.
   - 13 offline unit tests in `tests/test_analytics_engine.py` (100% pass rate).
   - Interactive demo runner in `src/analytics_engine/demo_runner.py`.

3. **Phase 3: State-Machine Loop Engineering & JIT Leasing (Completed):**
   - **AWS Step Functions Active Revocation Loop ([`infrastructure/asl/revocation_workflow.asl.json`](file:///d:/Projects/Cloud%20Architecture%20Project/infrastructure/asl/revocation_workflow.asl.json)):**
     - Designed Amazon States Language (ASL) JSON workflow.
     - Sequentially executes dynamic IAM operational policy detachment (`iam:detachRolePolicy`), immediate Deny isolation policy attachment (`iam:attachRolePolicy`), and SNS alert publishing (`sns:publish`).
     - Includes robust error handling (`Catch` on `States.ALL` and `NoSuchEntityException`) routing to failure alerting.
   - **Amazon SNS Quarantine Alert Integration ([`infrastructure/main.tf`](file:///d:/Projects/Cloud%20Architecture%20Project/infrastructure/main.tf)):**
     - Provisioned `aws_sns_topic.quarantine_alerts` (`aela-${var.environment}-quarantine-alerts`) and optional email subscription endpoint.
     - Configured Step Functions IAM role with least-privilege policy for role swapping and SNS publishing.
     - Configured CloudWatch Log Group for execution logging (`aws_cloudwatch_log_group.sfn_log_group`).
   - **Just-In-Time (JIT) Authorization Proxy ([`src/jit_proxy/handler.py`](file:///d:/Projects/Cloud%20Architecture%20Project/src/jit_proxy/handler.py)):**
     - Amazon API Gateway backend handler validating microservice identity, requested action, and quarantine status.
     - Dynamically constructs minimal, scoped-down session policies (e.g. restricting strictly to `dynamodb:GetItem` or `s3:GetObject`).
     - Integrates AWS STS `AssumeRole` to issue localized, 5-minute transient access tokens.
     - Integrated offline presentation fallback mode when credentials are not present.
   - **Presentation Demo Runner ([`src/jit_proxy/demo_runner.py`](file:///d:/Projects/Cloud%20Architecture%20Project/src/jit_proxy/demo_runner.py)):**
     - Interactive script showcasing valid lease granting, quarantined node rejections, and unauthorized action blockings.
   - **Unit Testing Suite with Moto Parity ([`tests/test_jit_proxy.py`](file:///d:/Projects/Cloud%20Architecture%20Project/tests/test_jit_proxy.py)):**
     - 10 unit tests using `moto.mock_aws` and offline mock fixtures.
     - Combined total of **23 unit tests** passing with 100% offline reliability.

## Files Created or Modified
- [`infrastructure/asl/revocation_workflow.asl.json`](file:///d:/Projects/Cloud%20Architecture%20Project/infrastructure/asl/revocation_workflow.asl.json)
- [`infrastructure/variables.tf`](file:///d:/Projects/Cloud%20Architecture%20Project/infrastructure/variables.tf)
- [`infrastructure/main.tf`](file:///d:/Projects/Cloud%20Architecture%20Project/infrastructure/main.tf)
- [`infrastructure/outputs.tf`](file:///d:/Projects/Cloud%20Architecture%20Project/infrastructure/outputs.tf)
- [`src/jit_proxy/handler.py`](file:///d:/Projects/Cloud%20Architecture%20Project/src/jit_proxy/handler.py)
- [`src/jit_proxy/demo_runner.py`](file:///d:/Projects/Cloud%20Architecture%20Project/src/jit_proxy/demo_runner.py)
- [`tests/test_jit_proxy.py`](file:///d:/Projects/Cloud%20Architecture%20Project/tests/test_jit_proxy.py)
- [`PROGRESS.md`](file:///d:/Projects/Cloud%20Architecture%20Project/PROGRESS.md)

## Next Immediate Action
- **Begin Phase 4: Empirical Load Testing & Validation**:
  - Author Apache JMeter test plan (`tests/jmeter_plans/burst_traffic_plan.jmx`) to benchmark API Gateway JIT authorization endpoint throughput, STS transient credential minting latency, and Step Functions revocation triggers under burst load.
  - Test synthetic traffic spikes and verify isolation metrics.
