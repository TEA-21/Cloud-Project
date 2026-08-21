"""
AELA Analytics Engine - Anomaly & Risk Signature Detector
Analyzes CloudTrail event signatures to flag privilege escalation, security group tampering, and unauthorized API calls.
"""

from __future__ import annotations

from typing import Set

from src.analytics_engine.models import AnomalyResult, CloudTrailEvent

# Critical and sensitive actions that trigger high-priority security evaluation
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


def analyze_event_anomaly(event: CloudTrailEvent) -> AnomalyResult:
    """
    Evaluates whether an incoming CloudTrail event matches known anomaly or risk signatures.

    Args:
        event: The parsed CloudTrail event signature.

    Returns:
        AnomalyResult specifying if the event is anomalous, its risk level, and diagnostic details.
    """
    # 1. Check for Unauthorized / Access Denied error codes
    if event.error_code in UNAUTHORIZED_ERROR_CODES:
        return AnomalyResult(
            is_anomaly=True,
            risk_level="HIGH",
            anomaly_type="UNAUTHORIZED_ACCESS_ATTEMPT",
            details=f"Identity {event.arn} triggered {event.error_code} on {event.event_source}:{event.event_name}",
        )

    # 2. Check for unauthorized IAM policy tampering or privilege escalation
    if event.event_source.startswith("iam") and event.event_name in SENSITIVE_IAM_ACTIONS:
        return AnomalyResult(
            is_anomaly=True,
            risk_level="CRITICAL",
            anomaly_type="PRIVILEGE_ESCALATION_ATTEMPT",
            details=f"Identity {event.arn} executed sensitive IAM mutation: {event.event_name}",
        )

    # 3. Check for security group or network boundary tampering
    if event.event_source.startswith("ec2") and event.event_name in SENSITIVE_NETWORK_ACTIONS:
        return AnomalyResult(
            is_anomaly=True,
            risk_level="HIGH",
            anomaly_type="NETWORK_ISOLATION_TAMPERING",
            details=f"Identity {event.arn} attempted network boundary mutation: {event.event_name}",
        )

    # 4. Check for anomalous or blacklisted user-agent signatures
    suspicious_agents = ["sqlmap", "nikto", "hydra", "metasploit", "curl/"]
    if any(agent.lower() in event.user_agent.lower() for agent in suspicious_agents):
        return AnomalyResult(
            is_anomaly=True,
            risk_level="MEDIUM",
            anomaly_type="SUSPICIOUS_CLIENT_AGENT",
            details=f"Identity used suspicious user-agent signature: '{event.user_agent}'",
        )

    # Normal operational signature
    return AnomalyResult(
        is_anomaly=False,
        risk_level="NONE",
        anomaly_type=None,
        details="Standard operational signature within permissible baseline",
    )
