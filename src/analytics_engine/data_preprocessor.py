"""
AELA Analytics Engine - Telemetry Preprocessing & Sequence Engineering
Phase 1: Transforms raw JIT lease & CloudTrail telemetry into normalized 3D sliding-window
tensors for LSTM anomaly detection and time-series modeling.
"""

from __future__ import annotations

import json
import ipaddress
import random
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import torch
from torch.utils.data import DataLoader, Dataset


# ------------------------------------------------------------------------------
# Action Taxonomy & Constants
# ------------------------------------------------------------------------------

# Granular classification of actions into categorical vector channels
ACTION_CATEGORIES: List[str] = [
    "compute:describe",
    "telemetry:write",
    "storage:read",
    "storage:write",
    "state:read",
    "state:write",
    "iam:mutation",
    "network:mutation",
    "other_unknown",
]

SENSITIVE_IAM_ACTIONS = {
    "AttachRolePolicy",
    "AttachUserPolicy",
    "PutRolePolicy",
    "PutUserPolicy",
    "CreateAccessKey",
    "UpdateAssumeRolePolicy",
    "CreateLoginProfile",
    "DeleteRolePermissionsBoundary",
}

SENSITIVE_NETWORK_ACTIONS = {
    "AuthorizeSecurityGroupIngress",
    "AuthorizeSecurityGroupEgress",
    "CreateRoute",
    "DeleteFlowLogs",
    "ModifyVpcEndpoint",
}

SUSPICIOUS_CLIENT_PATTERNS = ["sqlmap", "nikto", "hydra", "metasploit", "curl/"]

PRIVATE_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
]

CONTINUOUS_FEATURE_NAMES = [
    "request_interval_sec",
    "rolling_frequency_60s",
    "lease_duration_sec",
    "resource_sensitivity_score",
]

CATEGORICAL_FEATURE_NAMES = [f"action_{act}" for act in ACTION_CATEGORIES] + [
    "is_external_ip",
    "is_suspicious_agent",
    "has_error",
]

ALL_FEATURE_NAMES = CONTINUOUS_FEATURE_NAMES + CATEGORICAL_FEATURE_NAMES
NUM_FEATURES = len(ALL_FEATURE_NAMES)  # 4 + 9 + 3 = 16


# ------------------------------------------------------------------------------
# Feature Categorization Helpers
# ------------------------------------------------------------------------------

def classify_action_category(action_name: str, event_source: str = "") -> str:
    """Classifies an action or event name into one of the standardized ACTION_CATEGORIES."""
    act_lower = action_name.lower()
    source_lower = event_source.lower()

    if "iam" in source_lower or action_name in SENSITIVE_IAM_ACTIONS or "policy" in act_lower:
        return "iam:mutation"
    if "ec2" in source_lower and (action_name in SENSITIVE_NETWORK_ACTIONS or "securitygroup" in act_lower):
        return "network:mutation"
    if action_name in ACTION_CATEGORIES:
        return action_name

    # Mapping common actions / CloudTrail API calls
    if act_lower.startswith("compute:") or "describeinstances" in act_lower:
        return "compute:describe"
    if act_lower.startswith("telemetry:") or "putlogevents" in act_lower:
        return "telemetry:write"
    if act_lower.startswith("storage:read") or "getobject" in act_lower or "listbucket" in act_lower:
        return "storage:read"
    if act_lower.startswith("storage:write") or "putobject" in act_lower:
        return "storage:write"
    if act_lower.startswith("state:read") or "getitem" in act_lower or "query" in act_lower:
        return "state:read"
    if act_lower.startswith("state:write") or "putitem" in act_lower or "updateitem" in act_lower:
        return "state:write"

    return "other_unknown"


def evaluate_resource_sensitivity(resource_arn: str) -> float:
    """Assigns a normalized sensitivity weight (0.0 to 1.0) based on target resource ARN."""
    res_lower = resource_arn.lower()
    if res_lower == "*" or "iam::" in res_lower or "role/" in res_lower:
        return 1.0
    if "security-group" in res_lower or "vpc" in res_lower or "route-table" in res_lower:
        return 0.8
    if "dynamodb:" in res_lower or "state" in res_lower or "payment" in res_lower:
        return 0.6
    if "s3:::" in res_lower:
        return 0.5
    if "logs:" in res_lower or "telemetry" in res_lower:
        return 0.2
    return 0.1


