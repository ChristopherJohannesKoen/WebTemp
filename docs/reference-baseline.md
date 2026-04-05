# Reference Baseline

## Purpose

This repository was not built from a single starter. It was built from a
curated local research set under the `references/` directory and then
implemented as one opinionated template.

Some references influenced the code directly. Others were used as validation
material to pressure-test decisions, especially around App Router CSP behavior,
contract-backed transports, accessible form errors, sessions, and request
integrity.

Use this document to understand what informed the template and which reference
patterns were intentionally not adopted wholesale.

## How To Read The Reference Set

- `Direct donor`: a reference whose pattern clearly appears in the template.
- `Validation reference`: used to confirm or constrain an implementation choice.
- `Evaluated but not adopted`: reviewed for ideas, but not taken as the core
  template direction.

The goal was not to recreate another repo. The goal was to extract stable
patterns and re-implement them with this template's stack and security model.

## Monorepo And Delivery Baseline

Direct donors:

- `references/turborepo-main`
- `references/turborepo-nextjs-main`
- `references/fullstack-turborepo-starter-master`
- `references/nextjs-docker-production-kit-master`

Validation references:

- `references/Docker Compose _ Docker Docs.pdf`
- `references/Dockerfile reference _ Docker Docs.pdf`
- `references/How to Use the Postgres Docker Official Image _ Docker.pdf`
- `references/postgres - Official Image _ Docker Hub.pdf`
- `references/GitHub Actions documentation - GitHub Docs.pdf`
- `references/Understanding GitHub Actions - GitHub Docs.pdf`

What the template took from them:

- workspace-based app and package separation
- production Docker builds for web and API
- CI-first repository structure
- local and deployment workflows that keep the stack reproducible

## Web Shell And Product UX

Direct donors:

- `references/saas-starter-main`
- `references/next-saas-stripe-starter-main`
- `references/nextjs-auth-starter-main`

What the template took from them:

- the idea of a public marketing shell plus authenticated app shell
- role-aware dashboard navigation
- opinionated SaaS layouting instead of a blank admin scaffold

Current status:

This area is largely absorbed already. The website now hides admin navigation
for `member` users and preserves route and API guards as the real enforcement
boundary.

## Browser Security And CSP

Direct donors:

- `references/next-safe-middleware-main`

Validation references:

- `references/[App Router] Content Security Policy Broken · Issue #63015 · vercel_next.js.pdf`
- `references/Hydration warning when using next_script with a CSP that includes a nonce · Issue #77952 · vercel_next.js.pdf`
- `references/Next.js 15_ CSP headers not applied in production unless await headers() is called · vercel_next.js · Discussion #80....pdf`
- `references/next.js-canary`

What the template took from them:

- nonce-based CSP as the website baseline
- strict browser security headers owned in app middleware
- staged rollout support through report-only mode
- explicit caution around App Router nonce behavior and production regressions

Current status:

This area is also largely absorbed already. Production CSP is strict, nonce
based, and no longer relies on blanket `style-src 'unsafe-inline'`.

## Contract-Backed Website Transport

Direct donors:

- `references/ts-rest-main`
- `references/zod-main`
- `references/Intro _ Zod.pdf`

Evaluated but not adopted wholesale:

- `references/zodios-main`

What the template took from them:

- route contracts separated from payload schemas
- runtime validation of website-facing JSON responses
- explicit success and error status handling
- named client operations instead of raw fetch strings scattered through pages

Why `ts-rest` was chosen:

`ts-rest` fit the current Nest plus Next split cleanly and let the repository
adopt contract-backed calls without rewriting the API architecture. `zodios`
was a useful comparison point for response-schema validation and centralized API
declaration, but it was not chosen as the template baseline.

## Sessions, CSRF, And Request Integrity

Direct donors:

- `references/node-idempotency-main`

Validation references:

- `references/Session Management _ Better Auth.pdf`
- `references/Basic session implementation.pdf`
- `references/csrf-csrf-main`
- `references/CSRF _ NestJS - A progressive Node.js framework.pdf`
- `references/Authorization _ NestJS - A progressive Node.js framework.pdf`
- `references/Guards _ NestJS - A progressive Node.js framework.pdf`

What the template took from them:

- opaque server-side sessions instead of JWT-first auth
- touch-throttled session freshness updates
- rotation and revocation as explicit lifecycle events
- structured idempotency request replay and conflict semantics
- CSRF and origin handling as separate browser defenses
- clear `401` versus `403` semantics at guard boundaries

