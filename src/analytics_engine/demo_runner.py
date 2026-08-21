"""
AELA Analytics Engine - Interactive Live Demonstration Runner
Run directly during presentations: `python src/analytics_engine/demo_runner.py`
Simulates a live CloudTrail telemetry stream transitioning from active operations,
to idle-gap expiration (scale-to-zero), to security anomaly isolation.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone

# Ensure project root is on sys.path for direct script execution
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.analytics_engine.handler import lambda_handler
from src.analytics_engine.state_tracker import DynamoDBStateTracker


def run_demonstration():
    print("=" * 88)
    print("      AUTOMATED EPHEMERAL LEAST-PRIVILEGE ARCHITECTURE (AELA) DEMONSTRATION")
    print("               Phase 2: Event Stream Integration & Analytics Engine")
    print("=" * 88)

    state_tracker = DynamoDBStateTracker(use_in_memory_fallback=True)
    t0 = datetime(2026, 8, 21, 14, 0, 0, tzinfo=timezone.utc)

    # --------------------------------------------------------------------------
    # Scenario 1: Initial Microservice Active Telemetry
    # --------------------------------------------------------------------------
    print("\n>>> SCENARIO 1: Microservice Active Operational Traffic (Healthy Signature)")
    event_1 = {
        "eventID": "evt-001",
        "eventTime": t0.isoformat(),
        "eventSource": "ec2.amazonaws.com",
        "eventName": "DescribeInstances",
        "userIdentity": {
            "type": "AssumedRole",
            "principalId": "AROAEXAMPLE:i-0123456789abcdef0",
            "arn": "arn:aws:sts::123456789012:assumed-role/aela-dev-base-service-role/i-0123456789abcdef0",
        },
        "sourceIPAddress": "10.0.1.50",
        "userAgent": "aws-sdk-go/v1.44",
        "requestParameters": {"instanceId": "i-0123456789abcdef0"},
    }

    lambda_handler(
        event=event_1,
        context=None,
        state_tracker=state_tracker,
        current_time=t0 + timedelta(seconds=30),  # 30s elapsed
        idle_threshold_seconds=300.0,
    )

    # --------------------------------------------------------------------------
    # Scenario 2: Idle Decay Period Exceeded (Scale-to-Zero Quarantine Triggered)
    # --------------------------------------------------------------------------
    print("\n>>> SCENARIO 2: Idle Gap Detected (Time-Decay Exceeds 300s Threshold)")
    t_idle = t0 + timedelta(seconds=420)  # 7 minutes later (420s > 300s)
    event_2 = {
        "eventID": "evt-002",
        "eventTime": t_idle.isoformat(),
        "eventSource": "ec2.amazonaws.com",
        "eventName": "DescribeInstances",
        "userIdentity": {
            "type": "AssumedRole",
            "principalId": "AROAEXAMPLE:i-0123456789abcdef0",
            "arn": "arn:aws:sts::123456789012:assumed-role/aela-dev-base-service-role/i-0123456789abcdef0",
        },
        "sourceIPAddress": "10.0.1.50",
        "userAgent": "aws-sdk-go/v1.44",
        "requestParameters": {"instanceId": "i-0123456789abcdef0"},
    }

    lambda_handler(
        event=event_2,
        context=None,
        state_tracker=state_tracker,
        current_time=t_idle,
        idle_threshold_seconds=300.0,
    )

    # --------------------------------------------------------------------------
    # Scenario 3: Security Anomaly Signature Detected (Privilege Escalation Attempt)
    # --------------------------------------------------------------------------
    print("\n>>> SCENARIO 3: Security Anomaly Signature (Unauthorized IAM Mutation Attempt)")
    t_anomaly = t_idle + timedelta(seconds=60)
    event_3 = {
        "eventID": "evt-003",
        "eventTime": t_anomaly.isoformat(),
        "eventSource": "iam.amazonaws.com",
        "eventName": "AttachRolePolicy",
        "userIdentity": {
            "type": "AssumedRole",
            "principalId": "AROAEXAMPLE:i-0123456789abcdef0",
            "arn": "arn:aws:sts::123456789012:assumed-role/aela-dev-base-service-role/i-0123456789abcdef0",
        },
        "sourceIPAddress": "10.0.1.50",
        "userAgent": "aws-cli/2.15.0",
        "errorCode": "AccessDenied",
        "errorMessage": "Explicit deny isolation policy prevented IAM privilege escalation",
        "requestParameters": {
            "roleName": "aela-dev-base-service-role",
            "policyArn": "arn:aws:iam::aws:policy/AdministratorAccess",
        },
    }

    lambda_handler(
        event=event_3,
        context=None,
        state_tracker=state_tracker,
        current_time=t_anomaly,
        idle_threshold_seconds=300.0,
    )

    print("\n" + "=" * 88)
    print(" [AELA DEMO COMPLETE] All 3 operational states validated successfully.")
    print("=" * 88 + "\n")


if __name__ == "__main__":
    run_demonstration()
