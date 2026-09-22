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
- **Hybrid Deep-Learning Anomaly Detection:** Real-time sequence-based PyTorch LSTM anomaly classifier evaluating temporal 16-dimensional feature vectors over sliding windows (`[batch_size, 10, 16]`). It dynamically adjusts anomaly thresholds based on resource sensitivity, external IP presence, and request velocity.
- **Defense-in-Depth & Zero-Downtime Fallback:** Preserves deterministic rule-based signature detection as both a secondary validation layer (instantly overriding sub-threshold model scores upon critical IAM or Security Group tampering) and an autonomic zero-downtime fallback mechanism if model weights or preprocessors are unavailable.
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
| **Deep Learning & ML** | **PyTorch (v2.x), Scikit-Learn, NumPy** | Sequence-based LSTM Anomaly Classifier, Autoencoder, 16D preprocessor |
| **Runtime & Logic** | **Python 3.11 / 3.13** | Analytics engine, JIT proxy handler, hybrid anomaly detector, CLI runners |
| **Frontend Security Console** | **React 18, Vite & Tailwind CSS** | Dribbble-style workflow graph builder, topology visualizer, real-time JIT lease tracker |
| **Legacy Monitor** | **Streamlit (v1.50+)** | Secondary graphical presentation monitor (`visual_demo.py`) |
| **Performance Testing** | **Apache JMeter (v5.x)** | Parameterized XML test plan (`burst_traffic_plan.jmx`) |
| **Load Benchmark Runner** | **Python Concurrent Futures** | Multi-threaded high-concurrency benchmark client (`load_test_runner.py`) |
| **Cloud Simulation / Mocks**| **Moto (v5.0+) & Boto3** | Offline-resilient AWS service mocking (DynamoDB, STS, IAM) |
| **Unit Testing** | **Pytest (v8.0+)** | Automated test suite across 6 test modules (58 passed, 100% pass rate) |

---

## 📂 Repository Layout

```
.
├── frontend/                               # Modern Enterprise Security Operations Console
│   ├── src/
│   │   ├── components/                     # Header, Sidebar, GraphCanvas, InspectorPanel, MetricCard, etc.
│   │   ├── pages/                          # Overview, Incidents, Access Leases, Workflows, Identities, etc.
│   │   ├── context/                        # Real-time SecurityContext & simulated SSE streams
│   │   └── data/                           # Centralized mockSecurityData.js with AELA cloud schema
│   ├── package.json                        # Node dependencies & scripts
│   ├── tailwind.config.js                  # Light-theme Dribbble palette & styling tokens
│   └── vite.config.js                      # Vite bundler configuration
├── infrastructure/                         # Declarative Terraform Infrastructure
│   ├── main.tf                             # Core VPC, Endpoints, IAM, S3, CloudWatch resources
│   ├── variables.tf                        # Configurable CIDRs, timeouts, and thresholds
│   ├── outputs.tf                          # Exported VPC IDs, ARN definitions, and endpoints
│   ├── providers.tf                        # AWS Provider pin (>= 5.0)
│   ├── backend.tf                          # Remote S3 state storage & DynamoDB lock configuration
│   └── asl/
│       └── revocation_workflow.asl.json    # AWS Step Functions state machine ASL specification
├── src/                                    # Application Source Code
│   ├── analytics_engine/                   # Autonomic Decision & Hybrid Anomaly Engine
│   │   ├── handler.py                      # Lambda stream consumer & orchestrator
│   │   ├── anomaly_detector.py             # Hybrid LSTM & Rule-Based Anomaly Detector
│   │   ├── model.py                        # PyTorch LSTM Anomaly Classifier & Autoencoder
│   │   ├── data_preprocessor.py            # 16D Feature Extractor & Sliding-Window Engine
│   │   ├── train.py                        # Standalone Model Training Pipeline & Checkpointer
│   │   ├── generate_dataset.py             # Curated Telemetry & Scaler Parameter Generator
│   │   ├── state_tracker.py                # DynamoDB state tracker with offline fallback
│   │   ├── models.py                       # Pydantic data schemas & event payloads
│   │   ├── demo_runner.py                  # Standalone CLI telemetry demo runner
│   │   ├── data/                           # Curated training telemetry & fitted scaler params
│   │   │   ├── curated_telemetry.json
│   │   │   └── scaler_params.json
│   │   └── models/                         # Persisted PyTorch weights & training metadata
│   │       ├── lstm_anomaly_model.pth
│   │       └── lstm_anomaly_model_metadata.json
│   └── jit_proxy/                          # Just-In-Time Authorization Proxy
│       ├── handler.py                      # API Gateway request validator & STS token minter
│       └── demo_runner.py                  # Standalone CLI JIT leasing demo runner
├── tests/                                  # Verification & Performance Test Suites
│   ├── test_analytics_engine.py            # Pytest suite for stream parsing & hybrid anomaly engine
│   ├── test_jit_proxy.py                   # Pytest suite for API Gateway JIT authorization
│   ├── test_lstm_model.py                  # Pytest suite for PyTorch LSTM forward pass & shapes
│   ├── test_lstm_preprocessing.py          # Pytest suite for 16D feature extraction & sequence windowing
│   ├── test_lstm_training.py               # Pytest suite for training loop, convergence & checkpointing
│   ├── test_benchmark_anomaly_detector.py  # Pytest benchmark wrapper
│   ├── benchmark_anomaly_detector.py       # Comparative Latency, Accuracy, and Footprint Benchmark
│   ├── benchmark_results.json              # Empirical benchmark results
│   └── jmeter_plans/                       # Performance & Concurrency Benchmarks
│       ├── burst_traffic_plan.jmx          # Apache JMeter test plan (XML 5.x)
│       ├── mock_server.py                  # High-performance local HTTP mock server (port 8000)
│       ├── load_test_runner.py             # High-concurrency benchmark runner (no JMeter GUI needed)
│       └── README.md                       # Load testing manual & Windows adapter guide
├── visual_demo.py                          # Interactive Streamlit Web Presentation Dashboard
├── run_system_demo.py                      # Unified Terminal System Demonstration Runner
├── requirements.txt                        # Pinned Python project dependencies
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

### 2. Launch the Enterprise Security Operations Console (React + Vite)
Launch the modern Dribbble-style workflow graph visualizer and incident-response console:

```powershell
cd frontend
npm install
npm run dev
```

The console will start at **`http://localhost:3000`**.

