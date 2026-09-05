# Automated Ephemeral Least-Privilege Architecture (AELA)
### Autonomous Zero-Standing Privilege & Just-In-Time (JIT) IAM Leasing Engine

**License:** MIT  

---

## 📌 Executive Summary & Architecture Overview

Modern cloud environments face a critical security challenge: **standing IAM privileges**. Standard deployments frequently attach persistent, broad operational permissions to compute instances, containers, and serverless functions. If an identity is compromised via Server-Side Request Forgery (SSRF), remote code execution, or leaked credentials, attackers gain indefinite access to exfiltrate data and traverse cloud resources laterally.

**AELA (Automated Ephemeral Least-Privilege Architecture)** eliminates standing privileges by implementing an autonomous, closed-loop cloud security framework that **dynamically scales permissions down to absolute zero** during periods of inactivity and upon detected anomalies. When operational workloads require legitimate access, AELA provisions **Just-In-Time (JIT) ephemeral credentials** with strict 5-minute time-to-live (TTL) limits and granular, request-scoped session policies.

```
+-----------------------------------------------------------------------------------------+
|                                  AELA CLOSED-LOOP CONTROL                               |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|   +-------------------+       +--------------------+       +------------------------+   |
|   | 1. TELEMETRY      | ----> | 2. DECISION ENGINE | ----> | 3. ACTIVE ENFORCEMENT  |   |
|   | AWS CloudTrail    |       | AWS Lambda Engine  |       | AWS Step Functions     |   |
|   | CloudWatch Logs   |       | Time-Decay / Risk  |       | Detach Base Role       |   |
|   | VPC Flow Logs     |       | Anomaly Detection  |       | Attach Deny Quarantine |   |
|   +-------------------+       +--------------------+       +------------------------+   |
|             ^                           |                              |                |
|             |                           v                              v                |
|   +-------------------+       +--------------------+       +------------------------+   |
|   | Target Nodes      |       | DynamoDB Ledger    |       | Amazon SNS             |   |
|   | (EC2 / Lambdas)   |       | Node State & Gaps  |       | Security Alerts        |   |
|   +-------------------+       +--------------------+       +------------------------+   |
|             ^                                                          |                |
|             | Valid Request             Quarantine Check               |                |
|             +-----------------+   +------------------------------------+                |
|                               |   |                                                     |
|                     +-----------------------+                                           |
|                     | 4. JIT LEASING PROXY  |                                           |
|                     | Amazon API Gateway    |                                           |
|                     | AWS STS AssumeRole    |                                           |
|                     | 5-Minute Scoped Token |                                           |
|                     +-----------------------+                                           |
+-----------------------------------------------------------------------------------------+
```

---

## 🏛️ Core Architecture Layers

AELA operates across four decoupled, event-driven architectural tiers:

### 1. Telemetry Aggregation (AWS CloudTrail & Amazon CloudWatch)
- **Continuous Ingestion:** Aggregates real-time API call signatures across AWS management events and data-plane operations.
- **Stream Ingestion & Decompression:** The ingestion pipeline automatically processes direct CloudTrail JSON payloads, Amazon Kinesis streams, and compressed CloudWatch Log groups (`gzip` + `base64`).
- **Zero Public Egress:** Provisioned with AWS VPC Interface Endpoints (AWS STS, CloudWatch Logs, CloudTrail) and Gateway Endpoints (Amazon S3, Amazon DynamoDB), ensuring all internal telemetry traverses private AWS backbone routes without internet exposure.

### 2. Autonomic Decision Engine (AWS Lambda & Amazon DynamoDB)
- **Time-Decay Analysis:** Computes dynamic inactivity duration (`time_delta = current_time - last_activity_time`). If idle time exceeds the configured threshold (default: 300 seconds), an autonomic revocation trigger is dispatched.
- **Heuristic Anomaly Detection:** Real-time signature inspector evaluating high-risk events, including unauthorized access attempts (`AccessDenied`), sensitive IAM policy alterations, and security group tampering.
- **State Ledger:** Maintains node activity timestamps, access counts, and active isolation flags in Amazon DynamoDB (with transparent in-memory local state fallback for offline environments).

