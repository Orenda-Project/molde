// Round 2 browser tests: focus, midnight, columns added later, odd numbers, big series, pie, forms, 10k rows, public surface.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, open, inject } from './lib.mjs';

let srv, browser;
before(async () => { srv = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });
const noLog = (log) => assert.deepEqual(log, [], 'console output: ' + log.join(' | '));

test('focus survives re-render: keyboard toggle on the habit grid, remove button, timer button', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'habits');
  const cell = page.locator('.m-hrow', { hasText: 'Stretch' }).locator('.m-cell').first();
  await cell.focus(); const label = await cell.getAttribute('aria-label');
  await page.keyboard.press('Enter');
  assert.equal(await cell.getAttribute('aria-pressed'), 'true'); // (stale handle: re-query below proves the DOM was replaced)
  const active = () => page.evaluate(() => { const a = document.activeElement; return a && { label: a.getAttribute('aria-label'), cls: a.className, pressed: a.getAttribute('aria-pressed') }; });
  let a = await active(); assert.equal(a.label, label, 'focus stays on the same grid cell'); assert.equal(a.cls, 'm-cell');
  await page.keyboard.press('Space'); a = await active(); assert.equal(a.label, label); assert.equal(a.pressed, 'false');
  await page.keyboard.press('Tab'); a = await active(); assert.notEqual(a.label, label, 'tab still moves on');
  await ctx.close(); noLog(log);
  const e = await open(browser, srv.base, 'exercise');
  const x = e.page.locator('m-list .m-x').first(); await x.focus(); await e.page.keyboard.press('Enter');
  assert.equal(await e.page.evaluate(() => document.activeElement.className), 'm-x', 'focus lands on a remove button, not <body>');
  const st = e.page.locator('m-timer button', { hasText: 'Start' }); await st.focus(); await e.page.keyboard.press('Enter');
  assert.equal(await e.page.evaluate(() => document.activeElement.textContent.trim()), 'Pause');
  await e.ctx.close(); noLog(e.log);
});

test('midnight: with a fake clock the grid, lead and header move to the new day without a reload', async () => {
  const now = new Date(); const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 40);
  const { page, ctx, log } = await open(browser, srv.base, 'habits', { before: (p) => p.clock.install({ time: t0 }) });
  const head = () => page.locator('.m-hd.today').innerText();
  assert.match(await page.locator('.m-lead').innerText(), /Done today: 2 of 4/);
  const d0 = (await head()).split('\n')[1];
  await page.clock.runFor(31000);
  const tomorrow = new Date(t0.getTime() + 864e5);
  assert.equal((await head()).split('\n')[1], String(tomorrow.getDate()), 'today column moved (was ' + d0 + ')');
  assert.match(await page.locator('.m-lead').innerText(), /Done today: 0 of 4/);
  await ctx.close(); noLog(log);
});

test('a column added after rows exist: every component shows type defaults, never NaN or undefined', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'exercise', { q: '&grow=1' });
  await inject(page, '<m-list :table="s" title="exercise" sub="stars" meta="mood2,note2,ok,on"></m-list><m-chart :table="s" col="stars"></m-chart><m-stat :value="s.sum(\'stars\')" label="Stars"></m-stat>', "{s: store.t('set')}");
  const text = await page.locator('#inj').innerText(); const html = await page.locator('#inj').innerHTML();
  assert.ok(!/NaN|undefined|null|Infinity/.test(text + html.replace(/aria-[a-z]+="[^"]*"/g, '')), text.slice(0, 300));
  assert.match(text, /Calm/); assert.match(await page.locator('#inj .m-row').first().innerText(), /0\s*·|0$/m);
  await ctx.close(); noLog(log);
});

