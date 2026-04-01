# ADR 001: Template Scope

## Status

Accepted

## Decision

The v1 template is a single-tenant SaaS baseline with:

- session-cookie authentication
- owner/admin/member RBAC
- a public landing surface
- an authenticated dashboard shell
- one complete Projects CRUD reference slice
- Docker, CI, and Postgres as first-class concerns

## Rationale

- A template with no real product slice does not prove its own patterns.
- Single-tenant foundations are faster to understand and easier to customize.
- Session auth backed by Postgres keeps the baseline simple and avoids a Redis dependency.
- Optional integrations should be documented and scaffolded, not forced into the default runtime.

## Consequences

- Multi-tenant workspaces, OAuth, invitations, background workers, and object storage are deferred to extension slots.
- New projects should customize the reference Projects slice rather than delete the app shell and start over.
