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
    <input type=text name='n' x-model.number = "a.v">
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

test('format.mjs: a literal < in text does not throw, and text survives', () => {
  const out = format('<p>a < b and 3<5 and x<</p><p>if (a<b) {}</p>');
  assert.match(out, /a < b and 3<5 and x</); assert.equal(format(out), out);
  assert.doesNotThrow(() => format('<')); assert.doesNotThrow(() => format('<<<>>> < <3 </ ></'));
});
test('format.mjs: self-closing SVG children keep their slash and are idempotent', () => {
  const out = format('<svg viewBox="0 0 8 8"><circle cx="4" cy="4" r="2"/><path d="M0 0"/><g><rect width="1" height="1" /></g></svg>');
  assert.equal(out, '<svg viewBox="0 0 8 8">\n  <circle cx="4" cy="4" r="2" />\n  <path d="M0 0" />\n  <g>\n    <rect width="1" height="1" />\n  </g>\n</svg>\n');
  assert.equal(format(out), out);
});
test('format.mjs: stray closers are dropped and the result is stable', () => {
  const out = format('<div></span><p>x</p></div></div></p>'); assert.equal(out, '<div>\n  <p>x</p>\n</div>\n'); assert.equal(format(out), out);
});
test('format.mjs: <pre> and <textarea> content is preserved byte for byte', () => {
  const src = '<div><pre class="a">  line 1\n    <b>x</b>   \n\nline 4</pre><textarea name="n">\n  keep   me\n</textarea></div>';
  const out = format(src);
  assert.ok(out.includes('<pre class="a">  line 1\n    <b>x</b>   \n\nline 4</pre>')); assert.ok(out.includes('<textarea name="n">\n  keep   me\n</textarea>'));
  assert.equal(format(out), out);
});
test('format.mjs: spacing inside an attribute is not rewritten', () => {
  const out = format('<div   :a = "x > 1"   @click=\'f( 1 , 2 )\'  data-x="a  b">t</div>');
  assert.equal(out, '<div :a = "x > 1" @click=\'f( 1 , 2 )\' data-x="a  b">t</div>\n');
});

// fuzz: 3000 random well-formed documents
function prng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const ATTRS = ['class="card"', 'x-data="{a: 1, b: [1,2]}"', ":v = \"a > 1 && b < 2\"", "@click='f(1, 2)'", 'hidden', 'x-model.number="a.v"', 'data-k = v', 'title="a  b"', 'aria-label="x"'];
const TEXTS = ['Hello', 'a < b', '3<5', 'x<', 'Total: 5 > 3', 'Rock &amp; roll', 'line one line two', '  padded  ', 'ok'];
function gen(r, depth) {
  const pick = (a) => a[Math.floor(r() * a.length)], ws = () => pick(['', ' ', '\n', '\n  ', '\t']);
  const attrs = () => Array.from({ length: Math.floor(r() * 3) }, () => pick(ATTRS)).join(pick([' ', '  ', '\n ']));
  const open = (n, extra = '') => '<' + n + (attrs() || extra ? ' ' + (attrs() + extra).trim() : '') + (extra ? '' : '');
  let out = '';
  const n = 1 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const k = r();
    if (k < 0.25) out += pick(TEXTS) + ws();
    else if (k < 0.35) out += '<input ' + (attrs() || 'type=text') + '>' + ws();
    else if (k < 0.40) out += '<br>' + ws();
    else if (k < 0.48) out += '<svg viewBox="0 0 8 8">' + '<circle cx="1" r="2"/>' + ws() + '<path d="M0 0" />' + '</svg>' + ws();
    else if (k < 0.52) out += '<pre>' + pick(['  a\n b', 'x', '<i>q</i>\n\n']) + '</pre>' + ws();
    else if (k < 0.55) out += '<textarea name="t">' + pick(['', ' a ', '\n b\n']) + '</textarea>' + ws();
    else if (k < 0.58) out += '<!-- note ' + i + ' -->' + ws();
    else if (k < 0.60) out += '<script>\n  let a = 1 < 2;\n   a++\n</script>' + ws();
    else if (depth < 4) { const tag = pick(['div', 'span', 'p', 'h1', 'm-stat', 'button', 'label', 'template', 'ul', 'li', 'main', 'small']); out += '<' + tag + (attrs() ? ' ' + attrs() : '') + '>' + ws() + (depth < 4 ? gen(r, depth + 1) : '') + ws() + '</' + tag + '>' + ws(); }
  }
  return out;
}
test('format.mjs fuzz: 3000 random well-formed documents never throw and are idempotent', () => {
  const r = prng(20261112); let bad = 0, first = null;
  for (let i = 0; i < 3000; i++) {
    const src = gen(r, 0);
    let a, b;
    try { a = format(src); b = format(a); } catch (e) { bad++; first = first || { src, e: e.message }; continue; }
    if (a !== b) { bad++; first = first || { src, a, b }; }
  }
  assert.equal(bad, 0, JSON.stringify(first, null, 1));
});