def is_ip_external(ip_str: str) -> float:
    """Returns 1.0 if IP is outside private/loopback subnets, otherwise 0.0."""
    try:
        ip = ipaddress.ip_address(ip_str)
        for net in PRIVATE_NETWORKS:
            if ip in net:
                return 0.0
        return 1.0
    except ValueError:
        return 1.0


def is_user_agent_suspicious(agent_str: str) -> float:
    """Returns 1.0 if user agent contains known offensive/scripting signatures."""
    agent_lower = agent_str.lower()
    return 1.0 if any(pat in agent_lower for pat in SUSPICIOUS_CLIENT_PATTERNS) else 0.0


# ------------------------------------------------------------------------------
# Feature Scaler
# ------------------------------------------------------------------------------

class TelemetryScaler:
    """
    Min-Max Feature Scaler for continuous telemetry variables.
    Supports serialization to JSON/dict for zero-skew model deployment and inference.
    """

    def __init__(self) -> None:
        self.feature_names = CONTINUOUS_FEATURE_NAMES
        self.min_vals: Dict[str, float] = {
            "request_interval_sec": 0.0,
            "rolling_frequency_60s": 0.0,
            "lease_duration_sec": 0.0,
            "resource_sensitivity_score": 0.0,
        }
        self.max_vals: Dict[str, float] = {
            "request_interval_sec": 600.0,
            "rolling_frequency_60s": 30.0,
            "lease_duration_sec": 3600.0,
            "resource_sensitivity_score": 1.0,
        }
        self.is_fitted = False

    def fit(self, records: List[Dict[str, Any]]) -> "TelemetryScaler":
        """Calculates min and max values across continuous features in a dataset."""
        if not records:
            self.is_fitted = True
            return self

        for name in self.feature_names:
            vals = [float(r.get(name, 0.0)) for r in records]
            min_v = float(min(vals))
            max_v = float(max(vals))
            # Protect against division by zero
            if max_v <= min_v:
                max_v = min_v + 1.0
            self.min_vals[name] = min_v
            self.max_vals[name] = max_v

        self.is_fitted = True
        return self

    def transform_feature(self, feature_name: str, value: float) -> float:
        """Scales a single feature value to [0.0, 1.0] range."""
        min_v = self.min_vals.get(feature_name, 0.0)
        max_v = self.max_vals.get(feature_name, 1.0)
        clamped = max(min_v, min(float(value), max_v))
        return (clamped - min_v) / (max_v - min_v)

    def to_dict(self) -> Dict[str, Any]:
        """Serializes scaler parameters to a dictionary."""
        return {
            "feature_names": self.feature_names,
            "min_vals": self.min_vals,
            "max_vals": self.max_vals,
            "is_fitted": self.is_fitted,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TelemetryScaler":
        """Instantiates a scaler from serialized parameters."""
        scaler = cls()
        scaler.feature_names = data.get("feature_names", CONTINUOUS_FEATURE_NAMES)
        scaler.min_vals = data.get("min_vals", scaler.min_vals)
        scaler.max_vals = data.get("max_vals", scaler.max_vals)
        scaler.is_fitted = data.get("is_fitted", True)
        return scaler

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2)

    @classmethod
    def from_json(cls, json_str: str) -> "TelemetryScaler":
        return cls.from_dict(json.loads(json_str))


# ------------------------------------------------------------------------------
# Raw Event Feature Extraction
# ------------------------------------------------------------------------------

