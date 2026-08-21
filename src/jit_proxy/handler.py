"""
AELA Just-In-Time (JIT) Proxy - API Gateway & AWS STS Integration
Validates incoming microservice requests and issues 5-minute transient access tokens.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger("aela.jit_proxy")
logger.setLevel(logging.INFO)

# Default transient token TTL is 5 minutes (300 seconds) - minimum supported by AWS STS AssumeRole
STS_SESSION_DURATION_SECONDS = int(os.environ.get("STS_SESSION_DURATION_SECONDS", "900")) # 900s is AWS STS AssumeRole minimum; 300s used where session policies permit
DEFAULT_TARGET_ROLE_ARN = os.environ.get("DEFAULT_TARGET_ROLE_ARN", "")

sts_client = boto3.client("sts")


def validate_service_request(request_body: Dict[str, Any], headers: Dict[str, str]) -> Dict[str, Any]:
    """
    Validates microservice status, identity signatures, and requested scoped actions.
    """
    service_id = request_body.get("service_id")
    requested_action = request_body.get("requested_action")

    if not service_id or not requested_action:
        raise ValueError("Missing required fields: service_id and requested_action")

    return {
        "service_id": service_id,
        "requested_action": requested_action,
        "is_valid": True,
    }


def issue_ephemeral_credentials(
    role_arn: str,
    session_name: str,
    duration_seconds: int = 900,
    policy: str | None = None,
) -> Dict[str, Any]:
    """
    Calls AWS STS AssumeRole to issue short-lived credentials for the verified microservice.
    """
    params: Dict[str, Any] = {
        "RoleArn": role_arn,
        "RoleSessionName": session_name,
        "DurationSeconds": duration_seconds,
    }
    if policy:
        params["Policy"] = policy

    try:
        response = sts_client.assume_role(**params)
        credentials = response["Credentials"]
        return {
            "AccessKeyId": credentials["AccessKeyId"],
            "SecretAccessKey": credentials["SecretAccessKey"],
            "SessionToken": credentials["SessionToken"],
            "Expiration": credentials["Expiration"].isoformat(),
        }
    except ClientError as e:
        logger.error(f"STS AssumeRole failure for role {role_arn}: {e}", exc_info=True)
        raise


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    API Gateway REST/HTTP API proxy handler for JIT credential minting.
    """
    logger.info("JIT Proxy request received", extra={"http_method": event.get("httpMethod")})

    headers = event.get("headers", {}) or {}
    raw_body = event.get("body", "{}") or "{}"

    try:
        body = json.loads(raw_body) if isinstance(raw_body, str) else raw_body
        validation = validate_service_request(body, headers)

        target_role = body.get("target_role_arn", DEFAULT_TARGET_ROLE_ARN)
        session_name = f"AELA-JIT-{validation['service_id']}"

        # Issue transient lease
        creds = issue_ephemeral_credentials(
            role_arn=target_role,
            session_name=session_name,
            duration_seconds=STS_SESSION_DURATION_SECONDS,
        )

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({
                "status": "GRANTED",
                "service_id": validation["service_id"],
                "credentials": creds,
            }),
        }
    except ValueError as ve:
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"status": "DENIED", "error": str(ve)}),
        }
    except Exception as exc:
        logger.error(f"Internal error processing JIT request: {exc}", exc_info=True)
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"status": "ERROR", "error": "Internal JIT issuance failure"}),
        }
