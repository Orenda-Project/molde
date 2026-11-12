// Browser tests: host hidden, RTL, root font scale, Urdu chart labels, exercise paging at 10k, at the 5 viewports.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, open, inject, FIXTURES, VIEWPORTS, auditFn } from './lib.mjs';

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
  const b = await open(browser, srv.base, 'budget', { w: 360, q: '&dir=rtl&locale=ur-PK' });
  const boxes = await b.page.$$eval('m-form input[name=description], m-form input[name=amount]', (is) => is.map((i) => { const r = i.getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom]; }));
  assert.ok(boxes.length === 2 && boxes.every((x) => x[0] >= 0 && x[1] <= 360), 'budget inputs fit in RTL'); const [a1, a2] = boxes; assert.ok(a1[3] <= a2[2] + 1 || a1[0] >= a2[1] - 1 || a2[0] >= a1[1] - 1, 'description and amount do not overlap'); assert.ok((await b.page.$eval('m-form .seg', (s) => getComputedStyle(s).direction)) === 'rtl'); await b.ctx.close();
  const w = await open(browser, srv.base, 'water', { w: 360, q: '&dir=rtl&locale=ur-PK' });
  assert.equal(await w.page.$eval('bdi.stat', (n) => getComputedStyle(n).direction), 'ltr', 'the number stays LTR'); await w.ctx.close();
});

test('chart day labels do not collide at 360 px in Urdu and English', async () => {
  for (const q of ['&locale=ur-PK&dir=rtl', '']) for (const f of ['water']) {
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

test('long unbroken text (400-char URL, word, Urdu) in every text column never widens the page: 5 fixtures at 240, 320, 360 and 800 px', async () => {
  for (const f of FIXTURES) for (const w of [240, 320, 360, 800]) {
    const { page, ctx, log } = await open(browser, srv.base, f, { w, h: 700, q: '&long=1' });
    const a = await page.evaluate(auditFn); assert.deepEqual(a.overflow, [], `${f} @${w} overflow`); if (w >= 320) assert.deepEqual(a.small, [], `${f} @${w} targets`);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok(sw <= 0, `${f} @${w} scrollWidth +${sw}`);
    const found = await page.evaluate(() => /W{50}|a{60}|(\u06a9\u06be\u0627\u0646\u0627){10}/.test(document.body.textContent)); assert.equal(found, f !== 'water', f + ' shows the long text');
    await ctx.close(); noLog(log);
  }
});

test('narrow viewports 240 and 320 px: all fixtures render without overflow and the habit grid shrinks its columns', async () => {
  for (const f of FIXTURES) for (const w of [240, 320]) {
    const { page, ctx, log } = await open(browser, srv.base, f, { w, h: 640 });
    const a = await page.evaluate(auditFn); assert.deepEqual(a.overflow, [], `${f} @${w}`); assert.deepEqual(a.tiny, []);
    if (f === 'habits') { const n = await page.$$eval('.item.grid small', (els) => els.filter((e) => e.offsetTop === els[0].offsetTop).length); assert.ok(n === (w === 240 ? 3 : 5), 'columns follow the width: ' + n); assert.deepEqual(a.small, [], 'habit targets at ' + w); }
    await ctx.close(); noLog(log);
  }
});

test('habit grid follows a resize: more columns when the window grows, targets stay >= 44 px', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'habits', { w: 360, h: 700 });
  const cols = () => page.$$eval('.item.grid small', (els) => els.filter((e) => e.offsetTop === els[0].offsetTop).length); const c0 = await cols();
  await page.setViewportSize({ width: 700, height: 700 }); await page.waitForTimeout(250); const c1 = await cols();
  await page.setViewportSize({ width: 300, height: 700 }); await page.waitForTimeout(250); const c2 = await cols();
  assert.ok(c1 > c0 && c2 < c0, `columns ${c0} -> ${c1} -> ${c2}`); assert.deepEqual((await page.evaluate(auditFn)).small, []);
  await ctx.close(); noLog(log);
});

test('m-form: maxlength follows the SDK limits and a counter appears near the limit', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'exercise');
  assert.equal(await page.$eval('input[name=exercise]', (i) => i.maxLength), 1000);
  const c = page.locator('m-form .m-count'); assert.equal(await c.isHidden(), true);
  await page.fill('input[name=exercise]', 'x'.repeat(850)); assert.equal(await c.isVisible(), true); assert.equal(await c.innerText(), '850 / 1000');
  await page.fill('input[name=exercise]', 'x'.repeat(1000)); assert.equal(await c.innerText(), '1000 / 1000');
  const j = await open(browser, srv.base, 'journal'); assert.equal(await j.page.$eval('textarea', (t) => t.maxLength), 20000); await j.ctx.close();
  await ctx.close(); noLog(log);
});