Current status:

This area is mature in the current template. The main remaining work is ongoing
stress and race coverage, not a missing architectural pattern.

## API And Data-Layer Discipline

Validation references:

- `references/OpenAPI (Swagger) _ NestJS - A progressive Node.js framework.pdf`
- `references/Workspaces - CLI _ NestJS - A progressive Node.js framework.pdf`
- `references/testing-nestjs-main`
- `references/CRUD (Reference) _ Prisma Documentation.pdf`
- `references/Select fields _ Prisma Documentation.pdf`
- `references/Pagination _ Prisma Documentation.pdf`
- `references/Indexes _ Prisma Documentation.pdf`
- `references/Development and production _ Prisma Documentation.pdf`

What the template took from them:

- explicit API documentation and module structure
- testable Nest patterns at controller, service, integration, and E2E boundaries
- narrow Prisma selects instead of over-fetching related rows
- indexed list endpoints and predictable pagination behavior

## Logging, Metrics, And Operational Maturity

Direct donors:

- `references/nestjs-pino-master`

Validation references:

- `references/GitHub Actions documentation - GitHub Docs.pdf`
- `references/Understanding GitHub Actions - GitHub Docs.pdf`

What the template took from them:

- structured request logging with request identity
- a production-minded observability baseline instead of console-only logging
- CI as a first-class product surface, not an afterthought

## Accessibility And Form Semantics

### Direct donors

- `references/react-spectrum-main`

### Validation references

- `references/Prefer using \`aria-errormessage\` above \`aria-describedby\` · Issue #7425 · adobe_react-spectrum.pdf`
- `references/Live regions not announced correctly · Issue #11410 · nvaccess_nvda.pdf`
- `references/nvda-master`

### What the template took from them

- auth forms need explicit live-error regions
- field errors must be associated to controls through stable IDs
- accessibility behavior needs to be treated as product infrastructure, not
  cosmetic markup

Current status:

This area is substantially adopted. The auth flows now expose polite live
regions and field-level associations. The remaining improvements here are small
polish items rather than missing architecture.

## References Reviewed But Not Adopted As Core Template Direction

- `references/casbin-nest-authz-master`
  - reviewed while evaluating externalized authorization models
  - not adopted because the template keeps a smaller in-repo policy layer by
    default
- `references/next-auth-main`
  - reviewed while comparing session models
  - not adopted because the template keeps opaque cookie-backed sessions and a
    first-party auth flow
- `references/web-main`
  - useful as general UI inspiration, not a direct architecture donor

## Reference-Driven Upgrade Review

After reviewing the reference set against the current website code, the major
reference-driven upgrades are already present:

- role-aware admin navigation is implemented
- production CSP is strict and nonce based
- website JSON transport is contract backed
- auth forms have live regions and field-level associations

The remaining upgrades are incremental, not foundational.

### Upgrade 1: tighten success unwrapping around contract responses

`apps/web/lib/api-error.ts` still exposes a generic
`unwrapContractResponse<T>(...)` helper that returns `response.body as T` after
status checks. Runtime validation from `ts-rest` greatly reduces risk, so this
is no longer a serious correctness gap, but the helper API still allows future
callers to lean on casts instead of inferred contract payloads.

Recommended direction:

- make success unwrap helpers infer their payloads from the ts-rest operation
  result shape instead of accepting a generic `T`
- keep schema-less success casting unavailable by default

### Upgrade 2: add `aria-errormessage` as a progressive enhancement

The current auth forms already meet the main accessibility intent from the
reference set through `aria-live="polite"`, `aria-invalid`, and
`aria-describedby`. A small upgrade would be to also set
`aria-errormessage=<field-error-id>` when a field is invalid.

That would align more closely with the React Spectrum accessibility discussions
captured in the reference set while preserving current screen-reader behavior.

### Upgrade 3: add nonce-propagation E2E assertions, not just header assertions

The template already tests CSP header presence and policy shape. Because the
reference set includes multiple App Router nonce regression discussions, a
useful extra guard would be an E2E assertion that rendered framework scripts
actually carry a nonce when the page is served, not just that the header exists.

This is a test-depth improvement, not evidence that the current implementation
is broken.

## Bottom Line

The references folder still justifies a few targeted improvements, but it does
not reveal any missing top-tier website architecture in the current repo. Most
of the high-value ideas from the reference set are already absorbed into the
template.
