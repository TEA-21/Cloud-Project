"""
AELA Analytics Engine - Hybrid Anomaly & Risk Detector
Phase 3: Integrates deep-learning LSTM sequence inference with a deterministic rule-based
secondary validation layer and fault-tolerant fallback mechanism.

Features:
  1. Real-time sequence preprocessing using Phase 1 TelemetryScaler.
  2. Memory-loaded PyTorch LSTM model weights and metadata loaded at startup.
  3. Rolling temporal sequence buffer per entity with sliding-window tensor construction [1, 10, 16].
  4. Context-aware dynamic anomaly threshold computation based on resource sensitivity, burst rates, and IP risk.
  5. Hybrid ensemble & defense-in-depth:
     - Evaluates LSTM threat score against dynamic threshold.
     - Secondary validation layer catches known critical security signatures (IAM/Network mutations, errors).
     - Fault-tolerant fallback to pure rule-based evaluation if the model fails or produces uncertain scores.
"""

from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple, Union

import numpy as np
import torch

from src.analytics_engine.data_preprocessor import (
    NUM_FEATURES,
    TelemetryScaler,
    evaluate_resource_sensitivity,
    extract_record_features,
    is_ip_external,
    is_user_agent_suspicious,
)
from src.analytics_engine.model import (
    DEFAULT_HIDDEN_DIM,
    DEFAULT_INPUT_DIM,
    DEFAULT_SEQ_LEN,
    LSTMAnomalyClassifier,
    load_model_checkpoint,
)
from src.analytics_engine.models import AnomalyResult, CloudTrailEvent

logger = logging.getLogger("aela.anomaly_detector")

# Default Artifact Locations
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_MODEL_PATH = os.path.join(CURRENT_DIR, "models", "lstm_anomaly_model.pth")
DEFAULT_SCALER_PATH = os.path.join(CURRENT_DIR, "data", "scaler_params.json")
DEFAULT_METADATA_PATH = os.path.join(CURRENT_DIR, "models", "lstm_anomaly_model_metadata.json")

# Rule-Based Constants (Secondary Validation Layer & Fallback)
SENSITIVE_IAM_ACTIONS: Set[str] = {
    "AttachRolePolicy",
    "AttachUserPolicy",
    "PutRolePolicy",
    "PutUserPolicy",
    "CreateAccessKey",
    "UpdateAssumeRolePolicy",
    "CreateLoginProfile",
    "DeleteRolePermissionsBoundary",
}

SENSITIVE_NETWORK_ACTIONS: Set[str] = {
    "AuthorizeSecurityGroupIngress",
    "AuthorizeSecurityGroupEgress",
    "CreateRoute",
    "DeleteFlowLogs",
    "ModifyVpcEndpoint",
}

UNAUTHORIZED_ERROR_CODES: Set[str] = {
    "AccessDenied",
    "AccessDeniedException",
    "UnauthorizedOperation",
    "AuthFailure",
    "Client.UnauthorizedOperation",
}

SUSPICIOUS_CLIENT_PATTERNS = ["sqlmap", "nikto", "hydra", "metasploit", "curl/"]


# ------------------------------------------------------------------------------
# Rule-Based Signature Detector (Secondary Defense & High-Availability Fallback)
# ------------------------------------------------------------------------------

