import { writeFile } from 'node:fs/promises';
import process from 'node:process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [activity] = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*)::int AS total_connections,
      COUNT(*) FILTER (WHERE state = 'active')::int AS active_connections,
      COUNT(*) FILTER (WHERE state = 'idle')::int AS idle_connections,
      COUNT(*) FILTER (WHERE wait_event IS NOT NULL)::int AS waiting_connections
    FROM pg_stat_activity
    WHERE datname = current_database()
  `);

  const [database] = await prisma.$queryRawUnsafe(`
    SELECT
      xact_commit,
      xact_rollback,
      tup_returned,
      tup_fetched,
      tup_inserted,
      tup_updated,
      tup_deleted,
      blks_read,
      blks_hit
    FROM pg_stat_database
    WHERE datname = current_database()
  `);

  const payload = JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      activity,
      database
    },
    null,
    2
  );

  const outputPath = process.argv[2];

  if (outputPath) {
    await writeFile(outputPath, payload);
    return;
  }

  process.stdout.write(payload);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