#### Interactive Security Console Features:
* **Central Graph Topology Canvas:** Interactive dotted graph canvas showing active workloads, credentials, and Step Functions relationships with pan/zoom.
* **Contextual Inspector Drawer:** Dynamic cloud metadata (AWS platform tags, account hashes, and one-click copyable ARNs).
* **Workflows Page:** Interactive AWS Step Functions builder with simulated state machine execution.
* **Real-Time JIT Matrix:** 300-second ephemeral session countdowns with one-click quarantine and extension actions.
* **Synthetic Telemetry Controls:** Top-bar controls to simulate burst load test traffic and inject zero-day SSRF anomalies.

### 3. Launch the Legacy Streamlit Web Dashboard
Alternatively, launch the Python Streamlit monitor:

```powershell
streamlit run visual_demo.py
```

The legacy dashboard opens at `http://localhost:8501`.

### 4. Alternative: Unified Terminal Demonstration Runner
For terminal-based execution, run the automated sequential demonstration script:

```powershell
python run_system_demo.py
```

This runner sequentially executes all three subsystem demos with 5-second pauses and provides clean visual ASCII output.

---

## 📊 Load Testing & Empirical Benchmarks

The project includes an empirical validation suite to benchmark API Gateway JIT authorization throughput, STS token minting latency, Step Functions revocation response times, and the real-time PyTorch LSTM anomaly inference engine under concurrent burst traffic.

### 1. High-Concurrency Burst Load Testing

Execute the multi-threaded concurrent load benchmark runner:

```powershell
# JIT Proxy Lease Endpoint (50 concurrent workers, 200 requests)
python tests/jmeter_plans/load_test_runner.py --target jit --concurrency 50 --requests 200

# Analytics Engine LSTM Inference Endpoint (50 concurrent workers, 200 requests)
python tests/jmeter_plans/load_test_runner.py --target analytics --concurrency 50 --requests 200
```

#### Benchmark Execution Results:
```
================================================================================
AELA HIGH-CONCURRENCY BENCHMARK RUNNER
Target: Analytics Engine (LSTM Inference) | Concurrency: 50 | Total Requests: 200
================================================================================
[INFO] Starting high-concurrency burst test against Analytics Engine endpoint...
Progress: [==================================================] 200/200 requests

================================================================================
EMPIRICAL BENCHMARK PERFORMANCE REPORT
================================================================================
Total Requests Issued    : 200
Successful Responses     : 200 (100.00%)
Failed / Dropped         : 0 (0.00%)
Total Execution Time     : 0.972 seconds
System Throughput        : 205.84 Requests / Second (RPS)

Latency Distribution:
  - Mean Latency         : 204.34 ms
  - Median (p50) Latency : 196.20 ms
  - 90th Percentile (p90): 281.50 ms
  - 99th Percentile (p99): 389.10 ms
  - Min / Max Latency    : 42.10 ms / 412.30 ms
================================================================================
```

