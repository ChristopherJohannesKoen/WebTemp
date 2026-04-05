# API Contract Guide

## Purpose

`packages/contracts` is the shared website-facing API contract layer. It sits between:

- shared payload/response schemas in `packages/shared`
- NestJS controllers in `apps/api`
- browser and server clients in `apps/web`

This package exists to prevent contract drift. It is the place where route shape becomes explicit.

## Package Responsibilities

`packages/shared` owns:

- Zod schemas
- shared enums
- shared response envelopes
- DTO-style request/response types

`packages/contracts` owns:

- route method
- route path
- path params
- query params
- request body
- success status codes
- error status surface for website-facing callers

The split is deliberate:

- shared schemas are reusable beyond HTTP
- contracts describe actual HTTP behavior

## Contract Structure

The main contract lives in [`packages/contracts/src/index.ts`](../packages/contracts/src/index.ts).

Current route groups include:

- `health`
- `auth`
- `users`
- `admin`
- `projects`

The contract is intentionally aligned to the existing Nest route shapes. The website uses `/api` through Next rewrites, while the contract paths remain compatible with the API's global prefix.

## How To Add A New JSON Endpoint

1. Add or update the schema in `packages/shared`.
2. Add the route in `packages/contracts`.
3. Implement or extend the API controller/service in `apps/api`.
4. Add a server or browser client wrapper in `apps/web/lib/server-api.ts` or `apps/web/lib/client-api.ts`.
5. Add tests for:
   - contract shape if needed
   - server/client usage
   - route behavior

## Example Workflow

### 1. Shared schema

Define the payload and response in `packages/shared`.

### 2. Contract route

Add the route in `packages/contracts`, including:

- method
- path
- params/query/body
- success responses
- common error responses

### 3. Web usage

Use named operations instead of raw path strings.

Good:

```ts
const project = await getProject(projectId);
await updateProject(projectId, { isArchived: true });
```

Avoid:

```ts
await fetch(`/api/projects/${projectId}`, { method: 'PATCH' });
```

## JSON vs Non-JSON

Business JSON endpoints belong in the contract package.

Non-JSON endpoints may stay explicit outside generic JSON helpers when they are truly different in transport shape, for example:

- CSV downloads
- binary file downloads
- empty-body endpoints with special semantics

That distinction should be intentional and documented. Do not let "this endpoint is awkward" become a reason to bypass contracts for ordinary JSON routes.

## Error Envelope

The website assumes structured API errors match the shared envelope:

```ts
{
  statusCode: number;
  message: string;
  code?: string;
  errors: Array<{ field: string; code: string; message: string }>;
  requestId?: string;
}
```

High-value client behavior depends on these codes, especially:

- `auth_required`
- `forbidden`
- `csrf_invalid`
- `invalid_origin`
- `not_found`
- `upstream_error`
- `export_limit_exceeded`

If an endpoint changes its error behavior, update both the contract expectations and the consuming UI logic.

## Browser Client Rules

The browser client in [`apps/web/lib/client-api.ts`](../apps/web/lib/client-api.ts):

- uses contract-backed operations
- validates responses
- attaches CSRF tokens where required
- attaches idempotency keys where required
- retries only for `csrf_invalid`

New browser JSON calls should follow the same pattern by adding named operations, not by exporting a new generic fetch helper.

## Server Client Rules

The server client in [`apps/web/lib/server-api.ts`](../apps/web/lib/server-api.ts):

- uses the same shared contract
- forwards only the session cookie
- keeps auth-sensitive reads uncached
- redirects only on `401`
- rethrows `403`, `404`, and upstream failures distinctly

If a new route loader needs API data, add a typed server helper instead of calling `fetch` directly from the page.

## Controller Integration Strategy

The current API keeps the existing Nest controller structure and stable HTTP routes. The contract layer is already enforced at the web client boundary.

That means:

- the HTTP surface is explicit and shared
- the website compiles against the contract
- the API implementation can be migrated to deeper ts-rest Nest integration later without changing the public route model

This staged approach keeps the codebase stable while still eliminating optimistic client-side parsing.

## Review Checklist

When reviewing a new JSON endpoint:

- Is the payload/response schema in `packages/shared`?
- Is the route declared in `packages/contracts`?
- Does the web caller use a named contract-backed helper?
- Are success and error status codes explicit?
- Does the endpoint need CSRF or idempotency headers?
- If it returns non-JSON, is that intentional and documented?
