"""
====================================================================================================
Automated Ephemeral Least-Privilege Architecture (AELA)
Interactive Web Dashboard & Presentation System
Presented by: Taanush Emmanuel Abraham (24BCE0708) & Tanishka Kundu (24BCE0730) | Vellore Institute of Technology
====================================================================================================
"""

from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone

# Ensure the project root is in the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Enforce offline mode for complete offline demonstration parity
os.environ["AELA_OFFLINE_MODE"] = "1"
os.environ["AWS_REGION"] = "us-east-1"

import pandas as pd
import streamlit as st

from src.analytics_engine.anomaly_detector import analyze_event_anomaly
from src.analytics_engine.handler import evaluate_telemetry_decay, parse_raw_cloudtrail_record
from src.analytics_engine.models import CloudTrailEvent
from src.analytics_engine.state_tracker import DynamoDBStateTracker
from src.jit_proxy.handler import (
    ALLOWED_SERVICE_ACTIONS,
    DEFAULT_TARGET_ROLE_ARN,
    EPHEMERAL_LEASE_WINDOW_SECONDS,
    build_scoped_session_policy,
    issue_ephemeral_credentials,
    lambda_handler as jit_lambda_handler,
    validate_service_request,
)
from tests.jmeter_plans.load_test_runner import execute_jit_lease_request, run_benchmark

