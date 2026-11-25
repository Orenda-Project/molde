// describe() is deterministic: snapshots of every example. Refresh with UPDATE_SNAPSHOTS=1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe } from '../describe.mjs';
import { examples, LANG } from './lib.mjs';

for (const e of examples()) {
  test(`describe snapshot: ${e.name}`, () => {
    const got = describe(e.src);
    assert.equal(describe(e.src), got, 'not deterministic');
    assert.ok(!/undefined|\[object|NaN/.test(got), got);
    // plain English for a non-programmer: outside quoted labels, no brackets, operators or code words
    const bare = got.replace(/"[^"\n]*"/g, '""');
    assert.ok(!/[\[\]{}()=<>*\/_]|\b(sumof|countof|maxof|minof|clamp|addmonths|let|def)\b|\w\.\w/.test(bare.replace(/\d+\.\d+/g, '0')), bare.match(/.*([\[\]{}()=<>*\/_]|\b(sumof|countof|maxof|minof|clamp|addmonths|let|def)\b|\w\.\w).*/)?.[0]);
    const snap = join(LANG, 'tests', 'snapshots', e.name.replace(/\.mo$/, '.txt'));
    if (process.env.UPDATE_SNAPSHOTS || !existsSync(snap)) writeFileSync(snap, got);
    assert.equal(got, readFileSync(snap, 'utf8'));
  });
}

test('describe: ask program and a tiny app', () => {
  assert.equal(describe('ask "Track money spent or money owed?" "Spent" "Owed"\n'), 'Question for you: "Track money spent or money owed?" Answers: "Spent", "Owed".');
  assert.match(describe('app "Water"\ntable drink ml num\n'), /drink: ml: number/);
});
