// Browser tests: host hidden, RTL, root font scale, Urdu chart labels, exercise paging at 10k, at the 5 viewports.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, open, FIXTURES, VIEWPORTS, auditFn } from './lib.mjs';

let srv, browser;
before(async () => { srv = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });
const noLog = (log) => assert.deepEqual(log, [], 'console output: ' + log.join(' | '));

test('window.moldeHost is deleted after boot: page code cannot read or write the adapter or the bridge', async () => {
  const init = () => {
    const rows = new Map(), kv = new Map();
    const adapter = { rows: (t) => Array.from(rows.get(t)?.values() || []), put: (t, r) => { if (!rows.has(t)) rows.set(t, new Map()); rows.get(t).set(r.id, JSON.parse(JSON.stringify(r))); }, nextId: (t) => Array.from(rows.get(t)?.keys() || [0]).reduce((a, b) => Math.max(a, b), 0) + 1, kvGet: (k) => kv.get(k), kvSet: (k, v) => kv.set(k, v), errors: [] };
    window.moldeHost = { adapter, locale: 'en-US', bridge: { notify() {} } };
  };
  const { page, ctx, log } = await open(browser, srv.base, 'water', { seed: false, before: (p) => p.addInitScript(init) });
  const r = await page.evaluate(() => {
    const found = []; for (const k of Object.getOwnPropertyNames(window)) { let v; try { v = window[k]; } catch (e) { continue; } if (v && typeof v === 'object' && (typeof v.nextId === 'function' || typeof v.kvSet === 'function' || typeof v.put === 'function')) found.push(k); }
    return { host: typeof window.moldeHost, found, dunder: Object.getOwnPropertyNames(window).filter((k) => k.startsWith('__') && k !== '__pwClock'), alpine: Object.keys(window.Alpine || {}).filter((k) => /adapter|moldeHost/i.test(k)) };
  });
  assert.equal(r.host, 'undefined'); assert.deepEqual(r.found, [], 'no global holds the adapter'); assert.deepEqual(r.dunder, []); assert.deepEqual(r.alpine, []);
  await page.locator('button', { hasText: '+250' }).click(); assert.equal(await page.locator('.stat').innerText(), '250', 'the app still works through the hidden adapter');
  await ctx.close(); noLog(log);
});

test('RTL (Urdu): no overflow on all fixtures at 360 and 600 px, numbers and units stay together', async () => {
  for (const f of FIXTURES) for (const w of [360, 600]) {
    const { page, ctx, log } = await open(browser, srv.base, f, { w, h: 800, q: '&dir=rtl&locale=ur-PK' });
    const a = await page.evaluate(auditFn); assert.deepEqual(a.overflow, [], f + ' ' + w + ' rtl overflow'); assert.deepEqual(a.small, []);
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).direction), 'rtl');
    const bad = await page.$$eval('bdi', (els) => els.filter((e) => getComputedStyle(e).unicodeBidi !== 'isolate' || (/\d/.test(e.textContent) && /[a-z]/i.test(e.textContent) && getComputedStyle(e).direction !== 'ltr')).map((e) => e.textContent));
    assert.deepEqual(bad, [], 'mixed number+unit text keeps LTR order: ' + bad.slice(0, 3));
    await ctx.close(); noLog(log);
  }
  const e = await open(browser, srv.base, 'exercise', { w: 412, q: '&dir=rtl&locale=ur-PK' });
  assert.equal(await e.page.$eval('.list bdi.grow', (n) => getComputedStyle(n).direction), 'ltr', '"70 kg × 8" keeps its order'); await e.ctx.close();
  const w = await open(browser, srv.base, 'water', { w: 360, q: '&dir=rtl&locale=ur-PK' });
  assert.equal(await w.page.$eval('bdi.muted', (n) => getComputedStyle(n).direction), 'ltr', '"/ 2000 ml" stays together'); await w.ctx.close();
});