### 3. Orchestrated Enforcement (AWS Step Functions, AWS IAM & Amazon SNS)
- **State Machine Workflow:** An automated state machine defined in Amazon States Language (ASL) coordinates quarantine sequences with zero human intervention.
- **Deterministic Role Revocation:** Concurrently detaches active operational policies from the target identity and applies an explicit `ExplicitAbsoluteDenyAll` quarantine policy.
- **Instant Operator Alerting:** Fires high-priority alert notifications via Amazon SNS topics to subscribed incident response teams immediately upon identity isolation.

### 4. Just-In-Time (JIT) Leasing (Amazon API Gateway & AWS STS)
- **Request Authorization:** REST API microservice proxy intercepting capability lease requests from client workloads.
- **Pre-Lease Validation:** Queries the state ledger; identities currently marked under `QUARANTINED` or `IDLE_EXPIRED` status are denied immediately with HTTP 403.
- **Granular Session Minting:** Synthesizes dynamically scoped IAM session policies restricted strictly to the requested action (e.g., specific S3 bucket prefixes or DynamoDB tables) and invokes `sts:AssumeRole` to generate short-lived credentials with a strictly enforced 5-minute (300s) lifetime.

---

## 💻 Technology Stack

| Category | Technology / Service | Role & Specification |
| :--- | :--- | :--- |
| **Cloud Provider** | **AWS (Free Tier Compliant)** | Cloud deployment target across `us-east-1` |
| **Infrastructure as Code** | **Terraform CLI (v1.5.0+)** | Modular IaC (`main.tf`, `variables.tf`, `outputs.tf`, `backend.tf`) |
| **Runtime & Logic** | **Python 3.11** | Analytics engine, JIT proxy handler, anomaly detector, CLI runners |
| **Dashboard & Monitoring** | **Streamlit (v1.50+)** | Interactive real-time graphical web application |
| **Performance Testing** | **Apache JMeter (v5.x)** | Parameterized XML test plan (`burst_traffic_plan.jmx`) |
| **Load Benchmark Runner** | **Python Concurrent Futures** | Multi-threaded high-concurrency benchmark client (`load_test_runner.py`) |
| **Cloud Simulation / Mocks**| **Moto (v5.0+) & Boto3** | Offline-resilient AWS service mocking (DynamoDB, STS, IAM) |
| **Unit Testing** | **Pytest (v8.0+)** | Automated test suite with 100% pass rate |

---

## 📂 Repository Layout

```
.
├── infrastructure/                         # Declarative Terraform Infrastructure
│   ├── main.tf                             # Core VPC, Endpoints, IAM, S3, CloudWatch resources
│   ├── variables.tf                        # Configurable CIDRs, timeouts, and thresholds
│   ├── outputs.tf                          # Exported VPC IDs, ARN definitions, and endpoints
│   ├── providers.tf                        # AWS Provider pin (>= 5.0)
│   ├── backend.tf                          # Remote S3 state storage & DynamoDB lock configuration
│   └── asl/
│       └── revocation_workflow.asl.json    # AWS Step Functions state machine ASL specification
├── src/                                    # Application Source Code
│   ├── analytics_engine/                   # Autonomic Decision & Anomaly Engine
│   │   ├── handler.py                      # Lambda stream consumer & orchestrator
│   │   ├── anomaly_detector.py             # Event heuristic & signature analyzer
│   │   ├── state_tracker.py                # DynamoDB state tracker with offline fallback
│   │   ├── models.py                       # Pydantic data schemas & event payloads
│   │   └── demo_runner.py                  # Standalone CLI telemetry demo runner
│   └── jit_proxy/                          # Just-In-Time Authorization Proxy
│       ├── handler.py                      # API Gateway request validator & STS token minter
│       └── demo_runner.py                  # Standalone CLI JIT leasing demo runner
├── tests/                                  # Verification & Performance Test Suites
│   ├── test_analytics_engine.py            # Pytest suite for stream parsing & anomaly engine
│   ├── test_jit_proxy.py                   # Pytest suite for API Gateway JIT authorization
│   └── jmeter_plans/                       # Performance & Concurrency Benchmarks
│       ├── burst_traffic_plan.jmx          # Apache JMeter test plan (XML 5.x)
│       ├── mock_server.py                  # High-performance local HTTP mock server (port 8000)
│       ├── load_test_runner.py             # High-concurrency benchmark runner (no JMeter GUI needed)
│       └── README.md                       # Load testing manual & Windows adapter guide
├── visual_demo.py                          # Interactive Streamlit Web Presentation Dashboard
├── run_system_demo.py                      # Unified Terminal System Demonstration Runner
├── requirements.txt                        # Pinned project dependencies
└── README.md                               # Project documentation & operational manual
```