def extract_record_features(
    record: Dict[str, Any],
    scaler: Optional[TelemetryScaler] = None,
) -> np.ndarray:
    """
    Transforms a single structured telemetry dictionary into a 1D numeric feature vector of length 16.
    
    Returns:
        np.ndarray of shape (NUM_FEATURES,) and dtype float32.
    """
    if scaler is None:
        scaler = TelemetryScaler()

    # 1. Continuous Features
    interval = float(record.get("request_interval_sec", 0.0))
    frequency = float(record.get("rolling_frequency_60s", 1.0))
    duration = float(record.get("lease_duration_sec", 300.0))
    sensitivity = float(record.get("resource_sensitivity_score", evaluate_resource_sensitivity(record.get("resource_arn", "*"))))

    norm_interval = scaler.transform_feature("request_interval_sec", interval)
    norm_frequency = scaler.transform_feature("rolling_frequency_60s", frequency)
    norm_duration = scaler.transform_feature("lease_duration_sec", duration)
    norm_sensitivity = scaler.transform_feature("resource_sensitivity_score", sensitivity)

    cont_vec = [norm_interval, norm_frequency, norm_duration, norm_sensitivity]

    # 2. Categorical Action One-Hot Encoding (9 classes)
    action_raw = record.get("requested_action", record.get("event_name", "other_unknown"))
    event_source = record.get("event_source", "")
    category = classify_action_category(action_raw, event_source)

    action_vec = [1.0 if category == act else 0.0 for act in ACTION_CATEGORIES]

    # 3. Contextual / Security Binary Signals
    source_ip = record.get("source_ip", "10.0.1.50")
    user_agent = record.get("user_agent", "aws-sdk-go/v1.44")
    error_code = record.get("error_code")

    is_ext = is_ip_external(source_ip)
    is_susp = is_user_agent_suspicious(user_agent)
    has_err = 1.0 if error_code is not None and error_code != "" else 0.0

    binary_vec = [is_ext, is_susp, has_err]

    full_vector = np.array(cont_vec + action_vec + binary_vec, dtype=np.float32)
    return full_vector


# ------------------------------------------------------------------------------
# Synthetic Telemetry Generation
# ------------------------------------------------------------------------------

