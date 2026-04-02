# Customization Checklist

Use this before cutting a new product from the template.

## Branding

- rename the repository, package metadata, and Docker image names
- replace `Ultimate` copy, metadata, and logo assets
- update the seeded owner credentials

## Product

- decide whether the Projects slice remains or is replaced by your domain entity
- remove unused admin or public routes only after replacement flows exist
- extend shared Zod contracts before changing API payloads
- keep idempotent POSTs and CSRF coverage when adding new authenticated mutations
- update policy helpers whenever a new resource gains role-sensitive writes

## Infrastructure

- replace local-only secrets in `.env`
- choose whether Redis, Mailpit, MinIO, or the edge proxy profiles are needed
- configure your target deployment platform and registry credentials

## Verification

- run `npm run lint`
- run `npm run typecheck`
- run `npm test`
- run `npm run test:e2e`
- run `npm run build`
- run `docker compose up --build`
