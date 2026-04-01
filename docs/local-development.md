# Local Development Runbook

## First Boot

```powershell
Copy-Item .env.example .env
npm install
npm run dev:services
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
- If auth requests fail across origins, confirm `APP_URL` and `API_ORIGIN` match the actual local URLs.
- If the web app cannot load seeded data, rerun `npm run db:setup`.
- If Playwright is installed but browsers are missing, run `npx playwright install chromium`.
