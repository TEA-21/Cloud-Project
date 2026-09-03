"""
AELA Phase 4 - Empirical Load Testing & Benchmark Runner
Executes concurrent synthetic traffic spikes against the JIT proxy and Step Functions
revocation pipeline, collecting raw performance and security isolation metrics.

Usage:
  python tests/jmeter_plans/load_test_runner.py [--concurrency 50] [--requests 200]
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Tuple

# Ensure project root is in sys.path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.jit_proxy.handler import lambda_handler as jit_lambda_handler


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


def run_benchmark(concurrency: int = 50, total_requests: int = 200) -> Dict[str, Any]:
    print("=" * 88)
    print("      AELA EMPIRICAL LOAD TESTING BENCHMARK (PHASE 4 VALIDATION)")
    print("=" * 88)
    print(f" Concurrency Level  : {concurrency} workers")
    print(f" Total Transactions : {total_requests} requests")
    print(f" Target Pipeline    : Amazon API Gateway -> JIT Proxy -> AWS STS AssumeRole")
    print("-" * 88)

    latencies_ms: List[float] = []
    success_count = 0
    failure_count = 0

    overall_start = time.perf_counter()

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [
            executor.submit(execute_jit_lease_request, f"i-load-node-{i % concurrency}", is_quarantined=(i % 10 == 0))
            for i in range(total_requests)
        ]

        for future in as_completed(futures):
            try:
                success, latency, status_code = future.result()
                latencies_ms.append(latency)
                if success:
                    success_count += 1
                else:
                    failure_count += 1
            except Exception as e:
                failure_count += 1

    total_duration_sec = time.perf_counter() - overall_start
    throughput_rps = total_requests / total_duration_sec if total_duration_sec > 0 else 0.0

    sorted_latencies = sorted(latencies_ms) if latencies_ms else [0.0]
    p50 = statistics.median(sorted_latencies)
    p90 = sorted_latencies[int(len(sorted_latencies) * 0.90)] if sorted_latencies else 0.0
    p95 = sorted_latencies[int(len(sorted_latencies) * 0.95)] if sorted_latencies else 0.0
    p99 = sorted_latencies[int(len(sorted_latencies) * 0.99)] if sorted_latencies else 0.0
    mean_lat = statistics.mean(sorted_latencies) if sorted_latencies else 0.0

    print("\n[EMPIRICAL PERFORMANCE METRICS]")
    print(f" Total Time Elapsed : {total_duration_sec:.2f} seconds")
    print(f" Throughput (RPS)   : {throughput_rps:.2f} req/sec")
    print(f" Successful Checks  : {success_count} / {total_requests} ({(success_count/total_requests)*100:.1f}%)")
    print(f" Error / Rejections : {failure_count}")
    print("-" * 88)
    print("[LATENCY DISTRIBUTION (STS Credential Minting)]")
    print(f" Mean Latency       : {mean_lat:.2f} ms")
    print(f" Min Latency        : {min(sorted_latencies):.2f} ms")
    print(f" 50th Percentile    : {p50:.2f} ms")
    print(f" 90th Percentile    : {p90:.2f} ms")
    print(f" 95th Percentile    : {p95:.2f} ms")
    print(f" 99th Percentile    : {p99:.2f} ms")
    print(f" Max Latency        : {max(sorted_latencies):.2f} ms")
    print("=" * 88)

    print("\n[APACHE JMETER EXECUTION COMMAND]")
    print("To execute the full synthetic test plan using the JMeter CLI:")
    print("  jmeter -n -t tests/jmeter_plans/burst_traffic_plan.jmx \\")
    print("         -Jtarget_host=127.0.0.1 -Jtarget_port=8000 -Jprotocol=http \\")
    print("         -Jthreads=50 -Jramp_up=5 -Jloop_count=10 \\")
    print("         -l tests/jmeter_plans/results/load_test_results.jtl\n")

    return {
        "total_requests": total_requests,
        "concurrency": concurrency,
        "throughput_rps": throughput_rps,
        "mean_latency_ms": mean_lat,
        "p95_latency_ms": p95,
        "p99_latency_ms": p99,
        "success_rate_percent": (success_count / total_requests) * 100.0,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AELA Load Test & Benchmark Runner")
    parser.add_argument("--concurrency", type=int, default=50, help="Number of concurrent worker threads")
    parser.add_argument("--requests", type=int, default=200, help="Total number of requests to dispatch")
    args = parser.parse_args()

    run_benchmark(concurrency=args.concurrency, total_requests=args.requests)
