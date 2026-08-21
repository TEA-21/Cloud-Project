"""
AELA Analytics Engine - Lambda Handler & Real-Time Decision Pipeline
Parses streaming CloudTrail signatures, evaluates time-decay idle gaps, detects anomalies,
and updates identity state in DynamoDB.
"""

from __future__ import annotations

import base64
import gzip
import json
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from dateutil.parser import isoparse

from src.analytics_engine.anomaly_detector import analyze_event_anomaly
from src.analytics_engine.models import CloudTrailEvent, DecayEvaluation
from src.analytics_engine.state_tracker import DynamoDBStateTracker

# Configure logging with immediate stdout flushing for real-time presentation narration
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("aela.analytics_engine")
logger.setLevel(logging.INFO)

# Configurable Parameters
DEFAULT_IDLE_THRESHOLD_SECONDS = int(os.environ.get("IDLE_THRESHOLD_SECONDS", "300"))  # 5 minutes
STATE_TABLE_NAME = os.environ.get("STATE_TABLE_NAME", "aela-dev-identity-state")


def extract_service_id(arn: str, principal_id: str, request_params: Dict[str, Any]) -> str:
    """
    Derives a standardized microservice or node ID from the ARN, principal ID, or request parameters.
    """
    # 1. Check if EC2 instance ID is provided in request params or ARN
    if "instanceId" in request_params:
        return str(request_params["instanceId"])

    # 2. Extract from assumed-role or role ARN: e.g. arn:aws:sts::123456789012:assumed-role/aela-dev-base-service-role/i-0123456789abcdef0
    if "/" in arn:
        parts = arn.split("/")
        # If the last segment is an instance ID (starts with i-)
        if parts[-1].startswith("i-"):
            return parts[-1]
        return parts[1]  # Return the role name

    # 3. Fallback to principalId or generic node name
    if ":" in principal_id:
        return principal_id.split(":")[-1]

    return principal_id if principal_id != "UNKNOWN" else "aela-target-node-1"


def parse_raw_cloudtrail_record(record: Dict[str, Any]) -> CloudTrailEvent:
    """
    Parses a single CloudTrail JSON dictionary into a strongly-typed CloudTrailEvent.
    """
    event_time_raw = record.get("eventTime")
    if isinstance(event_time_raw, str):
        try:
            event_time = isoparse(event_time_raw)
        except Exception:
            event_time = datetime.now(timezone.utc)
    elif isinstance(event_time_raw, datetime):
        event_time = event_time_raw
    else:
        event_time = datetime.now(timezone.utc)

    # Ensure UTC timezone awareness
    if event_time.tzinfo is None:
        event_time = event_time.replace(tzinfo=timezone.utc)

    user_identity = record.get("userIdentity", {})
    principal_id = user_identity.get("principalId", "UNKNOWN")
    arn = user_identity.get("arn", "")
    request_params = record.get("requestParameters", {}) or {}
    response_elements = record.get("responseElements", {}) or {}

    service_id = extract_service_id(arn, principal_id, request_params)

    return CloudTrailEvent(
        event_id=record.get("eventID", f"evt-{int(event_time.timestamp())}"),
        event_time=event_time,
        event_source=record.get("eventSource", "aws.ec2"),
        event_name=record.get("eventName", "APIInvocation"),
        principal_id=principal_id,
        arn=arn,
        service_id=service_id,
        source_ip=record.get("sourceIPAddress", "10.0.1.50"),
        user_agent=record.get("userAgent", "aws-sdk-go/v1.44"),
        error_code=record.get("errorCode"),
        error_message=record.get("errorMessage"),
        request_parameters=request_params,
        response_elements=response_elements,
    )