def generate_synthetic_telemetry(
    num_entities: int = 8,
    events_per_entity: int = 120,
    anomaly_ratio: float = 0.12,
    seed: int = 42,
) -> List[Dict[str, Any]]:
    """
    Generates realistic historical JIT lease and telemetry records with labeled anomalies.
    Emulates operational baseline microservices as well as simulated attack deviations.
    """
    random.seed(seed)
    np.random.seed(seed)

    records: List[Dict[str, Any]] = []
    base_timestamp = datetime(2026, 9, 1, 0, 0, 0, tzinfo=timezone.utc)

    standard_actions = [
        ("compute:describe", "*", 0.1),
        ("telemetry:write", "arn:aws:logs:us-east-1:123456789012:log-group:aela*", 0.2),
        ("storage:read", "arn:aws:s3:::aela-analytics-store/*", 0.5),
        ("state:read", "arn:aws:dynamodb:us-east-1:123456789012:table/aela-state", 0.6),
        ("state:write", "arn:aws:dynamodb:us-east-1:123456789012:table/aela-state", 0.6),
    ]

    anomalous_iam_mutations = [
        ("AttachRolePolicy", "arn:aws:iam::123456789012:policy/AdministratorAccess", 1.0),
        ("PutRolePolicy", "arn:aws:iam::123456789012:role/aela-admin", 1.0),
        ("CreateAccessKey", "arn:aws:iam::123456789012:user/root", 1.0),
    ]

    for entity_idx in range(1, num_entities + 1):
        entity_id = f"srv-node-prod-{entity_idx:02d}"
        curr_time = base_timestamp + timedelta(minutes=random.randint(0, 60))
        recent_timestamps: List[datetime] = []

        for evt_idx in range(events_per_entity):
            is_anomaly = random.random() < anomaly_ratio

            if not is_anomaly:
                # Normal operational profile: steady intervals, valid internal IP, legitimate role
                interval = float(np.random.exponential(scale=45.0) + 10.0)  # 10s - 120s typical
                curr_time += timedelta(seconds=interval)
                action_tuple = random.choice(standard_actions)
                action_name, res_arn, sens_score = action_tuple

                record = {
                    "event_id": f"evt-{entity_id}-{evt_idx:04d}",
                    "service_id": entity_id,
                    "timestamp": curr_time.isoformat(),
                    "requested_action": action_name,
                    "resource_arn": res_arn,
                    "resource_sensitivity_score": sens_score,
                    "lease_duration_sec": 300.0,
                    "source_ip": f"10.0.1.{10 + entity_idx}",
                    "user_agent": "aws-sdk-go/v1.44",
                    "error_code": None,
                    "event_source": "aws.ec2" if "compute" in action_name else "aws.internal",
                    "is_anomaly": False,
                    "anomaly_label": 0,
                }
            else:
                # Anomalous profile: burst frequency, privilege escalation, suspicious agent, or external IP
                anomaly_mode = random.choice(["burst_rate", "iam_escalation", "external_agent", "unauthorized_error"])

                if anomaly_mode == "burst_rate":
                    interval = float(random.uniform(0.1, 1.5))  # High-rate burst / brute force
                    curr_time += timedelta(seconds=interval)
                    action_tuple = random.choice(standard_actions)
                    action_name, res_arn, sens_score = action_tuple
                    record = {
                        "event_id": f"evt-{entity_id}-{evt_idx:04d}",
                        "service_id": entity_id,
                        "timestamp": curr_time.isoformat(),
                        "requested_action": action_name,
                        "resource_arn": res_arn,
                        "resource_sensitivity_score": sens_score,
                        "lease_duration_sec": 300.0,
                        "source_ip": f"10.0.1.{10 + entity_idx}",
                        "user_agent": "aws-sdk-go/v1.44",
                        "error_code": None,
                        "event_source": "aws.internal",
                        "is_anomaly": True,
                        "anomaly_label": 1,
                    }
                elif anomaly_mode == "iam_escalation":
                    interval = float(random.uniform(5.0, 30.0))
                    curr_time += timedelta(seconds=interval)
                    action_tuple = random.choice(anomalous_iam_mutations)
                    action_name, res_arn, sens_score = action_tuple
                    record = {
                        "event_id": f"evt-{entity_id}-{evt_idx:04d}",
                        "service_id": entity_id,
                        "timestamp": curr_time.isoformat(),
                        "requested_action": action_name,
                        "resource_arn": res_arn,
                        "resource_sensitivity_score": sens_score,
                        "lease_duration_sec": 3600.0,  # Abnormal duration requested
                        "source_ip": f"10.0.1.{10 + entity_idx}",
                        "user_agent": "aws-sdk-go/v1.44",
                        "error_code": None,
                        "event_source": "iam.amazonaws.com",
                        "is_anomaly": True,
                        "anomaly_label": 1,
                    }
                elif anomaly_mode == "external_agent":
                    interval = float(random.uniform(10.0, 60.0))
                    curr_time += timedelta(seconds=interval)
                    record = {
                        "event_id": f"evt-{entity_id}-{evt_idx:04d}",
                        "service_id": entity_id,
                        "timestamp": curr_time.isoformat(),
                        "requested_action": "storage:read",
                        "resource_arn": "arn:aws:s3:::aela-confidential-keys/*",
                        "resource_sensitivity_score": 0.9,
                        "lease_duration_sec": 300.0,
                        "source_ip": "198.51.100.44",  # Untrusted external IP
                        "user_agent": "curl/7.68.0",   # Suspicious automated tool
                        "error_code": None,
                        "event_source": "aws.s3",
                        "is_anomaly": True,
                        "anomaly_label": 1,
                    }
                else:  # unauthorized_error
                    interval = float(random.uniform(5.0, 20.0))
                    curr_time += timedelta(seconds=interval)
                    record = {
                        "event_id": f"evt-{entity_id}-{evt_idx:04d}",
                        "service_id": entity_id,
                        "timestamp": curr_time.isoformat(),
                        "requested_action": "state:write",
                        "resource_arn": "arn:aws:dynamodb:*:table/root-audit",
                        "resource_sensitivity_score": 0.8,
                        "lease_duration_sec": 300.0,
                        "source_ip": f"10.0.1.{10 + entity_idx}",
                        "user_agent": "aws-sdk-go/v1.44",
                        "error_code": "AccessDenied",
                        "event_source": "aws.dynamodb",
                        "is_anomaly": True,
                        "anomaly_label": 1,
                    }

            # Maintain rolling frequency and delta intervals
            recent_timestamps.append(curr_time)
            # Retain only timestamps within the last 60 seconds
            cutoff = curr_time - timedelta(seconds=60)
            recent_timestamps = [t for t in recent_timestamps if t >= cutoff]

            record["request_interval_sec"] = interval
            record["rolling_frequency_60s"] = float(len(recent_timestamps))

            records.append(record)

    return records


# ------------------------------------------------------------------------------
# Sliding Window Sequence Generator
# ------------------------------------------------------------------------------

