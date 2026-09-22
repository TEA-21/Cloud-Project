# Technical Roadmap: Full Frontend-Backend Live Integration

## 1. Executive Summary & Objective
Transform the AELA (Autonomous Ephemeral Lease Architecture) dashboard from an isolated client-side mock demo into a fully integrated full-stack security console. The frontend React application will communicate in real time with the local Python mock server / JIT proxy engine on port `8000`, dispatching live HTTP requests for JIT credential lease minting (`POST /jit/lease`), autonomic quarantine revocations (`POST /quarantine/trigger`), and continuous engine health monitoring (`GET /health`).

---

## 2. Execution Phases & Technical Specifications

### Phase 1: Network & Proxy Configuration
**Objective**: Enable seamless client-to-backend communication without cross-origin port hardcoding, ensuring browser requests to `/api/*` are reliably forwarded to the backend server.

- **Target File**: [`frontend/vite.config.js`](file:///d:/Projects/Cloud%20Architecture%20Project/frontend/vite.config.js)
- **Modifications**:
  1. Add a `server.proxy` block routing `/api` prefix requests to `http://127.0.0.1:8000`.
  2. Implement URL path rewriting stripping the `/api` prefix so backend endpoints receive `/health`, `/jit/lease`, and `/quarantine/trigger` cleanly.
  3. Ensure `changeOrigin: true` and `secure: false` are configured for local development.

```javascript
// frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: false
      }
    }
  }
});
```

---

### Phase 2: Backend CORS & Preflight Resolution
**Objective**: Ensure the backend Python HTTP server natively supports standard browser CORS preflight negotiations (`OPTIONS` requests), enabling reliable `fetch()` calls with `Content-Type: application/json` without rejection.

- **Target File**: [`tests/jmeter_plans/mock_server.py`](file:///d:/Projects/Cloud%20Architecture%20Project/tests/jmeter_plans/mock_server.py)
- **Modifications**:
  1. Implement `do_OPTIONS(self)` in `AELAMockHTTPRequestHandler` to intercept preflight requests.
  2. Return HTTP `204 No Content` with appropriate headers:
     - `Access-Control-Allow-Origin: *`
     - `Access-Control-Allow-Methods: GET, POST, OPTIONS`
     - `Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With`
     - `Access-Control-Max-Age: 86400`
  3. Update `_send_json_response(self, status_code, data)` to attach the same permissive access headers to every GET/POST response.

```python
# In tests/jmeter_plans/mock_server.py -> AELAMockHTTPRequestHandler

def do_OPTIONS(self):
    """Handles browser CORS preflight requests."""
    self.send_response(204)
    self.send_header("Access-Control-Allow-Origin", "*")
    self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
    self.send_header("Access-Control-Max-Age", "86400")
    self.end_headers()

def _send_json_response(self, status_code: int, data: Dict[str, Any]):
    response_bytes = json.dumps(data).encode("utf-8")
    self.send_response(status_code)
    self.send_header("Content-Type", "application/json")
    self.send_header("Content-Length", str(len(response_bytes)))
    self.send_header("Access-Control-Allow-Origin", "*")
    self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
    self.end_headers()
    self.wfile.write(response_bytes)
```

---

### Phase 3: State Management Migration & Live API Integration
**Objective**: Refactor [`frontend/src/context/SecurityContext.jsx`](file:///d:/Projects/Cloud%20Architecture%20Project/frontend/src/context/SecurityContext.jsx) from purely local in-memory simulation to an active orchestration layer dispatching real HTTP network payloads.

- **Target File**: [`frontend/src/context/SecurityContext.jsx`](file:///d:/Projects/Cloud%20Architecture%20Project/frontend/src/context/SecurityContext.jsx)
- **Detailed Refactor Items**:

#### 1. Engine Health Polling
- Implement periodic polling of `GET /api/health` every 10 seconds.
- Map backend response `{"status": "UP", "service": "AELA-Local-Mock-Engine"}` to `streamHealth` (`Operational` vs `Degraded` / `Disconnected`).

#### 2. Live JIT Lease Minting (`requestJitLease`)
- Add an asynchronous `requestJitLease` method to context.
- **Request Endpoint**: `POST /api/jit/lease`
- **Request Payload**:
  ```json
  {
    "service_id": "srv-prod-ingress-worker-02",
    "requested_action": "state:read",
    "target_role_arn": "arn:aws:iam::123456789012:role/aela-dev-base-service-role",
    "resource_arn": "arn:aws:dynamodb:us-east-1:123456789012:table/AppLedger"
  }
  ```
- **Backend Response Handling**:
  Parse returned 300s STS credentials (`AccessKeyId`, `SecretAccessKey`, `SessionToken`, `scoped_policy`), instantiate a new session item, prepend to `sessions`, and display a success notification toast with granted lease details.

#### 3. Live Emergency Revocation & Quarantine (`revokeSessionNow`)
- Refactor `revokeSessionNow(sessionId, reason)` to invoke the live Step Functions revocation simulator.
- **Request Endpoint**: `POST /api/quarantine/trigger`
- **Request Payload**:
  ```json
  {
    "service_id": "srv-prod-ingress-worker-02",
    "role_name": "aela-dev-base-service-role",
    "target_policy_arn": "arn:aws:iam::123:policy/base",
    "deny_policy_arn": "arn:aws:iam::123:policy/deny",
    "reason": "Operator manual revocation"
  }
  ```
- **Backend Response Handling**:
  Extract the live `execution_arn` (e.g., `arn:aws:states:us-east-1:123456789012:execution:aela-dev-revocation-workflow:exec-...`), update session status to `REVOKED` (TTL set to `0`), and append a verified enforcement record to `revocationLogs` displaying the real Step Functions ARN.

#### 4. UI Trigger Integration in Access Leases
- **Target File**: [`frontend/src/pages/AccessLeasesPage.jsx`](file:///d:/Projects/Cloud%20Architecture%20Project/frontend/src/pages/AccessLeasesPage.jsx)
- Connect a "Request New JIT Lease" action button opening a modal with action selector (`telemetry:write`, `state:read`, `state:write`, `storage:read`), dispatching `requestJitLease` to mint credentials via the backend.

---

### Phase 4: Automated UI Verification & Integration Pipeline
**Objective**: End-to-end automated verification using Chrome browser automation and network traffic auditing to certify complete live integration.

- **Sequence of Actions**:
  1. **Git Synchronization**: Verify git status and branch consistency.
  2. **Service Spin-Up**:
     - Restart backend mock server (`python tests/jmeter_plans/mock_server.py`) on port `8000`.
     - Restart Vite dev server (`npm run dev`) on port `3000` with the new proxy configuration.
     - Validate local health check: `curl http://localhost:3000/api/health` returns `200 OK`.
  3. **Automated Chrome Walkthrough**:
     - Open Chrome session to `http://localhost:3000`.
     - Verify `StreamHealth` indicator displays live `Operational` status sourced from `GET /api/health`.
     - Navigate to `Access Leases`, trigger a new JIT lease request, and verify network traffic logs `POST /api/jit/lease` with `200 OK`.
     - Inspect the newly minted lease row and verify the returned STS credentials inside `LeaseDetailDrawer`.
     - Trigger emergency revocation via `ConfirmActionDialog`, verifying network traffic logs `POST /api/quarantine/trigger` with `200 OK`.
     - Confirm that the UI updates the lease to `REVOKED` and displays the real Step Functions `execution_arn` in the enforcement timeline.
  4. **DevTools Network & Console Audit**:
     - Confirm 0 CORS errors.
     - Confirm 0 unhandled promise rejections.
     - Confirm all `/api/*` endpoints return HTTP `2xx`.
     - Confirm zero remaining silent fallbacks to static fixtures for active lease operations.

---

## 3. Implementation Verification Checklist

- [ ] `frontend/vite.config.js` proxy configured and verified with `/api/health`.
- [ ] `tests/jmeter_plans/mock_server.py` implements `do_OPTIONS` returning 204 No Content with CORS headers.
- [ ] `frontend/src/context/SecurityContext.jsx` refactored with live `fetch()` calls for `requestJitLease`, `revokeSessionNow`, and health monitoring.
- [ ] `frontend/src/pages/AccessLeasesPage.jsx` provides UI trigger for requesting new JIT leases.
- [ ] Chrome automation validates full live cycle: Lease Minting -> Active Countdown -> Live Step Functions Revocation.
- [ ] Final verification report delivered with DevTools network trace and updated `PROGRESS.md`.
