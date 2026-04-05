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

## Seeded Local Account

Seed data provisions the initial owner through setup, not public signup.

- email: `owner@example.com`
- password: `ChangeMe123!`

Keep these credentials in local docs only. The public login and signup pages intentionally do not render them.

## Web Security Notes

- The web app now runs with a nonce-based CSP. Because of that, pages render dynamically per request instead of using static generation.
- In development, CSP allows websocket connections, `unsafe-eval`, and inline styles only where Next.js tooling still requires them. Production keeps the stricter nonce-based policy for both scripts and styles.
- If you add third-party scripts, fonts, or analytics later, update the CSP policy in `apps/web/middleware.ts` at the same time.
- You can enable `CSP_REPORT_ONLY=true` to emit an additional strict nonce-based `Content-Security-Policy-Report-Only` header while validating future CSP changes locally.
- Auth forms expose polite live error regions and field-level error associations. Keep those semantics when customizing login, signup, forgot-password, and reset-password screens.

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run test:e2e`
- `npm run docs:check`
- `npm run build`

## Troubleshooting

- If Prisma complains about missing generated types, run `npm run prisma:generate`.
- If the first admin account is missing, rerun `npm run db:setup`; owner bootstrap comes from seed data, not public signup.
- If auth requests fail across origins, confirm `APP_URL`, `API_ORIGIN`, and `ALLOWED_ORIGINS` match the actual local or LAN URLs.
- If a local non-browser client cannot send `Origin` or `Referer`, set `ALLOW_MISSING_ORIGIN_FOR_DEV=true` only for that development session.
- If you need a raw reset token or reset URL locally, set `EXPOSE_DEV_RESET_DETAILS=true` for that session only; it stays off by default.
- If authenticated writes fail with `403`, fetch a fresh CSRF token by reloading the page or calling `GET /api/auth/csrf` from the first-party client.
- If protected POST requests fail with `400`, confirm the client sends `Idempotency-Key` on signup, password reset completion, and project creation.
- If you want local metrics and dashboards, start the optional observability profile and scrape `http://localhost:4000/api/metrics`.
- If the web app cannot load seeded data, rerun `npm run db:setup`.
- If Playwright is installed but browsers are missing, run `npx playwright install chromium`.
