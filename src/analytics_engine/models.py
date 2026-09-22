"""
AELA Analytics Engine - Domain Data Models
Defines telemetry schema, time-decay evaluation results, and DynamoDB identity state.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Optional


@dataclass
class CloudTrailEvent:
    """Represents a structured CloudTrail event signature."""
    event_id: str
    event_time: datetime
    event_source: str
    event_name: str
    principal_id: str
    arn: str
    service_id: str
    source_ip: str = ""
    user_agent: str = ""
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    request_parameters: Dict[str, Any] = field(default_factory=dict)
    response_elements: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["event_time"] = self.event_time.isoformat()
        return data


@dataclass
class AnomalyResult:
    """Represents the findings from event signature anomaly detection."""
    is_anomaly: bool
    risk_level: str  # NONE, LOW, MEDIUM, HIGH, CRITICAL
    anomaly_type: Optional[str] = None
    details: str = ""
    anomaly_score: float = 0.0
    detection_source: str = "RULE_BASED"  # LSTM_INFERENCE, HYBRID_FALLBACK, HYBRID_OVERRIDE, RULE_BASED
    threshold_applied: float = 0.5


@dataclass
class DecayEvaluation:
    """Represents the outcome of a time-decay and idle gap calculation."""
    service_id: str
    last_activity_time: datetime
    current_time: datetime
    idle_duration_seconds: float
    threshold_seconds: float
    status: str  # ACTIVE, IDLE_EXPIRED, ANOMALY_QUARANTINED
    should_quarantine: bool
    reason: str
    anomaly_details: Optional[AnomalyResult] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "service_id": self.service_id,
            "last_activity_time": self.last_activity_time.isoformat(),
            "current_time": self.current_time.isoformat(),
            "idle_duration_seconds": self.idle_duration_seconds,
            "threshold_seconds": self.threshold_seconds,
            "status": self.status,
            "should_quarantine": self.should_quarantine,
            "reason": self.reason,
            "is_anomaly": self.anomaly_details.is_anomaly if self.anomaly_details else False,
            "risk_level": self.anomaly_details.risk_level if self.anomaly_details else "NONE",
            "anomaly_score": self.anomaly_details.anomaly_score if self.anomaly_details else 0.0,
            "detection_source": self.anomaly_details.detection_source if self.anomaly_details else "RULE_BASED",
            "threshold_applied": self.anomaly_details.threshold_applied if self.anomaly_details else 0.5,
        }


@dataclass
class IdentityState:
    """Represents the persistent state stored in DynamoDB for an identity."""
    service_id: str
    principal_arn: str
    status: str  # ACTIVE, QUARANTINED, REVOKED
    last_activity_timestamp: str
    last_event_name: str
    last_event_source: str
    idle_duration_seconds: float
    quarantine_count: int = 0
    anomaly_count: int = 0
    last_evaluated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_item(self) -> Dict[str, Any]:
        return asdict(self)
