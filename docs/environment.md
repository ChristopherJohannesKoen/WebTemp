# Environment Catalog

Copy `.env.example` to `.env` and adjust values as needed.

## Core App Variables

| Variable               | Purpose                                                | Default                     |
| ---------------------- | ------------------------------------------------------ | --------------------------- |
| `NODE_ENV`             | runtime mode                                           | `development`               |
| `APP_URL`              | public web origin used by CORS and password reset URLs | `http://localhost:3000`     |
| `API_ORIGIN`           | server-to-server origin for the Nest API               | `http://localhost:4000`     |
| `API_PORT`             | Nest listen port                                       | `4000`                      |
| `API_PREFIX`           | global API prefix                                      | `api`                       |
| `WEB_PORT`             | web container port                                     | `3000`                      |
| `SESSION_SECRET`       | secret reserved for future token/signing extensions    | required                    |
| `SESSION_COOKIE_NAME`  | session cookie key                                     | `ultimate_template_session` |
| `ARGON2_MEMORY_COST`   | password hashing memory cost                           | `19456`                     |
| `RATE_LIMIT_WINDOW_MS` | throttle window                                        | `60000`                     |
| `RATE_LIMIT_MAX`       | throttle ceiling per window                            | `120`                       |

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

## Optional Extension Variables

These are documented now but unused by the default runtime:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `REDIS_URL`
- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
