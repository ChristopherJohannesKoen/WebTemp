# Operations Guide

## Metrics And Dashboards

- Scrape `GET /api/metrics` with Prometheus.
- Use the optional `prometheus` and `grafana` compose profiles for local or pre-production observability bring-up.
- The template ships starter dashboards and alert rules under `infra/observability`.
- Ownership events are exposed separately from generic security events so bootstrap conflicts and owner-floor violations are visible in metrics.

## Recommended SLO Baseline

- API availability: `99.9%` rolling 30 days
- Auth success rate for valid credentials: `99.9%`
- `GET /api/health` p95 latency: `< 250ms`
- `POST /api/auth/login` p95 latency: `< 500ms`
- `GET /api/auth/me` and `GET /api/auth/sessions` p95 latency: `< 300ms`
- `GET /api/projects` and `GET /api/projects/:id` p95 latency: `< 500ms`
- Protected write p95 latency: `< 1000ms`
- `DELETE /api/auth/sessions/:sessionId` and `POST /api/auth/logout-all` p95 latency: `< 700ms`
- `POST /api/projects` idempotent create/replay p95 latency: `< 900ms`

## Alert Recommendations

- sustained `5xx` rate above baseline
- elevated `auth.login_failure` or `security.origin_invalid` spikes
- growing `ultimate_template_idempotency_expired_backlog`
- any `ultimate_template_ownership_events_total{event="owner_floor_violation"}` or `role_conflict` spike above normal admin activity
- DB connection pressure or repeated session-expiry cleanup spikes
- `/api/metrics` scrape failures

## Incident Runbooks

### Login or Session Outage

- check `/api/health`
- inspect recent `http.request`, `auth.login_failure`, and `ultimate_template_session_events_total`
- verify DB connectivity and session table churn
- confirm cookie name, `APP_URL`, `API_ORIGIN`, `APP_ENV`, and allowed origins

### Password Reset Trouble

- confirm whether `EXPOSE_DEV_RESET_DETAILS` is intentionally enabled
- verify token creation succeeds and reset tokens are not expiring immediately
- if email delivery is enabled later, verify provider-specific logs separately

### Idempotency Contention

- inspect `ultimate_template_idempotency_events_total`
- check whether conflicts are from genuine duplicate submissions or client misuse
- inspect cleanup backlog and cleanup duration metrics to confirm expired rows are not accumulating

### Database Saturation

- review request latency histograms and session/idempotency counters
- confirm session touch throttling is working and requests are not rewriting on every hit
- confirm no code path instantiates `PrismaClient` outside `PrismaService`

## Performance Workflows

- `npm run test:perf:smoke` is the blocking smoke gate and should stay green in CI.
- Local deep perf runs should use `npm run perf:up` so the API starts with the perf overlay from `.env.perf.example` or `.env.perf`.
- The perf overlay intentionally raises `RATE_LIMIT_MAX` and `SESSION_MAX_ACTIVE` for load-validation runs; it does not relax origin, CSRF, or reset-detail security behavior.
- `.github/workflows/perf-profile.yml` is the deeper nightly/manual profile lane for:
  - auth/session churn
  - critical auth/session/project API paths
  - dashboard reads
  - idempotent project creation
  - password-reset bursts
- The profile workflow uploads:
  - k6 summary JSON files
  - API and web server logs
  - before/after Postgres activity snapshots from `scripts/export-db-activity.mjs`
