#!/usr/bin/env node
/** Enforces the performance budget on the production build (gzip sizes). */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = { entryJs: 120, totalJs: 180, css: 12 };
const dir = 'dist/assets';
const html = readFileSync('dist/index.html', 'utf8');
const entry = /<script type="module"[^>]*src="\/assets\/([^"]+)"/.exec(html)?.[1];
if (!entry) {
  console.error('check-size: entry script not found; run `npm run build` first.');
  process.exit(2);
}

const kb = (file) => gzipSync(readFileSync(join(dir, file))).length / 1024;
const files = readdirSync(dir);
const totals = {
  entryJs: kb(entry),
  totalJs: files.filter((f) => f.endsWith('.js')).reduce((sum, f) => sum + kb(f), 0),
  css: files.filter((f) => f.endsWith('.css')).reduce((sum, f) => sum + kb(f), 0),
};

let failed = false;
for (const [key, limit] of Object.entries(BUDGET_KB)) {
  const value = totals[key];
  const ok = value <= limit;
  failed ||= !ok;
  console.info(
    `${ok ? 'ok  ' : 'FAIL'} ${key.padEnd(8)} ${value.toFixed(1).padStart(6)} kB gzip (budget ${limit} kB)`,
  );
}
if (/<script(?![^>]*\bsrc=)[^>]*>/.test(html) || /\sstyle=/.test(html)) {
  console.error('FAIL inline script or style found in index.html (breaks the CSP)');
  failed = true;
}
process.exit(failed ? 1 : 0);
