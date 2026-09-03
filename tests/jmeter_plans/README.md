# AELA Apache JMeter Load Testing & Empirical Validation Suite

This directory contains the Apache JMeter test plan (`burst_traffic_plan.jmx`), local HTTP mock server (`mock_server.py`), and automated load benchmark runner (`load_test_runner.py`) for **Phase 4: Empirical Load Testing & Validation**.

---

## 📁 Directory Layout
```
tests/jmeter_plans/
├── README.md                 # Execution documentation & configuration guide
├── burst_traffic_plan.jmx    # Apache JMeter test plan (XML 5.x)
├── mock_server.py            # Local Python HTTP mock server (port 8000)
├── load_test_runner.py       # Standalone high-concurrency benchmark runner
└── results/                  # Test output directory (*.jtl files, git-ignored)
```

---

## 🎯 Test Scenarios Covered

1. **JIT Credential Leasing Burst Load (`TG 1`)**:
   - Spikes high-concurrency requests against `POST /jit/lease`.
   - Benchmarks API Gateway throughput and measures the latency of dynamic IAM session policy generation and AWS STS `AssumeRole` transient credential minting.
   - Asserts HTTP 200, JSON status `GRANTED`, and valid ephemeral session token signature (`ASIA...`).

2. **Step Functions Revocation Loop Stress Load (`TG 2`)**:
   - Simulates sudden traffic spikes and idle decay expiration triggers against `POST /quarantine/trigger`.
   - Validates that the active revocation state machine strips operational policies, attaches the `ExplicitAbsoluteDenyAll` role, and publishes an SNS security alert.

3. **Quarantined Node Rejection Verification (`TG 3`)**:
   - Sends requests on behalf of isolated microservices, confirming that the JIT proxy enforces absolute zero-standing privilege with immediate HTTP 403 / `DENIED` responses.

---

## 🚀 Execution Instructions

### Option A: Running with Apache JMeter CLI (Offline Local Mode)
1. **Start the local mock server** in a separate terminal:
   ```powershell
   python tests/jmeter_plans/mock_server.py
   ```
2. **Execute the JMeter test plan**:
   ```powershell
   jmeter -n -t tests/jmeter_plans/burst_traffic_plan.jmx \
          -Jtarget_host=127.0.0.1 \
          -Jtarget_port=8000 \
          -Jprotocol=http \
          -Jthreads=50 \
          -Jramp_up=5 \
          -Jloop_count=10 \
          -l tests/jmeter_plans/results/load_test_results.jtl
   ```

### Option B: Running against Live AWS API Gateway
Execute the test plan targeting the provisioned API Gateway endpoint:
```powershell
jmeter -n -t tests/jmeter_plans/burst_traffic_plan.jmx \
       -Jtarget_host=api.example.execute-api.us-east-1.amazonaws.com \
       -Jtarget_port=443 \
       -Jprotocol=https \
       -Jjit_path=/dev/jit/lease \
       -Jrevocation_path=/dev/quarantine/trigger \
       -Jthreads=50 \
       -Jramp_up=5 \
       -Jloop_count=10 \
       -l tests/jmeter_plans/results/load_test_results.jtl
```

### Option C: Python High-Concurrency Benchmark Runner (No JMeter Required)
For offline project presentation demos where JMeter GUI is not available:
```powershell
python tests/jmeter_plans/load_test_runner.py --concurrency 50 --requests 200
```

---

## ⚙️ Windows & Virtual Network Bridge Compatibility
- The local server binds explicitly to `127.0.0.1:8000` (loopback) to prevent IP binding collisions on Windows workstations with active **Hyper-V**, **WSL2**, or **Docker Desktop** virtual Ethernet bridge adapters.
- All test results (`*.jtl`, `jmeter.log`) and local environment override files are excluded from Git via `.gitignore`.
