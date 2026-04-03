# Deployment Runbook

## Container Flow

- `apps/api/Dockerfile` builds the Nest application and Prisma client.
- `apps/web/Dockerfile` builds the Next standalone server.
- `docker-compose.yml` is the primary local orchestration file.
- `infra/compose/docker-compose.extensions.yml` holds optional profile-based services.

## Production Checklist

1. Set production `APP_URL`, `API_ORIGIN`, `DATABASE_URL`, `SESSION_COOKIE_NAME`, and the origin policy envs.
2. Run `npm run prisma:migrate:deploy`.
3. Run `npm run seed` only for bootstrap environments where the initial owner must be provisioned.
4. Build and publish `api` and `web` images from GitHub Actions.
5. Expose `/api/health` for health checks.

## CI/CD

- `ci.yml` runs format, lint, typecheck, tests, migration smoke, build, and browser smoke.
- `docker-images.yml` builds both images and pushes them to GHCR on `main` and tags.
- `codeql.yml` scans the JavaScript/TypeScript codebase.

## Notes

- The default template is single-tenant.
- Public signup creates `member` users only; owner bootstrap is a seed/setup concern.
- Keep `ALLOW_MISSING_ORIGIN_FOR_DEV=false` in deploy environments.
- Password reset email delivery is intentionally left as an extension point.
- Redis, object storage, and reverse proxy components are optional and profile-driven.
