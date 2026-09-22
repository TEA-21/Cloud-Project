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

import numpy as np
import pytest
import torch

from src.analytics_engine.anomaly_detector import (
    HybridAnomalyDetector,
    analyze_event_anomaly,
    analyze_rule_based_anomaly,
    calculate_dynamic_threshold,
    get_detector,
    reset_detector_state,
)
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


# ------------------------------------------------------------------------------
# 6. Phase 3: LSTM Inference Pipeline, Dynamic Thresholds & Hybrid Fallback
# ------------------------------------------------------------------------------

def test_lstm_inference_pipeline_real_time_jit_request():
    """Verifies that a benign real-time JIT lease request passes through LSTM inference."""
    reset_detector_state()
    jit_request = {
        "service_id": "srv-prod-worker-01",
        "requested_action": "state:read",
        "target_role_arn": "arn:aws:iam::123456789012:role/aela-dev-base-service-role",
        "resource_arn": "arn:aws:dynamodb:us-east-1:123456789012:table/aela-state",
        "source_ip": "10.0.1.25",
        "user_agent": "AELA-Client/1.0",
        "lease_duration_sec": 300.0,
        "request_interval_sec": 15.0,
        "rolling_frequency_60s": 2.0,
    }

    result = analyze_event_anomaly(jit_request)

    assert result.is_anomaly is False
    assert result.risk_level == "NONE"
    assert result.detection_source == "LSTM_INFERENCE"
    assert 0.0 <= result.anomaly_score < 0.50
    assert result.threshold_applied >= 0.15


def test_lstm_inference_pipeline_anomalous_burst():
    """Verifies that an anomalous high-risk burst JIT request triggers anomaly detection."""
    reset_detector_state()
    anomalous_request = {
        "service_id": "srv-unknown-attacker",
        "requested_action": "AttachRolePolicy",
        "target_role_arn": "arn:aws:iam::123456789012:role/Admin",
        "resource_arn": "arn:aws:iam::123456789012:policy/AdministratorAccess",
        "source_ip": "198.51.100.77",
        "user_agent": "sqlmap/1.6",
        "lease_duration_sec": 3600.0,
        "request_interval_sec": 0.05,
        "rolling_frequency_60s": 50.0,
        "error_code": "AccessDenied",
    }

    result = analyze_event_anomaly(anomalous_request)

    assert result.is_anomaly is True
    assert result.risk_level in ("HIGH", "CRITICAL")
    assert result.detection_source in ("HYBRID_ENSEMBLE", "LSTM_INFERENCE")
    assert result.anomaly_score > 0.50


def test_dynamic_threshold_adjustments():
    """Verifies context-aware dynamic threshold lowering for elevated risk factors."""
    # 1. Baseline normal event
    base_record = {
        "resource_arn": "arn:aws:s3:::standard-bucket/object",
        "source_ip": "10.0.1.5",
        "rolling_frequency_60s": 1.0,
    }
    th_base = calculate_dynamic_threshold(base_record, base_threshold=0.50)
    assert th_base == 0.50

    # 2. Sensitive resource drops threshold by 0.15
    sensitive_record = dict(base_record)
    sensitive_record["resource_arn"] = "arn:aws:iam::123456789012:role/Admin"
    th_sens = calculate_dynamic_threshold(sensitive_record, base_threshold=0.50)
    assert th_sens < th_base
    assert th_sens == 0.35

    # 3. External IP drops threshold by additional 0.10
    external_record = dict(sensitive_record)
    external_record["source_ip"] = "203.0.113.10"
    th_ext = calculate_dynamic_threshold(external_record, base_threshold=0.50)
    assert th_ext == 0.25

    # 4. Burst traffic drops threshold further
    burst_record = dict(external_record)
    burst_record["rolling_frequency_60s"] = 35.0
    th_burst = calculate_dynamic_threshold(burst_record, base_threshold=0.50)
    assert th_burst == 0.15  # Clamped to min bound 0.15


def test_hybrid_secondary_validation_layer_override_on_uncertain_score():
    """
    Verifies that if the LSTM model produces a sub-threshold / uncertain score (e.g. 0.18),
    the secondary rule-based defense layer overrides the decision and quarantines critical attacks.
    """
    detector = get_detector()
    mock_model = MagicMock()
    # Force the model to return a sub-threshold benign score
    mock_model.predict_proba.return_value = torch.tensor([[0.18]])
    orig_model = detector.model
    detector.model = mock_model

    try:
        critical_event = CloudTrailEvent(
            event_id="evt-override-test",
            event_time=datetime.now(timezone.utc),
            event_source="iam.amazonaws.com",
            event_name="AttachRolePolicy",
            principal_id="attacker-principal",
            arn="arn:aws:iam::123456789012:role/target",
            service_id="target-service",
        )

        result = detector.evaluate(critical_event)

        # Even though LSTM gave 0.18, secondary validation catches the IAM mutation
        assert result.is_anomaly is True
        assert result.risk_level == "CRITICAL"
        assert result.anomaly_type == "PRIVILEGE_ESCALATION_ATTEMPT"
        assert result.detection_source == "HYBRID_OVERRIDE"
        assert result.anomaly_score == 0.18
        assert "Rule-based safety net flagged" in result.details
    finally:
        detector.model = orig_model


