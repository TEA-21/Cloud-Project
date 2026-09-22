"""
AELA Phase 4 - Empirical Load Testing & Benchmark Runner
Executes concurrent synthetic traffic spikes against:
  1. The Analytics Engine real-time LSTM inference pipeline
  2. The JIT Proxy STS credential minting pipeline
  3. The integrated full-stack JIT Proxy + Analytics Engine workflow

Usage:
  python tests/jmeter_plans/load_test_runner.py [--concurrency 50] [--requests 200] [--mode all]
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

# Ensure project root is on sys.path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.analytics_engine.anomaly_detector import analyze_event_anomaly, get_detector
from src.analytics_engine.handler import lambda_handler as analytics_lambda_handler
from src.analytics_engine.models import CloudTrailEvent
from src.jit_proxy.handler import lambda_handler as jit_lambda_handler


# ------------------------------------------------------------------------------
# 1. JIT Proxy Credential Minting Transaction
# ------------------------------------------------------------------------------

def execute_jit_lease_request(node_id: str, is_quarantined: bool = False) -> Tuple[bool, float, int]:
    """Simulates a single microservice transaction requesting JIT credentials."""
    start = time.perf_counter()
    event = {
        "httpMethod": "POST",
        "path": "/jit/lease",
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({
            "service_id": node_id,
            "requested_action": "state:read",
            "target_role_arn": "arn:aws:iam::123456789012:role/aela-dev-base-service-role",
            "resource_arn": "arn:aws:dynamodb:us-east-1:123456789012:table/aela-dev-identity-state",
            "quarantined": is_quarantined,
        }),
    }
    response = jit_lambda_handler(event, context=None)
    duration_ms = (time.perf_counter() - start) * 1000.0
    status_code = response.get("statusCode", 500)
    success = (status_code == 200) if not is_quarantined else (status_code == 403)
    return success, duration_ms, status_code


# ------------------------------------------------------------------------------
# 2. Analytics Engine Real-Time LSTM Inference Transaction
# ------------------------------------------------------------------------------

def execute_analytics_inference_request(
    node_id: str,
    is_anomalous: bool = False,
    rolling_freq: float = 5.0,
) -> Tuple[bool, float, Dict[str, Any]]:
    """
    Simulates real-time telemetry ingestion and deep-learning LSTM sequence inference.
    Evaluates inference latency, threat scoring, and isolation decisions under burst load.
    """
    start = time.perf_counter()

    if is_anomalous:
        telemetry_payload = {
            "service_id": node_id,
            "requested_action": "AttachRolePolicy",
            "target_role_arn": "arn:aws:iam::123456789012:role/Admin",
            "resource_arn": "arn:aws:iam::123456789012:policy/Admin",
            "source_ip": "198.51.100.88",
            "user_agent": "sqlmap/1.5",
            "lease_duration_sec": 3600.0,
            "request_interval_sec": 0.05,
            "rolling_frequency_60s": 45.0,
            "error_code": "AccessDenied",
        }
    else:
        telemetry_payload = {
            "service_id": node_id,
            "requested_action": "state:read",
            "target_role_arn": "arn:aws:iam::123456789012:role/aela-dev-base-service-role",
            "resource_arn": "arn:aws:dynamodb:us-east-1:123456789012:table/aela-state",
            "source_ip": "10.0.1.50",
            "user_agent": "aws-sdk-go/v1.44",
            "lease_duration_sec": 300.0,
            "request_interval_sec": 12.0,
            "rolling_frequency_60s": rolling_freq,
        }

    result = analyze_event_anomaly(telemetry_payload)
    duration_ms = (time.perf_counter() - start) * 1000.0

    # Success criteria: correctly identified state
    is_correct = (result.is_anomaly == is_anomalous)
    metadata = {
        "is_anomaly": result.is_anomaly,
        "score": result.anomaly_score,
        "source": result.detection_source,
        "risk": result.risk_level,
    }
    return is_correct, duration_ms, metadata


# ------------------------------------------------------------------------------
# 3. Full Integrated JIT + Analytics Telemetry Transaction
# ------------------------------------------------------------------------------

def execute_integrated_request(
    node_id: str,
    is_anomalous: bool = False,
) -> Tuple[bool, float, Dict[str, Any]]:
    """Simulates the combined workflow: JIT proxy credential minting followed by analytics telemetry evaluation."""
    start = time.perf_counter()

    # 1. JIT Request
    jit_success, jit_lat, status_code = execute_jit_lease_request(node_id, is_quarantined=False)

    # 2. Analytics Telemetry Inference
    analytics_success, analytics_lat, meta = execute_analytics_inference_request(node_id, is_anomalous=is_anomalous)

    total_duration_ms = (time.perf_counter() - start) * 1000.0
    overall_success = jit_success and analytics_success

    return overall_success, total_duration_ms, {
        "jit_latency_ms": jit_lat,
        "analytics_latency_ms": analytics_lat,
        "status_code": status_code,
        "meta": meta,
    }


# ------------------------------------------------------------------------------
# Generic Suite Runner & Metrics Aggregator
# ------------------------------------------------------------------------------

def run_suite(
    suite_name: str,
    target_pipeline: str,
    worker_fn: Any,
    concurrency: int = 50,
    total_requests: int = 200,
) -> Dict[str, Any]:
    print("=" * 88)
    print(f"      AELA LOAD TEST BENCHMARK: {suite_name.upper()}")
    print("=" * 88)
    print(f" Concurrency Level  : {concurrency} worker threads")
    print(f" Total Transactions : {total_requests} requests")
    print(f" Target Pipeline    : {target_pipeline}")
    print("-" * 88)

    latencies_ms: List[float] = []
    success_count = 0
    failure_count = 0

    overall_start = time.perf_counter()

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [
            executor.submit(worker_fn, f"i-node-{i % concurrency}", (i % 10 == 0))
            for i in range(total_requests)
        ]

        for future in as_completed(futures):
            try:
                res = future.result()
                success = res[0]
                latency = res[1]
                latencies_ms.append(latency)
                if success:
                    success_count += 1
                else:
                    failure_count += 1
            except Exception:
                failure_count += 1

    total_duration_sec = time.perf_counter() - overall_start
    throughput_rps = total_requests / total_duration_sec if total_duration_sec > 0 else 0.0

    sorted_lat = sorted(latencies_ms) if latencies_ms else [0.0]
    p50 = statistics.median(sorted_lat)
    p90 = sorted_lat[int(len(sorted_lat) * 0.90)] if sorted_lat else 0.0
    p95 = sorted_lat[int(len(sorted_lat) * 0.95)] if sorted_lat else 0.0
    p99 = sorted_lat[int(len(sorted_lat) * 0.99)] if sorted_lat else 0.0
    mean_lat = statistics.mean(sorted_lat) if sorted_lat else 0.0

    print("\n[EMPIRICAL PERFORMANCE METRICS]")
    print(f" Total Time Elapsed : {total_duration_sec:.2f} seconds")
    print(f" Throughput (RPS)   : {throughput_rps:.2f} req/sec")
    print(f" Successful Checks  : {success_count} / {total_requests} ({(success_count/total_requests)*100:.1f}%)")
    print(f" Error / Anomalies  : {failure_count}")
    print("-" * 88)
    print("[LATENCY DISTRIBUTION]")
    print(f" Min Latency        : {min(sorted_lat):.2f} ms")
    print(f" Mean Latency       : {mean_lat:.2f} ms")
    print(f" 50th Percentile    : {p50:.2f} ms")
    print(f" 90th Percentile    : {p90:.2f} ms")
    print(f" 95th Percentile    : {p95:.2f} ms")
    print(f" 99th Percentile    : {p99:.2f} ms")
    print(f" Max Latency        : {max(sorted_lat):.2f} ms")
    print("=" * 88 + "\n")

    return {
        "suite_name": suite_name,
        "total_requests": total_requests,
        "concurrency": concurrency,
        "throughput_rps": round(throughput_rps, 2),
        "mean_latency_ms": round(mean_lat, 2),
        "p50_latency_ms": round(p50, 2),
        "p90_latency_ms": round(p90, 2),
        "p95_latency_ms": round(p95, 2),
        "p99_latency_ms": round(p99, 2),
        "min_latency_ms": round(min(sorted_lat), 2),
        "max_latency_ms": round(max(sorted_lat), 2),
        "success_rate_percent": round((success_count / total_requests) * 100.0, 2),
    }


def run_benchmark(concurrency: int = 50, total_requests: int = 200, mode: str = "all") -> Dict[str, Any]:
    """
    Executes empirical performance tests across requested modes:
    'analytics', 'jit', 'integrated', or 'all'.
    Maintains 100% backward compatibility with visual_demo.py and previous callers.
    """
    results: Dict[str, Any] = {}

    # Ensure model is warmed up in memory
    get_detector()

    if mode in ("analytics", "all"):
        results["analytics"] = run_suite(
            suite_name="Analytics Engine Real-Time LSTM Inference",
            target_pipeline="In-Memory Preprocessing -> 3D Tensor Buffering -> PyTorch LSTM -> Dynamic Threshold",
            worker_fn=execute_analytics_inference_request,
            concurrency=concurrency,
            total_requests=total_requests,
        )

    if mode in ("jit", "all"):
        results["jit"] = run_suite(
            suite_name="JIT Proxy STS Token Minting",
            target_pipeline="API Gateway Payload Validation -> Dynamic Policy Scoping -> STS AssumeRole",
            worker_fn=execute_jit_lease_request,
            concurrency=concurrency,
            total_requests=total_requests,
        )

    if mode in ("integrated", "all"):
        results["integrated"] = run_suite(
            suite_name="Integrated Full-Stack Workflow",
            target_pipeline="JIT Token Minting + Real-Time Telemetry Analytics Evaluation",
            worker_fn=execute_integrated_request,
            concurrency=concurrency,
            total_requests=total_requests,
        )

    print("\n[APACHE JMETER EXECUTION COMMAND]")
    print("To execute the full synthetic test plan using the JMeter CLI:")
    print("  jmeter -n -t tests/jmeter_plans/burst_traffic_plan.jmx \\")
    print("         -Jtarget_host=127.0.0.1 -Jtarget_port=8000 -Jprotocol=http \\")
    print("         -Jthreads=50 -Jramp_up=5 -Jloop_count=10 \\")
    print("         -l tests/jmeter_plans/results/load_test_results.jtl\n")

    # If single mode or backward-compatible call, return primary dictionary
    if mode == "jit":
        return results["jit"]
    elif mode == "analytics":
        return results["analytics"]
    elif mode == "integrated":
        return results["integrated"]

    # In 'all' mode, flatten primary metrics for backward compatibility while providing full data
    combined = dict(results.get("analytics", {}))
    combined["sub_suites"] = results
    return combined


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AELA Load Test & Benchmark Runner")
    parser.add_argument("--concurrency", type=int, default=50, help="Number of concurrent worker threads")
    parser.add_argument("--requests", type=int, default=200, help="Total number of requests to dispatch")
    parser.add_argument("--mode", type=str, default="all", choices=["all", "analytics", "jit", "integrated"])
    args = parser.parse_args()

    run_benchmark(concurrency=args.concurrency, total_requests=args.requests, mode=args.mode)