test('m-list :rows with a row that has no `at` (or a broken value) does not blank the list', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'exercise');
  await inject(page, '<m-list :table="s" :rows="[{id: 901, exercise: \'No date\', kg: 5, reps: 1}, {id: 902, exercise: \'Has date\', kg: 6, reps: 1, at: Date.now()}, {id: 903, exercise: {}, at: NaN}]" title="exercise" sub="kg" by="day"></m-list>', "{s: store.t('set')}");
  const text = await page.locator('#inj').innerText(); assert.match(text, /No date/); assert.match(text, /Has date/); assert.ok(!/NaN|undefined/.test(text), text);
  await ctx.close(); noLog(log);
});

test('goals persist: a localStorage-backed host adapter keeps the edited goal and the rows across a reload', async () => {
  const init = () => {
    const L = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
    const adapter = { rows: (t) => L('r:' + t, []), get: (t, id) => L('r:' + t, []).find((r) => r.id === id), put: (t, r) => { const a = L('r:' + t, []).filter((x) => x.id !== r.id); a.push(r); localStorage.setItem('r:' + t, JSON.stringify(a)); }, nextId: (t) => L('r:' + t, []).reduce((m, r) => Math.max(m, r.id), 0) + 1, kvGet: (k) => L('k:' + k, undefined), kvSet: (k, v) => localStorage.setItem('k:' + k, JSON.stringify(v)), errors: [] };
    window.moldeHost = { adapter, locale: 'en-US' };
  };
  const w = await open(browser, srv.base, 'water', { seed: false, before: (p) => p.addInitScript(init) }); const p = w.page;
  await p.locator('small [contenteditable]').click(); await p.keyboard.press('Control+A'); await p.keyboard.type('3000'); await p.keyboard.press('Enter');
  await p.locator('button', { hasText: '+250' }).click();
  await p.reload(); await p.waitForTimeout(500);
  assert.equal(await p.locator('small [contenteditable]').innerText(), '3000', 'goal persisted'); assert.equal(await p.locator('.stat').innerText(), '250', 'rows persisted');
  await w.ctx.close(); noLog(w.log);
  const b = await open(browser, srv.base, 'budget', { seed: false, before: (q) => q.addInitScript(init) });
  await b.page.locator('small [contenteditable]').click(); await b.page.keyboard.press('Control+A'); await b.page.keyboard.type('50000'); await b.page.keyboard.press('Enter');
  await b.page.reload(); await b.page.waitForTimeout(500); assert.equal(await b.page.locator('small [contenteditable]').innerText(), '50000', 'budget persisted');
  await b.ctx.close(); noLog(b.log);
});

test('scale: journal and habits stay fast and cap what they render at 1,000 and 10,000 rows', async () => {
  for (const [f, sel, cap] of [['journal', 'm-list .item', 31], ['habits', '.item.wrap', 41]]) for (const big of [1000, 10000]) {
    const c2 = await browser.newContext({ viewport: { width: 412, height: 915 } }); const page = await c2.newPage(); const errs = []; page.on('console', (m) => errs.push(m.text())); page.on('pageerror', (e) => errs.push(e.message));
    const t0 = Date.now(); await page.goto(`${srv.base}/app/${f}?big=${big}`, { waitUntil: 'commit' }); await page.waitForSelector(sel); const ms = Date.now() - t0;
    const n = await page.locator(sel).count(); console.log(`# ${f} ${big} rows: first paint ${ms} ms, ${n} rows in the DOM`);
    assert.ok(n <= cap + 1, `${f} renders at most a page: ${n}`); assert.ok(ms < 1000, `${f} ${big} rows first paint ${ms} ms`); noLog(errs); await c2.close();
  }
});