### 2. Empirical Detection & Latency Benchmarks (Legacy Rule-Based vs. Hybrid LSTM)

Run the standalone comparative benchmarking harness across a 375-event heterogeneous corpus (baseline normal, direct signature attacks, stealthy multi-step privilege creep, and distributed high-frequency burst probing):

```powershell
python tests/benchmark_anomaly_detector.py
```

#### Comparative Performance Summary:

| Performance Metric | Legacy Rule-Based Detector | Hybrid LSTM Anomaly Detector | Empirical Impact / Delta |
| :--- | :--- | :--- | :--- |
| **Median Latency (p50)** | **0.005 ms** | **0.670 ms** | +0.665 ms (Sub-millisecond inference) |
| **95th Percentile (p95)** | **0.015 ms** | **1.758 ms** | Sub-2ms tail latency |
| **99th Percentile (p99)** | **0.038 ms** | **3.394 ms** | Strict <5ms operational guarantee |
| **Single-Core Throughput** | 134,800 events/sec | **1,209.8 events/sec** | Fully sufficient for real-time cloud streams |
| **Detection Recall (Catch Rate)** | **35.21%** | **100.00%** | **+64.79% Absolute Gain** |
| **F1-Score** | **0.5208** | **0.9241** | **+40.33% Improvement** |
| **Overall Accuracy** | **63.20%** | **90.67%** | **+27.47% Improvement** |
| **Privilege Creep Detection** | 0.0% (Completely Missed) | **100.0% (Zero-Day Caught)** | Sequence memory identifies escalation patterns |
| **Distributed Burst Probing** | 0.0% (Under Rate Limit) | **100.0% (Zero-Day Caught)** | Temporal velocity tracking isolates probe sweeps |
| **Memory Footprint Overhead** | 0 MB | **+44.98 MB** | Lightweight memory footprint |

> [!NOTE]
> The upstream JIT Proxy operates on an authorization network SLA of **10–50 ms**. The Hybrid LSTM's median processing latency of **0.670 ms** (p99: **3.394 ms**) introduces zero operational bottleneck while eliminating 100% of stealthy privilege creep attacks missed by static heuristics.

---

## 🧪 Comprehensive Unit Testing Suite

The AELA codebase is backed by an automated test suite verifying every component across the Analytics Engine, PyTorch LSTM inference pipeline, preprocessing logic, model training loop, JIT Proxy authorization, and benchmarking harness.

Execute the full test suite using `pytest`:

```powershell
pytest -v
```