def test_rule_based_fallback_on_model_runtime_error():
    """
    Verifies fault-tolerance: If PyTorch raises a RuntimeError (OOM, device failure),
    the engine seamlessly falls back to pure rule-based evaluation without crashing.
    """
    detector = get_detector()
    mock_model = MagicMock()
    mock_model.predict_proba.side_effect = RuntimeError("Simulated GPU/CPU Out of Memory Exception")
    orig_model = detector.model
    detector.model = mock_model

    try:
        # 1. Malicious event with network tampering
        tamper_event = CloudTrailEvent(
            event_id="evt-fb-tamper",
            event_time=datetime.now(timezone.utc),
            event_source="ec2.amazonaws.com",
            event_name="AuthorizeSecurityGroupIngress",
            principal_id="compromised-worker",
            arn="arn:aws:iam::123:role/worker",
            service_id="worker-node",
        )

        result = detector.evaluate(tamper_event)

        assert result.is_anomaly is True
        assert result.risk_level == "HIGH"
        assert result.anomaly_type == "NETWORK_ISOLATION_TAMPERING"
        assert result.detection_source == "RULE_BASED_FALLBACK"
        assert "FALLBACK ON ERROR: RuntimeError" in result.details

        # 2. Benign event under error fallback
        benign_event = CloudTrailEvent(
            event_id="evt-fb-benign",
            event_time=datetime.now(timezone.utc),
            event_source="ec2.amazonaws.com",
            event_name="DescribeInstances",
            principal_id="worker-1",
            arn="arn:aws:iam::123:role/worker",
            service_id="worker-node",
        )

        result_benign = detector.evaluate(benign_event)
        assert result_benign.is_anomaly is False
        assert result_benign.detection_source == "RULE_BASED_FALLBACK"
    finally:
        detector.model = orig_model


def test_rule_based_fallback_on_unloaded_model():
    """Verifies that an uninitialized detector operates strictly in fallback mode."""
    detector = HybridAnomalyDetector(model_path="non_existent_model_file.pth", auto_load=True)
    assert detector.is_model_loaded is False

    event = CloudTrailEvent(
        event_id="evt-unloaded",
        event_time=datetime.now(timezone.utc),
        event_source="s3.amazonaws.com",
        event_name="GetObject",
        principal_id="user1",
        arn="arn:aws:iam::123:role/worker",
        service_id="worker-node",
        error_code="AccessDenied",
    )

    result = detector.evaluate(event)
    assert result.is_anomaly is True
    assert result.risk_level == "HIGH"
    assert result.detection_source == "RULE_BASED_FALLBACK"
    assert "[FALLBACK MODE]" in result.details


def test_rule_based_fallback_on_corrupted_nan_model_output():
    """Verifies that if the model returns NaN or Inf, the fallback activates."""
    detector = get_detector()
    mock_model = MagicMock()
    mock_model.predict_proba.return_value = torch.tensor([[float("nan")]])
    orig_model = detector.model
    detector.model = mock_model

    try:
        event = CloudTrailEvent(
            event_id="evt-nan",
            event_time=datetime.now(timezone.utc),
            event_source="iam.amazonaws.com",
            event_name="PutRolePolicy",
            principal_id="attacker",
            arn="arn:aws:iam::123:role/admin",
            service_id="admin-service",
        )

        result = detector.evaluate(event)
        assert result.is_anomaly is True
        assert result.risk_level == "CRITICAL"
        assert result.detection_source == "RULE_BASED_FALLBACK"
        assert "FALLBACK ON ERROR: ValueError" in result.details
    finally:
        detector.model = orig_model


def test_rolling_sequence_buffer_and_padding():
    """Verifies rolling sequence buffering, left-padding on warm-up, and max sequence length."""
    detector = get_detector()
    detector.reset_buffer()

    service_id = "test-rolling-svc"
    dummy_vec = np.zeros(16, dtype=np.float32)

    # 1. Warm-up with single event (padding replicates to length 10)
    tensor1 = detector._prepare_sequence_tensor(service_id, dummy_vec)
    assert tensor1.shape == (1, 10, 16)
    assert len(detector._sequence_buffers[service_id]) == 1

    # 2. Add 11 more events (buffer should cap at 10)
    for i in range(11):
        vec = np.ones(16, dtype=np.float32) * (i + 1)
        tensor_n = detector._prepare_sequence_tensor(service_id, vec)
        assert tensor_n.shape == (1, 10, 16)

    assert len(detector._sequence_buffers[service_id]) == 10
    # Most recent vector should match the 11th added vector
    assert detector._sequence_buffers[service_id][-1][0] == 11.0

