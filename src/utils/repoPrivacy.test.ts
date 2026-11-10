import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';

const repoRoot = process.cwd();
const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage']);
const ignoredFiles = new Set(['firebase-applet-config.json']);
const allowedEmail = /^[^@\s]+@(?:nileuniversity\.edu\.ng|(?:[A-Z0-9.-]+\.)?example\.com|(?:[A-Z0-9.-]+\.)?test\.invalid)$/i;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const apiKeyPattern = /AIza[0-9A-Za-z_-]{35}/g;

function collectTextFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    if (ignoredDirectories.has(entry) || ignoredFiles.has(entry)) continue;
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      files.push(...collectTextFiles(path));
    } else if (stats.isFile()) {
      files.push(path);
    }
  }
  return files;
}

test('repository privacy scan blocks personal emails and embedded API keys', () => {
  const findings: string[] = [];

  for (const file of collectTextFiles(repoRoot)) {
    let content: string;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    for (const email of content.match(emailPattern) ?? []) {
      if (!allowedEmail.test(email)) {
        findings.push(`${relative(repoRoot, file)} contains disallowed email ${email}`);
      }
    }
    if (apiKeyPattern.test(content)) {
      findings.push(`${relative(repoRoot, file)} contains an embedded Firebase/API key`);
    }
    apiKeyPattern.lastIndex = 0;
  }

  assert.deepEqual(findings, [], findings.join('\n'));
});