def analyze_rule_based_anomaly(event: Union[CloudTrailEvent, Dict[str, Any]]) -> AnomalyResult:
    """
    Evaluates whether an incoming event matches deterministic signature patterns.
    Functions as both a secondary defense layer and a high-availability fallback.
    """
    if isinstance(event, CloudTrailEvent):
        event_dict = event.to_dict()
        event_name = event.event_name
        event_source = event.event_source
        error_code = event.error_code
        user_agent = event.user_agent
        arn = event.arn
    else:
        event_dict = dict(event)
        event_name = event_dict.get("requested_action", event_dict.get("event_name", event_dict.get("eventName", "")))
        event_source = event_dict.get("event_source", event_dict.get("eventSource", ""))
        error_code = event_dict.get("error_code", event_dict.get("errorCode"))
        user_agent = event_dict.get("user_agent", event_dict.get("userAgent", ""))
        arn = event_dict.get("arn", event_dict.get("target_role_arn", ""))

    # 1. Unauthorized Access / Access Denied Errors
    if error_code in UNAUTHORIZED_ERROR_CODES:
        return AnomalyResult(
            is_anomaly=True,
            risk_level="HIGH",
            anomaly_type="UNAUTHORIZED_ACCESS_ATTEMPT",
            details=f"Identity {arn} triggered {error_code} on {event_source}:{event_name}",
            detection_source="RULE_BASED",
        )

    # 2. Sensitive IAM Privilege Escalation
    act_lower = event_name.lower()
    source_lower = event_source.lower()
    is_iam = "iam" in source_lower or "iam" in act_lower or event_name in SENSITIVE_IAM_ACTIONS
    if is_iam and (event_name in SENSITIVE_IAM_ACTIONS or "policy" in act_lower):
        return AnomalyResult(
            is_anomaly=True,
            risk_level="CRITICAL",
            anomaly_type="PRIVILEGE_ESCALATION_ATTEMPT",
            details=f"Identity {arn} executed sensitive IAM mutation: {event_name}",
            detection_source="RULE_BASED",
        )

    # 3. Network Boundary & Security Group Tampering
    is_network = "ec2" in source_lower or "network" in act_lower or event_name in SENSITIVE_NETWORK_ACTIONS
    if is_network and (event_name in SENSITIVE_NETWORK_ACTIONS or "securitygroup" in act_lower):
        return AnomalyResult(
            is_anomaly=True,
            risk_level="HIGH",
            anomaly_type="NETWORK_ISOLATION_TAMPERING",
            details=f"Identity {arn} attempted network boundary mutation: {event_name}",
            detection_source="RULE_BASED",
        )

    # 4. Suspicious Client User-Agent
    if any(agent.lower() in str(user_agent).lower() for agent in SUSPICIOUS_CLIENT_PATTERNS):
        return AnomalyResult(
            is_anomaly=True,
            risk_level="MEDIUM",
            anomaly_type="SUSPICIOUS_CLIENT_AGENT",
            details=f"Identity used suspicious user-agent signature: '{user_agent}'",
            detection_source="RULE_BASED",
        )

    # Normal Signature
    return AnomalyResult(
        is_anomaly=False,
        risk_level="NONE",
        anomaly_type=None,
        details="Standard operational signature within permissible baseline",
        detection_source="RULE_BASED",
    )


# ------------------------------------------------------------------------------
# Context-Aware Dynamic Threshold Engine
# ------------------------------------------------------------------------------

def calculate_dynamic_threshold(
    record: Dict[str, Any],
    base_threshold: float = 0.50,
) -> float:
    """
    Computes a context-aware dynamic anomaly classification threshold.
    Higher risk contexts (sensitive resources, external IPs, rapid bursts) lower the threshold
    to increase detection sensitivity. Standard operations maintain nominal baseline threshold.
    """
    threshold = base_threshold

    # 1. Resource Sensitivity Adjustment
    resource_arn = record.get("resource_arn", record.get("arn", "*"))
    sensitivity = float(record.get("resource_sensitivity_score", evaluate_resource_sensitivity(resource_arn)))
    if sensitivity >= 0.8:
        # Sensitive IAM, security groups, or administrative tables
        threshold -= 0.15
    elif sensitivity >= 0.6:
        threshold -= 0.05

    # 2. IP Origin Risk
    source_ip = record.get("source_ip", record.get("sourceIPAddress", "10.0.1.50"))
    if is_ip_external(source_ip) > 0.5:
        threshold -= 0.10

    # 3. Burst Rate / Rolling Frequency Risk
    frequency = float(record.get("rolling_frequency_60s", 1.0))
    if frequency > 20.0:
        threshold -= 0.10
    elif frequency > 10.0:
        threshold -= 0.05

    # 4. Error State
    if record.get("error_code") or record.get("errorCode"):
        threshold -= 0.10

    # Clamp dynamic threshold strictly to permissible operational range [0.15, 0.85]
    return float(max(0.15, min(0.85, round(threshold, 3))))


