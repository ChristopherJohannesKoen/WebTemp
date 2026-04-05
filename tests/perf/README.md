# Performance Scenarios

These `k6` scripts validate the runtime characteristics that matter most for this template:

- session churn and repeated authenticated reads
- protected dashboard page reads
- idempotent project creation replay behavior
- forgot-password burst handling

## Local usage

Start the perf-tuned stack first, then run any scenario from the repo root:

```bash
npm run perf:up
npm run test:perf:smoke
npm run test:perf:auth
npm run test:perf:critical
npm run test:perf:read
npm run test:perf:idempotency
npm run test:perf:reset
```

Stop the local perf stack with:

```bash
npm run perf:down
```

## Defaults

- API origin: `http://localhost:4000`
- App origin: `http://localhost:3000`
- Seeded owner: `owner@example.com` / `ChangeMe123!`

The perf commands layer `.env.perf.example` and optional `.env.perf` on top of your normal env files. The default perf profile raises `RATE_LIMIT_MAX` and `SESSION_MAX_ACTIVE` so the deeper scenarios exercise application behavior instead of tripping the normal local security limits.

Override values with `.env.perf`, or by setting `APP_URL`, `API_ORIGIN`, `SESSION_COOKIE_NAME`, `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD`, and `PERF_USER_PASSWORD`.

Stateful scenarios bootstrap deterministic per-VU member accounts such as `k6+critical-api-vu1@example.com` so `logout-all`, session revocation, and session-cap behavior do not cause cross-VU interference.

## Acceptance thresholds

- smoke scenario: `http_req_failed < 1%` and p95 `< 750ms`
- critical auth/session/project API scenario:
  - `POST /api/auth/login` p95 `< 500ms`
  - `GET /api/auth/me` p95 `< 300ms`
  - `GET /api/auth/sessions` p95 `< 300ms`
  - `DELETE /api/auth/sessions/:sessionId` p95 `< 700ms`
  - `POST /api/auth/logout-all` p95 `< 700ms`
  - `GET /api/projects` p95 `< 500ms`
  - `GET /api/projects/:id` p95 `< 500ms`
- dashboard read scenario: p95 `< 900ms`
- idempotent write scenario: `POST /api/projects` p95 `< 900ms` with replayed request returning the original project id
- password-reset burst: `http_req_failed < 2%` and p95 `< 800ms`
- auth/session churn:
  - repeated reads inside the touch window should keep `session_touch_ratio_ok > 0.99`
  - active secondary sessions should be revoked immediately after `logout-all`

## CI vs deeper profiling

- `npm run test:perf:smoke` is the blocking CI perf gate.
- `.github/workflows/perf-profile.yml` runs the deeper nightly/manual profile set and uploads k6 summaries plus before/after Postgres activity snapshots.