def decode_stream_payload(event: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Extracts and unpacks CloudTrail records from various AWS triggers:
    - CloudWatch Logs Subscription Filter (`awslogs.data` base64 + gzip)
    - Amazon Kinesis Streams (`kinesis.data` base64)
    - S3 / Direct Event JSON (`Records` list)
    """
    extracted_records: List[Dict[str, Any]] = []

    # 1. CloudWatch Logs Subscription Filter
    if "awslogs" in event and "data" in event["awslogs"]:
        try:
            compressed_data = base64.b64decode(event["awslogs"]["data"])
            decompressed = gzip.decompress(compressed_data).decode("utf-8")
            log_payload = json.loads(decompressed)
            for log_event in log_payload.get("logEvents", []):
                msg = log_event.get("message", "{}")
                extracted_records.append(json.loads(msg) if isinstance(msg, str) else msg)
            return extracted_records
        except Exception as e:
            logger.error(f"[AELA INGESTION ERROR] Failed decompressing CloudWatch logs payload: {e}")

    # 2. Direct Records list (Kinesis, S3, or standard test payload)
    if "Records" in event:
        for record in event["Records"]:
            if "kinesis" in record and "data" in record["kinesis"]:
                try:
                    raw_data = base64.b64decode(record["kinesis"]["data"]).decode("utf-8")
                    extracted_records.append(json.loads(raw_data))
                except Exception as e:
                    logger.error(f"[AELA INGESTION ERROR] Failed decoding Kinesis record: {e}")
            else:
                extracted_records.append(record)
        return extracted_records

    # 3. Single direct event payload
    if "eventName" in event or "eventSource" in event:
        return [event]

    return extracted_records


def evaluate_telemetry_decay(
    event: CloudTrailEvent,
    stored_state: Optional[Dict[str, Any]],
    current_time: Optional[datetime] = None,
    threshold_seconds: float = DEFAULT_IDLE_THRESHOLD_SECONDS,
) -> DecayEvaluation:
    """
    Computes time-decay idle gap and evaluates security anomalies.
    """
    if current_time is None:
        current_time = datetime.now(timezone.utc)
    if current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=timezone.utc)

    # 1. First check for security anomaly signatures
    anomaly_result = analyze_event_anomaly(event)

    # 2. Determine last active timestamp
    if stored_state and "last_activity_timestamp" in stored_state:
        last_active = isoparse(stored_state["last_activity_timestamp"])
        if last_active.tzinfo is None:
            last_active = last_active.replace(tzinfo=timezone.utc)
    else:
        last_active = event.event_time

    idle_duration = max(0.0, (current_time - last_active).total_seconds())

    # 3. Decision Matrix
    if anomaly_result.is_anomaly and anomaly_result.risk_level in {"HIGH", "CRITICAL"}:
        return DecayEvaluation(
            service_id=event.service_id,
            last_activity_time=last_active,
            current_time=current_time,
            idle_duration_seconds=idle_duration,
            threshold_seconds=threshold_seconds,
            status="ANOMALY_QUARANTINED",
            should_quarantine=True,
            reason=f"SECURITY ANOMALY DETECTED: {anomaly_result.details}",
            anomaly_details=anomaly_result,
        )

    if idle_duration >= threshold_seconds:
        return DecayEvaluation(
            service_id=event.service_id,
            last_activity_time=last_active,
            current_time=current_time,
            idle_duration_seconds=idle_duration,
            threshold_seconds=threshold_seconds,
            status="IDLE_EXPIRED",
            should_quarantine=True,
            reason=f"Idle duration ({idle_duration:.1f}s) exceeded time-decay threshold ({threshold_seconds:.1f}s)",
            anomaly_details=anomaly_result,
        )

    return DecayEvaluation(
        service_id=event.service_id,
        last_activity_time=event.event_time,
        current_time=current_time,
        idle_duration_seconds=idle_duration,
        threshold_seconds=threshold_seconds,
        status="ACTIVE",
        should_quarantine=False,
        reason=f"Active operational signature. Idle gap is healthy ({idle_duration:.1f}s < {threshold_seconds:.1f}s)",
        anomaly_details=anomaly_result,
    )


def print_demo_narration_banner(event: CloudTrailEvent, evaluation: DecayEvaluation) -> None:
    """
    Renders visual terminal output narrating time-decay calculations and isolation decisions in real-time.
    """
    banner_border = "=" * 88
    section_divider = "-" * 88

    status_badge = {
        "ACTIVE": "[OPERATIONAL / ACTIVE]",
        "IDLE_EXPIRED": "[SCALE-TO-ZERO QUARANTINE TRIGGERED]",
        "ANOMALY_QUARANTINED": "[SECURITY ANOMALY ISOLATION TRIGGERED]",
    }.get(evaluation.status, f"[{evaluation.status}]")

    print(f"\n{banner_border}")
    print(f" [AELA ANALYTICS ENGINE] Real-Time Telemetry Processing")
    print(f"{banner_border}")
    print(f" Target Service ID : {event.service_id}")
    print(f" Identity ARN      : {event.arn or 'N/A'}")
    print(f" API Signature     : {event.event_source} -> {event.event_name}")
    print(f" Source IP / Agent : {event.source_ip} | {event.user_agent}")
    if event.error_code:
        print(f" Error Code        : {event.error_code} ({event.error_message})")
    print(f"{section_divider}")
    print(f" [TIME-DECAY & RISK EVALUATION]")
    print(f" Last Active Time  : {evaluation.last_activity_time.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f" Current Timestamp : {evaluation.current_time.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f" Idle Gap Elapsed  : {evaluation.idle_duration_seconds:.1f}s / Threshold: {evaluation.threshold_seconds:.1f}s")
    if evaluation.anomaly_details and evaluation.anomaly_details.is_anomaly:
        print(f" Anomaly Flag      : {evaluation.anomaly_details.anomaly_type} (Risk: {evaluation.anomaly_details.risk_level})")
    print(f"{section_divider}")
    print(f" DECISION          : {status_badge}")
    print(f" Reason            : {evaluation.reason}")
    print(f"{banner_border}\n")


def lambda_handler(
    event: Dict[str, Any],
    context: Any,
    state_tracker: Optional[DynamoDBStateTracker] = None,
    current_time: Optional[datetime] = None,
    idle_threshold_seconds: Optional[float] = None,
) -> Dict[str, Any]:
    """
    AWS Lambda entrypoint for analytics engine telemetry stream processing.
    """
    if state_tracker is None:
        state_tracker = DynamoDBStateTracker(table_name=STATE_TABLE_NAME)

    threshold = idle_threshold_seconds if idle_threshold_seconds is not None else DEFAULT_IDLE_THRESHOLD_SECONDS
    raw_records = decode_stream_payload(event)

    processed_count = 0
    quarantine_triggers: List[Dict[str, Any]] = []

    for raw_record in raw_records:
        try:
            parsed_event = parse_raw_cloudtrail_record(raw_record)
            existing_state = state_tracker.get_identity_state(parsed_event.service_id)

            evaluation = evaluate_telemetry_decay(
                event=parsed_event,
                stored_state=existing_state,
                current_time=current_time,
                threshold_seconds=threshold,
            )

            # Print rich presentation narration banner
            print_demo_narration_banner(parsed_event, evaluation)

            if evaluation.should_quarantine:
                state_tracker.record_quarantine(
                    service_id=parsed_event.service_id,
                    reason=evaluation.reason,
                    principal_arn=parsed_event.arn,
                    details=evaluation.to_dict(),
                )
                quarantine_triggers.append(evaluation.to_dict())
            else:
                state_tracker.record_activity(
                    service_id=parsed_event.service_id,
                    event=parsed_event,
                    evaluation=evaluation,
                )

            processed_count += 1
        except Exception as err:
            logger.error(f"[AELA ERROR] Failed processing telemetry record: {err}", exc_info=True)

    return {
        "statusCode": 200,
        "body": json.dumps({
            "message": "Telemetry batch processed successfully",
            "records_processed": processed_count,
            "quarantine_triggers_count": len(quarantine_triggers),
            "quarantine_triggers": quarantine_triggers,
        }),
    }
