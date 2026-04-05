import process from 'node:process';

const url = process.argv[2];
const timeoutMs = Number(process.argv[3] ?? '60000');
const intervalMs = Number(process.argv[4] ?? '1000');

if (!url) {
  console.error('Usage: node scripts/wait-for-http.mjs <url> [timeoutMs] [intervalMs]');
  process.exit(1);
}

const startedAt = Date.now();

while (Date.now() - startedAt < timeoutMs) {
  try {
    const response = await fetch(url);

    if (response.ok) {
      console.info(`HTTP target ready: ${url}`);
      process.exit(0);
    }
  } catch {
    // Ignore and retry until timeout.
  }

  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}

console.error(`Timed out waiting for ${url}`);
process.exit(1);
