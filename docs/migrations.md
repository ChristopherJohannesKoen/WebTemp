# Migrations

## Local

- `npm run db:setup`: run migrations and seed data
- `npm run db:reset`: wipe the local database, rerun migrations, and reseed
- `npm run prisma:generate`: refresh Prisma client after schema changes

## Deployment

- `npm run prisma:migrate:deploy`: apply committed migrations without creating new ones
- `npm run seed`: only use for bootstrap environments, demos, or staging resets

## Workflow

1. Update `packages/db/prisma/schema.prisma`.
2. Create a new migration with `npm run prisma:migrate:dev --workspace=@packages/db`.
3. Commit the migration directory and regenerated Prisma client outputs are ignored because the client is generated at install/build time.
4. Run lint, typecheck, tests, and build before merging.