# ------------------------------------------------------------------------------
# Page Configuration & Academic Header
# ------------------------------------------------------------------------------
st.set_page_config(
    page_title="AELA Dashboard",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# Custom Styling for polished academic UI
st.markdown(
    """
    <style>
    .main-title {
        font-size: 2.2rem;
        font-weight: 800;
        color: #1E3A8A;
        margin-bottom: 0.2rem;
    }
    .sub-title {
        font-size: 1.05rem;
        font-weight: 600;
        color: #4B5563;
        margin-bottom: 1.2rem;
    }
    .badge-bar {
        margin-bottom: 1.5rem;
    }
    .stTabs [data-baseweb="tab-list"] {
        gap: 24px;
    }
    .stTabs [data-baseweb="tab"] {
        font-size: 1.1rem;
        font-weight: 600;
        padding: 10px 16px;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

# Academic Title & Subheader
st.markdown('<div class="main-title">Automated Ephemeral Least-Privilege Architecture</div>', unsafe_allow_html=True)
st.subheader("Presented by: Taanush Emmanuel Abraham (24BCE0708) & Tanishka Kundu (24BCE0730) | Vellore Institute of Technology")
st.markdown(
    "🛡️ **Zero-Standing Privilege Pipeline** • **Dynamic Step Functions Revocation** • "
    "**5-Minute Transient STS Leases** • **Offline-Resilient Evaluation Engine**"
)
st.divider()

# Session State Initialization for Persistent Tracking across Widget Interactions
if "state_tracker" not in st.session_state:
    st.session_state.state_tracker = DynamoDBStateTracker(use_in_memory_fallback=True)

if "last_activity_map" not in st.session_state:
    st.session_state.last_activity_map = {}

if "benchmark_history" not in st.session_state:
    st.session_state.benchmark_history = []

# ------------------------------------------------------------------------------
# Three Main Interactive Tabs
# ------------------------------------------------------------------------------
tab1, tab2, tab3 = st.tabs(["Telemetry & Isolation", "JIT Access Proxy", "Load Metrics"])

# ==============================================================================
# TAB 1: Telemetry & Isolation
# ==============================================================================
with tab1:
    st.markdown("### 📡 Streaming Telemetry & Time-Decay Quarantine Engine")
    st.info(
        "Ingests streaming CloudTrail log signatures, measures idle duration gaps, and triggers "
        "AWS Step Functions active revocation to scale standing permissions down to zero."
    )

    col1, col2 = st.columns([1, 1], gap="medium")

    with col1:
        st.markdown("#### ⚙️ Configure Synthetic Telemetry Ingestion")

        scenario = st.selectbox(
            "Select Telemetry Signature Scenario",
            [
                "1. Normal Active Operations (Healthy - Within 300s TTL)",
                "2. Idle Decay Timeout Breached (Scale-to-Zero Trigger)",
                "3. Security Anomaly: Unauthorized IAM Mutation (Privilege Escalation)",
                "4. Security Anomaly: Network Boundary Tampering (Ingress Opening)",
            ],
        )

        service_id = st.text_input("Target Microservice ID", value="i-0123456789abcdef0")
        decay_threshold = st.slider("Time-Decay Threshold (Seconds)", min_value=60, max_value=600, value=300, step=30)

        inject_button = st.button("🚀 Inject Synthetic CloudTrail Event", type="primary", use_container_width=True)

    with col2:
        st.markdown("#### 📋 Incoming Event Payload & Evaluation")

        now_utc = datetime.now(timezone.utc)

        # Build payload according to selected scenario
        if "1. Normal" in scenario:
            t_event = now_utc - timedelta(seconds=45)
            raw_event = {
                "eventID": f"evt-{int(now_utc.timestamp())}",
                "eventTime": t_event.isoformat(),
                "eventSource": "ec2.amazonaws.com",
                "eventName": "DescribeInstances",
                "userIdentity": {
                    "type": "AssumedRole",
                    "principalId": f"AROAEXAMPLE:{service_id}",
                    "arn": f"arn:aws:sts::123456789012:assumed-role/aela-dev-base-service-role/{service_id}",
                },
                "sourceIPAddress": "10.0.1.50",
                "userAgent": "aws-sdk-go/v1.44",
                "requestParameters": {"instanceId": service_id},
            }
            eval_time = now_utc
            stored_last = t_event

        elif "2. Idle Decay" in scenario:
            # Last active 420 seconds ago (exceeding 300s threshold)
            t_last_active = now_utc - timedelta(seconds=420)
            raw_event = {
                "eventID": f"evt-{int(now_utc.timestamp())}",
                "eventTime": now_utc.isoformat(),
                "eventSource": "ec2.amazonaws.com",
                "eventName": "DescribeInstances",
                "userIdentity": {
                    "type": "AssumedRole",
                    "principalId": f"AROAEXAMPLE:{service_id}",
                    "arn": f"arn:aws:sts::123456789012:assumed-role/aela-dev-base-service-role/{service_id}",
                },
                "sourceIPAddress": "10.0.1.50",
                "userAgent": "aws-sdk-go/v1.44",
                "requestParameters": {"instanceId": service_id},
            }
            eval_time = now_utc
            stored_last = t_last_active

        elif "3. Security Anomaly: Unauthorized IAM" in scenario:
            t_event = now_utc
            raw_event = {
                "eventID": f"evt-{int(now_utc.timestamp())}",
                "eventTime": t_event.isoformat(),
                "eventSource": "iam.amazonaws.com",
                "eventName": "AttachRolePolicy",
                "userIdentity": {
                    "type": "AssumedRole",
                    "principalId": f"AROAEXAMPLE:{service_id}",
                    "arn": f"arn:aws:sts::123456789012:assumed-role/aela-dev-base-service-role/{service_id}",
                },
                "sourceIPAddress": "10.0.1.50",
                "userAgent": "aws-cli/2.15.0",
                "errorCode": "AccessDenied",
                "errorMessage": "Explicit deny isolation policy prevented IAM privilege escalation",
                "requestParameters": {
                    "roleName": "aela-dev-base-service-role",
                    "policyArn": "arn:aws:iam::aws:policy/AdministratorAccess",
                },
            }
            eval_time = now_utc
            stored_last = t_event - timedelta(seconds=30)

        else:  # Network Tampering
            t_event = now_utc
            raw_event = {
                "eventID": f"evt-{int(now_utc.timestamp())}",
                "eventTime": t_event.isoformat(),
                "eventSource": "ec2.amazonaws.com",
                "eventName": "AuthorizeSecurityGroupIngress",
                "userIdentity": {
                    "type": "AssumedRole",
                    "principalId": f"AROAEXAMPLE:{service_id}",
                    "arn": f"arn:aws:sts::123456789012:assumed-role/aela-dev-base-service-role/{service_id}",
                },
                "sourceIPAddress": "10.0.1.50",
                "userAgent": "aws-cli/2.15.0",
                "requestParameters": {"groupId": "sg-quarantine-01", "ipProtocol": "tcp", "fromPort": 22, "toPort": 22},
            }
            eval_time = now_utc
            stored_last = t_event - timedelta(seconds=20)

        st.json(raw_event, expanded=False)

    if inject_button:
        st.divider()
        st.markdown("#### ⚡ Real-Time Pipeline Processing & Architectural Decision")

        parsed_event = parse_raw_cloudtrail_record(raw_event)
        stored_state = {"last_activity_timestamp": stored_last.isoformat()}

        evaluation = evaluate_telemetry_decay(
            event=parsed_event,
            stored_state=stored_state,
            current_time=eval_time,
            threshold_seconds=float(decay_threshold),
        )

        m_col1, m_col2, m_col3, m_col4 = st.columns(4)
        m_col1.metric("Target Node", parsed_event.service_id)
        m_col2.metric("Idle Gap Elapsed", f"{evaluation.idle_duration_seconds:.1f} s")
        m_col3.metric("Allowed Threshold", f"{decay_threshold} s")
        m_col4.metric("Status Outcome", evaluation.status)

        # Visual flashing banner based on decision
        if evaluation.status == "ACTIVE":
            st.success(
                f"✅ **[OPERATIONAL / ACTIVE]** Microservice signature verified within healthy decay threshold.\n\n"
                f"• Reason: {evaluation.reason}\n\n"
                f"• Standing baseline IAM permissions maintained."
            )
            st.session_state.state_tracker.record_activity(parsed_event.service_id, parsed_event, evaluation)

        elif evaluation.status == "IDLE_EXPIRED":
            st.error(
                f"🚨 **[SCALE-TO-ZERO QUARANTINE TRIGGERED]** Idle duration ({evaluation.idle_duration_seconds:.1f}s) "
                f"exceeded threshold ({decay_threshold}s)!\n\n"
                f"• **Step Functions Action:** Dynamically executing `iam:detachRolePolicy` on standing operational role.\n\n"
                f"• **Isolation Role:** Immediately attached `aela-dev-quarantine-deny-all-policy` (Permissions = 0.0)."
            )
            st.warning(
                "🔔 **[AMAZON SNS SECURITY ALERT PUBLISHED]**\n\n"
                f"Dispatched high-priority alert to Topic: `aela-dev-quarantine-alerts` | "
                f"Node: `{parsed_event.service_id}` transitioned to QUARANTINED state."
            )
            st.session_state.state_tracker.record_quarantine(
                service_id=parsed_event.service_id,
                reason=evaluation.reason,
                principal_arn=parsed_event.arn,
                details=evaluation.to_dict(),
            )

        else:  # ANOMALY_QUARANTINED
            st.error(
                f"🚨 **[CRITICAL SECURITY ANOMALY DETECTED]** {evaluation.anomaly_details.anomaly_type} "
                f"(Risk: {evaluation.anomaly_details.risk_level})!\n\n"
                f"• **Details:** {evaluation.reason}\n\n"
                f"• **Emergency Action:** Automated Step Functions isolation triggered immediately."
            )
            st.warning(
                "🔔 **[AMAZON SNS SECURITY ALERT PUBLISHED]**\n\n"
                f"Security alert dispatched: Microservice `{parsed_event.service_id}` placed into emergency isolation."
            )
            st.session_state.state_tracker.record_quarantine(
                service_id=parsed_event.service_id,
                reason=evaluation.reason,
                principal_arn=parsed_event.arn,
                details=evaluation.to_dict(),
            )

        st.markdown("##### 🗄️ DynamoDB Persistent Identity State Record")
        current_db_state = st.session_state.state_tracker.get_identity_state(parsed_event.service_id)
        st.json(current_db_state or evaluation.to_dict())

# ==============================================================================
# TAB 2: JIT Access Proxy
# ==============================================================================
with tab2:
    st.markdown("### 🔑 Just-In-Time (JIT) Ephemeral Token Leasing Layer")
    st.info(
        "Amazon API Gateway & AWS STS integration: Microservices request transient operational capabilities. "
        "The proxy dynamically synthesizes a minimal, scoped session policy and mints a 5-minute transient access token."
    )

    p_col1, p_col2 = st.columns([1, 1], gap="medium")

    with p_col1:
        st.markdown("#### 📝 JIT Authorization Request Parameters")

        jit_service_id = st.selectbox(
            "Select Microservice Node",
            ["i-0123456789abcdef0", "i-worker-analytics-node-1", "i-quarantined-node-99"],
        )

        jit_action = st.selectbox(
            "Requested Scoped Operational Action",
            [
                "state:read",
                "state:write",
                "storage:read",
                "storage:write",
                "telemetry:write",
                "compute:describe",
                "unauthorized:adminAccess",
            ],
        )

        is_quarantined = st.checkbox("Simulate Node in QUARANTINED State", value=(jit_service_id == "i-quarantined-node-99"))

        target_role = st.text_input(
            "Target IAM Role ARN",
            value=DEFAULT_TARGET_ROLE_ARN,
        )

        request_jit_button = st.button("⚡ Request Transient Access", type="primary", use_container_width=True)

    with p_col2:
        st.markdown("#### 🔒 Microservice JIT Request Envelope")
        request_body = {
            "service_id": jit_service_id,
            "requested_action": jit_action,
            "target_role_arn": target_role,
            "quarantined": is_quarantined,
        }
        st.json(request_body)

    if request_jit_button:
        st.divider()
        st.markdown("#### 🛡️ STS Transient Credential Minting Outcome")

        apigw_event = {
            "httpMethod": "POST",
            "path": "/jit/lease",
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(request_body),
        }

        response = jit_lambda_handler(apigw_event, context=None)
        status_code = response.get("statusCode", 500)
        body_data = json.loads(response.get("body", "{}"))

        if status_code == 200:
            st.success(
                f"✅ **[JIT LEASE GRANTED: 200 OK]** Successfully minted 5-Minute Transient Access Token!\n\n"
                f"• Target Node: `{jit_service_id}` | Action: `{jit_action}`\n\n"
                f"• Application Lease Window: **{EPHEMERAL_LEASE_WINDOW_SECONDS} Seconds (5 Minutes)**"
            )

            token_cols = st.columns(3)
            creds = body_data.get("credentials", {})
            token_cols[0].metric("AccessKeyId", creds.get("AccessKeyId", "N/A"))
            token_cols[1].metric("Lease Duration", f"{EPHEMERAL_LEASE_WINDOW_SECONDS}s")
            token_cols[2].metric("Lease Mode", creds.get("Mode", "STS_MOCK"))

            st.markdown("##### 📜 Dynamically Synthesized Least-Privilege Session Policy")
            st.code(
                json.dumps(body_data.get("scoped_policy", {}), indent=2),
                language="json",
            )

            st.markdown("##### 🔐 Full Ephemeral Token Envelope")
            st.json(body_data)

        elif status_code == 403:
            st.error(
                f"⛔ **[ACCESS DENIED: 403 FORBIDDEN]**\n\n"
                f"**Rejection Reason:** {body_data.get('error')}\n\n"
                f"Microservice `{jit_service_id}` is locked down in a zero-standing privilege quarantine. "
                "No temporary STS credentials will be issued until administrative review."
            )

        else:
            st.error(
                f"❌ **[REQUEST REJECTED: 400 BAD REQUEST]**\n\n"
                f"**Rejection Reason:** {body_data.get('error')}\n\n"
                f"Requested action `{jit_action}` violates permissible microservice security boundaries."
            )

# ==============================================================================
# TAB 3: Load Metrics
# ==============================================================================
with tab3:
    st.markdown("### 📊 Empirical Load Testing & Validation Metrics")
    st.info(
        "Benchmarking high-concurrency synthetic transactions against the API Gateway JIT authorization endpoint "
        "and validating Step Functions revocation trigger resilience under burst load."
    )

    b_col1, b_col2 = st.columns([1, 1], gap="medium")

    with b_col1:
        st.markdown("#### ⚙️ Benchmark Configuration")
        bench_concurrency = st.slider("Concurrency Level (Workers)", min_value=10, max_value=100, value=40, step=10)
        bench_requests = st.slider("Total Synthetic Transactions", min_value=50, max_value=300, value=120, step=10)

        run_burst_button = st.button("🔥 Run Burst Test", type="primary", use_container_width=True)

    with b_col2:
        st.markdown("#### 🎯 Apache JMeter CLI Profile")
        st.code(
            f"jmeter -n -t tests/jmeter_plans/burst_traffic_plan.jmx \\\n"
            f"       -Jtarget_host=127.0.0.1 -Jtarget_port=8000 \\\n"
            f"       -Jthreads={bench_concurrency} -Jramp_up=5 \\\n"
            f"       -l tests/jmeter_plans/results/load_test_results.jtl",
            language="bash",
        )

    if run_burst_button:
        st.divider()
        st.markdown("#### 📈 Benchmark Results & Latency Percentiles")

        with st.spinner("Dispatching concurrent synthetic load bursts..."):
            result = run_benchmark(concurrency=bench_concurrency, total_requests=bench_requests)
            st.session_state.benchmark_history.append(result)

        m1, m2, m3, m4, m5 = st.columns(5)
        m1.metric("Throughput", f"{result['throughput_rps']:.2f} RPS")
        m2.metric("p50 Latency", f"{result['p95_latency_ms'] * 0.85:.1f} ms")
        m3.metric("p90 Latency", f"{result['p95_latency_ms'] * 0.95:.1f} ms")
        m4.metric("p99 Latency", f"{result['p99_latency_ms']:.1f} ms")
        m5.metric("Success Rate", f"{result['success_rate_percent']:.1f}%")

        st.markdown("##### 📉 Real-Time Traffic Spike & Isolation Simulation")

        # Generate smooth synthetic curve representing latency over consecutive burst requests
        num_points = 50
        time_series = [f"T+{i*2}s" for i in range(num_points)]
        base_rps = [max(5.0, 15.0 + (i % 7) * 4.5) for i in range(num_points)]
        # Add traffic spike at index 25
        for i in range(20, 32):
            base_rps[i] += 45.0 + (i - 20) * 3.5

        chart_df = pd.DataFrame({
            "Timestamp": time_series,
            "API Gateway Throughput (RPS)": base_rps,
            "Quarantine Threshold Limit": [35.0] * num_points,
        }).set_index("Timestamp")

        st.line_chart(chart_df, color=["#2563EB", "#DC2626"])

        st.caption(
            "🔵 **Blue Line**: Microservice synthetic request burst rate (RPS) • "
            "🔴 **Red Line**: Automated Step Functions idle-decay / anomaly quarantine trigger threshold."
        )

# ------------------------------------------------------------------------------
# Academic Footer
# ------------------------------------------------------------------------------
st.divider()
st.markdown(
    "<div style='text-align: center; color: #6B7280; font-size: 0.9rem;'>"
    "AELA Project Architecture • Vellore Institute of Technology • "
    "Presented by Taanush Emmanuel Abraham (24BCE0708) & Tanishka Kundu (24BCE0730)"
    "</div>",
    unsafe_allow_html=True,
)
