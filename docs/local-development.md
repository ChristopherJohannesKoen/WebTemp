# Local Development Runbook

## First Boot

```powershell
Copy-Item .env.example .env
npm install
npm run dev:services
npm run db:setup
npm run dev
```

If you use WSL, run the equivalent Linux commands inside the distro and keep Docker Desktop WSL integration enabled:

```bash
cp .env.example .env
npm install
docker compose up db -d
npm run db:setup
npm run dev
```

## Daily Commands

- `npm run dev`: run API and web together
- `npm run dev:services`: start only Postgres
- `npm run db:setup`: apply local migrations and seed data
- `npm run db:reset`: rebuild the database from scratch
- `npm run prisma:generate`: regenerate Prisma client

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run test:e2e`
- `npm run build`

## Troubleshooting

- If Prisma complains about missing generated types, run `npm run prisma:generate`.
- If auth requests fail across origins, confirm `APP_URL`, `API_ORIGIN`, and `ALLOWED_ORIGINS` match the actual local or LAN URLs.
- If authenticated writes fail with `403`, fetch a fresh CSRF token by reloading the page or calling `GET /api/auth/csrf` from the first-party client.
- If protected POST requests fail with `400`, confirm the client sends `Idempotency-Key` on signup, password reset completion, and project creation.
- If the web app cannot load seeded data, rerun `npm run db:setup`.
- If Playwright is installed but browsers are missing, run `npx playwright install chromium`.
