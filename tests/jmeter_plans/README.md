# AELA JMeter Load Testing Plans

This directory contains Apache JMeter test plans (`.jmx`) for Phase 4 empirical transaction load testing and stress-testing the Just-In-Time (JIT) credential leasing and revocation pipelines.

## Test Scenarios
1. **Bursty Traffic Ingestion (`burst_traffic_plan.jmx`):**
   - High-concurrency spikes against API Gateway JIT authorization endpoint.
   - Evaluates STS transient credential minting latency under load.
2. **Idle Expiration & Revocation Loop (`revocation_stress_plan.jmx`):**
   - Simulates periodic telemetry events followed by idle gap intervals to verify automated scale-to-zero IAM revocation.

## Local Execution & Network Bridge Notes
- When running JMeter locally on Windows workstations (specifically systems running Hyper-V, WSL2, or Docker Desktop virtual Ethernet bridge adapters), ensure network routing targets the configured AWS API Gateway endpoint or local mock proxies without adapter collision.
- Local execution artifacts (`*.jtl`, `jmeter.log`) and local adapter configurations are excluded via `.gitignore`.
