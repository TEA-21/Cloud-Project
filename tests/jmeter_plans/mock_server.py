"""
AELA Phase 4 - Local Mock API Gateway & Step Functions Server
Provides local HTTP endpoints for Apache JMeter load testing and offline demonstrations:
- POST /jit/lease: Dispatches to JIT Proxy Lambda handler
- POST /quarantine/trigger: Dispatches to Step Functions active revocation simulation
- GET /health: Health check endpoint
"""

from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict

# Ensure project root is on sys.path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.jit_proxy.handler import lambda_handler as jit_lambda_handler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("aela.mock_server")


class AELAMockHTTPRequestHandler(BaseHTTPRequestHandler):
    """Handles HTTP requests from JMeter or test runners for local benchmarking."""

    def do_GET(self):
        if self.path == "/health":
            self._send_json_response(200, {
                "status": "UP",
                "service": "AELA-Local-Mock-Engine",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
        else:
            self._send_json_response(404, {"error": f"Path '{self.path}' not found"})

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b"{}"

        try:
            body_dict = json.loads(post_data.decode("utf-8"))
        except Exception:
            body_dict = {}

        if self.path == "/jit/lease":
            self._handle_jit_lease(body_dict)
        elif self.path == "/quarantine/trigger":
            self._handle_quarantine_trigger(body_dict)
        else:
            self._send_json_response(404, {"error": f"Endpoint '{self.path}' not supported"})

    def _handle_jit_lease(self, body: Dict[str, Any]):
        """Delegates to the JIT proxy Lambda handler."""
        apigw_event = {
            "httpMethod": "POST",
            "path": "/jit/lease",
            "headers": dict(self.headers),
            "body": json.dumps(body),
        }
        response = jit_lambda_handler(apigw_event, context=None)
        status_code = response.get("statusCode", 200)
        body_obj = json.loads(response.get("body", "{}"))
        self._send_json_response(status_code, body_obj)

    def _handle_quarantine_trigger(self, body: Dict[str, Any]):
        """Simulates the Step Functions Active Revocation Loop execution."""
        service_id = body.get("service_id", "UNKNOWN")
        role_name = body.get("role_name", "aela-dev-base-service-role")
        target_policy_arn = body.get("target_policy_arn", "arn:aws:iam::123:policy/base")
        deny_policy_arn = body.get("deny_policy_arn", "arn:aws:iam::123:policy/deny")
        reason = body.get("reason", "Idle decay threshold exceeded")

        if not service_id or not role_name:
            self._send_json_response(400, {
                "status": "FAILED",
                "error": "Missing required fields: service_id or role_name",
            })
            return

        # Simulate Step Functions execution latency & role swap
        result = {
            "status": "SUCCESS",
            "execution_arn": f"arn:aws:states:us-east-1:123456789012:execution:aela-dev-revocation-workflow:exec-{service_id}",
            "service_id": service_id,
            "role_name": role_name,
            "action": "QUARANTINE_ATTACHED",
            "detached_policy": target_policy_arn,
            "attached_deny_policy": deny_policy_arn,
            "sns_alert_published": True,
            "quarantine_reason": reason,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        self._send_json_response(200, result)

    def _send_json_response(self, status_code: int, data: Dict[str, Any]):
        response_bytes = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(response_bytes)

    def log_message(self, format, *args):
        # Override default noisy stderr logging during load bursts
        pass


def run_server(host: str = "127.0.0.1", port: int = 8000):
    server_address = (host, port)
    httpd = HTTPServer(server_address, AELAMockHTTPRequestHandler)
    logger.info(f"[AELA LOCAL MOCK SERVER] Running on http://{host}:{port}")
    logger.info("Endpoints ready: POST /jit/lease, POST /quarantine/trigger, GET /health")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("\n[AELA LOCAL MOCK SERVER] Shutting down.")
        httpd.server_close()


if __name__ == "__main__":
    host = os.environ.get("MOCK_HOST", "127.0.0.1")
    port = int(os.environ.get("MOCK_PORT", "8000"))
    run_server(host, port)