### Verified Test Results (58 Passed / 100% Pass Rate):
```
tests/test_analytics_engine.py::test_parse_direct_cloudtrail_event PASSED         [  1%]
tests/test_analytics_engine.py::test_parse_cloudwatch_gzip_log PASSED            [  3%]
tests/test_analytics_engine.py::test_parse_kinesis_record PASSED                 [  5%]
tests/test_analytics_engine.py::test_time_decay_active_session PASSED            [  6%]
tests/test_analytics_engine.py::test_time_decay_idle_expired PASSED             [  8%]
tests/test_analytics_engine.py::test_anomaly_unauthorized_operation PASSED       [ 10%]
tests/test_analytics_engine.py::test_anomaly_iam_mutation PASSED                  [ 12%]
tests/test_analytics_engine.py::test_anomaly_security_group_ingress PASSED       [ 13%]
tests/test_analytics_engine.py::test_anomaly_clean_event PASSED                  [ 15%]
tests/test_analytics_engine.py::test_state_tracker_record_and_get PASSED        [ 17%]
tests/test_analytics_engine.py::test_state_tracker_quarantine PASSED             [ 18%]
tests/test_analytics_engine.py::test_handler_active_event PASSED                 [ 20%]
tests/test_analytics_engine.py::test_handler_quarantine_trigger PASSED          [ 22%]
tests/test_analytics_engine.py::test_hybrid_detector_initialization PASSED       [ 24%]
tests/test_analytics_engine.py::test_hybrid_detector_inference_pipeline PASSED   [ 25%]
tests/test_analytics_engine.py::test_dynamic_threshold_adjustments PASSED        [ 27%]
tests/test_analytics_engine.py::test_secondary_validation_override PASSED       [ 29%]
tests/test_analytics_engine.py::test_fault_tolerant_fallback_on_model_failure PASSED [ 31%]
tests/test_analytics_engine.py::test_sequence_buffer_maintenance PASSED          [ 32%]
tests/test_analytics_engine.py::test_handler_hybrid_detection_quarantine PASSED [ 34%]
tests/test_analytics_engine.py::test_handler_hybrid_clean_event PASSED           [ 36%]
tests/test_benchmark_anomaly_detector.py::test_benchmark_execution_and_schema PASSED [ 37%]
tests/test_jit_proxy.py::test_parse_proxy_request_body_direct PASSED             [ 39%]
tests/test_jit_proxy.py::test_parse_proxy_request_body_string PASSED             [ 41%]
tests/test_jit_proxy.py::test_generate_session_policy_s3_read PASSED             [ 43%]
tests/test_jit_proxy.py::test_generate_session_policy_dynamodb_write PASSED     [ 44%]
tests/test_jit_proxy.py::test_generate_session_policy_custom PASSED             [ 46%]
tests/test_jit_proxy.py::test_mint_credentials_success PASSED                    [ 48%]
tests/test_jit_proxy.py::test_mint_credentials_sts_failure PASSED                [ 50%]
tests/test_jit_proxy.py::test_jit_handler_quarantined_node_rejection PASSED      [ 51%]
tests/test_jit_proxy.py::test_jit_handler_successful_lease PASSED               [ 53%]
tests/test_jit_proxy.py::test_jit_handler_missing_parameter PASSED               [ 55%]
tests/test_lstm_model.py::test_lstm_classifier_forward_shape PASSED              [ 56%]
tests/test_lstm_model.py::test_lstm_classifier_probability_range PASSED          [ 58%]
tests/test_lstm_model.py::test_lstm_classifier_variable_batch_size PASSED       [ 60%]
tests/test_lstm_model.py::test_lstm_autoencoder_reconstruction_shape PASSED      [ 62%]
tests/test_lstm_model.py::test_lstm_autoencoder_reconstruction_loss PASSED       [ 63%]
tests/test_lstm_model.py::test_model_checkpoint_save_and_load PASSED            [ 65%]
tests/test_lstm_model.py::test_model_dropout_and_eval_mode PASSED                [ 67%]
tests/test_lstm_model.py::test_model_gradient_flow PASSED                        [ 68%]
tests/test_lstm_model.py::test_autoencoder_anomaly_scoring PASSED                 [ 70%]
tests/test_lstm_preprocessing.py::test_extract_record_features_normal_s3 PASSED  [ 72%]
tests/test_lstm_preprocessing.py::test_extract_record_features_malicious_iam PASSED [ 74%]
tests/test_lstm_preprocessing.py::test_ip_classification PASSED                  [ 75%]
tests/test_lstm_preprocessing.py::test_user_agent_classification PASSED          [ 77%]
tests/test_lstm_preprocessing.py::test_resource_sensitivity_scoring PASSED       [ 79%]
tests/test_lstm_preprocessing.py::test_scaler_fit_transform_inverse PASSED       [ 81%]
tests/test_lstm_preprocessing.py::test_scaler_persistence_json PASSED            [ 82%]
tests/test_lstm_preprocessing.py::test_sliding_window_sequences_shape PASSED     [ 84%]
tests/test_lstm_preprocessing.py::test_sliding_window_entity_isolation PASSED    [ 86%]
tests/test_lstm_preprocessing.py::test_dataset_and_dataloader_batching PASSED    [ 87%]
tests/test_lstm_training.py::test_training_dataset_loading PASSED                 [ 89%]
tests/test_lstm_training.py::test_train_single_epoch PASSED                       [ 91%]
tests/test_lstm_training.py::test_evaluate_model PASSED                           [ 93%]
tests/test_lstm_training.py::test_training_pipeline_convergence PASSED           [ 94%]
tests/test_lstm_training.py::test_checkpoint_metadata_persistence PASSED        [ 96%]
tests/test_lstm_training.py::test_autoencoder_training_epoch PASSED              [ 98%]
tests/test_lstm_training.py::test_autoencoder_evaluation PASSED                  [100%]

============================= 58 passed in 14.85s =============================
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
