# Template Conventions

## Naming And Structure

- Keep product features as capability modules: `auth`, `users`, `admin`, `projects`, not generic technical buckets.
- Add or update reusable payload/response schemas in `packages/shared` first, then declare website-facing routes in `packages/contracts`.
- Keep cross-cutting infrastructure in `apps/api/src/common` and feature logic in `apps/api/src/modules/<feature>`.

## Adding A New Resource Module

1. Add the shared Zod schema and response types in `packages/shared`.
2. Add or extend the route contract in `packages/contracts`.
3. Add Prisma schema changes and a migration in `packages/db/prisma`.
4. Create or extend the Nest module with `controller`, `service`, DTOs, and any policy helpers under `apps/api/src/modules/<resource>`.
5. Add or update server API helpers in `apps/web/lib/server-api.ts` and client mutation calls through `apps/web/lib/client-api.ts` using contract-backed operations, not raw path strings.
6. Add at least one server-rendered page and one client-side mutation form that exercise the real API flow.

## Policy Checks

- Keep authorization decisions in service-level helpers, not in controllers.
- Default pattern:
  - controller authenticates and validates
  - service loads the target record
  - policy helper decides whether the actor can mutate it
  - service writes and audits the result
- Audit denied writes when the policy boundary matters for incident review.

## Public Relation Selects

- When a feature needs related user data, use a shared public select constant instead of `include: true`.
- Public relation selects should expose only the fields the web/API contract actually needs, such as `id`, `email`, `name`, and `role`.
- Password hashes and other sensitive columns should only be loaded in code paths that explicitly perform authentication work.

## Prisma Ownership

- `PrismaService` is the only allowed owner of `PrismaClient` in application runtime code.
- Do not instantiate `new PrismaClient()` inside middleware, controllers, services, or module files.
- If a cross-cutting path needs DB access, inject `PrismaService` or a feature service that already owns the query logic.

## Request Integrity

- Require `Idempotency-Key` on high-value POST endpoints that create or finalize state.
- Keep CSRF tokens on authenticated unsafe requests handled through `client-api.ts`.
- Treat origin checks as secondary protection, not as the only browser-side defense.
- Keep JSON business endpoints behind `packages/contracts`; explicit text/file endpoints are the only allowed non-contract transport paths.

## Extension Features

- Put optional infra behind feature flags in `.env`.
- Fail fast when a feature is enabled without its required env values.
- Keep the default runtime limited to web, API, and Postgres unless a project explicitly opts into more.