def create_sliding_window_sequences(
    records: List[Dict[str, Any]],
    sequence_length: int = 10,
    step: int = 1,
    scaler: Optional[TelemetryScaler] = None,
) -> Tuple[torch.FloatTensor, torch.FloatTensor]:
    """
    Groups telemetry by microservice entity and constructs fixed-length sliding windows.
    
    Args:
        records: List of structured telemetry records.
        sequence_length: Number of consecutive time-steps per sample (default: 10).
        step: Stride for sliding the window (default: 1).
        scaler: TelemetryScaler for continuous feature scaling.

    Returns:
        X: torch.FloatTensor of shape (num_samples, sequence_length, NUM_FEATURES)
        y: torch.FloatTensor of shape (num_samples, 1) representing binary anomaly label
    """
    if scaler is None:
        scaler = TelemetryScaler().fit(records)

    # Group records by service_id to guarantee zero cross-entity sequence blending
    entity_buckets: Dict[str, List[Dict[str, Any]]] = {}
    for r in records:
        sid = r.get("service_id", "default-entity")
        if sid not in entity_buckets:
            entity_buckets[sid] = []
        entity_buckets[sid].append(r)

    sequences_x: List[np.ndarray] = []
    labels_y: List[float] = []

    for sid, entity_records in entity_buckets.items():
        # Sort chronologically by timestamp
        entity_records.sort(key=lambda x: x.get("timestamp", ""))

        if len(entity_records) < sequence_length:
            # Skip entities with insufficient temporal history for window size
            continue

        # Extract feature vectors for all events of this entity
        feature_matrix = np.array(
            [extract_record_features(r, scaler=scaler) for r in entity_records],
            dtype=np.float32,
        )

        # Sliding window generation
        n_events = len(entity_records)
        for start_idx in range(0, n_events - sequence_length + 1, step):
            end_idx = start_idx + sequence_length
            window_slice = feature_matrix[start_idx:end_idx]  # Shape: (sequence_length, NUM_FEATURES)
            
            # Label is 1.0 if the target (latest event in window) is anomalous, or if an anomaly occurs
            target_record = entity_records[end_idx - 1]
            has_anomaly = 1.0 if target_record.get("anomaly_label", 0) == 1 or target_record.get("is_anomaly", False) else 0.0

            sequences_x.append(window_slice)
            labels_y.append(has_anomaly)

    if not sequences_x:
        # Return empty 3D tensor with correct feature dimensions
        X_tensor = torch.empty((0, sequence_length, NUM_FEATURES), dtype=torch.float32)
        y_tensor = torch.empty((0, 1), dtype=torch.float32)
        return X_tensor, y_tensor

    X_np = np.stack(sequences_x, axis=0)  # Shape: (samples, sequence_length, NUM_FEATURES)
    y_np = np.array(labels_y, dtype=np.float32).reshape(-1, 1)

    return torch.from_numpy(X_np).float(), torch.from_numpy(y_np).float()


# ------------------------------------------------------------------------------
# PyTorch Dataset & Data Loader Pipeline
# ------------------------------------------------------------------------------

class TelemetrySequenceDataset(Dataset):
    """PyTorch Dataset wrapping 3D telemetry sequences and corresponding target labels."""

    def __init__(self, X: torch.Tensor, y: torch.Tensor) -> None:
        if X.shape[0] != y.shape[0]:
            raise ValueError(f"X and y must have identical sample lengths! Got {X.shape[0]} vs {y.shape[0]}")
        self.X = X
        self.y = y

    def __len__(self) -> int:
        return self.X.shape[0]

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        return self.X[idx], self.y[idx]


def prepare_data_loaders(
    X: torch.Tensor,
    y: torch.Tensor,
    batch_size: int = 32,
    train_split: float = 0.8,
    val_split: float = 0.1,
    test_split: float = 0.1,
    seed: int = 42,
) -> Tuple[DataLoader, DataLoader, DataLoader]:
    """
    Partitions 3D sequence tensors into Train (80%), Validation (10%), and Test (10%) sets
    and constructs PyTorch DataLoaders.
    """
    total_samples = X.shape[0]
    if total_samples == 0:
        raise ValueError("Cannot prepare data loaders from empty sequence tensor.")

    n_train = int(total_samples * train_split)
    n_val = int(total_samples * val_split)
    n_test = total_samples - n_train - n_val

    # Reproducible randomized permutation
    generator = torch.Generator().manual_seed(seed)
    indices = torch.randperm(total_samples, generator=generator)

    train_idx = indices[:n_train]
    val_idx = indices[n_train : n_train + n_val]
    test_idx = indices[n_train + n_val :]

    train_ds = TelemetrySequenceDataset(X[train_idx], y[train_idx])
    val_ds = TelemetrySequenceDataset(X[val_idx], y[val_idx])
    test_ds = TelemetrySequenceDataset(X[test_idx], y[test_idx])

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)
    test_loader = DataLoader(test_ds, batch_size=batch_size, shuffle=False)

    return train_loader, val_loader, test_loader
