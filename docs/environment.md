# Environment Catalog

Copy `.env.example` to `.env` and adjust values as needed.

For local performance validation, layer `.env.perf.example` or an untracked `.env.perf` on top of the normal env files. The perf overlay is intended for K6-driven load runs and increases rate/session ceilings without changing the strict origin, CSRF, or reset-detail rules.

## Core App Variables

| Variable                          | Purpose                                                                       | Default                     |
| --------------------------------- | ----------------------------------------------------------------------------- | --------------------------- |
| `NODE_ENV`                        | runtime mode                                                                  | `development`               |
| `APP_ENV`                         | deployment-security mode: `local`, `test`, `staging`, or `production`         | derived from `NODE_ENV`     |
| `APP_URL`                         | public web origin used by CORS and password reset URLs                        | `http://localhost:3000`     |
| `API_ORIGIN`                      | server-to-server origin for the Nest API                                      | `http://localhost:4000`     |
| `ALLOWED_ORIGINS`                 | extra comma-separated web origins for LAN/prod access                         | empty                       |
| `ALLOW_MISSING_ORIGIN_FOR_DEV`    | explicit local-dev escape hatch for missing `Origin`/`Referer`                | `false`                     |
| `API_PORT`                        | Nest listen port                                                              | `4000`                      |
| `API_PREFIX`                      | global API prefix                                                             | `api`                       |
| `WEB_PORT`                        | web container port                                                            | `3000`                      |
| `CSP_REPORT_ONLY`                 | emit an additional strict report-only CSP header for rollout/debug validation | `false`                     |
| `CSP_REPORT_URI`                  | optional CSP reporting target used with report-only mode                      | empty                       |
| `SESSION_COOKIE_NAME`             | session cookie key                                                            | `ultimate_template_session` |
| `SESSION_ROTATION_MS`             | session token rotation window                                                 | `43200000`                  |
| `SESSION_TOUCH_INTERVAL_MS`       | interval before authenticated requests touch session freshness                | `600000`                    |
| `SESSION_MAX_ACTIVE`              | maximum concurrent sessions per user                                          | `5`                         |
| `ARGON2_MEMORY_COST`              | password hashing memory cost                                                  | `19456`                     |
| `RATE_LIMIT_WINDOW_MS`            | throttle window                                                               | `60000`                     |
| `RATE_LIMIT_MAX`                  | throttle ceiling per window                                                   | `120`                       |
| `IDEMPOTENCY_TTL_SECONDS`         | replay window for protected POST requests                                     | `86400`                     |
| `IDEMPOTENCY_CLEANUP_INTERVAL_MS` | interval between scheduled expired-request cleanup runs                       | `900000`                    |
| `IDEMPOTENCY_CLEANUP_BATCH_SIZE`  | max expired idempotency rows deleted per cleanup run                          | `500`                       |
| `EXPORT_SYNC_LIMIT`               | max synchronous CSV export size                                               | `5000`                      |
| `EXPOSE_DEV_RESET_DETAILS`        | return password reset token/url in local non-prod workflows                   | `false`                     |

## Database Variables

| Variable            | Purpose                  | Default                                                                         |
| ------------------- | ------------------------ | ------------------------------------------------------------------------------- |
| `POSTGRES_USER`     | Postgres username        | `postgres`                                                                      |
| `POSTGRES_PASSWORD` | Postgres password        | `postgres`                                                                      |
| `POSTGRES_DB`       | Postgres database name   | `ultimate_template`                                                             |
| `DATABASE_URL`      | Prisma connection string | `postgresql://postgres:postgres@localhost:5432/ultimate_template?schema=public` |

## Seed Variables

| Variable              | Purpose                       | Default             |
| --------------------- | ----------------------------- | ------------------- |
| `SEED_OWNER_EMAIL`    | seeded owner account email    | `owner@example.com` |
| `SEED_OWNER_PASSWORD` | seeded owner account password | `ChangeMe123!`      |

The template's initial owner is provisioned through seeding and setup flows. Public signup always creates a `member`.

Bootstrap ownership is stored in a singleton `BootstrapState` row. Once established, rerunning seed data with a different `SEED_OWNER_EMAIL` fails loudly instead of silently rebinding the template owner.

## Feature Flags And Optional Extension Variables

The default runtime still needs only web, API, and Postgres. Feature flags make optional integrations explicit and fail fast when enabled without their required credentials.

| Variable                | Purpose                                          | Default |
| ----------------------- | ------------------------------------------------ | ------- |
| `FEATURE_EMAIL`         | enable SMTP-backed email delivery                | `false` |
| `FEATURE_STORAGE`       | enable object-storage-backed file flows          | `false` |
| `FEATURE_CACHE`         | enable cache/queue extensions that require Redis | `false` |
| `FEATURE_OBSERVABILITY` | enable OTLP exporter validation                  | `false` |

When a feature flag is enabled, the API validates these envs before boot:

- `FEATURE_EMAIL`: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
- `FEATURE_STORAGE`: `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- `FEATURE_CACHE`: `REDIS_URL`
- `FEATURE_OBSERVABILITY`: `OTEL_EXPORTER_OTLP_ENDPOINT`

## Security And Runtime Notes

- First-party clients fetch `GET /api/auth/csrf` and send `X-CSRF-Token` on authenticated unsafe requests.
- Missing `Origin` or `Referer` is rejected by default outside `APP_ENV=test`. Set `ALLOW_MISSING_ORIGIN_FOR_DEV=true` only for explicit `APP_ENV=local` edge cases.
- `Idempotency-Key` is required on `POST /api/auth/signup`, `POST /api/auth/password/reset`, and `POST /api/projects`.
- Expired idempotency records are cleaned up off the request path on a bounded schedule controlled by `IDEMPOTENCY_CLEANUP_INTERVAL_MS` and `IDEMPOTENCY_CLEANUP_BATCH_SIZE`.
- Session freshness writes are throttled by `SESSION_TOUCH_INTERVAL_MS`; authenticated requests do not rewrite `lastUsedAt` on every hit.
- Session tokens are opaque random values hashed server-side; the core template does not require a signing secret.
- Password reset details are never exposed by default. Set `EXPOSE_DEV_RESET_DETAILS=true` only for explicit `APP_ENV=local` or `APP_ENV=test` workflows.
- `GET /api/projects/export.csv` streams the full filtered result or returns a structured `400` with `export_limit_exceeded`.
- `GET /api/metrics` exposes Prometheus text metrics. OTLP tracing remains optional behind `FEATURE_OBSERVABILITY`.
- Use `ALLOWED_ORIGINS` when the site must be reached from a LAN IP or a second browser origin in development.
- Set `CSP_REPORT_ONLY=true` when you want the web app to emit an additional strict nonce-based `Content-Security-Policy-Report-Only` header for rollout/debug validation while the production enforced header stays strict by default.
- `ALLOW_MISSING_ORIGIN_FOR_DEV=true` is invalid in `APP_ENV=staging` or `APP_ENV=production`.
- `EXPOSE_DEV_RESET_DETAILS=true` is invalid in `APP_ENV=staging` or `APP_ENV=production`.
- `.env.perf.example` raises `RATE_LIMIT_MAX` and `SESSION_MAX_ACTIVE` so local perf scenarios do not measure rate-limit rejection or session-cap interference instead of the critical paths themselves.
