// Browser tests: host hidden, RTL, root font scale, Urdu chart labels, exercise paging at 10k, at the 5 viewports.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, open, inject, FIXTURES, VIEWPORTS, auditFn, del } from './lib.mjs';

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
  await page.locator('.m-quick button', { hasText: '+250' }).click(); assert.equal(await page.locator('.stat').innerText(), '250 ml', 'the app still works through the hidden adapter');
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
    assert.equal(fs[0], '24px'); assert.equal(fs[2], '30px', 'h1 follows the root size'); assert.ok(['22.5px', '60px'].includes(fs[1]), 'secondary text follows the root size: ' + fs[1]);
    assert.deepEqual(a.overflow, [], `${f} ${w}x${h} @150% overflow`); assert.deepEqual(a.small, [], `${f} ${w}x${h} small targets`); assert.deepEqual(a.tiny, []);
    await ctx.close(); noLog(log);
  }
});

test('secondary text is >= 14 px at 100%', async () => {
  const { page, ctx } = await open(browser, srv.base, 'habits');
  const sizes = await page.$$eval('small, .muted, .chip', (els) => els.filter((e) => e.getClientRects().length).map((e) => parseFloat(getComputedStyle(e).fontSize)));
  assert.ok(sizes.length > 5 && Math.min(...sizes) >= 14, 'min ' + Math.min(...sizes)); await ctx.close();
});

test('exercise with 10,000 sets in 10,000 groups (a stress case, about 27 years of daily sets): first rows under 4 s (best of 3 cold loads; the richer exemplar evaluates its history getters several times) and paging works', async () => {
  const paints = []; let last;
  for (let i = 0; i < 3; i++) {
    const c2 = await browser.newContext({ viewport: { width: 412, height: 915 } }); const page = await c2.newPage(); const errs = []; page.on('console', (m) => errs.push(m.text())); page.on('pageerror', (e) => errs.push(e.message));
    const t0 = Date.now(); await page.goto(`${srv.base}/app/exercise?big=10000`, { waitUntil: 'commit' }); await page.waitForSelector('.list .item'); paints.push(Date.now() - t0);
    noLog(errs); if (i < 2) await c2.close(); else last = { c2, page };
  }
  console.log(`# exercise 10k sets: first rows visible after ${paints.join(' / ')} ms (cold loads)`);
  assert.ok(Math.min(...paints) < 4000, 'first paint ' + paints);
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

test('narrow viewports 240 and 320 px: all fixtures render without overflow and the habit targets stay 44 px', async () => {
  for (const f of FIXTURES) for (const w of [240, 320]) {
    const { page, ctx, log } = await open(browser, srv.base, f, { w, h: 640 });
    const a = await page.evaluate(auditFn); assert.deepEqual(a.overflow, [], `${f} @${w}`); assert.deepEqual(a.tiny, []);
    if (f === 'habits') assert.deepEqual(a.small, [], 'habit targets at ' + w);
    await ctx.close(); noLog(log);
  }
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
  await p.locator('.m-quick button', { hasText: '+250' }).click();
  await p.reload(); await p.waitForTimeout(500);
  assert.equal(await p.locator('small [contenteditable]').innerText(), '3,000', 'goal persisted'); assert.equal(await p.locator('.stat').innerText(), '250 ml', 'rows persisted');
  await w.ctx.close(); noLog(w.log);
  const b = await open(browser, srv.base, 'budget', { seed: false, before: (q) => q.addInitScript(init) });
  await b.page.locator('[contenteditable]').first().click(); await b.page.keyboard.press('Control+A'); await b.page.keyboard.type('50000'); await b.page.keyboard.press('Enter');
  await b.page.reload(); await b.page.waitForTimeout(500); assert.equal(await b.page.locator('[contenteditable]').first().innerText(), '50,000', 'budget persisted');
  await b.ctx.close(); noLog(b.log);
});

test('scale: journal and habits cap what they render at 1,000 and 10,000 rows; first paint is the MEDIAN of 3 cold loads and stays under 1.5 s (a loaded CI machine makes a single load vary by +-30%)', async () => {
  for (const [f, sel, cap] of [['journal', 'm-list .item', 31], ['habits', '.item.wrap', 41]]) for (const big of [1000, 10000]) {
    const times = []; let n = 0;
    for (let k = 0; k < 3; k++) {
      const c2 = await browser.newContext({ viewport: { width: 412, height: 915 } }); const page = await c2.newPage(); const errs = []; page.on('console', (m) => errs.push(m.text())); page.on('pageerror', (e) => errs.push(e.message));
      const t0 = Date.now(); await page.goto(`${srv.base}/app/${f}?big=${big}`, { waitUntil: 'commit' }); await page.waitForSelector(sel); times.push(Date.now() - t0);
      n = await page.locator(sel).count(); noLog(errs); await c2.close();
    }
    const ms = times.sort((a, b) => a - b)[1]; console.log(`# ${f} ${big} rows: first paint median ${ms} ms (${times.join(',')}), ${n} rows in the DOM`);
    assert.ok(n <= cap + 1, `${f} renders at most a page: ${n}`); assert.ok(ms < 1500, `${f} ${big} rows first paint median ${ms} ms`);
  }
});

test('$day(n) (page magic): dates relative to today, month boundaries, reactive across midnight', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'habits');
  const r = await page.evaluate(() => { const el = document.querySelector('main'); const ev = (e) => Alpine.evaluate(el, e); return { t: ev('$day()'), t0: ev('$day(0)'), y: ev('$day(-1)'), oct: ev('$day(-21)'), dec: ev('$day(10)'), app: app.today(), n: ev('typeof $day(1 - 7)') }; });
  assert.deepEqual(r, { t: '2026-11-21', t0: '2026-11-21', y: '2026-11-20', oct: '2026-10-31', dec: '2026-12-01', app: '2026-11-21', n: 'string' });
  await ctx.close(); noLog(log);
});

