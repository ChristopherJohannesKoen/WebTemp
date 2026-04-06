# Reference Baseline

## Purpose

This repository was informed by a private working archive of open-source
repositories, official documentation, and public issue discussions. The public
repository does not distribute that archive.

This document is the public provenance summary: it names the key references,
links to the public sources, and explains which patterns were adopted or only
used for validation.

## How To Read This Document

- `Direct donor`: a reference whose pattern clearly appears in the template
- `Validation reference`: used to confirm or constrain an implementation choice
- `Evaluated but not adopted`: reviewed for ideas, but not taken as the core
  template direction

The goal was not to recreate another repo. The goal was to extract stable
patterns and re-implement them with this template's stack, security model, and
product posture.

## Public Repositories And Docs Used As Direct Donors

### Monorepo, delivery, and container baseline

- Turborepo
  - <https://github.com/vercel/turborepo>
- Fullstack Turborepo Starter
  - <https://github.com/Skolaczk/fullstack-turborepo-starter>
- Next.js Docker Production Kit
  - <https://github.com/leerob/nextjs-docker-production-kit>

Patterns absorbed:

- workspace-based app and package separation
- production Docker builds for web and API
- CI-first repository structure
- reproducible local and deployment workflows

### Web shell and product UX

- Next.js SaaS Starter
  - <https://github.com/nextjs/saas-starter>
- Next SaaS Stripe Starter
  - <https://github.com/mickasmt/next-saas-stripe-starter>
- Next.js Auth Starter
  - <https://github.com/Thabish-Kader/nextjs-auth-starter>

Patterns absorbed:

- public marketing shell plus authenticated app shell
- role-aware dashboard navigation
- SaaS-oriented application framing instead of a blank admin scaffold

### Browser security and CSP

- next-safe-middleware
  - <https://github.com/nibtime/next-safe-middleware>

Patterns absorbed:

- nonce-based CSP as the website baseline
- strict browser security headers owned in app middleware
- staged rollout support through report-only mode

### Contract-backed website transport

- ts-rest
  - <https://github.com/ts-rest/ts-rest>
- Zod
  - <https://github.com/colinhacks/zod>

Patterns absorbed:

- contracts separated from payload schemas
- runtime validation for website-facing JSON responses
- named client operations instead of scattered raw fetch strings

### Sessions, CSRF, and request integrity

- node-idempotency
  - <https://github.com/mahendraHegde/node-idempotency>
- csrf-csrf
  - <https://github.com/Psifi-Solutions/csrf-csrf>

Patterns absorbed:

- opaque server-side sessions instead of JWT-first auth
- touch-throttled session freshness updates
- explicit rotation and revocation lifecycle events
- structured idempotency request replay and conflict semantics
- CSRF and origin handling as separate browser defenses

### Logging and observability

- nestjs-pino
  - <https://github.com/iamolegga/nestjs-pino>

Patterns absorbed:

- structured request logging with request identity
- production-minded observability baselines instead of console-only logging

### Accessibility and form semantics

- React Spectrum
  - <https://github.com/adobe/react-spectrum>
- NVDA
  - <https://github.com/nvaccess/nvda>

Patterns absorbed:

- live error regions for auth flows
- stable field-error associations
- accessibility treatment as infrastructure, not cosmetic markup

## Validation References

These sources shaped implementation constraints without being copied wholesale.

### Framework and platform docs

- Next.js
  - <https://github.com/vercel/next.js>
  - <https://nextjs.org/docs>
- NestJS
  - <https://docs.nestjs.com>
- Prisma
  - <https://www.prisma.io/docs>
- Docker
  - <https://docs.docker.com>
- GitHub Actions
  - <https://docs.github.com/en/actions>

### Public discussions reviewed for edge cases

- Next.js CSP and nonce discussions around App Router behavior
- React Spectrum accessibility discussions around `aria-errormessage`
- NVDA issue threads on live-region announcement behavior

What these validation sources influenced:

- App Router CSP implementation choices
- contract and response-validation constraints
- Nest module and Prisma query discipline
- operational CI and container workflow shape
- auth-form accessibility details

## References Evaluated But Not Adopted As Core Direction

- Zodios
  - <https://github.com/ecyrbe/zodios>
  - useful comparison point for response-schema validation and centralized API
    declaration, but not chosen over `ts-rest`
- NextAuth / Auth.js
  - <https://github.com/nextauthjs/next-auth>
  - reviewed while comparing session models, but not adopted because the
    template keeps first-party opaque cookie-backed sessions
- casbin-nest-authz
  - <https://github.com/node-casbin/nest-authz>
  - reviewed while evaluating externalized authorization models, but not used
    because the template keeps a smaller in-repo policy layer

## Public Repo Policy For Reference Material

This public repository should not carry copied third-party PDFs, copied issue
exports, copied documentation snapshots, or similar archive material unless
redistribution rights are clear and the material is documented in
[`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md).

The maintainable public posture is:

- keep private research archives outside the public repository
- keep this document as the public provenance summary
- link to upstream public sources instead of redistributing them

## Bottom Line

The template was informed by a broad research set, but it is not a repackaged
starter. The value in this repository is the reimplementation, integration, and
hardening of those ideas into one opinionated template.
