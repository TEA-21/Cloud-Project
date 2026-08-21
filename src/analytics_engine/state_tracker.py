"""
AELA Analytics Engine - DynamoDB State Tracking Layer
Persists and retrieves microservice activity timestamps, idle gap durations, and quarantine states.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError, NoCredentialsError

from src.analytics_engine.models import CloudTrailEvent, DecayEvaluation, IdentityState

logger = logging.getLogger("aela.state_tracker")


class DynamoDBStateTracker:
    """
    Manages persistent state in Amazon DynamoDB for microservices and identities.
    Supports in-memory fallback for reliable offline testing and local demonstrations.
    """

    def __init__(
        self,
        table_name: Optional[str] = None,
        dynamodb_resource: Optional[Any] = None,
        use_in_memory_fallback: bool = True,
    ):
        self.table_name = table_name or os.environ.get("STATE_TABLE_NAME", "aela-dev-identity-state")
        self.use_in_memory_fallback = use_in_memory_fallback
        self._in_memory_store: Dict[str, Dict[str, Any]] = {}
        self._offline_mode = False

        if dynamodb_resource is not None:
            self._dynamodb = dynamodb_resource
            self._table = self._dynamodb.Table(self.table_name)
        else:
            try:
                # Check for explicit offline flag or attempt AWS credentials resolution
                if os.environ.get("AELA_OFFLINE_MODE", "").lower() in ("1", "true", "yes"):
                    self._offline_mode = True
                    self._dynamodb = None
                    self._table = None
                else:
                    region = os.environ.get("AWS_REGION", "us-east-1")
                    session = boto3.Session(region_name=region)
                    # Check if credentials exist before binding table
                    if session.get_credentials() is None:
                        self._offline_mode = True
                        self._dynamodb = None
                        self._table = None
                    else:
                        self._dynamodb = session.resource("dynamodb")
                        self._table = self._dynamodb.Table(self.table_name)
            except Exception as e:
                logger.debug(f"[AELA STATE TRACKER] Operating in offline in-memory fallback mode: {e}")
                self._offline_mode = True
                self._dynamodb = None
                self._table = None

    def get_identity_state(self, service_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves the last known operational state and timestamp for a microservice.

        Args:
            service_id: The unique service or node identifier (e.g., EC2 instance ID or role name).

        Returns:
            Dictionary containing stored state, or None if identity not yet tracked.
        """
        if self._table is not None and not self._offline_mode:
            try:
                response = self._table.get_item(Key={"service_id": service_id})
                item = response.get("Item")
                if item:
                    return self._sanitize_dynamodb_item(item)
            except (ClientError, BotoCoreError, NoCredentialsError) as err:
                logger.debug(
                    f"[AELA STATE TRACKER] DynamoDB get_item error for {service_id}: {err}. "
                    "Reading from in-memory fallback store."
                )

        return self._in_memory_store.get(service_id)

    def record_activity(
        self,
        service_id: str,
        event: CloudTrailEvent,
        evaluation: DecayEvaluation,
    ) -> Dict[str, Any]:
        """
        Records an active API invocation and updates timestamps.

        Args:
            service_id: Unique microservice identifier.
            event: The parsed CloudTrail event.
            evaluation: The time-decay evaluation result.

        Returns:
            The saved state dictionary.
        """
        existing = self.get_identity_state(service_id) or {}
        quarantine_count = int(existing.get("quarantine_count", 0))
        anomaly_count = int(existing.get("anomaly_count", 0))

        if evaluation.anomaly_details and evaluation.anomaly_details.is_anomaly:
            anomaly_count += 1

        state = IdentityState(
            service_id=service_id,
            principal_arn=event.arn,
            status=evaluation.status,
            last_activity_timestamp=event.event_time.isoformat(),
            last_event_name=event.event_name,
            last_event_source=event.event_source,
            idle_duration_seconds=evaluation.idle_duration_seconds,
            quarantine_count=quarantine_count,
            anomaly_count=anomaly_count,
            last_evaluated_at=datetime.now(timezone.utc).isoformat(),
        )

        item = state.to_item()
        self._persist_item(service_id, item)
        return item

    def record_quarantine(
        self,
        service_id: str,
        reason: str,
        principal_arn: str = "",
        details: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Transitions an identity to QUARANTINED state upon idle expiration or anomaly trigger.

        Args:
            service_id: Unique microservice identifier.
            reason: Explanation for quarantine (e.g., IDLE_TIMEOUT_EXCEEDED, PRIVILEGE_ESCALATION).
            principal_arn: IAM ARN associated with the microservice.
            details: Extra diagnostic metadata.

        Returns:
            The updated state dictionary.
        """
        existing = self.get_identity_state(service_id) or {}
        quarantine_count = int(existing.get("quarantine_count", 0)) + 1
        anomaly_count = int(existing.get("anomaly_count", 0))

        item: Dict[str, Any] = {
            "service_id": service_id,
            "principal_arn": principal_arn or existing.get("principal_arn", "UNKNOWN"),
            "status": "QUARANTINED",
            "quarantine_reason": reason,
            "quarantine_count": quarantine_count,
            "anomaly_count": anomaly_count,
            "last_activity_timestamp": existing.get("last_activity_timestamp", datetime.now(timezone.utc).isoformat()),
            "last_evaluated_at": datetime.now(timezone.utc).isoformat(),
            "details": details or {},
        }

        self._persist_item(service_id, item)
        return item

    def _persist_item(self, service_id: str, item: Dict[str, Any]) -> None:
        """Internal helper to write to DynamoDB and sync the in-memory cache."""
        self._in_memory_store[service_id] = dict(item)

        if self._table is not None and not self._offline_mode:
            try:
                # Convert floats to Decimals for DynamoDB
                dynamo_item = self._convert_floats_to_decimals(item)
                self._table.put_item(Item=dynamo_item)
            except (ClientError, BotoCoreError, NoCredentialsError) as err:
                logger.debug(
                    f"[AELA STATE TRACKER] DynamoDB put_item failed for {service_id}: {err}. "
                    "State safely preserved in memory."
                )

    def _convert_floats_to_decimals(self, obj: Any) -> Any:
        """Recursively converts float values to Decimal for DynamoDB compliance."""
        if isinstance(obj, float):
            return Decimal(str(round(obj, 3)))
        if isinstance(obj, dict):
            return {k: self._convert_floats_to_decimals(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [self._convert_floats_to_decimals(v) for v in obj]
        return obj

    def _sanitize_dynamodb_item(self, item: Dict[str, Any]) -> Dict[str, Any]:
        """Converts DynamoDB Decimals back to standard Python floats/ints."""
        result = {}
        for k, v in item.items():
            if isinstance(v, Decimal):
                result[k] = int(v) if v % 1 == 0 else float(v)
            elif isinstance(v, dict):
                result[k] = self._sanitize_dynamodb_item(v)
            else:
                result[k] = v
        return result