test('segmented control wraps (no hidden options) and journal mood faces keep 44 px targets at 240 and 320 px', async () => {
  for (const w of [240, 320]) {
    const b = await open(browser, srv.base, 'budget', { w, h: 700 });
    const seg = await b.page.$$eval('.seg label', (ls) => ls.map((l) => { const r = l.getBoundingClientRect(); return [r.left, r.right, r.width, r.height]; }));
    assert.equal(seg.length, 5); assert.ok(seg.every((s) => s[0] >= 0 && s[1] <= w && s[3] >= 44), `all five options are visible and tappable at ${w}: ` + JSON.stringify(seg));
    await b.ctx.close(); noLog(b.log);
    const j = await open(browser, srv.base, 'journal', { w, h: 700 });
    const faces = await j.page.$$eval('form label:has(input[type=radio])', (ls) => ls.map((l) => { const r = l.getBoundingClientRect(); return [r.left, r.right, r.width, r.height]; }));
    assert.equal(faces.length, 5); assert.ok(faces.every((f) => f[2] >= 44 && f[3] >= 44 && f[0] >= 0 && f[1] <= w), `faces >= 44 px at ${w}: ` + JSON.stringify(faces));
    await j.ctx.close(); noLog(j.log);
  }
});

test('one input style kit-wide: every text, number and textarea field is the filled style; no mixed looks', async () => {
  for (const f of FIXTURES) {
    const { page, ctx } = await open(browser, srv.base, f);
    const styles = await page.$$eval('input:not([type=radio]):not([type=checkbox]):not([type=hidden]), textarea', (els) => els.filter((e) => e.getClientRects().length).map((e) => { const c = getComputedStyle(e); return [c.backgroundColor, c.boxShadow !== 'none', c.borderTopColor].join('|'); }));
    assert.ok(new Set(styles).size <= 1, f + ' mixes input styles: ' + [...new Set(styles)].join(' // '));
    await ctx.close();
  }
});

test('the five fixtures use five different themes and secondary text is never below 15 px', async () => {
  const themes = [];
  for (const f of FIXTURES) { const { page, ctx } = await open(browser, srv.base, f); themes.push(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))); const sizes = await page.$$eval('small, .muted, .chip', (els) => els.filter((e) => e.getClientRects().length).map((e) => parseFloat(getComputedStyle(e).fontSize))); assert.ok(Math.min(...sizes) >= 15, f + ' min ' + Math.min(...sizes)); await ctx.close(); }
  assert.equal(new Set(themes).size, 5, themes.join());
});

test('the kebab: first tap arms Delete (4 s) and announces it, a double tap does not delete, a tap elsewhere disarms, a separate second tap deletes with ONE Undo', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'water');
  const k = page.locator('m-list .ibtn').first(); assert.match(await k.getAttribute('aria-label'), /^More actions/); const rows = () => page.evaluate(() => store.t('cup').rows.length); const n0 = await rows();
  await k.click(); assert.match(await k.getAttribute('aria-label'), /^Delete/); assert.equal(await rows(), n0, 'the first tap does not delete');
  await page.waitForTimeout(100); assert.match(await page.locator('.m-sr[aria-live=assertive]').innerText(), /Tap Delete again to confirm/, 'arming is announced');
  await k.click(); await page.waitForTimeout(60); assert.equal(await rows(), n0, 'a double tap (two taps < 300 ms apart) only arms: nothing is deleted');
  await page.locator('h1').click(); assert.match(await k.getAttribute('aria-label'), /^More actions/, 'blur disarms');
  await k.click(); await page.waitForTimeout(4200); assert.match(await k.getAttribute('aria-label'), /^More actions/, 'it disarms by itself after 4 s');
  await del(k); assert.equal(await rows(), n0 - 1); assert.equal(await page.locator('.m-toast').count(), 1);
  assert.match(await page.locator('.m-toast span').innerText(), /^Removed/);
  await ctx.close(); noLog(log);
});
