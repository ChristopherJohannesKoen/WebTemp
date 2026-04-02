# Template Conventions

## Naming And Structure

- Keep product features as capability modules: `auth`, `users`, `admin`, `projects`, not generic technical buckets.
- Add new reusable contracts to `packages/shared` first, then update API DTOs and web callers against those shared types.
- Keep cross-cutting infrastructure in `apps/api/src/common` and feature logic in `apps/api/src/modules/<feature>`.

## Adding A New Resource Module

1. Add the shared Zod schema and response types in `packages/shared`.
2. Add Prisma schema changes and a migration in `packages/db/prisma`.
3. Create a Nest module with `controller`, `service`, DTOs, and any policy helpers under `apps/api/src/modules/<resource>`.
4. Add server API helpers in `apps/web/lib/server-api.ts` and client mutation calls through `apps/web/lib/client-api.ts`.
5. Add at least one server-rendered page and one client-side mutation form that exercise the real API flow.

## Policy Checks

- Keep authorization decisions in service-level helpers, not in controllers.
- Default pattern:
  - controller authenticates and validates
  - service loads the target record
  - policy helper decides whether the actor can mutate it
  - service writes and audits the result
- Audit denied writes when the policy boundary matters for incident review.

## Request Integrity

- Require `Idempotency-Key` on high-value POST endpoints that create or finalize state.
- Keep CSRF tokens on authenticated unsafe requests handled through `client-api.ts`.
- Treat origin checks as secondary protection, not as the only browser-side defense.

## Extension Features

- Put optional infra behind feature flags in `.env`.
- Fail fast when a feature is enabled without its required env values.
- Keep the default runtime limited to web, API, and Postgres unless a project explicitly opts into more.
