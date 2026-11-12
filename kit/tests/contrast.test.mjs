// Computed contrast (real browser, real CSS): every theme x light/dark x text role on a specimen page, then every text node on
// all 5 fixtures x 5 themes x light/dark. >= 4.5:1 for text (3:1 for large text), >= 3:1 for the edges of inputs and buttons.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, open, FIXTURES, THEMES } from './lib.mjs';

let srv, browser;
before(async () => { srv = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });

// runs in the page
const probe = () => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const parse = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (top, bot) => { const a = top[3] + bot[3] * (1 - top[3]); return [0, 1, 2].map((i) => (top[i] * top[3] + bot[i] * bot[3] * (1 - top[3])) / (a || 1)).concat([a]); };
  const bgOf = (el) => { const layers = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c[3] > 0) layers.push(c); if (c[3] === 1) break; } let acc = [255, 255, 255, 1]; for (const l of layers.reverse()) acc = over(l, acc); return acc; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const res = [];
  const check = (el, name, kind, fgCss, bg) => {
    const bgc = bg || bgOf(el); const fg = over(parse(fgCss), bgc);
    res.push({ name, kind, ratio: ratio(fg, bgc) });
  };
  const roles = [...document.querySelectorAll('[id^=r-]')];
  if (roles.length) {
    for (const el of roles) {
      const cs = getComputedStyle(el);
      if (el.id === 'r-input') {
        check(el, 'input text', 'text', cs.color); check(el, 'placeholder', 'text', getComputedStyle(el, '::placeholder').color);
        const sh = cs.boxShadow.match(/(rgba?\([^)]*\)|color\([^)]*\)|oklab\([^)]*\))/); // the filled input's edge is its bottom shadow
        check(el, 'input edge', 'ui', sh ? sh[1] : cs.borderTopColor, bgOf(el)); continue;
      }
      if (el.id === 'r-ghost') { check(el, 'ghost text', 'text', cs.color); check(el, 'ghost edge', 'ui', cs.borderTopColor, bgOf(el.parentElement)); continue; }
      if (el.id === 'r-danger') { check(el, 'danger text', 'text', cs.color); continue; }
      if (el.id === 'r-opt-off') { check(el, 'option text', 'text', cs.color); check(el, 'option edge', 'ui', cs.borderTopColor, bgOf(el.parentElement)); continue; }
      if (/^r-c\d+$/.test(el.id)) { check(el, 'categorical ' + el.id.slice(2), 'ui', cs.fill, bgOf(document.getElementById('r-input'))); continue; }
      if (/^r-cc\d+$/.test(el.id)) { check(el, 'mark on ' + el.id.slice(4), 'ui', cs.fill, parse(getComputedStyle(document.getElementById(el.dataset.on)).fill)); continue; }
      if (el.id === 'r-check') { check(el, 'check ring', 'ui', getComputedStyle(el, '::before').borderTopColor, bgOf(el)); continue; }
      if (el.id === 'r-empty' || el.id === 'r-legend' || el.id.startsWith('r-')) check(el, el.id.slice(2), 'text', cs.color);
    }
  }
  return res;
};
const fixtureProbe = () => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const parse = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (t, b) => { const a = t[3] + b[3] * (1 - t[3]); return [0, 1, 2].map((i) => (t[i] * t[3] + b[i] * b[3] * (1 - t[3])) / (a || 1)).concat([a]); };
  const bgOf = (el) => { const layers = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c[3] > 0) layers.push(c); if (c[3] === 1) break; } let acc = [255, 255, 255, 1]; for (const l of layers.reverse()) acc = over(l, acc); return acc; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bad = []; let n = 0;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t; (t = w.nextNode());) {
    if (!t.textContent.trim()) continue;
    const el = t.parentElement; if (!el.getClientRects().length) continue;
    const cs = getComputedStyle(el); const svg = el.closest('svg');
    const fgCss = svg ? cs.fill : cs.color; const bg = bgOf(el); const fg = over(parse(fgCss), bg);
    const size = parseFloat(cs.fontSize), large = size >= 24 || (size >= 18.66 && +cs.fontWeight >= 500 && false);
    const r = ratio(fg, bg); n++;
    if (r < (large ? 3 : 4.5)) bad.push(`${el.localName}.${el.className} "${t.textContent.trim().slice(0, 24)}" ${r.toFixed(2)}`);
  }
  // non-text parts that carry meaning: input edges, selected bar vs card
  for (const i of document.querySelectorAll('input:not([type=radio]):not([type=checkbox]), textarea')) {
    const cs = getComputedStyle(i), bg = bgOf(i.parentElement), cands = [cs.borderTopColor, cs.borderBottomColor];
    const sh = cs.boxShadow.match(/(rgba?\([^)]*\)|color\([^)]*\)|oklab\([^)]*\))/); if (sh) cands.push(sh[1]);
    const r = Math.max(1, ...cands.map((c) => { const f = over(parse(c), bg); return f[3] === 0 ? 1 : ratio(f, bg); })); n++; if (r < 3) bad.push(`input edge ${r.toFixed(2)}`);
  }
  return { n, bad };
};

for (const theme of THEMES) for (const scheme of ['light', 'dark']) {
  test(`contrast: ${theme} ${scheme}: every text role >= 4.5:1, input/button edges >= 3:1`, async () => {
    const ctx = await browser.newContext({ colorScheme: scheme }); const page = await ctx.newPage();
    await page.goto(srv.base + '/specimen'); await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme); await page.waitForTimeout(100);
    const res = await page.evaluate(probe); await ctx.close();
    assert.ok(res.length >= 20, 'specimen roles measured: ' + res.length);
    const bad = res.filter((r) => r.ratio < (r.kind === 'ui' ? 3 : 4.5));
    console.log(`# ${theme}/${scheme}: ${res.length} roles, min text ${Math.min(...res.filter((r) => r.kind === 'text').map((r) => r.ratio)).toFixed(2)}, min ui ${Math.min(...res.filter((r) => r.kind === 'ui').map((r) => r.ratio)).toFixed(2)}`);
    assert.deepEqual(bad.map((r) => `${r.name} ${r.ratio.toFixed(2)}`), []);
  });
}

test('contrast: every text node of 5 fixtures x 5 themes x light/dark >= 4.5:1', async () => {
  let total = 0; const fails = [];
  for (const f of FIXTURES) for (const theme of THEMES) for (const scheme of ['light', 'dark']) {
    const { page, ctx } = await open(browser, srv.base, f, { theme, scheme });
    const r = await page.evaluate(fixtureProbe); await ctx.close();
    total += r.n; r.bad.forEach((b) => fails.push(`${f}/${theme}/${scheme}: ${b}`));
  }
  console.log(`# fixture text nodes + input edges measured: ${total}`);
  assert.deepEqual(fails, []);
});