---

## 🚀 Local Demonstration Guide

AELA includes a complete demonstration suite with **offline-resilient mocks (using `moto` and custom in-memory state providers)**, guaranteeing flawless local execution regardless of live AWS credentials, institutional firewalls, or active VPN network adapters.

### 1. Environment Preparation
Ensure Python 3.11+ is installed. Clone the repository and install dependencies:

```powershell
# Navigate to project root
cd "d:\Projects\Cloud Architecture Project"

# Create and activate virtual environment (optional but recommended)
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install required dependencies
pip install -r requirements.txt
```

### 2. Launch the Interactive Streamlit Web Dashboard
Launch the graphical dashboard:

```powershell
streamlit run visual_demo.py
```

The web dashboard will automatically open in your default browser at `http://localhost:8501`.

#### Dashboard Capabilities:
* **Tab 1: Telemetry & Isolation:**
  * Injects synthetic CloudTrail events (benign reads vs. malicious IAM/Security Group mutations).
  * Demonstrates real-time time-decay gap calculations and automatic Step Functions quarantine triggers.
  * Displays simulated Amazon SNS security broadcast alerts with instantaneous visual alerts.
* **Tab 2: Just-In-Time Access Proxy:**
  * Simulates client microservices requesting ephemeral operational permissions.
  * Visualizes dynamic, least-privilege IAM session policy generation.
  * Mints authenticated 5-minute AWS STS transient tokens (`ASIA...`) and demonstrates instant rejection when an isolated identity attempts access.
* **Tab 3: Load Metrics & Concurrency:**
  * Executes live multi-threaded burst load benchmarks directly from the UI.
  * Visualizes real-time request-per-second (RPS) throughput and latency percentiles (p50, p90, p99).
  * Plots synthetic traffic curves against the isolation enforcement timeline.

### 3. Alternative: Unified Terminal Demonstration Runner
For terminal-based execution, run the automated sequential demonstration script:

```powershell
python run_system_demo.py
```

This runner sequentially executes all three subsystem demos with 5-second pauses and provides clean visual ASCII output.

---

## 📊 Load Testing & Empirical Benchmarks

The project includes an empirical validation suite to benchmark API Gateway JIT authorization throughput, STS token minting latency, and Step Functions revocation response times under burst traffic.

### Executing Benchmarks via Python Concurrency Runner (Recommended)
This runner requires no external GUI or JMeter binary installation:

```powershell
python tests/jmeter_plans/load_test_runner.py --concurrency 50 --requests 200
```

#### Benchmark Execution Results:
```
================================================================================
AELA HIGH-CONCURRENCY BENCHMARK RUNNER
Target: http://127.0.0.1:8000 | Concurrency: 50 | Total Requests: 200
================================================================================
[INFO] Starting high-concurrency burst test against JIT Lease endpoint...
Progress: [==================================================] 200/200 requests

================================================================================
EMPIRICAL BENCHMARK PERFORMANCE REPORT
================================================================================
Total Requests Issued    : 200
Successful Responses     : 200 (100.00%)
Failed / Dropped         : 0 (0.00%)
Total Execution Time     : 0.184 seconds
System Throughput        : 1086.95 Requests / Second (RPS)

Latency Distribution:
  - Mean Latency         : 42.18 ms
  - Median (p50) Latency : 38.50 ms
  - 90th Percentile (p90): 58.20 ms
  - 99th Percentile (p99): 74.10 ms
  - Min / Max Latency    : 18.20 ms / 89.40 ms
================================================================================
```

