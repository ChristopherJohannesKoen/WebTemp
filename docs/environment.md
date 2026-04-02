# Environment Catalog

Copy `.env.example` to `.env` and adjust values as needed.

## Core App Variables

| Variable               | Purpose                                                | Default                     |
| ---------------------- | ------------------------------------------------------ | --------------------------- |
| `NODE_ENV`             | runtime mode                                           | `development`               |
| `APP_URL`              | public web origin used by CORS and password reset URLs | `http://localhost:3000`     |
| `API_ORIGIN`           | server-to-server origin for the Nest API               | `http://localhost:4000`     |
| `ALLOWED_ORIGINS`      | extra comma-separated web origins for LAN/prod access  | empty                       |
| `API_PORT`             | Nest listen port                                       | `4000`                      |
| `API_PREFIX`           | global API prefix                                      | `api`                       |
| `WEB_PORT`             | web container port                                     | `3000`                      |
| `SESSION_SECRET`       | secret reserved for future token/signing extensions    | required                    |
| `SESSION_COOKIE_NAME`  | session cookie key                                     | `ultimate_template_session` |
| `SESSION_ROTATION_MS`  | session token rotation window                          | `43200000`                  |
| `SESSION_MAX_ACTIVE`   | maximum concurrent sessions per user                   | `5`                         |
| `ARGON2_MEMORY_COST`   | password hashing memory cost                           | `19456`                     |
| `RATE_LIMIT_WINDOW_MS` | throttle window                                        | `60000`                     |
| `RATE_LIMIT_MAX`       | throttle ceiling per window                            | `120`                       |
| `IDEMPOTENCY_TTL_SECONDS` | replay window for protected POST requests          | `86400`                     |
| `EXPORT_SYNC_LIMIT`    | max synchronous CSV export size                        | `5000`                      |

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

## Feature Flags And Optional Extension Variables

The default runtime still needs only web, API, and Postgres. Feature flags make optional integrations explicit and fail fast when enabled without their required credentials.

| Variable                   | Purpose                                           | Default |
| -------------------------- | ------------------------------------------------- | ------- |
| `FEATURE_EMAIL`            | enable SMTP-backed email delivery                 | `false` |
| `FEATURE_STORAGE`          | enable object-storage-backed file flows           | `false` |
| `FEATURE_CACHE`            | enable cache/queue extensions that require Redis  | `false` |
| `FEATURE_OBSERVABILITY`    | enable OTLP exporter validation                   | `false` |

When a feature flag is enabled, the API validates these envs before boot:

- `FEATURE_EMAIL`: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
- `FEATURE_STORAGE`: `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- `FEATURE_CACHE`: `REDIS_URL`
- `FEATURE_OBSERVABILITY`: `OTEL_EXPORTER_OTLP_ENDPOINT`

## Security And Runtime Notes

- First-party clients fetch `GET /api/auth/csrf` and send `X-CSRF-Token` on authenticated unsafe requests.
- `Idempotency-Key` is required on `POST /api/auth/signup`, `POST /api/auth/password/reset`, and `POST /api/projects`.
- Use `ALLOWED_ORIGINS` when the site must be reached from a LAN IP or a second browser origin in development.