test('odd numbers: Infinity, NaN, 1e30, negatives in m-stat, bar, line, pie and rows never overflow or print NaN', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'exercise', { w: 360, h: 640 });
  const data = "[{k:'2026-11-06',v:Infinity},{k:'2026-11-07',v:NaN},{k:'2026-11-08',v:1e30},{k:'2026-11-09',v:-40},{k:'2026-11-10',v:-Infinity},{k:'2026-11-11',v:12},{k:'2026-11-12',v:0}]";
  await inject(page, `<m-stat label="Big" :value="1e30" :of="1e15" unit="ml"></m-stat><m-stat left label="Neg" :value="-5" :of="NaN"></m-stat><m-stat label="Inf" :value="Infinity" :of="Infinity"></m-stat><m-chart :data="${data}"></m-chart><m-chart type="line" :data="${data}"></m-chart><m-chart type="pie" :data="${data}"></m-chart><m-chart type="rows" :data="${data}"></m-chart>`);
  const html = await page.locator('#inj').innerHTML(), text = await page.locator('#inj').innerText();
  assert.ok(!/NaN|Infinity/.test(text + html), 'no NaN or Infinity anywhere in text or attributes');
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok(over <= 0, 'overflow ' + over);
  const rects = await page.$$eval('#inj m-chart svg rect', (rs) => rs.map((r) => [+r.getAttribute('width'), +r.getAttribute('height'), +r.getAttribute('y')]));
  assert.ok(rects.length >= 7 && rects.every(([w, h, y]) => w > 0 && h >= 2 && Number.isFinite(y)), 'all bars have positive size: ' + JSON.stringify(rects.slice(0, 3)));
  const base = await page.$eval('#inj m-chart .m-base', (l) => +l.getAttribute('y1'));
  const neg = await page.$$eval('#inj m-chart:first-of-type svg rect', (rs, b) => rs.filter((r) => +r.getAttribute('y') >= b - 0.5).length, base);
  assert.ok(neg >= 2, 'negative values hang below the zero line (' + neg + ')');
  assert.ok((await page.locator('#inj m-chart').first().innerText()).includes('−'), 'negative bars are labelled with a minus sign');
  assert.match(await page.locator('#inj m-stat').first().innerText(), /1T|1,000,000,000,000|1000B|1\.0?T/i);
  await ctx.close(); noLog(log);
});

test('series(last >= 37, up to 366): no negative widths, no console errors, no overflow, labels thinned', async () => {
  for (const last of [31, 37, 90, 366, 400]) {
    const { page, ctx, log } = await open(browser, srv.base, 'exercise', { w: 360, h: 640 });
    await inject(page, `<m-chart :table="s" last="${last}"></m-chart><m-chart type="line" :table="s" last="${last}"></m-chart>`, "{s: store.t('set')}");
    const n = await page.$$eval('#inj m-chart:first-of-type svg rect', (r) => r.length); assert.equal(n, Math.min(last, 366), 'bars for last=' + last);
    const bad = await page.$$eval('#inj svg *', (els) => els.filter((e) => ['width', 'height'].some((a) => e.hasAttribute(a) && +e.getAttribute(a) < 0)).length); assert.equal(bad, 0);
    const labels = await page.$$eval('#inj m-chart:first-of-type svg text', (t) => t.length); assert.ok(labels <= 14, 'labels thinned: ' + labels);
    assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);
    await ctx.close(); noLog(log);
  }
});

test('pie: more than 5 categories become an Other slice and the percentages sum to 100', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'budget', { w: 360, h: 640 });
  const cats = "[{k:'a',v:30},{k:'b',v:25},{k:'c',v:15},{k:'d',v:12},{k:'e',v:8},{k:'f',v:5},{k:'g',v:3},{k:'h',v:2}]";
  await inject(page, `<m-chart type="pie" :data="${cats}"></m-chart>`);
  const items = await page.$$eval('#inj .m-legend li', (l) => l.map((x) => x.innerText.replace(/\s+/g, ' ')));
  assert.equal(items.length, 5); assert.match(items[4], /^Other/);
  const pcts = items.map((s) => +s.match(/(\d+)%/)[1]); assert.equal(pcts.reduce((a, b) => a + b, 0), 100, items.join(' | '));
  assert.match(items[4], /18 · 18%/); assert.equal(await page.locator('#inj circle.m-ring').count(), 6);
  await ctx.close(); noLog(log);
});

test('pie and rows legends do not collapse on long English or Urdu labels at 360 px', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'budget', { w: 360, h: 640 });
  const d = "[{k:'Medical and pharmacy expenses for the whole extended family this quarter',v:900},{k:'کھانے پینے کی اشیاء اور گھریلو سامان کی خریداری',v:600},{k:'Transport',v:300},{k:'Supercalifragilisticexpialidocious_Supercalifragilisticexpialidocious',v:100}]";
  await inject(page, `<m-chart type="pie" :data="${d}"></m-chart><m-chart type="rows" :data="${d}"></m-chart>`);
  const m = await page.$$eval('#inj .m-legend li .m-n', (n) => n.map((e) => Math.round(e.getBoundingClientRect().width)));
  assert.ok(m.every((w) => w >= 100), 'legend names keep a readable width: ' + m);
  const lines = await page.$eval('#inj .m-legend li .m-n', (e) => Math.round(e.getBoundingClientRect().height / 20)); assert.ok(lines >= 2, 'long label wraps');
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0, 'no horizontal overflow');
  await ctx.close(); noLog(log);
});

