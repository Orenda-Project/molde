import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { format } from '../format.mjs';
import { FIXTURES, KIT } from './lib.mjs';

for (const f of FIXTURES) {
  test(`format.mjs: ${f} fixture is canonical and formatting is idempotent`, () => {
    const src = readFileSync(`${KIT}/fixtures/${f}/app.html`, 'utf8');
    assert.equal(format(src), src, 'fixture file is already canonical');
    assert.equal(format(format(src)), format(src));
  });
}

test('format.mjs: messy input becomes canonical, attributes untouched, idempotent', () => {
  const messy = `<main   x-data="{a: store.t('log')}"><h1>
   Title   here </h1>
<div   class="row"  ><input  type=text   name='n' x-model.number = "a.v"><button @click="a.add({x:1})"   >Go</button></div>
<m-stat  :value="a.sum('x',{since:'week'})"   label="W"></m-stat>
<script>
      Alpine.data('x', () => ({
         n: 1,
      }))
</script></main>`;
  const out = format(messy);
  assert.equal(out, `<main x-data="{a: store.t('log')}">
  <h1>Title here</h1>
  <div class="row">
    <input type=text name='n' x-model.number="a.v">
    <button @click="a.add({x:1})">Go</button>
  </div>
  <m-stat :value="a.sum('x',{since:'week'})" label="W"></m-stat>
  <script>
    Alpine.data('x', () => ({
       n: 1,
    }))
  </script>
</main>
`);
  assert.equal(format(out), out);
});
