"""
AELA Analytics Engine - Comprehensive Unit Tests & Mock Suite
Runs 100% offline without requiring AWS credentials or network connectivity.
"""

from __future__ import annotations

import base64
import gzip
import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from src.analytics_engine.anomaly_detector import analyze_event_anomaly
from src.analytics_engine.handler import (
    decode_stream_payload,
    evaluate_telemetry_decay,
    extract_service_id,
    lambda_handler,
    parse_raw_cloudtrail_record,
)
from src.analytics_engine.models import CloudTrailEvent
from src.analytics_engine.state_tracker import DynamoDBStateTracker


# ------------------------------------------------------------------------------
# Fixtures & Mock Payloads
# ------------------------------------------------------------------------------

@pytest.fixture
def base_time() -> datetime:
    return datetime(2026, 8, 21, 12, 0, 0, tzinfo=timezone.utc)


@pytest.fixture
def sample_cloudtrail_raw(base_time: datetime) -> dict:
    return {
        "eventID": "evt-test-101",
        "eventTime": base_time.isoformat(),
        "eventSource": "ec2.amazonaws.com",
        "eventName": "DescribeInstances",
        "userIdentity": {
            "type": "AssumedRole",
            "principalId": "AROAEXAMPLE:i-0123456789abcdef0",
            "arn": "arn:aws:sts::123456789012:assumed-role/aela-dev-base-service-role/i-0123456789abcdef0",
        },
        "sourceIPAddress": "10.0.1.25",
        "userAgent": "aws-cli/2.15.0",
        "requestParameters": {
            "instanceId": "i-0123456789abcdef0",
        },
    }


@pytest.fixture
def mock_cloudwatch_logs_payload(sample_cloudtrail_raw: dict) -> dict:
    log_payload = {
        "messageType": "DATA_MESSAGE",
        "owner": "123456789012",
        "logGroup": "/aws/aela/dev/telemetry",
        "logStream": "i-0123456789abcdef0",
        "logEvents": [
            {
                "id": "eventId1",
                "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000),
                "message": json.dumps(sample_cloudtrail_raw),
            }
        ],
    }
    compressed = gzip.compress(json.dumps(log_payload).encode("utf-8"))
    encoded = base64.b64encode(compressed).decode("utf-8")
    return {"awslogs": {"data": encoded}}


# ------------------------------------------------------------------------------
# 1. CloudTrail Event Parsing Tests
# ------------------------------------------------------------------------------

def test_extract_service_id():
    # Test instance ID extraction
    arn = "arn:aws:sts::123456789012:assumed-role/aela-dev-base-service-role/i-0abcdef1234567890"
    assert extract_service_id(arn, "principal", {}) == "i-0abcdef1234567890"

    # Test role name fallback
    role_arn = "arn:aws:iam::123456789012:role/aela-service-worker"
    assert extract_service_id(role_arn, "principal", {}) == "aela-service-worker"

    # Test request parameter priority
    assert extract_service_id("", "", {"instanceId": "i-explicit-id"}) == "i-explicit-id"


def test_parse_raw_cloudtrail_record(sample_cloudtrail_raw: dict, base_time: datetime):
    event = parse_raw_cloudtrail_record(sample_cloudtrail_raw)

    assert event.event_id == "evt-test-101"
    assert event.event_name == "DescribeInstances"
    assert event.event_source == "ec2.amazonaws.com"
    assert event.service_id == "i-0123456789abcdef0"
    assert event.source_ip == "10.0.1.25"
    assert event.event_time == base_time


def test_decode_cloudwatch_logs_stream(mock_cloudwatch_logs_payload: dict):
    records = decode_stream_payload(mock_cloudwatch_logs_payload)
    assert len(records) == 1
    assert records[0]["eventName"] == "DescribeInstances"
    assert records[0]["eventID"] == "evt-test-101"


