# Ultimate General Website Template

An opinionated full-stack SaaS template for teams that want to start from a hardened, reusable product baseline instead of rebuilding the same infrastructure on every project.

## Stack

- `apps/web`: Next.js 15 App Router, Tailwind, shared UI package, server-side `/api/*` proxying
- `apps/web`: Next.js 15 App Router, Tailwind, shared UI package, nonce-based CSP, strict browser security headers, server-side `/api/*` proxying
- `apps/api`: NestJS 11, Prisma, Postgres, Swagger, session-cookie auth, CSRF protection, idempotency, RBAC, rate limiting, audit logging
- `packages/db`: shared Prisma schema, migrations, seed flow
- `packages/shared`: shared Zod contracts and DTO types
- `packages/ui`: reusable UI primitives and styling helpers
- `packages/config`: shared ESLint, Prettier, and TypeScript config

## What Is Included

- email/password signup, login, logout, logout-all, session revocation, forgot-password, and reset-password flows
- single-tenant roles: `owner`, `admin`, and `member`
- authenticated dashboard shell with profile settings, session security, and admin user management
- Projects reference slice with indexed search, filters, cursor pagination, ownership-aware mutations, detail/edit, archive, delete, and streamed CSV export
- Docker-first local stack with Next.js, NestJS, and Postgres
- real lint, typecheck, unit tests, API integration tests, and Playwright auth/project/session/RBAC coverage
- browser-boundary hardening with CSP, clickjacking protection, strict cookie forwarding, and route-level forbidden/error states
- CI, Docker image publishing workflow, and CodeQL scanning

## Quick Start

### Local development

```powershell
Copy-Item .env.example .env
npm install
npm run dev:services
npm run db:setup
npm run dev
```

Open:

- web: `http://localhost:3000`
- API docs: `http://localhost:4000/api/docs`
- health: `http://localhost:4000/api/health`

Seeded owner credentials come from `.env`:

- email: `owner@example.com`
- password: `ChangeMe123!`

### Docker

```powershell
Copy-Item .env.example .env
docker compose up --build
```

The Compose stack starts Postgres, runs migrations and seeding in the API container, then serves:

- web on `http://localhost:3000`
- API on `http://localhost:4000`

### Windows + WSL

If you run the repo from WSL, use Linux shell commands inside WSL and make sure Docker Desktop has WSL integration enabled for your distro. Typical flow:

```bash
cp .env.example .env
docker compose up --build
```

## Common Commands

- `npm run dev`: start web and API in watch mode
- `npm run dev:services`: start Postgres only
- `npm run db:setup`: run local migrations and seed data
- `npm run db:reset`: reset the database and reseed it
- `npm run lint`: run ESLint and Prisma validation
- `npm run typecheck`: run TypeScript and Prisma validation
- `npm test`: run workspace Vitest suites
- `npm run test:e2e`: run the full Playwright E2E suite
- `npm run build`: produce production builds for every workspace
- `npm run docker:up`: build and start the Compose stack
- `npm run docker:down`: stop and clean up Compose containers

## Repository Layout

```text
apps/
  api/                  NestJS API
  web/                  Next.js application
packages/
  config/               Shared ESLint, Prettier, and TS config
  db/                   Prisma schema, migrations, seed script
  shared/               Zod schemas and shared DTO types
  ui/                   Reusable UI primitives
docs/
  architecture.md
  code-critique.md
  environment.md
  local-development.md
  deployment.md
  template-conventions.md
  customization-checklist.md
infra/
  compose/              Optional extension services
scripts/
  with-env.mjs          Shared env loader for workspace commands
```

## Extension Slots

The default template keeps the runtime small: web, API, and Postgres only. Optional extension services live in [`infra/compose/docker-compose.extensions.yml`](infra/compose/docker-compose.extensions.yml) and stay off by default.

- `cache`: Redis
- `email`: Mailpit
- `storage`: MinIO
- `edge`: Nginx reverse proxy

## Docs

- [Architecture](docs/architecture.md)
- [Code Critique](docs/code-critique.md)
- [Environment Catalog](docs/environment.md)
- [Local Development Runbook](docs/local-development.md)
- [Migrations](docs/migrations.md)
- [Deployment Runbook](docs/deployment.md)
- [Template Conventions](docs/template-conventions.md)
- [ADR 001](docs/adrs/001-template-scope.md)
- [Customization Checklist](docs/customization-checklist.md)
