"""
AELA Just-In-Time (JIT) Proxy - Comprehensive Unit Tests with Moto
Tests request validation, dynamic policy scoping, STS transient credential minting, and offline demo support.
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock

import boto3
import pytest
from moto import mock_aws

from src.jit_proxy.handler import (
    ALLOWED_SERVICE_ACTIONS,
    EPHEMERAL_LEASE_WINDOW_SECONDS,
    build_scoped_session_policy,
    issue_ephemeral_credentials,
    lambda_handler,
    validate_service_request,
)


@pytest.fixture
def valid_request_body() -> dict:
    return {
        "service_id": "i-0123456789abcdef0",
        "requested_action": "state:read",
        "target_role_arn": "arn:aws:iam::123456789012:role/aela-dev-base-service-role",
        "resource_arn": "arn:aws:dynamodb:us-east-1:123456789012:table/aela-dev-identity-state",
    }


@pytest.fixture
def mock_apigw_event(valid_request_body: dict) -> dict:
    return {
        "httpMethod": "POST",
        "path": "/jit/lease",
        "headers": {
            "Content-Type": "application/json",
            "User-Agent": "AELA-Microservice-Client/1.0",
        },
        "body": json.dumps(valid_request_body),
    }


# ------------------------------------------------------------------------------
# 1. Validation & Policy Scoping Tests
# ------------------------------------------------------------------------------

def test_validate_service_request_success(valid_request_body: dict):
    result = validate_service_request(valid_request_body, {})
    assert result["is_valid"] is True
    assert result["service_id"] == "i-0123456789abcdef0"
    assert result["requested_action"] == "state:read"


def test_validate_service_request_missing_fields():
    with pytest.raises(ValueError, match="Missing required parameter: 'service_id'"):
        validate_service_request({"requested_action": "state:read"}, {})

    with pytest.raises(ValueError, match="Missing required parameter: 'requested_action'"):
        validate_service_request({"service_id": "node-1"}, {})


def test_validate_service_request_unauthorized_action():
    with pytest.raises(ValueError, match="Unauthorized action 'admin:deleteAll'"):
        validate_service_request({"service_id": "node-1", "requested_action": "admin:deleteAll"}, {})


def test_validate_service_request_quarantined():
    with pytest.raises(PermissionError, match="currently in QUARANTINED state"):
        validate_service_request({
            "service_id": "node-1",
            "requested_action": "state:read",
            "quarantined": True,
        }, {})


def test_build_scoped_session_policy():
    policy_json = build_scoped_session_policy("storage:read", "arn:aws:s3:::my-bucket/*")
    policy = json.loads(policy_json)

    assert policy["Version"] == "2012-10-17"
    statement = policy["Statement"][0]
    assert statement["Effect"] == "Allow"
    assert statement["Action"] == ["s3:GetObject", "s3:ListBucket"]
    assert statement["Resource"] == "arn:aws:s3:::my-bucket/*"


# ------------------------------------------------------------------------------
# 2. STS Credential Minting with Moto
# ------------------------------------------------------------------------------

@mock_aws
def test_issue_ephemeral_credentials_moto():
    sts = boto3.client("sts", region_name="us-east-1")
    role_arn = "arn:aws:iam::123456789012:role/aela-dev-base-service-role"
    session_policy = build_scoped_session_policy("telemetry:write")

    creds = issue_ephemeral_credentials(
        role_arn=role_arn,
        session_name="AELA-JIT-node-1",
        duration_seconds=900,
        policy=session_policy,
        sts_client=sts,
    )

    assert "AccessKeyId" in creds
    assert "SecretAccessKey" in creds
    assert "SessionToken" in creds
    assert creds["LeaseDurationSeconds"] == EPHEMERAL_LEASE_WINDOW_SECONDS
    assert creds["Mode"] == "LIVE_STS"
    assert creds["AccessKeyId"].startswith("ASIA")


def test_issue_ephemeral_credentials_offline_mock():
    # Calling without STS client in offline mode triggers fallback
    creds = issue_ephemeral_credentials(
        role_arn="arn:aws:iam::123456789012:role/dummy",
        session_name="AELA-JIT-offline-node",
        sts_client=None,
    )
    assert creds["AccessKeyId"].startswith("ASIA")
    assert creds["LeaseDurationSeconds"] == EPHEMERAL_LEASE_WINDOW_SECONDS
    assert creds["Mode"] == "OFFLINE_MOCK"


# ------------------------------------------------------------------------------
# 3. End-to-End API Gateway Lambda Proxy Handler Tests
# ------------------------------------------------------------------------------

@mock_aws
def test_lambda_handler_granted_moto(mock_apigw_event: dict):
    sts = boto3.client("sts", region_name="us-east-1")
    response = lambda_handler(mock_apigw_event, context=None, sts_client=sts)

    assert response["statusCode"] == 200
    assert response["headers"]["Content-Type"] == "application/json"
    assert response["headers"]["X-AELA-Lease-Duration"] == "300"

    body = json.loads(response["body"])
    assert body["status"] == "GRANTED"
    assert body["service_id"] == "i-0123456789abcdef0"
    assert body["requested_action"] == "state:read"
    assert "credentials" in body
    assert body["credentials"]["AccessKeyId"].startswith("ASIA")


def test_lambda_handler_quarantined_rejected():
    event = {
        "httpMethod": "POST",
        "body": json.dumps({
            "service_id": "i-quarantined-node",
            "requested_action": "state:read",
            "quarantined": True,
        }),
    }
    response = lambda_handler(event, context=None)

    assert response["statusCode"] == 403
    body = json.loads(response["body"])
    assert body["status"] == "DENIED"
    assert "QUARANTINED" in body["error"]


def test_lambda_handler_invalid_payload():
    event = {
        "httpMethod": "POST",
        "body": json.dumps({
            "service_id": "",
            "requested_action": "state:read",
        }),
    }
    response = lambda_handler(event, context=None)

    assert response["statusCode"] == 400
    body = json.loads(response["body"])
    assert body["status"] == "REJECTED"
    assert "Missing required parameter" in body["error"]