# ------------------------------------------------------------------------------
# Hybrid Anomaly Detector Engine
# ------------------------------------------------------------------------------

class HybridAnomalyDetector:
    """
    Production Anomaly Detection Engine combining:
      1. Sequence-based PyTorch LSTM Deep Learning Model (Primary inference)
      2. Deterministic Heuristic Signature Matrix (Secondary defense layer)
      3. Automatic Fallback Handler ensuring zero service interruption
    """

    def __init__(
        self,
        model_path: Optional[str] = None,
        scaler_path: Optional[str] = None,
        metadata_path: Optional[str] = None,
        sequence_length: int = DEFAULT_SEQ_LEN,
        device: str = "cpu",
        auto_load: bool = True,
    ) -> None:
        self.model_path = model_path or DEFAULT_MODEL_PATH
        self.scaler_path = scaler_path or DEFAULT_SCALER_PATH
        self.metadata_path = metadata_path or DEFAULT_METADATA_PATH
        self.sequence_length = sequence_length
        self.device = device

        self.model: Optional[LSTMAnomalyClassifier] = None
        self.scaler: Optional[TelemetryScaler] = None
        self.metadata: Dict[str, Any] = {}
        self.base_threshold: float = 0.50
        self.is_model_loaded: bool = False

        # In-memory entity sequence buffer: service_id -> list of feature vectors (max 10)
        self._sequence_buffers: Dict[str, List[np.ndarray]] = {}

        if auto_load:
            self.load_artifacts()

    def load_artifacts(self) -> bool:
        """
        Initializes and loads model weights, scaler bounds, and metadata into memory.
        Returns True on complete initialization, False if fallback mode is activated.
        """
        # 1. Load Scaler
        try:
            if os.path.exists(self.scaler_path):
                with open(self.scaler_path, "r", encoding="utf-8") as f:
                    self.scaler = TelemetryScaler.from_json(f.read())
            else:
                logger.warning(f"[AnomalyDetector] Scaler file not found at {self.scaler_path}. Creating default scaler.")
                self.scaler = TelemetryScaler()
        except Exception as e:
            logger.warning(f"[AnomalyDetector] Error loading scaler params: {e}. Fallback scaler instantiated.")
            self.scaler = TelemetryScaler()

        # 2. Load Model & Metadata
        try:
            if os.path.exists(self.model_path):
                self.model, self.metadata = load_model_checkpoint(
                    LSTMAnomalyClassifier,
                    self.model_path,
                    device=self.device,
                )
                self.base_threshold = float(self.metadata.get("anomaly_threshold", 0.50))
                self.is_model_loaded = True
                logger.info(
                    f"[AnomalyDetector] LSTM model initialized successfully from {self.model_path} "
                    f"(Base Threshold: {self.base_threshold})"
                )
                return True
            else:
                logger.warning(
                    f"[AnomalyDetector] Model weights not found at {self.model_path}. "
                    "Engine operating in deterministic RULE_BASED fallback mode."
                )
                self.is_model_loaded = False
                return False
        except Exception as e:
            logger.error(f"[AnomalyDetector] Failed to load LSTM model checkpoint: {e}. Activating fallback.")
            self.is_model_loaded = False
            return False

    def reset_buffer(self) -> None:
        """Clears all in-memory rolling sequence buffers."""
        self._sequence_buffers.clear()

    def _prepare_sequence_tensor(
        self,
        service_id: str,
        feature_vec: np.ndarray,
    ) -> torch.Tensor:
        """
        Appends the latest feature vector to the service's rolling buffer and
        constructs a 3D input tensor of shape [1, sequence_length=10, 16].
        Pads beginning of sequence if entity history contains fewer than 10 events.
        """
        if service_id not in self._sequence_buffers:
            self._sequence_buffers[service_id] = []

        buffer = self._sequence_buffers[service_id]
        buffer.append(feature_vec)

        # Retain only the most recent sequence_length events
        if len(buffer) > self.sequence_length:
            self._sequence_buffers[service_id] = buffer[-self.sequence_length :]
            buffer = self._sequence_buffers[service_id]

        # Pad sequence on left if history < sequence_length
        current_len = len(buffer)
        if current_len < self.sequence_length:
            pad_count = self.sequence_length - current_len
            # Replicate earliest feature vector for warm-up temporal padding
            pad_vectors = [buffer[0].copy() for _ in range(pad_count)]
            full_sequence = pad_vectors + buffer
        else:
            full_sequence = buffer

        seq_array = np.array(full_sequence, dtype=np.float32)  # (10, 16)
        tensor_3d = torch.from_numpy(seq_array).unsqueeze(0).to(self.device)  # (1, 10, 16)
        return tensor_3d

    def evaluate(
        self,
        event: Union[CloudTrailEvent, Dict[str, Any]],
        force_fallback: bool = False,
    ) -> AnomalyResult:
        """
        Executes end-to-end anomaly evaluation for a real-time event or JIT request.
        Coordinates LSTM inference, dynamic threshold comparison, secondary signature defense,
        and fault-tolerant fallback.
        """
        # Convert event to dictionary representation
        if isinstance(event, CloudTrailEvent):
            record = event.to_dict()
            service_id = event.service_id
        else:
            record = dict(event)
            service_id = str(record.get("service_id", record.get("instanceId", "default-service")))

        # Always evaluate deterministic rule-based signature as baseline / safety net
        rule_result = analyze_rule_based_anomaly(event)

        # ----------------------------------------------------------------------
        # Fallback Check: Model Unloaded, Disabled, or Forcible Failure Mode
        # ----------------------------------------------------------------------
        if force_fallback or not self.is_model_loaded or self.model is None:
            rule_result.detection_source = "RULE_BASED_FALLBACK"
            rule_result.threshold_applied = self.base_threshold
            rule_result.details = f"[FALLBACK MODE] {rule_result.details}"
            return rule_result

        # ----------------------------------------------------------------------
        # Primary Inference Pipeline: PyTorch LSTM Evaluation
        # ----------------------------------------------------------------------
        try:
            # 1. Feature Extraction & Scaling (Phase 1 pipeline)
            feature_vec = extract_record_features(record, scaler=self.scaler)

            # 2. Formulate 3D Tensor [1, 10, 16]
            x_tensor = self._prepare_sequence_tensor(service_id, feature_vec)

            # 3. Model Forward Pass
            probas = self.model.predict_proba(x_tensor)
            anomaly_score = float(probas.item())

            # 4. Check for NaN or Inf (Uncertain / Corrupted output)
            if np.isnan(anomaly_score) or np.isinf(anomaly_score):
                raise ValueError(f"Model generated invalid score: {anomaly_score}")

            # 5. Compute Dynamic Threshold
            dynamic_threshold = calculate_dynamic_threshold(record, base_threshold=self.base_threshold)

            # ------------------------------------------------------------------
            # Hybrid Decision Integration & Secondary Defense Layer
            # ------------------------------------------------------------------
            model_flagged = anomaly_score >= dynamic_threshold

            # Map raw score to baseline risk level
            if anomaly_score >= 0.85:
                model_risk = "CRITICAL"
            elif anomaly_score >= 0.70:
                model_risk = "HIGH"
            elif anomaly_score >= dynamic_threshold:
                model_risk = "MEDIUM"
            else:
                model_risk = "NONE"

            # CASE 1: Rule-based signature triggered (Secondary defense layer)
            if rule_result.is_anomaly:
                resolved_risk = rule_result.risk_level
                if model_flagged:
                    # Both layers confirm anomaly -> HYBRID_ENSEMBLE
                    return AnomalyResult(
                        is_anomaly=True,
                        risk_level=resolved_risk,
                        anomaly_type=rule_result.anomaly_type,
                        details=(
                            f"[HYBRID ENSEMBLE] LSTM threat score {anomaly_score:.3f} "
                            f"(threshold: {dynamic_threshold:.2f}) confirmed by signature: {rule_result.details}"
                        ),
                        anomaly_score=round(anomaly_score, 4),
                        detection_source="HYBRID_ENSEMBLE",
                        threshold_applied=dynamic_threshold,
                    )
                else:
                    # Model did NOT flag or was uncertain, but critical rule signature detected
                    # Heuristic Safety Net overrides to prevent bypasses
                    return AnomalyResult(
                        is_anomaly=True,
                        risk_level=rule_result.risk_level,
                        anomaly_type=rule_result.anomaly_type,
                        details=(
                            f"[HYBRID OVERRIDE] Rule-based safety net flagged {rule_result.anomaly_type} "
                            f"despite sub-threshold LSTM score ({anomaly_score:.3f} < {dynamic_threshold:.2f}): {rule_result.details}"
                        ),
                        anomaly_score=round(anomaly_score, 4),
                        detection_source="HYBRID_OVERRIDE",
                        threshold_applied=dynamic_threshold,
                    )

            # CASE 2: Rule-based signature did not trigger, but LSTM detects sequence anomaly
            if model_flagged:
                return AnomalyResult(
                    is_anomaly=True,
                    risk_level=model_risk,
                    anomaly_type="LSTM_SEQUENCE_ANOMALY",
                    details=(
                        f"[LSTM INFERENCE] Temporal pattern deviation detected. "
                        f"Threat score {anomaly_score:.3f} exceeded dynamic threshold {dynamic_threshold:.2f}."
                    ),
                    anomaly_score=round(anomaly_score, 4),
                    detection_source="LSTM_INFERENCE",
                    threshold_applied=dynamic_threshold,
                )

            # CASE 3: Normal operational event across both model and rule checks
            return AnomalyResult(
                is_anomaly=False,
                risk_level="NONE",
                anomaly_type=None,
                details=(
                    f"Standard operational sequence. Threat score {anomaly_score:.3f} "
                    f"within permissible threshold ({dynamic_threshold:.2f})."
                ),
                anomaly_score=round(anomaly_score, 4),
                detection_source="LSTM_INFERENCE",
                threshold_applied=dynamic_threshold,
            )

        except Exception as exc:
            # ------------------------------------------------------------------
            # Fault-Tolerant Fallback: Model inference exception
            # ------------------------------------------------------------------
            logger.warning(
                f"[AnomalyDetector] LSTM inference pipeline encountered an error: {exc}. "
                "Failing over safely to RULE_BASED fallback."
            )
            rule_result.detection_source = "RULE_BASED_FALLBACK"
            rule_result.threshold_applied = self.base_threshold
            rule_result.details = f"[FALLBACK ON ERROR: {type(exc).__name__}] {rule_result.details}"
            return rule_result


