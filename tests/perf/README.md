# Performance Scenarios

These `k6` scripts validate the runtime characteristics that matter most for this template:

- session churn and repeated authenticated reads
- protected dashboard page reads
- idempotent project creation replay behavior
- forgot-password burst handling

## Local usage

Start the stack first, then run any scenario from the repo root:

```bash
k6 run tests/perf/smoke.js
k6 run tests/perf/auth-session-churn.js
k6 run tests/perf/dashboard-read.js
k6 run tests/perf/project-create-idempotent.js
k6 run tests/perf/password-reset-burst.js
```

## Defaults

- API origin: `http://127.0.0.1:4000`
- App origin: `http://127.0.0.1:3000`
- Seeded owner: `owner@example.com` / `ChangeMe123!`

Override them with `APP_URL`, `API_ORIGIN`, `SESSION_COOKIE_NAME`, `SEED_OWNER_EMAIL`, and `SEED_OWNER_PASSWORD` when needed.

## Acceptance thresholds

- smoke scenario: `http_req_failed < 1%` and p95 `< 750ms`
- dashboard read scenario: p95 `< 900ms`
- idempotent write scenario: p95 `< 1200ms` with replayed request returning the original project id
- password-reset burst: `http_req_failed < 2%` and p95 `< 800ms`
- auth/session churn: no request-path cleanup hotspot and no abnormal session rewrite churn inside the configured touch window
