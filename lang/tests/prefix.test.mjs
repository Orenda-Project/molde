// Prefix-valid property: every program cut at every line end still parses and type-checks,
// so the app can render while the model is still writing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check } from '../check.mjs';
import { allPrograms } from './lib.mjs';

for (const p of allPrograms()) {
  test(`prefix-valid: ${p.name}`, () => {
    const lines = p.src.split('\n').filter(l => l.trim());
    for (let i = 1; i <= lines.length; i++) {
      const r = check(lines.slice(0, i).join('\n') + '\n');
      assert.deepEqual(r.errors.map(String), [], `cut after line ${i}: ${lines[i - 1]}`);
    }
  });
}
