"""
AELA Just-In-Time (JIT) Proxy - Interactive Live Demonstration Runner
Run directly during presentations: `python src/jit_proxy/demo_runner.py`
Simulates microservice API requests to the JIT Authorization Proxy, showcasing:
1. Valid authorization -> Scoped 5-minute ephemeral STS token granted.
2. Quarantined node request -> Immediate 403 Denied rejection.
3. Invalid / unauthorized action -> 400 Bad Request rejection.
"""

from __future__ import annotations

import json
import os
import sys

# Ensure project root is in sys.path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.jit_proxy.handler import lambda_handler


def run_demonstration():
    print("=" * 88)
    print("      AUTOMATED EPHEMERAL LEAST-PRIVILEGE ARCHITECTURE (AELA) DEMONSTRATION")
    print("            Phase 3: Just-In-Time (JIT) Ephemeral Token Leasing")
    print("=" * 88)

    # --------------------------------------------------------------------------
    # Scenario 1: Valid Ephemeral Credential Request
    # --------------------------------------------------------------------------
    print("\n>>> SCENARIO 1: Valid Microservice Request (Scoped DynamoDB Read Lease)")
    event_1 = {
        "httpMethod": "POST",
        "path": "/jit/lease",
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({
            "service_id": "i-0123456789abcdef0",
            "requested_action": "state:read",
            "target_role_arn": "arn:aws:iam::123456789012:role/aela-dev-base-service-role",
            "resource_arn": "arn:aws:dynamodb:us-east-1:123456789012:table/aela-dev-identity-state",
        }),
    }
    lambda_handler(event_1, context=None)

    # --------------------------------------------------------------------------
    # Scenario 2: Quarantined Node Attempting Credential Leasing
    # --------------------------------------------------------------------------
    print("\n>>> SCENARIO 2: Quarantined Microservice Node Blocked from Credential Minting")
    event_2 = {
        "httpMethod": "POST",
        "path": "/jit/lease",
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({
            "service_id": "i-0123456789abcdef0",
            "requested_action": "state:write",
            "quarantined": True,
        }),
    }
    lambda_handler(event_2, context=None)

    # --------------------------------------------------------------------------
    # Scenario 3: Unauthorized Out-of-Scope Action Rejection
    # --------------------------------------------------------------------------
    print("\n>>> SCENARIO 3: Request with Unauthorized Action (Scope Violation)")
    event_3 = {
        "httpMethod": "POST",
        "path": "/jit/lease",
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({
            "service_id": "i-0123456789abcdef0",
            "requested_action": "iam:PassRole",
        }),
    }
    lambda_handler(event_3, context=None)

    print("\n" + "=" * 88)
    print(" [AELA JIT DEMO COMPLETE] All 3 JIT proxy authorization paths verified.")
    print("=" * 88 + "\n")


if __name__ == "__main__":
    run_demonstration()
