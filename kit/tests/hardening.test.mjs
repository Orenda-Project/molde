// Browser tests for the generic kit: focus, midnight, columns added later, odd numbers, big series, pie, forms, 10k rows, public surface.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, open, inject } from './lib.mjs';

let srv, browser;
before(async () => { srv = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });
const noLog = (log) => assert.deepEqual(log, [], 'console output: ' + log.join(' | '));

test('a column added after rows exist: m-list and m-stat show type defaults, never NaN or undefined', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'exercise', { q: '&grow=1' });
  await inject(page, '<m-list :table="s" title="exercise" sub="stars" meta="mood2,note2,ok,on"></m-list><m-chart :data="s.series(\'stars\', {last: 7})"></m-chart><m-stat :value="s.sum(\'stars\')" label="Stars"></m-stat>', "{s: store.t('set')}");
  const text = await page.locator('#inj').innerText(); const html = await page.locator('#inj').innerHTML();
  assert.ok(!/NaN|undefined|null|Infinity/.test(text + html.replace(/aria-[a-z]+="[^"]*"/g, '')), text.slice(0, 300));
  assert.match(text, /calm/); assert.match(text, /false/); assert.match(await page.locator('#inj .item').first().innerText(), /\b0\b/);
  await ctx.close(); noLog(log);
});

test('odd numbers: Infinity, NaN, 1e30, negatives in m-stat, bar, line and pie never overflow or print NaN', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'exercise', { w: 360, h: 640 });
  const data = "[{k:'2026-11-06',v:Infinity},{k:'2026-11-07',v:NaN},{k:'2026-11-08',v:1e30},{k:'2026-11-09',v:-40},{k:'2026-11-10',v:-Infinity},{k:'2026-11-11',v:12},{k:'2026-11-12',v:0}]";
  await inject(page, `<m-stat label="Big" :value="1e30" :of="1e15" unit="ml"></m-stat><m-stat label="Neg" :value="-5" :of="NaN"></m-stat><m-stat label="Inf" :value="Infinity" :of="Infinity"></m-stat><m-chart :data="${data}"></m-chart><m-chart type="line" :data="${data}"></m-chart><m-chart type="pie" :data="${data}"></m-chart>`);
  const html = await page.locator('#inj').innerHTML(), text = await page.locator('#inj').innerText();
  assert.ok(!/NaN|Infinity/.test(text + html), 'no NaN or Infinity anywhere in text or attributes');
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0, 'overflow');
  const rects = await page.$$eval('#inj m-chart svg rect', (rs) => rs.map((r) => [+r.getAttribute('width'), +r.getAttribute('height'), +r.getAttribute('y')]));
  assert.ok(rects.length >= 7 && rects.every(([w, h, y]) => w > 0 && h >= 2 && Number.isFinite(y)), 'all bars have positive size');
  const base = await page.$eval('#inj m-chart .m-base', (l) => +l.getAttribute('y1'));
  const neg = await page.$$eval('#inj m-chart:first-of-type svg rect', (rs, b) => rs.filter((r) => +r.getAttribute('y') >= b - 0.5).length, base);
  assert.ok(neg >= 2, 'negative values hang below the zero line (' + neg + ')');
  assert.ok((await page.locator('#inj m-chart').first().innerText()).includes('−'), 'negative bars are labelled with a minus sign');
  assert.match(await page.locator('#inj m-stat').first().innerText(), /1T|1,000,000,000,000|1000B|1\.0?T/i);
  await ctx.close(); noLog(log);
});

test('series(last up to 366): no negative widths, no console errors, no overflow, labels thinned', async () => {
  for (const last of [31, 37, 90, 366, 400]) {
    const { page, ctx, log } = await open(browser, srv.base, 'exercise', { w: 360, h: 640 });
    await inject(page, `<m-chart :data="s.series(null, {last: ${last}})"></m-chart><m-chart type="line" :data="s.series(null, {last: ${last}})"></m-chart>`, "{s: store.t('set')}");
    const n = await page.$$eval('#inj m-chart:first-of-type svg rect', (r) => r.length); assert.equal(n, Math.min(last, 366), 'bars for last=' + last);
    const bad = await page.$$eval('#inj svg *', (els) => els.filter((e) => ['width', 'height'].some((a) => e.hasAttribute(a) && +e.getAttribute(a) < 0)).length); assert.equal(bad, 0);
    const labels = await page.$$eval('#inj m-chart:first-of-type svg text.m-xl', (t) => t.length); assert.ok(labels <= 14, 'labels thinned: ' + labels);
    assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);
    await ctx.close(); noLog(log);
  }
});

