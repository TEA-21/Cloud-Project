"""
Unit Tests for AELA Phase 1 - Telemetry Preprocessing & LSTM Sequence Engineering
Validates feature normalization, categorical encoding, sliding-window tensor shapes,
and PyTorch DataLoader batching.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
import numpy as np
import pytest
import torch

from src.analytics_engine.data_preprocessor import (
    ACTION_CATEGORIES,
    NUM_FEATURES,
    TelemetryScaler,
    TelemetrySequenceDataset,
    classify_action_category,
    create_sliding_window_sequences,
    evaluate_resource_sensitivity,
    extract_record_features,
    generate_synthetic_telemetry,
    is_ip_external,
    is_user_agent_suspicious,
    prepare_data_loaders,
)


# ------------------------------------------------------------------------------
# Feature Categorization & Enrichment Tests
# ------------------------------------------------------------------------------

def test_action_categorization_logic() -> None:
    assert classify_action_category("storage:read") == "storage:read"
    assert classify_action_category("state:write") == "state:write"
    assert classify_action_category("compute:describe") == "compute:describe"
    assert classify_action_category("AttachRolePolicy", "iam.amazonaws.com") == "iam:mutation"
    assert classify_action_category("PutRolePolicy") == "iam:mutation"
    assert classify_action_category("AuthorizeSecurityGroupIngress", "ec2.amazonaws.com") == "network:mutation"
    assert classify_action_category("UnrecognizedNonStandardCall") == "other_unknown"


def test_resource_sensitivity_scoring() -> None:
    assert evaluate_resource_sensitivity("arn:aws:iam::123456789012:role/Admin") == 1.0
    assert evaluate_resource_sensitivity("*") == 1.0
    assert evaluate_resource_sensitivity("arn:aws:ec2:us-east-1:123456789012:security-group/sg-123") == 0.8
    assert evaluate_resource_sensitivity("arn:aws:dynamodb:us-east-1:123456789012:table/aela-state") == 0.6
    assert evaluate_resource_sensitivity("arn:aws:s3:::my-bucket/path") == 0.5
    assert evaluate_resource_sensitivity("arn:aws:logs:us-east-1:123456789012:log-group:test") == 0.2
    assert evaluate_resource_sensitivity("arn:aws:sqs:us-east-1:123456789012:queue") == 0.1


def test_security_binary_signals() -> None:
    # IP subnet checks
    assert is_ip_external("10.0.1.25") == 0.0
    assert is_ip_external("172.16.5.10") == 0.0
    assert is_ip_external("192.168.1.100") == 0.0
    assert is_ip_external("127.0.0.1") == 0.0
    assert is_ip_external("198.51.100.45") == 1.0
    assert is_ip_external("not-an-ip") == 1.0

    # User Agent checks
    assert is_user_agent_suspicious("aws-sdk-go/v1.44") == 0.0
    assert is_user_agent_suspicious("Boto3/1.26.0 Python/3.11") == 0.0
    assert is_user_agent_suspicious("curl/7.68.0") == 1.0
    assert is_user_agent_suspicious("sqlmap/1.5.2#stable") == 1.0


# ------------------------------------------------------------------------------
# Scaler & Feature Extraction Tests
# ------------------------------------------------------------------------------

def test_telemetry_scaler_fit_transform_and_serialization() -> None:
    sample_records = [
        {"request_interval_sec": 10.0, "rolling_frequency_60s": 1.0, "lease_duration_sec": 300.0, "resource_sensitivity_score": 0.2},
        {"request_interval_sec": 100.0, "rolling_frequency_60s": 10.0, "lease_duration_sec": 1200.0, "resource_sensitivity_score": 1.0},
    ]

    scaler = TelemetryScaler().fit(sample_records)
    assert scaler.is_fitted
    assert scaler.min_vals["request_interval_sec"] == 10.0
    assert scaler.max_vals["request_interval_sec"] == 100.0

    # Test transformation bounds
    val_norm = scaler.transform_feature("request_interval_sec", 55.0)
    assert 0.49 < val_norm < 0.51

    # Test clamping
    assert scaler.transform_feature("request_interval_sec", 0.0) == 0.0
    assert scaler.transform_feature("request_interval_sec", 500.0) == 1.0

    # Test JSON serialization
    json_data = scaler.to_json()
    loaded_scaler = TelemetryScaler.from_json(json_data)
    assert loaded_scaler.is_fitted
    assert loaded_scaler.min_vals == scaler.min_vals
    assert loaded_scaler.max_vals == scaler.max_vals


def test_extract_record_features_shape_and_values() -> None:
    record = {
        "request_interval_sec": 30.0,
        "rolling_frequency_60s": 2.0,
        "lease_duration_sec": 300.0,
        "resource_sensitivity_score": 0.5,
        "requested_action": "storage:read",
        "source_ip": "10.0.1.25",
        "user_agent": "aws-sdk-go/v1.44",
        "error_code": None,
    }

    scaler = TelemetryScaler().fit([record])
    vec = extract_record_features(record, scaler=scaler)

    assert isinstance(vec, np.ndarray)
    assert vec.shape == (NUM_FEATURES,)  # Must equal 16
    assert vec.dtype == np.float32

    # Check action one-hot: storage:read must be 1.0, others 0.0
    action_idx = ACTION_CATEGORIES.index("storage:read")
    # 4 continuous features preceding action one-hot
    assert vec[4 + action_idx] == 1.0
    assert sum(vec[4 : 4 + len(ACTION_CATEGORIES)]) == 1.0


# ------------------------------------------------------------------------------
# 3D Tensor Sliding Window Tests
# ------------------------------------------------------------------------------

def test_sliding_window_sequence_generation_shapes() -> None:
    records = generate_synthetic_telemetry(num_entities=3, events_per_entity=20, anomaly_ratio=0.1, seed=42)
    assert len(records) == 60

    seq_len = 10
    step = 1
    X, y = create_sliding_window_sequences(records, sequence_length=seq_len, step=step)

    # For 3 entities each with 20 events, sliding window gives (20 - 10 + 1) = 11 samples per entity
    expected_samples = 3 * 11
    assert X.shape == (expected_samples, seq_len, NUM_FEATURES)
    assert y.shape == (expected_samples, 1)
    assert isinstance(X, torch.Tensor)
    assert isinstance(y, torch.Tensor)
    assert X.dtype == torch.float32
    assert y.dtype == torch.float32


def test_sliding_window_entity_isolation() -> None:
    """Verifies sequences never interleave events across distinct microservice identities."""
    records_entity_a = [
        {
            "service_id": "srv-A",
            "timestamp": f"2026-09-01T00:{i:02d}:00Z",
            "requested_action": "state:read",
            "source_ip": "10.0.1.1",
            "user_agent": "boto3",
            "error_code": None,
            "anomaly_label": 0,
        }
        for i in range(15)
    ]
    records_entity_b = [
        {
            "service_id": "srv-B",
            "timestamp": f"2026-09-01T00:{i:02d}:00Z",
            "requested_action": "compute:describe",
            "source_ip": "10.0.1.2",
            "user_agent": "boto3",
            "error_code": None,
            "anomaly_label": 1,
        }
        for i in range(12)
    ]

    combined_records = records_entity_a + records_entity_b
    X, y = create_sliding_window_sequences(combined_records, sequence_length=10, step=1)

    # Entity A has 15 - 10 + 1 = 6 samples
    # Entity B has 12 - 10 + 1 = 3 samples
    assert X.shape[0] == 9
    assert X.shape[1] == 10
    assert X.shape[2] == NUM_FEATURES

    # First 6 samples must be from Entity A (label 0)
    assert (y[:6] == 0.0).all()
    # Next 3 samples must be from Entity B (label 1)
    assert (y[6:] == 1.0).all()


def test_sliding_window_short_history_handling() -> None:
    """Entities with fewer than sequence_length records should be skipped safely without throwing errors."""
    short_records = [
        {
            "service_id": "srv-short",
            "timestamp": "2026-09-01T00:01:00Z",
            "requested_action": "state:read",
            "source_ip": "10.0.1.5",
            "user_agent": "boto3",
        }
    ]
    X, y = create_sliding_window_sequences(short_records, sequence_length=10)
    assert X.shape == (0, 10, NUM_FEATURES)
    assert y.shape == (0, 1)


# ------------------------------------------------------------------------------
# PyTorch Dataset & DataLoader Tests
# ------------------------------------------------------------------------------

def test_pytorch_dataset_and_dataloaders() -> None:
    X_dummy = torch.randn(100, 10, NUM_FEATURES, dtype=torch.float32)
    y_dummy = torch.randint(0, 2, (100, 1), dtype=torch.float32)

    dataset = TelemetrySequenceDataset(X_dummy, y_dummy)
    assert len(dataset) == 100

    item_x, item_y = dataset[0]
    assert item_x.shape == (10, NUM_FEATURES)
    assert item_y.shape == (1,)

    train_loader, val_loader, test_loader = prepare_data_loaders(
        X_dummy,
        y_dummy,
        batch_size=16,
        train_split=0.8,
        val_split=0.1,
        test_split=0.1,
        seed=42,
    )

    # 80 train, 10 val, 10 test
    assert len(train_loader.dataset) == 80
    assert len(val_loader.dataset) == 10
    assert len(test_loader.dataset) == 10

    # Test batch iteration
    batch_x, batch_y = next(iter(train_loader))
    assert batch_x.shape == (16, 10, NUM_FEATURES)
    assert batch_y.shape == (16, 1)
    assert batch_x.dtype == torch.float32


# ------------------------------------------------------------------------------
# Curated Disk Dataset Integrity Tests
# ------------------------------------------------------------------------------

def test_persisted_dataset_artifacts() -> None:
    base_dir = os.path.dirname(os.path.dirname(__file__))
    telemetry_file = os.path.join(base_dir, "src", "analytics_engine", "data", "curated_telemetry.json")
    scaler_file = os.path.join(base_dir, "src", "analytics_engine", "data", "scaler_params.json")

    assert os.path.exists(telemetry_file), f"Missing {telemetry_file}"
    assert os.path.exists(scaler_file), f"Missing {scaler_file}"

    with open(telemetry_file, "r", encoding="utf-8") as f:
        records = json.load(f)
    assert isinstance(records, list)
    assert len(records) >= 1000

    with open(scaler_file, "r", encoding="utf-8") as f:
        scaler_data = json.load(f)
    assert scaler_data["is_fitted"] is True
    assert "request_interval_sec" in scaler_data["min_vals"]
