import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDirectory = process.cwd();
const ignoredDirectories = new Set([
  '.git',
  '.next',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'references',
  'server',
  'test-results'
]);

const markdownFiles = [];
const brokenLinks = [];

walk(rootDirectory);

for (const markdownFile of markdownFiles) {
  const contents = fs.readFileSync(markdownFile, 'utf8');
  const links = extractLinks(contents);

  for (const rawTarget of links) {
    validateLink(markdownFile, rawTarget);
  }
}

if (brokenLinks.length > 0) {
  console.error('Broken markdown links found:');

  for (const error of brokenLinks) {
    console.error(`- ${error}`);
  }

  process.exit(1);
}

console.info(`Validated markdown links in ${markdownFiles.length} file(s).`);

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        walk(path.join(directory, entry.name));
      }

      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      markdownFiles.push(path.join(directory, entry.name));
    }
  }
}

function extractLinks(contents) {
  const matches = [...contents.matchAll(/(?<!!)\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)];
  return matches.map((match) => match[1]).filter(Boolean);
}

function validateLink(fromFile, rawTarget) {
  const target = rawTarget.trim().replace(/^<|>$/g, '');
  const normalized = target.trim().toLowerCase();

  if (
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('mailto:') ||
    normalized.startsWith('tel:') ||
    normalized.startsWith('javascript:') ||
    normalized.startsWith('data:') ||
    normalized.startsWith('vbscript:')
  ) {
    return;
  }

  const [rawPath, rawAnchor] = target.split('#');
  const targetPath = rawPath ? path.resolve(path.dirname(fromFile), rawPath) : fromFile;

  if (!fs.existsSync(targetPath)) {
    brokenLinks.push(`${relative(fromFile)} -> ${target}`);
    return;
  }

  if (!rawAnchor) {
    return;
  }

  const anchors = getAnchors(targetPath);

  if (!anchors.has(rawAnchor)) {
    brokenLinks.push(`${relative(fromFile)} -> ${target} (missing anchor)`);
  }
}

function getAnchors(filePath) {
  const anchors = new Set();
  const seen = new Map();
  const contents = fs.readFileSync(filePath, 'utf8');
  const headingMatches = contents.matchAll(/^(#{1,6})\s+(.+)$/gm);

  for (const match of headingMatches) {
    const headingText = match[2]?.replace(/\s+#+\s*$/, '').trim();

    if (!headingText) {
      continue;
    }

    const baseSlug = slugify(headingText);
    const occurrence = seen.get(baseSlug) ?? 0;
    seen.set(baseSlug, occurrence + 1);
    anchors.add(occurrence === 0 ? baseSlug : `${baseSlug}-${occurrence}`);
  }

  return anchors;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

function relative(filePath) {
  return path.relative(rootDirectory, filePath).replaceAll('\\', '/');
}
