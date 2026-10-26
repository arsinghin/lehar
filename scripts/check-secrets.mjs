#!/usr/bin/env node
/**
 * Fails if anything that looks like a real credential is committed. It matches credential SHAPES
 * (not variable names), so docs that mention GEMINI_API_KEY are fine.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const PATTERNS = [
  { name: 'Google API key', re: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'Google OAuth token', re: /ya29\.[0-9A-Za-z_-]{20,}/ },
  { name: 'OpenRouter key', re: /sk-or-(?:v1-)?[0-9a-f]{40,}/i },
  { name: 'NVIDIA API key', re: /nvapi-[A-Za-z0-9_-]{40,}/ },
  { name: 'OpenAI-style key', re: /\bsk-[A-Za-z0-9]{32,}\b/ },
  { name: 'Private key block', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'Assigned secret in env file', re: /^(?:GEMINI|OPENROUTER|NVIDIA)_API_KEY=\S+/m },
];

function trackedFiles() {
  try {
    return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean);
  } catch {
    console.error('check-secrets: run inside a git repository.');
    process.exit(2);
  }
}

const findings = [];
for (const file of trackedFiles()) {
  if (file === 'package-lock.json' || /\.(png|jpe?g|webp|gif|ico|woff2?)$/i.test(file)) continue;
  let text;
  try {
    if (statSync(file).size > 1_000_000) continue;
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const { name, re } of PATTERNS) if (re.test(text)) findings.push(`${file}: ${name}`);
}

if (findings.length > 0) {
  console.error(`Possible secrets found:\n  ${findings.join('\n  ')}`);
  process.exit(1);
}
console.info('check-secrets: no credentials found.');
