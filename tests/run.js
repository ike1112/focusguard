// tests/run.js — discovers and runs all test files
// Run: node tests/run.js

import { readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const files = (await readdir(__dirname))
  .filter((f) => f !== 'run.js' && f.endsWith('.js'));

let failed = 0;
for (const f of files) {
  try {
    await import(pathToFileURL(resolve(__dirname, f)).href);
  } catch (e) {
    console.error(`FAIL ${f}:`, e.message);
    failed++;
  }
}
if (failed) process.exit(1);
