# Architecture

## Goal

This repository is a reusable single-tenant SaaS template. It is intentionally opinionated so new projects can inherit a hardened product spine instead of a blank monorepo.

## Runtime Topology

- `apps/web` renders the public marketing shell and authenticated dashboard.
- `apps/web` proxies `/api/*` requests to Nest through the server-side `API_ORIGIN` variable and consumes JSON endpoints through ts-rest contracts in `packages/contracts`.
- `apps/api` exposes REST endpoints under `/api`, serves Swagger at `/api/docs`, and manages auth, CSRF, idempotency, RBAC, enterprise identity, auditing, governance cleanup, and projects.
- `apps/api` also exposes Prometheus-compatible runtime metrics at `/api/metrics`.
- `packages/db` owns Prisma schema, migrations, and seed data.
- `packages/contracts` owns the shared website-facing ts-rest route contract.
- `Postgres` is the only required backing service in v1.

## Product Modules

- `AuthModule`: signup, login, logout, logout-all, session revocation, forgot-password, reset-password, break-glass login, step-up confirmation, cookie sessions, CSRF token issuing
- `IdentityModule`: OIDC, SAML, SCIM, provider sync, group-role mapping, and enterprise access policy events
- `GovernanceModule`: retention-policy cleanup for audit, session, reset-token, and idempotency records
- `UsersModule`: current-user profile read/update
- `AdminModule`: user listing and owner-only role changes
- `ProjectsModule`: the reference CRUD slice with cursor pagination and explicit write policy checks
- `AuditModule`: append-only audit trail for auth, role, and project lifecycle events
- `HealthModule`: application and database status

## Security Baseline

- Argon2id password hashing
- secure, HTTP-only session cookies
- encrypted enterprise SSO state and encrypted session-cookie transport
- nonce-based Content Security Policy and strict browser security headers on web responses
- synchronizer-token CSRF protection for authenticated unsafe routes
- idempotency protection for critical POST endpoints
- session rotation and per-user session caps
- touch-throttled session freshness updates
- owner/admin/member global roles
- origin checks for mutating requests as secondary defense
- throttling via Nest throttler
- structured request IDs and audit records
- tamper-evident audit chain fields and legal-hold support
- Prometheus-compatible request, auth, session, security, and idempotency metrics
- enterprise identity metrics for SSO, SCIM, and access-policy events
- validation-first request handling with class-validator and a shared JSON error envelope

## Security Invariants

- Seed/setup flows establish the initial owner; public signup never bootstraps privileged roles.
- Enterprise SSO is the preferred production auth path; local auth is disabled by policy unless explicitly allowed for local or break-glass usage.
- Owner-sensitive admin actions require a fresh step-up confirmation window.
- SCIM deprovision disables users instead of hard-deleting them so audit and ownership history remain intact.
- Bootstrap ownership is anchored in the database through a singleton `BootstrapState` record. Seed/setup creates it in a serializable transaction and refuses to silently migrate it to a new configured owner email later.
- Multiple owners are allowed after bootstrap, but owner-sensitive role updates must never leave the system with zero owners.
- Role-protected routes return `401` when unauthenticated and `403` only for authenticated-but-forbidden requests.
- Mutating first-party browser requests require a valid CSRF token, and origin checks stay strict by default outside tests.
- Synchronous CSV export must return the full filtered result or fail explicitly; it must never silently truncate.
- Non-authentication code paths must not hydrate password hashes or other sensitive user fields when public relation selects are sufficient.
- `PrismaClient` must only be owned by `PrismaService`; middleware and feature modules must never instantiate their own client.
- The web tier forwards only the configured session cookie to the API; unrelated browser cookies must never become auth inputs.
- Protected route failures must distinguish `401`, `403`, `404`, and upstream errors instead of collapsing them into redirects or fake not-found states.

## Ownership And Role Safety

- Public signup always creates `member`.
- Seed/setup is the only normal bootstrap path for the initial owner.
- Owner role updates run inside serializable transactions with retry on serialization failure.
- If the last remaining owner would be demoted, the API returns `409 owner_floor_violation`.
- If concurrent owner-sensitive updates cannot be resolved after bounded retries, the API returns `409 role_conflict`.
- Each privileged denial path records audit metadata and ownership metrics so operator tooling can distinguish policy rejection from normal role changes.

## Web Security Boundary

- `apps/web/middleware.ts` issues a per-request nonce and sets CSP, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and related browser hardening headers through a centralized policy builder.
- The nonce-based CSP forces dynamic rendering so Next.js can attach the nonce to framework and page scripts at request time.
- Production enforces nonce-based `script-src` and `style-src` without blanket `unsafe-inline`. Development keeps only the minimum style/script relaxations needed for local Next.js tooling.
- `Content-Security-Policy-Report-Only` remains available as an optional rollout/debug header and emits the stricter nonce-based style policy even when development keeps local relaxations enabled.
- Public auth pages do not render seeded local credentials or privileged bootstrap hints; those stay in docs and runbooks only.
- The browser and server web clients both resolve JSON endpoints through `packages/contracts`, retry unsafe requests only for explicit `csrf_invalid` responses, and forward only `SESSION_COOKIE_NAME` to the API.
- JSON responses fail fast on contract drift; downloads and exports stay on explicit non-JSON paths.
- Auth forms expose polite live error regions and field-level accessibility wiring so server and validation failures are announced consistently.
- Dashboard navigation is role-aware in the UI, but privileged routes remain enforced again at the route and API layers.

## Shared Contracts

`packages/shared` is the source of truth for:

- role enums
- auth payloads
- session and CSRF DTOs
- project DTOs
- cursor and paginated response shapes
- API error structures

The web app and API both rely on these schemas so UI and server drift is reduced.

`packages/contracts` layers route shapes on top of those schemas so new website-facing JSON endpoints declare method, path, params, query, body, success responses, and structured error responses in one place.

## Test Harness Boundary

- Production runtime code does not contain E2E-only failpoint branches.
- Browser failure-path tests use an API-only failpoint module loaded from the E2E bootstrap entrypoint.
- The E2E harness can arm one-shot upstream failures without mixing query toggles or environment branches into website request code.
- Ownership and admin-race coverage includes concurrent seed/bootstrap tests, active-admin demotion coverage, and conflicting owner-demotion flows in browser contexts backed by the real database.

## Extension Strategy

The default template intentionally avoids hard dependencies on Redis, object storage, email delivery, worker orchestration, and distributed tracing collectors. Optional infrastructure is scaffolded in `infra/compose`, feature-gated through env validation, and documented as extension slots rather than mandatory runtime components.

Prometheus and Grafana are included as optional observability profiles so teams can adopt a working metrics stack without changing the core runtime contract.

## Production Baseline

- Docker Compose remains the local-development path.
- Kubernetes under `infra/k8s` is the authoritative production baseline.
- Production assumes managed Postgres, secret-backed config injection, SBOM generation, image scanning, and provenance-aware release lanes.
