// Every complete program shown in SPEC.md (a code block starting with app or ask) must check,
// so the reference never teaches something the checker rejects.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { check } from '../check.mjs';
import { format } from '../format.mjs';
import { read, LANG } from './lib.mjs';

const blocks = [...read(join(LANG, 'SPEC.md')).matchAll(/```\n([\s\S]*?)```/g)].map(m => m[1]).filter(b => /^(app|ask) /.test(b));

test('SPEC.md has complete example programs', () => assert.ok(blocks.length >= 2));
blocks.forEach((b, i) => test(`SPEC.md program ${i + 1} checks and is canonical`, () => {
  assert.deepEqual(check(b).errors.map(String), []);
  assert.equal(format(b), b);
}));