test('chart day labels do not collide at 360 px in Urdu and English', async () => {
  for (const q of ['&locale=ur-PK&dir=rtl', '']) for (const f of ['water', 'exercise']) {
    const { page, ctx, log } = await open(browser, srv.base, f, { w: 360, h: 800, q });
    const boxes = await page.$$eval('m-chart svg text.m-xl', (ts) => ts.map((t) => { const b = t.getBoundingClientRect(); return [b.left, b.right]; }).sort((a, b) => a[0] - b[0]));
    assert.ok(boxes.length >= 3, f + ' has labels');
    for (let i = 1; i < boxes.length; i++) assert.ok(boxes[i][0] >= boxes[i - 1][1] - 0.5, `${f} ${q}: labels ${i - 1} and ${i} overlap`);
    await ctx.close(); noLog(log);
  }
});

test('root font scale 150%: no overflow and targets stay >= 44 px on 5 fixtures x 5 viewports (type follows rem)', async () => {
  for (const f of FIXTURES) for (const [w, h] of VIEWPORTS) {
    const { page, ctx, log } = await open(browser, srv.base, f, { w, h });
    await page.evaluate(() => { document.documentElement.style.fontSize = '150%'; }); await page.setViewportSize({ width: w + 1, height: h }); await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(350);
    const a = await page.evaluate(auditFn);
    const fs = await page.evaluate(() => [getComputedStyle(document.documentElement).fontSize, getComputedStyle(document.querySelector('small, .muted, .chip, .stat')).fontSize, getComputedStyle(document.querySelector('h1')).fontSize]);
    assert.equal(fs[0], '24px'); assert.equal(fs[2], '30px', 'h1 follows the root size'); assert.ok(['21px', '60px'].includes(fs[1]), 'secondary text follows the root size: ' + fs[1]);
    assert.deepEqual(a.overflow, [], `${f} ${w}x${h} @150% overflow`); assert.deepEqual(a.small, [], `${f} ${w}x${h} small targets`); assert.deepEqual(a.tiny, []);
    await ctx.close(); noLog(log);
  }
});

test('secondary text is >= 14 px at 100%', async () => {
  const { page, ctx } = await open(browser, srv.base, 'habits');
  const sizes = await page.$$eval('small, .muted, .chip', (els) => els.filter((e) => e.getClientRects().length).map((e) => parseFloat(getComputedStyle(e).fontSize)));
  assert.ok(sizes.length > 5 && Math.min(...sizes) >= 14, 'min ' + Math.min(...sizes)); await ctx.close();
});

test('exercise with 10,000 sets in 10,000 groups: first paint under 1 s (best of 3 cold loads) and paging works', async () => {
  const paints = []; let last;
  for (let i = 0; i < 3; i++) {
    const c2 = await browser.newContext({ viewport: { width: 412, height: 915 } }); const page = await c2.newPage(); const errs = []; page.on('console', (m) => errs.push(m.text())); page.on('pageerror', (e) => errs.push(e.message));
    const t0 = Date.now(); await page.goto(`${srv.base}/app/exercise?big=10000`, { waitUntil: 'commit' }); await page.waitForSelector('.list .item'); paints.push(Date.now() - t0);
    noLog(errs); if (i < 2) await c2.close(); else last = { c2, page };
  }
  console.log(`# exercise 10k sets: first rows visible after ${paints.join(' / ')} ms (cold loads)`);
  assert.ok(Math.min(...paints) < 1000, 'first paint ' + paints);
  const { c2, page } = last; const n0 = await page.locator('.list .item').count(); assert.ok(n0 <= 60, 'only a page of blocks is in the DOM: ' + n0);
  const s = Date.now(); await page.locator('button', { hasText: 'Show more history' }).click(); await page.waitForFunction((n) => document.querySelectorAll('.list .item').length > n, n0); assert.ok(Date.now() - s < 1000);
  await c2.close();
});