test('forms: whitespace-only text rejected, empty number not stored as 0, double click adds once', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'exercise');
  const rows = () => page.locator('m-list .m-row').count();
  const r0 = await rows();
  await page.fill('input[name=exercise]', '   '); await page.fill('input[name=kg]', '20'); await page.fill('input[name=reps]', '5'); await page.click('button[type=submit]');
  assert.equal(await rows(), r0, 'whitespace-only exercise name rejected'); assert.equal(await page.$eval('input[name=exercise]', (i) => i.validationMessage), 'Enter some text');
  await page.fill('input[name=exercise]', 'Press'); await page.fill('input[name=kg]', ''); await page.click('button[type=submit]');
  assert.equal(await rows(), r0, 'empty number is not stored as 0'); assert.equal(await page.$eval('input[name=kg]', (i) => i.validity.valueMissing), true);
  await page.fill('input[name=kg]', '20'); await page.fill('input[name=reps]', '5'); await page.dblclick('button[type=submit]');
  assert.equal(await rows(), r0 + 1, 'double click inserts one row'); assert.equal(await page.locator('.m-row', { hasText: '20 kg × 5' }).count(), 1);
  await ctx.close(); noLog(log);
});

test('10,000 rows: first render and every "Show more" click stay responsive', async () => {
  const t0 = Date.now();
  const { page, ctx, log } = await open(browser, srv.base, 'budget', { q: '&big=10000' });
  const load = Date.now() - t0;
  assert.equal(await page.locator('m-list .m-row').count(), 30);
  const times = [];
  for (let i = 0; i < 4; i++) { const s = Date.now(); await page.locator('.m-more').click(); await page.waitForFunction((n) => document.querySelectorAll('m-list .m-row').length >= n, 30 * (i + 2)); times.push(Date.now() - s); }
  console.log(`# 10k rows: load ${load} ms, show-more clicks ${times.join('/')} ms, rows now ${await page.locator('m-list .m-row').count()}`);
  assert.ok(times.every((x) => x < 1500), 'each click < 1.5 s: ' + times);
  assert.ok(load < 6000, 'load ' + load);
  assert.match(await page.locator('.m-more').innerText(), /left/);
  await ctx.close(); noLog(log);
});

test('public surface in the page: Object.keys(window.store/ui/app) is exactly the 16 calls; t.rows is frozen; no kit internals', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'exercise');
  const r = await page.evaluate(() => {
    'use strict';
    const t = store.t('set'); let pushed = 'no', mut = 'no';
    try { t.rows.push({}); } catch (e) { pushed = e.constructor.name; }
    try { t.rows[0].kg = 1; } catch (e) { mut = e.constructor.name; }
    return { store: Object.keys(store).sort(), ui: Object.keys(ui).sort(), app: Object.keys(app).sort(), t: Object.keys(t).sort(), pushed, mut,
      hidden: [typeof app._notifications, typeof ui.toasts, typeof ui._dismiss, typeof t._schema, typeof t.schema, typeof store.internal], extra: Object.keys(window).filter((k) => ['sdk', 'internal', 'moldeSdk'].includes(k)) };
  });
  assert.deepEqual(r.store, ['kv', 't']); assert.deepEqual(r.ui, ['timer', 'toast']); assert.deepEqual(r.app, ['fmt', 'notify', 'today']);
  assert.deepEqual(r.t, ['add', 'group', 'has', 'remove', 'series', 'set', 'streak', 'sum', 'toggle']);
  assert.equal(r.store.length + r.ui.length + r.app.length + r.t.length, 16);
  assert.equal(r.pushed, 'TypeError'); assert.equal(r.mut, 'TypeError'); assert.deepEqual(r.hidden, Array(6).fill('undefined')); assert.deepEqual(r.extra, []);
  await ctx.close(); noLog(log);
});
