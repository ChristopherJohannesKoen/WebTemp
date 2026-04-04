# Architecture

## Goal

This repository is a reusable single-tenant SaaS template. It is intentionally opinionated so new projects can inherit a hardened product spine instead of a blank monorepo.

## Runtime Topology

- `apps/web` renders the public marketing shell and authenticated dashboard.
- `apps/web` proxies `/api/*` requests to Nest through the server-side `API_ORIGIN` variable.
- `apps/api` exposes REST endpoints under `/api`, serves Swagger at `/api/docs`, and manages auth, CSRF, idempotency, RBAC, auditing, and projects.
- `apps/api` also exposes Prometheus-compatible runtime metrics at `/api/metrics`.
- `packages/db` owns Prisma schema, migrations, and seed data.
- `Postgres` is the only required backing service in v1.

## Product Modules

- `AuthModule`: signup, login, logout, logout-all, session revocation, forgot-password, reset-password, cookie sessions, CSRF token issuing
- `UsersModule`: current-user profile read/update
- `AdminModule`: user listing and owner-only role changes
- `ProjectsModule`: the reference CRUD slice with cursor pagination and explicit write policy checks
- `AuditModule`: append-only audit trail for auth, role, and project lifecycle events
- `HealthModule`: application and database status

## Security Baseline

- Argon2id password hashing
- secure, HTTP-only session cookies
- nonce-based Content Security Policy and strict browser security headers on web responses
- synchronizer-token CSRF protection for authenticated unsafe routes
- idempotency protection for critical POST endpoints
- session rotation and per-user session caps
- touch-throttled session freshness updates
- owner/admin/member global roles
- origin checks for mutating requests as secondary defense
- throttling via Nest throttler
- structured request IDs and audit records
- Prometheus-compatible request, auth, session, security, and idempotency metrics
- validation-first request handling with class-validator and a shared JSON error envelope

## Security Invariants

- Seed/setup flows establish the initial owner; public signup never bootstraps privileged roles.
- Role-protected routes return `401` when unauthenticated and `403` only for authenticated-but-forbidden requests.
- Mutating first-party browser requests require a valid CSRF token, and origin checks stay strict by default outside tests.
- Synchronous CSV export must return the full filtered result or fail explicitly; it must never silently truncate.
- Non-authentication code paths must not hydrate password hashes or other sensitive user fields when public relation selects are sufficient.
- `PrismaClient` must only be owned by `PrismaService`; middleware and feature modules must never instantiate their own client.
- The web tier forwards only the configured session cookie to the API; unrelated browser cookies must never become auth inputs.
- Protected route failures must distinguish `401`, `403`, `404`, and upstream errors instead of collapsing them into redirects or fake not-found states.

## Web Security Boundary

- `apps/web/middleware.ts` issues a per-request nonce and sets CSP, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and related browser hardening headers.
- The nonce-based CSP forces dynamic rendering so Next.js can attach the nonce to framework and page scripts at request time.
- Public auth pages do not render seeded local credentials or privileged bootstrap hints; those stay in docs and runbooks only.
- The web server bridge retries unsafe requests only for explicit `csrf_invalid` responses and forwards only `SESSION_COOKIE_NAME` to the API.

## Shared Contracts

`packages/shared` is the source of truth for:

- role enums
- auth payloads
- session and CSRF DTOs
- project DTOs
- cursor and paginated response shapes
- API error structures

The web app and API both rely on these schemas so UI and server drift is reduced.

## Extension Strategy

The default template intentionally avoids hard dependencies on Redis, object storage, email delivery, worker orchestration, and distributed tracing collectors. Optional infrastructure is scaffolded in `infra/compose`, feature-gated through env validation, and documented as extension slots rather than mandatory runtime components.

Prometheus and Grafana are included as optional observability profiles so teams can adopt a working metrics stack without changing the core runtime contract.
