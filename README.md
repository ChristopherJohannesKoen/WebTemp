# Ultimate General Website Template

A Turborepo-powered full-stack starter built from proven patterns in official docs/examples:
- `apps/web`: Next.js 15 (standalone Docker output)
- `apps/api`: NestJS 11 + Prisma + Swagger + Joi validation + Winston logging
- `packages/db`: shared Prisma schema and migration commands
- `packages/shared`: shared Zod contracts
- Docker Compose with Postgres 16
- GitHub Actions CI (lint/typecheck/build)

## Quick Start

```bash
cp .env.example .env
npm install
npm run dev
```

### Docker

```bash
docker compose up --build
```

## Structure

```text
apps/
  api/
  web/
packages/
  db/
  shared/
.github/workflows/
```