# ------------------------------------------------------------------------------
# Module-Level Singleton & Standard Interface
# ------------------------------------------------------------------------------

_GLOBAL_DETECTOR: Optional[HybridAnomalyDetector] = None


def get_detector() -> HybridAnomalyDetector:
    """Returns the process-wide singleton instance of HybridAnomalyDetector."""
    global _GLOBAL_DETECTOR
    if _GLOBAL_DETECTOR is None:
        _GLOBAL_DETECTOR = HybridAnomalyDetector()
    return _GLOBAL_DETECTOR


def set_detector(detector: Optional[HybridAnomalyDetector]) -> None:
    """Sets or overrides the process-wide detector singleton (useful for testing)."""
    global _GLOBAL_DETECTOR
    _GLOBAL_DETECTOR = detector


def reset_detector_state() -> None:
    """Resets the detector's rolling sequence cache."""
    detector = get_detector()
    detector.reset_buffer()


def analyze_event_anomaly(event: Union[CloudTrailEvent, Dict[str, Any]]) -> AnomalyResult:
    """
    Standard entrypoint for AELA Analytics Engine to evaluate event anomaly status.
    Uses memory-loaded LSTM inference with dynamic thresholding, secondary rule validation,
    and automatic fallback.
    """
    return get_detector().evaluate(event)