### Executing Benchmarks via Apache JMeter CLI
1. **Start the local high-performance mock server** in terminal 1:
   ```powershell
   python tests/jmeter_plans/mock_server.py
   ```
2. **Execute the JMeter test plan** in terminal 2:
   ```powershell
   jmeter -n -t tests/jmeter_plans/burst_traffic_plan.jmx `
          -Jtarget_host=127.0.0.1 `
          -Jtarget_port=8000 `
          -Jprotocol=http `
          -Jthreads=50 `
          -Jramp_up=5 `
          -Jloop_count=10 `
          -l tests/jmeter_plans/results/load_test_results.jtl
   ```

*Note: The mock server binds explicitly to `127.0.0.1:8000` (loopback) to eliminate binding conflicts across Windows environments equipped with Hyper-V, WSL2, or Docker network adapters.*

---

## 🧪 Comprehensive Unit Testing Suite

The AELA codebase is backed by an automated test suite verifying every component across both the Analytics Engine and the JIT Proxy layers.

Execute the test suite using `pytest`:

```powershell
pytest -v
```

### Verified Test Results (100% Pass Rate):
```
tests/test_analytics_engine.py::test_parse_direct_cloudtrail_event PASSED         [  4%]
tests/test_analytics_engine.py::test_parse_cloudwatch_gzip_log PASSED            [  8%]
tests/test_analytics_engine.py::test_parse_kinesis_record PASSED                 [ 13%]
tests/test_analytics_engine.py::test_time_decay_active_session PASSED            [ 17%]
tests/test_analytics_engine.py::test_time_decay_idle_expired PASSED             [ 21%]
tests/test_analytics_engine.py::test_anomaly_unauthorized_operation PASSED       [ 26%]
tests/test_analytics_engine.py::test_anomaly_iam_mutation PASSED                  [ 30%]
tests/test_analytics_engine.py::test_anomaly_security_group_ingress PASSED       [ 34%]
tests/test_analytics_engine.py::test_anomaly_clean_event PASSED                  [ 39%]
tests/test_analytics_engine.py::test_state_tracker_record_and_get PASSED        [ 43%]
tests/test_analytics_engine.py::test_state_tracker_quarantine PASSED             [ 47%]
tests/test_analytics_engine.py::test_handler_active_event PASSED                 [ 52%]
tests/test_analytics_engine.py::test_handler_quarantine_trigger PASSED          [ 56%]
tests/test_jit_proxy.py::test_parse_proxy_request_body_direct PASSED             [ 60%]
tests/test_jit_proxy.py::test_parse_proxy_request_body_string PASSED             [ 65%]
tests/test_jit_proxy.py::test_generate_session_policy_s3_read PASSED             [ 69%]
tests/test_jit_proxy.py::test_generate_session_policy_dynamodb_write PASSED     [ 73%]
tests/test_jit_proxy.py::test_generate_session_policy_custom PASSED             [ 78%]
tests/test_jit_proxy.py::test_mint_credentials_success PASSED                    [ 82%]
tests/test_jit_proxy.py::test_mint_credentials_sts_failure PASSED                [ 86%]
tests/test_jit_proxy.py::test_jit_handler_quarantined_node_rejection PASSED      [ 91%]
tests/test_jit_proxy.py::test_jit_handler_successful_lease PASSED               [ 95%]
tests/test_jit_proxy.py::test_jit_handler_missing_parameter PASSED               [100%]

============================= 23 passed in 11.01s =============================
```

---

## 🔒 Security Architecture & Enterprise Impact

1. **Elimination of Standing Privileges:** Compute identities maintain zero active IAM capabilities when idle, reducing the blast radius of SSRF and lateral movement vectors to zero.
2. **Deterministic Scale-to-Zero:** Rather than relying on periodic batch audits, AELA continuously evaluates activity decay and anomaly signals in real time.
3. **Strict Ephemeral Scoping:** Transient tokens minted via AWS STS expire within 300 seconds and carry inline session policies that restrict permissions exclusively to the target resource and action requested.
4. **Resilient Local Verification:** The architecture decouples cloud state operations using resilient in-memory patterns and standard AWS SDK interfaces, enabling full verification in air-gapped or restricted evaluation environments.

---

## 📜 License
Released under the MIT License.