def test_decode_kinesis_stream_payload(sample_cloudtrail_raw: dict):
    raw_str = json.dumps(sample_cloudtrail_raw)
    b64_data = base64.b64encode(raw_str.encode("utf-8")).decode("utf-8")
    kinesis_event = {
        "Records": [
            {"kinesis": {"data": b64_data}}
        ]
    }
    records = decode_stream_payload(kinesis_event)
    assert len(records) == 1
    assert records[0]["eventName"] == "DescribeInstances"


# ------------------------------------------------------------------------------
# 2. Time-Decay & Idle Gap Calculations
# ------------------------------------------------------------------------------

def test_time_decay_active_status(sample_cloudtrail_raw: dict, base_time: datetime):
    event = parse_raw_cloudtrail_record(sample_cloudtrail_raw)
    current_time = base_time + timedelta(seconds=120)  # 2 minutes later (within 5-min threshold)

    eval_result = evaluate_telemetry_decay(
        event=event,
        stored_state={"last_activity_timestamp": base_time.isoformat()},
        current_time=current_time,
        threshold_seconds=300.0,
    )

    assert eval_result.status == "ACTIVE"
    assert eval_result.should_quarantine is False
    assert eval_result.idle_duration_seconds == 120.0


def test_time_decay_idle_expired_quarantine(sample_cloudtrail_raw: dict, base_time: datetime):
    event = parse_raw_cloudtrail_record(sample_cloudtrail_raw)
    current_time = base_time + timedelta(seconds=350)  # 5 min 50 sec later (exceeds 300s threshold)

    eval_result = evaluate_telemetry_decay(
        event=event,
        stored_state={"last_activity_timestamp": base_time.isoformat()},
        current_time=current_time,
        threshold_seconds=300.0,
    )

    assert eval_result.status == "IDLE_EXPIRED"
    assert eval_result.should_quarantine is True
    assert eval_result.idle_duration_seconds == 350.0
    assert "exceeded time-decay threshold" in eval_result.reason


# ------------------------------------------------------------------------------
# 3. Anomaly Detection Tests
# ------------------------------------------------------------------------------

def test_anomaly_detection_unauthorized_error(base_time: datetime):
    event = CloudTrailEvent(
        event_id="evt-err-1",
        event_time=base_time,
        event_source="s3.amazonaws.com",
        event_name="GetObject",
        principal_id="user1",
        arn="arn:aws:iam::123:role/service",
        service_id="service-1",
        error_code="AccessDenied",
        error_message="User is not authorized to perform: s3:GetObject",
    )
    result = analyze_event_anomaly(event)
    assert result.is_anomaly is True
    assert result.risk_level == "HIGH"
    assert result.anomaly_type == "UNAUTHORIZED_ACCESS_ATTEMPT"


def test_anomaly_detection_sensitive_iam_mutation(base_time: datetime):
    event = CloudTrailEvent(
        event_id="evt-iam-1",
        event_time=base_time,
        event_source="iam.amazonaws.com",
        event_name="AttachRolePolicy",
        principal_id="attacker",
        arn="arn:aws:iam::123:role/node-role",
        service_id="node-role",
    )
    result = analyze_event_anomaly(event)
    assert result.is_anomaly is True
    assert result.risk_level == "CRITICAL"
    assert result.anomaly_type == "PRIVILEGE_ESCALATION_ATTEMPT"


def test_anomaly_detection_network_tampering(base_time: datetime):
    event = CloudTrailEvent(
        event_id="evt-ec2-1",
        event_time=base_time,
        event_source="ec2.amazonaws.com",
        event_name="AuthorizeSecurityGroupIngress",
        principal_id="node1",
        arn="arn:aws:iam::123:role/node-role",
        service_id="node-role",
    )
    result = analyze_event_anomaly(event)
    assert result.is_anomaly is True
    assert result.risk_level == "HIGH"
    assert result.anomaly_type == "NETWORK_ISOLATION_TAMPERING"


