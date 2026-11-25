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

// UITREE.md Themes: text on accent keeps 4.5:1 in light (white text) and dark (the table's text colour); every theme word has a row
test('UITREE accent shades keep text on accent at 4.5:1 in light and dark', () => {
  const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const rows = [...read(join(LANG, 'UITREE.md')).matchAll(/^\| ([a-z]+) \| (#[0-9A-F]{6}) \| (#[0-9A-F]{6}) \| (#[0-9A-F]{6}) \|$/gm)];
  assert.deepEqual(rows.map(r => r[1]).sort(), 'ocean mint slate ink plum red orange yellow green teal blue purple pink grey'.split(' ').sort());
  for (const [, n, l, d, o] of rows) { assert.ok(cr(l, '#FFFFFF') >= 4.5, n + ' light'); assert.ok(cr(d, o) >= 4.5, n + ' dark'); }
});

test('app theme and mode reach the tree; old app lines still check', async () => {
  const { load } = await import('../eval.mjs');
  assert.deepEqual([load('app "A" drop red dark').tree()].map(t => [t.theme, t.mode]), [['red', 'dark']]);
  assert.deepEqual([load('app "A" drop ocean').tree()].map(t => [t.theme, t.mode]), [['ocean', null]]);
  assert.equal(check('app "A" drop brown').ok, false);
});

test('a text value after a comma may start with a formula; the first value may not', async () => {
  const { load } = await import('../eval.mjs');
  const src = 'app "T"\ntable t n num\nsection "Today", count(t today) "in all"\n  text "x"\n';
  assert.deepEqual(check(src).errors.map(String), []);
  assert.ok(JSON.stringify(load(src).tree()).includes('"text":"0 in all"'));
  assert.equal(check('app "T"\ntable t n num\nstatcard count(t) "rows"\n').ok, false);
});
