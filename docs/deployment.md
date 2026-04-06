# Deployment Runbook

## Container Flow

- `apps/api/Dockerfile` builds the Nest application and Prisma client.
- `apps/web/Dockerfile` builds the Next standalone server.
- `docker-compose.yml` is the primary local orchestration file.
- `infra/compose/docker-compose.extensions.yml` holds optional profile-based services.
- `infra/k8s` is the production deployment baseline.

## Production Checklist

1. Set production `APP_URL`, `API_ORIGIN`, `DATABASE_URL`, `SESSION_COOKIE_NAME`, and the origin policy envs.
2. For the baseline production posture, configure OIDC and set `ENTERPRISE_DEFAULT_PROVIDER_SLUG` to the OIDC provider slug before enabling `ENTERPRISE_IDENTITY_ENABLED=true`.
3. Enable SAML only when a deployment specifically requires it, and enable SCIM only when provisioning automation is needed.
4. Keep local auth out of the normal production login path; break-glass remains the only allowed local recovery mechanism.
5. Run the Prisma migration job before promoting a new API revision.
6. Run `npm run seed` only for bootstrap environments where the initial owner must be provisioned.
7. Build and publish `api` and `web` images from GitHub Actions.
8. Promote the same image digest between staging and production; do not rebuild environment-specific application images.
9. Generate SBOMs, scan artifacts, sign images, and attach provenance attestations in the release-integrity lane.
10. Expose `/api/health` for health checks and `/api/metrics` for Prometheus scraping.
11. Keep `EXPOSE_DEV_RESET_DETAILS=false` in every deployed environment.
12. Enable `FEATURE_OBSERVABILITY=true` only when `OTEL_EXPORTER_OTLP_ENDPOINT` is configured and reachable.

## CI/CD

- `ci.yml` runs format, lint, typecheck, tests, migration smoke, build, and browser smoke.
- `docker-images.yml` builds both images and pushes them to GHCR on `main` and tags.
- `codeql.yml` scans the JavaScript/TypeScript codebase.
- `dependency-review.yml` blocks risky dependency drift on pull requests.
- `license-audit.yml` provides a repo-owned dependency license summary lane.
- `release-integrity.yml` generates SBOMs, scans images, signs released images, and attaches provenance attestations.

Documented protected-branch baseline:

- `quality`
- CodeQL
- dependency review
- release integrity for tagged releases
- `release-integrity.yml` also signs released images and is the baseline promotion lane for enterprise review.

## Notes

- The default template is single-tenant.
- Public signup creates `member` users only; owner bootstrap is a seed/setup concern.
- Keep `ALLOW_MISSING_ORIGIN_FOR_DEV=false` in deploy environments.
- Keep `APP_ENV=staging` or `APP_ENV=production` in deployed clusters so local-only auth and reset toggles fail fast.
- Password reset email delivery is intentionally left as an extension point, and raw reset details should remain hidden unless you explicitly opt in for local/test workflows.
- Idempotency cleanup runs off the request path on a bounded schedule and should be monitored through logs and `ultimate_template_idempotency_expired_backlog`.
- Optional observability services are available through the `prometheus` and `grafana` compose profiles.
- Redis, object storage, and reverse proxy components are optional and profile-driven.
