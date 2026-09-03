# AELA - Project Progress & Execution State

## Current Active Phase
- **Interactive Visual Web Dashboard & Academic UI Delivery (Completed)**

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
   - AWS Step Functions active revocation loop ASL JSON workflow ([`infrastructure/asl/revocation_workflow.asl.json`](file:///d:/Projects/Cloud%20Architecture%20Project/infrastructure/asl/revocation_workflow.asl.json)).
   - Amazon SNS topic (`aela-${var.environment}-quarantine-alerts`) and email alert subscription integration.
   - Just-In-Time (JIT) Authorization Proxy ([`src/jit_proxy/handler.py`](file:///d:/Projects/Cloud%20Architecture%20Project/src/jit_proxy/handler.py)) issuing 5-minute ephemeral AWS STS credentials with dynamic scoped session policies.
   - Interactive demo runner in `src/jit_proxy/demo_runner.py`.
   - 10 unit tests with `moto.mock_aws` in `tests/test_jit_proxy.py`.

4. **Phase 4: Empirical Load Testing & Validation (Completed):**
   - Apache JMeter Test Plan ([`tests/jmeter_plans/burst_traffic_plan.jmx`](file:///d:/Projects/Cloud%20Architecture%20Project/tests/jmeter_plans/burst_traffic_plan.jmx)).
   - Local Mock HTTP Server ([`tests/jmeter_plans/mock_server.py`](file:///d:/Projects/Cloud%20Architecture%20Project/tests/jmeter_plans/mock_server.py)).
   - High-Concurrency Benchmark Runner ([`tests/jmeter_plans/load_test_runner.py`](file:///d:/Projects/Cloud%20Architecture%20Project/tests/jmeter_plans/load_test_runner.py)).

5. **Presentation Systems & Interactive UI (Completed):**
   - **Terminal Academic Runner ([`run_academic_demo.py`](file:///d:/Projects/Cloud%20Architecture%20Project/run_academic_demo.py)):**
     - Clears screen, prints formal academic header, and sequentially executes the 3 runners with 5s pauses and signal interruption handling.
   - **Interactive Streamlit Web Dashboard ([`visual_demo.py`](file:///d:/Projects/Cloud%20Architecture%20Project/visual_demo.py)):**
     - Academic header: `Automated Ephemeral Least-Privilege Architecture` with subheader: `Presented by: Taanush Emmanuel Abraham (24BCE0708) & Tanishka Kundu (24BCE0730) | Vellore Institute of Technology`.
     - **Tab 1 ("Telemetry & Isolation")**: Injects synthetic CloudTrail signatures, evaluates time-decay idle gaps, updates DynamoDB state in real time, and visually alerts/flashes red on `IDLE_EXPIRED` and `ANOMALY_QUARANTINED` triggers with simulated SNS alert dispatches.
     - **Tab 2 ("JIT Access Proxy")**: Simulates microservice API Gateway authorization requests, displays dynamically scoped IAM session policy generation, and mints 5-minute transient STS tokens with `st.success()`, while blocking quarantined nodes with `st.error()`.
     - **Tab 3 ("Load Metrics")**: Runs multi-threaded burst benchmarks, displays throughput (RPS) and latency percentiles (p50, p90, p99) via `st.metric()`, and plots synthetic burst traffic curves vs isolation thresholds via `st.line_chart()`.
     - Pinned core dependencies in root [`requirements.txt`](file:///d:/Projects/Cloud%20Architecture%20Project/requirements.txt).
     - Full offline parity with `AELA_OFFLINE_MODE=1`.

## Files Created or Modified
- [`visual_demo.py`](file:///d:/Projects/Cloud%20Architecture%20Project/visual_demo.py)
- [`requirements.txt`](file:///d:/Projects/Cloud%20Architecture%20Project/requirements.txt)
- [`PROGRESS.md`](file:///d:/Projects/Cloud%20Architecture%20Project/PROGRESS.md)

## Next Immediate Action
- Launch the interactive web presentation dashboard locally by running:
  `streamlit run visual_demo.py`