test('pie: more than 5 categories become an Other slice, percentages sum to 100, legends survive long and Urdu labels at 360 px', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'budget', { w: 360, h: 640 });
  const cats = "[{k:'a',v:30},{k:'b',v:25},{k:'c',v:15},{k:'d',v:12},{k:'e',v:8},{k:'f',v:5},{k:'g',v:3},{k:'h',v:2}]";
  await inject(page, `<m-chart type="pie" :data="${cats}"></m-chart>`);
  const items = await page.$$eval('#inj .m-legend li', (l) => l.map((x) => x.innerText.replace(/\s+/g, ' ')));
  assert.equal(items.length, 5); assert.match(items[4], /^Other/);
  const pcts = items.map((s) => +s.match(/(\d+)%/)[1]); assert.equal(pcts.reduce((a, b) => a + b, 0), 100, items.join(' | '));
  assert.match(items[4], /18 · 18%/); assert.equal(await page.locator('#inj circle.m-ring').count(), 6);
  await page.evaluate(() => document.getElementById('inj').remove());
  const d = "[{k:'Medical and pharmacy expenses for the whole extended family this quarter',v:900},{k:'کھانے پینے کی اشیاء اور گھریلو سامان کی خریداری',v:600},{k:'Transport',v:300},{k:'Supercalifragilisticexpialidocious_Supercalifragilisticexpialidocious',v:100}]";
  await inject(page, `<m-chart type="pie" :data="${d}"></m-chart>`);
  const m = await page.$$eval('#inj .m-legend li .m-n', (n) => n.map((e) => Math.round(e.getBoundingClientRect().width)));
  assert.ok(m.every((w) => w >= 100), 'legend names keep a readable width: ' + m);
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0, 'no horizontal overflow');
  await ctx.close(); noLog(log);
});

test('m-form: whitespace-only text rejected with a visible message, empty number not stored as 0, double click adds once', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'exercise');
  const n = (txt) => page.locator('.item', { hasText: txt }).count();
  await page.fill('input[name=exercise]', '   '); await page.fill('input[name=kg]', '20'); await page.fill('input[name=reps]', '5'); await page.click('button[type=submit]');
  assert.equal(await n('20 kg × 5'), 0); assert.match(await page.locator('.m-err').innerText(), /Enter some text/); assert.ok(await page.locator('.m-err').isVisible());
  await page.fill('input[name=exercise]', 'Press'); await page.fill('input[name=kg]', '20'); await page.fill('input[name=reps]', ''); await page.click('button[type=submit]');
  assert.equal(await n('20 kg × 5'), 0); assert.match(await page.locator('.m-err').innerText(), /number/); assert.equal(await page.$eval('input[name=reps]', (i) => i.getAttribute('aria-invalid')), 'true');
  await page.fill('input[name=kg]', '20'); await page.fill('input[name=reps]', '5'); await page.dblclick('button[type=submit]');
  assert.equal(await n('20 kg × 5'), 1, 'double click inserts one row'); assert.equal(await page.locator('.m-err').count(), 0);
  await ctx.close(); noLog(log);
});

test('10,000 rows: m-list first render and every "Show more" click stay responsive', async () => {
  const t0 = Date.now();
  const { page, ctx, log } = await open(browser, srv.base, 'budget', { q: '&big=10000' });
  const load = Date.now() - t0;
  assert.equal(await page.locator('m-list .item').count(), 30);
  const times = [];
  for (let i = 0; i < 4; i++) { const s = Date.now(); await page.locator('.m-more').click(); await page.waitForFunction((n) => document.querySelectorAll('m-list .item').length >= n, 30 * (i + 2)); times.push(Date.now() - s); }
  console.log(`# 10k rows: load ${load} ms, show-more clicks ${times.join('/')} ms, rows now ${await page.locator('m-list .item').count()}`);
  assert.ok(times.every((x) => x < 1500), 'each click < 1.5 s: ' + times); assert.ok(load < 6000, 'load ' + load);
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
      hidden: [typeof app._notifications, typeof ui.toasts, typeof ui._dismiss, typeof t._schema, typeof t.schema, typeof store.internal], extra: Object.keys(window).filter((k) => ['sdk', 'internal', 'moldeSdk', 'moldeHost'].includes(k)) };
  });
  assert.deepEqual(r.store, ['kv', 't']); assert.deepEqual(r.ui, ['timer', 'toast']); assert.deepEqual(r.app, ['fmt', 'notify', 'today']);
  assert.deepEqual(r.t, ['add', 'group', 'has', 'remove', 'series', 'set', 'streak', 'sum', 'toggle']);
  assert.equal(r.store.length + r.ui.length + r.app.length + r.t.length, 16);
  assert.equal(r.pushed, 'TypeError'); assert.equal(r.mut, 'TypeError'); assert.deepEqual(r.hidden, Array(6).fill('undefined')); assert.deepEqual(r.extra, []);
  await ctx.close(); noLog(log);
});