# ------------------------------------------------------------------------------
# 4. DynamoDB State Tracking Layer Tests
# ------------------------------------------------------------------------------

def test_in_memory_state_tracker_lifecycle(sample_cloudtrail_raw: dict, base_time: datetime):
    tracker = DynamoDBStateTracker(use_in_memory_fallback=True)
    event = parse_raw_cloudtrail_record(sample_cloudtrail_raw)

    # Initial state is None
    assert tracker.get_identity_state("i-0123456789abcdef0") is None

    # Record active state
    evaluation = evaluate_telemetry_decay(event, None, base_time, 300.0)
    saved = tracker.record_activity("i-0123456789abcdef0", event, evaluation)

    assert saved["status"] == "ACTIVE"
    assert saved["service_id"] == "i-0123456789abcdef0"
    assert saved["quarantine_count"] == 0

    # Retrieve saved state
    retrieved = tracker.get_identity_state("i-0123456789abcdef0")
    assert retrieved is not None
    assert retrieved["last_event_name"] == "DescribeInstances"

    # Transition to Quarantine
    quarantine_state = tracker.record_quarantine(
        service_id="i-0123456789abcdef0",
        reason="IDLE_EXPIRED",
        principal_arn=event.arn,
    )
    assert quarantine_state["status"] == "QUARANTINED"
    assert quarantine_state["quarantine_count"] == 1


def test_mocked_dynamodb_resource(sample_cloudtrail_raw: dict, base_time: datetime):
    mock_resource = MagicMock()
    mock_table = MagicMock()
    mock_resource.Table.return_value = mock_table

    mock_table.get_item.return_value = {
        "Item": {
            "service_id": "i-test-node",
            "status": "ACTIVE",
            "last_activity_timestamp": base_time.isoformat(),
            "idle_duration_seconds": Decimal("45.5"),
            "quarantine_count": Decimal("0"),
        }
    }

    tracker = DynamoDBStateTracker(
        table_name="aela-test-table",
        dynamodb_resource=mock_resource,
    )

    state = tracker.get_identity_state("i-test-node")
    assert state is not None
    assert state["status"] == "ACTIVE"
    assert state["idle_duration_seconds"] == 45.5
    assert state["quarantine_count"] == 0
    mock_table.get_item.assert_called_once_with(Key={"service_id": "i-test-node"})


# ------------------------------------------------------------------------------
# 5. End-to-End Lambda Handler Processing Tests
# ------------------------------------------------------------------------------

def test_lambda_handler_active_batch(mock_cloudwatch_logs_payload: dict, base_time: datetime):
    tracker = DynamoDBStateTracker(use_in_memory_fallback=True)

    response = lambda_handler(
        event=mock_cloudwatch_logs_payload,
        context=None,
        state_tracker=tracker,
        current_time=base_time + timedelta(seconds=60),
        idle_threshold_seconds=300.0,
    )

    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["records_processed"] == 1
    assert body["quarantine_triggers_count"] == 0


def test_lambda_handler_quarantine_batch(mock_cloudwatch_logs_payload: dict, base_time: datetime):
    tracker = DynamoDBStateTracker(use_in_memory_fallback=True)

    # First record activity at base_time
    event = parse_raw_cloudtrail_record(decode_stream_payload(mock_cloudwatch_logs_payload)[0])
    eval_initial = evaluate_telemetry_decay(event, None, base_time, 300.0)
    tracker.record_activity(event.service_id, event, eval_initial)

    # Now evaluate 10 minutes later (600s > 300s threshold)
    current_time = base_time + timedelta(seconds=600)
    response = lambda_handler(
        event=mock_cloudwatch_logs_payload,
        context=None,
        state_tracker=tracker,
        current_time=current_time,
        idle_threshold_seconds=300.0,
    )

    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["records_processed"] == 1
    assert body["quarantine_triggers_count"] == 1
    assert body["quarantine_triggers"][0]["status"] == "IDLE_EXPIRED"
