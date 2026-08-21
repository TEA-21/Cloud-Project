"""
AELA Analytics Engine - Lambda Handler & Telemetry Parser
Processes streaming CloudTrail API signatures and computes idle duration time-decay parameters.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

# Configure structured JSON/standard logging
logger = logging.getLogger("aela.analytics_engine")
logger.setLevel(logging.INFO)

# Default configuration parameters (can be overridden via environment variables)
IDLE_THRESHOLD_SECONDS = int(os.environ.get("IDLE_THRESHOLD_SECONDS", "300"))  # 5 minutes
REVOCATION_TOPIC_ARN = os.environ.get("REVOCATION_TOPIC_ARN", "")


def parse_cloudtrail_event(record: Dict[str, Any]) -> Dict[str, Any]:
    """
    Parses structural CloudTrail event records from CloudWatch Logs or Kinesis streams.

    Args:
        record: Raw event data dictionary or CloudWatch log record.

    Returns:
        Structured dictionary containing identity ARN, event time, event source, and API action.
    """
    event_time_str = record.get("eventTime", datetime.now(timezone.utc).isoformat())
    user_identity = record.get("userIdentity", {})
    principal_id = user_identity.get("principalId", "UNKNOWN")
    arn = user_identity.get("arn", "")

    return {
        "event_id": record.get("eventID", ""),
        "event_time": event_time_str,
        "event_source": record.get("eventSource", ""),
        "event_name": record.get("eventName", ""),
        "principal_id": principal_id,
        "arn": arn,
        "source_ip": record.get("sourceIPAddress", ""),
        "user_agent": record.get("userAgent", ""),
    }


def calculate_time_decay_gap(
    last_activity_time: datetime,
    current_time: Optional[datetime] = None,
    threshold_seconds: int = IDLE_THRESHOLD_SECONDS,
) -> Dict[str, Any]:
    """
    Calculates idle duration gaps and determines if identity quarantine should be triggered.

    Args:
        last_activity_time: Timestamp of the last recorded API activity for an identity.
        current_time: Reference timestamp (defaults to UTC now).
        threshold_seconds: Max allowable idle duration before scale-down to zero.

    Returns:
        Dictionary with idle_duration_seconds, should_quarantine flag, and reason.
    """
    if current_time is None:
        current_time = datetime.now(timezone.utc)

    idle_duration = (current_time - last_activity_time).total_seconds()
    should_quarantine = idle_duration >= threshold_seconds

    return {
        "idle_duration_seconds": idle_duration,
        "threshold_seconds": threshold_seconds,
        "should_quarantine": should_quarantine,
        "status": "IDLE_EXPIRED" if should_quarantine else "ACTIVE",
    }


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    AWS Lambda entrypoint for analytics engine telemetry stream processing.
    """
    logger.info("Received event for telemetry analysis", extra={"event_keys": list(event.keys())})

    records_processed = 0
    quarantine_candidates: List[Dict[str, Any]] = []

    # Processing batch records (e.g. from Kinesis or CloudWatch log group subscriptions)
    records = event.get("Records", [])
    for record in records:
        try:
            # Handle Kinesis / CloudWatch base64/json decoded payload
            payload = record.get("kinesis", {}).get("data", record)
            if isinstance(payload, str):
                payload = json.loads(payload)

            parsed = parse_cloudtrail_event(payload)
            records_processed += 1
            logger.debug(f"Parsed telemetry record: {parsed['event_name']} for {parsed['arn']}")
        except Exception as err:
            logger.error(f"Failed to process telemetry record: {err}", exc_info=True)

    return {
        "statusCode": 200,
        "body": json.dumps({
            "message": "Telemetry batch processed successfully",
            "records_processed": records_processed,
            "quarantine_candidates_count": len(quarantine_candidates),
        }),
    }
