import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const tsconfigPath = path.resolve(process.cwd(), 'tsconfig.json');

async function main() {
  const raw = await readFile(tsconfigPath, 'utf8');
  const parsed = JSON.parse(raw);

  if (parsed.compilerOptions?.jsx === 'react-jsx') {
    return;
  }

  parsed.compilerOptions = {
    ...parsed.compilerOptions,
    jsx: 'react-jsx'
  };

  await writeFile(tsconfigPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
