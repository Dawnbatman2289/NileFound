import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      results.push(...collectTsFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      results.push(full);
    }
  }
  return results;
}

test('source and test files contain no explicit any types', () => {
  const files = [...collectTsFiles('src'), ...collectTsFiles('__tests__')].filter(
    (f) => !f.endsWith('repoQuality.test.ts')
  );
  const violations: string[] = [];
  const anyPattern = /:\s*any\b|\bas\s+any\b|<any>/;

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (anyPattern.test(line)) {
        violations.push(`${file}:${idx + 1}: ${line.trim()}`);
      }
    });
  }

  assert.deepEqual(violations, []);
});
