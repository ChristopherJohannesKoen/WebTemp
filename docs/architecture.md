# Architecture

## Goal

This repository is a reusable single-tenant SaaS starter. It is intentionally opinionated so new projects can inherit a real product spine instead of a blank monorepo.

## Runtime Topology

- `apps/web` renders the public marketing shell and authenticated dashboard.
- `apps/web` proxies `/api/*` requests to Nest through the server-side `API_ORIGIN` variable.
- `apps/api` exposes REST endpoints under `/api`, serves Swagger at `/api/docs`, and manages auth, RBAC, auditing, and projects.
- `packages/db` owns Prisma schema, migrations, and seed data.
- `Postgres` is the only required backing service in v1.

## Product Modules

- `AuthModule`: signup, login, logout, forgot-password, reset-password, cookie sessions
- `UsersModule`: current-user profile read/update
- `AdminModule`: user listing and owner-only role changes
- `ProjectsModule`: the reference CRUD slice
- `AuditModule`: append-only audit trail for auth, role, and project lifecycle events
- `HealthModule`: application and database status

## Security Baseline

- Argon2id password hashing
- secure, HTTP-only session cookies
- owner/admin/member global roles
- origin checks for mutating requests
- throttling via Nest throttler
- structured request IDs and audit records
- validation-first request handling with class-validator and a shared JSON error envelope

## Shared Contracts

`packages/shared` is the source of truth for:

- role enums
- auth payloads
- project DTOs
- paginated response shapes
- API error structures

The web app and API both rely on these schemas so UI and server drift is reduced.

## Extension Strategy

The default template intentionally avoids hard dependencies on Redis, object storage, email delivery, worker orchestration, and observability collectors. Optional infrastructure is scaffolded in `infra/compose` and documented as extension slots rather than mandatory runtime components.