test('x-edit: Enter commits (single line), Escape cancels, blur commits, empty reverts, paste is one line, kv numbers stay numbers', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'habits');
  const edit = page.locator('.item.wrap [contenteditable]').first(); const name0 = await edit.innerText();
  const set = async (txt, key) => { await edit.click(); await page.keyboard.press('Control+A'); await page.keyboard.type(txt); if (key) await page.keyboard.press(key); };
  await set('Read 30 pages', 'Enter'); assert.equal(await edit.innerText(), 'Read 30 pages'); assert.equal(await page.evaluate(() => document.activeElement === document.body || document.activeElement.getAttribute('contenteditable') !== 'true'), true, 'Enter leaves the field');
  assert.equal(await edit.evaluate((e) => e.innerHTML.includes('<div') || e.innerHTML.includes('<br')), false, 'no <div> or <br> is ever inserted');
  await edit.click(); await page.keyboard.press('Control+A'); await page.keyboard.type('line one'); await page.keyboard.press('Shift+Enter'); await page.keyboard.type('line two'); await page.keyboard.press('Enter');
  assert.ok(!/\n/.test(await edit.innerText()) && (await edit.innerText()).startsWith('line one'), 'a newline is never inserted: ' + JSON.stringify(await edit.innerText()));
  await set('Throw this away', 'Escape'); assert.notEqual(await edit.innerText(), 'Throw this away', 'Escape cancels'); const kept = await edit.innerText();
  await set('Saved by blur'); await page.keyboard.press('Tab'); assert.equal(await edit.innerText(), 'Saved by blur');
  await edit.click(); await page.keyboard.press('Control+A'); await page.keyboard.press('Delete'); await page.keyboard.press('Enter'); assert.equal(await edit.innerText(), 'Saved by blur', 'empty reverts');
  await edit.evaluate((e) => { e.focus(); document.getSelection().selectAllChildren(e); const dt = new DataTransfer(); dt.setData('text', 'pasted\nacross\nlines'); e.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
  await page.keyboard.press('Enter'); assert.equal(await edit.innerText(), 'pasted across lines');
  assert.equal(await page.evaluate(() => typeof store.t('habit').rows[0].habit), 'string'); void name0; void kept;
  await ctx.close(); noLog(log);
  const w = await open(browser, srv.base, 'water'); const g = w.page.locator('small [contenteditable]');
  await g.click(); await w.page.keyboard.press('Control+A'); await w.page.keyboard.type('2,500'); await w.page.keyboard.press('Enter');
  assert.equal(await w.page.evaluate(() => store.kv('goal', 0).v), 2500, 'the goal is a number'); assert.equal(await g.innerText(), '2,500');
  await g.click(); await w.page.keyboard.press('Control+A'); await w.page.keyboard.type('lots'); await w.page.keyboard.press('Enter'); assert.equal(await w.page.evaluate(() => store.kv('goal', 0).v), 2500, 'junk reverts');
  await w.ctx.close(); noLog(w.log);
});

test('focus survives updates: a keyboard toggle of the big Today button keeps focus on it; the remove button of an m-list keeps focus on a row action', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'habits');
  const b = page.locator('.item.wrap', { hasText: 'Stretch' }).locator('.btn.big'); await b.focus(); const was = await b.getAttribute('aria-pressed');
  await page.keyboard.press('Enter'); const a = () => page.evaluate(() => { const e = document.activeElement; return { label: e.getAttribute('aria-label'), cls: e.className, p: e.getAttribute('aria-pressed') }; });
  let x = await a(); assert.match(x.label, /^Stretch, today$/); assert.match(x.cls, /btn/); assert.notEqual(x.p, was);
  await page.keyboard.press('Space'); x = await a(); assert.equal(x.p, was); await ctx.close(); noLog(log);
  const w = await open(browser, srv.base, 'water');
  const k = w.page.locator('m-list .ibtn').first(); await k.focus(); await w.page.keyboard.press('Enter'); await w.page.waitForTimeout(350); await w.page.keyboard.press('Enter');
  assert.equal(await w.page.evaluate(() => document.activeElement.tagName), 'BUTTON', 'focus lands on a button (the Undo), not <body>');
  await w.ctx.close(); noLog(w.log);
});

test('midnight: with a fake clock the Today buttons and the day lists move to the new day without a reload', async () => {
  const t0 = new Date(2026, 10, 21, 23, 59, 58);
  const { page, ctx, log } = await open(browser, srv.base, 'habits', { real: true, before: (p) => p.clock.install({ time: t0 }) });
  const first = page.locator('.item.wrap', { hasText: 'Read 20 pages' }).locator('.btn.big');
  assert.equal(await first.getAttribute('aria-pressed'), 'true'); await page.clock.runFor(6000);
  assert.equal(await first.getAttribute('aria-pressed'), 'false', 'nothing is checked on the new day'); assert.equal(await first.innerText(), 'Mark done');
  await ctx.close(); noLog(log);
});
