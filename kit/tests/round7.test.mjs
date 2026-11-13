// Round 7: empty-table safety, one tab stop per row (no clipped controls), the Undo tray (stable focus, keyboard path, Escape, hover pause),
// generic helpers ($group $streaks $ema $aria $clock $hue $fit), null-safe charts, month jump, fieldset, 15 px text.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, open, inject, del } from './lib.mjs';

let srv, browser;
before(async () => { srv = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });
const noLog = (log) => assert.deepEqual(log, [], 'console output: ' + log.join(' | '));

test('habits: deleting every habit (and the last one) leaves the console clean, then adding works again', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'habits');
  const rows = () => page.locator('.item.wrap').count();
  while ((await rows()) > 0) await del(page.locator('.item.wrap .ibtn:not(.ring)').last());
  await page.waitForTimeout(200); assert.equal(await rows(), 0); assert.equal(await page.locator('section').count(), 0, 'no history section without a habit');
  assert.equal(await page.locator('.stat').innerText(), '0'); noLog(log);
  await page.fill('input[name=habit]', 'Stretch'); await page.click('button[type=submit]'); await page.waitForTimeout(200);
  assert.equal(await rows(), 1); assert.equal(await page.locator('section').count(), 1); assert.equal(await page.locator('section .day').count() >= 28, true);
  await page.locator('.item.wrap [role=checkbox]').first().click(); assert.equal(await page.locator('.stat').innerText(), '1');
  await ctx.close(); noLog(log);
});

for (const [w, h] of [[360, 640], [412, 915]]) test(`habits @${w}: no clipped controls, one tab stop per row, arrows/Home/End move inside a row, Space toggles`, async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'habits', { w, h });
  const info = await page.$$eval('.item.wrap', (rows) => rows.map((r) => { const cs = [...r.querySelectorAll('[role=checkbox]')]; return { n: cs.length, inside: cs.every((c) => c.getBoundingClientRect().right <= innerWidth + 0.5), stops: cs.filter((c) => c.tabIndex === 0).length }; }));
  assert.ok(info.length >= 6); for (const r of info) { assert.ok(r.n >= 4 && r.n <= 7, 'columns that fit: ' + r.n); assert.ok(r.inside, 'every day button is inside the viewport'); assert.equal(r.stops, 1, 'one tab stop per row'); }
  assert.equal(new Set(info.map((r) => r.n)).size, 1, 'every row has the same number of columns');
  const hdr = await page.locator('.item.grid small').count(); assert.equal(hdr, info[0].n, 'header and rows agree on the columns');
  const first = page.locator('.item.wrap').nth(0).locator('[role=checkbox]'), second = page.locator('.item.wrap').nth(1).locator('[role=checkbox]');
  await first.nth(0).focus(); await page.keyboard.press('Tab'); // leaves the row: the next stop is not the 2nd button of the same row
  assert.equal(await page.evaluate(() => document.activeElement.closest('.item.wrap') === document.querySelectorAll('.item.wrap')[0]), false, 'Tab leaves the row');
  await first.nth(0).focus(); await page.keyboard.press('ArrowRight'); assert.equal(await first.nth(1).evaluate((e) => e === document.activeElement), true);
  await page.keyboard.press('End'); assert.equal(await first.nth(info[0].n - 1).evaluate((e) => e === document.activeElement), true); await page.keyboard.press('Home'); assert.equal(await first.nth(0).evaluate((e) => e === document.activeElement), true);
  const was = await first.nth(0).getAttribute('aria-checked'); await page.keyboard.press('Space'); assert.notEqual(await first.nth(0).getAttribute('aria-checked'), was);
  assert.equal(await first.nth(0).evaluate((e) => e === document.activeElement), true, 'focus stays on the toggled day'); void second;
  await ctx.close(); noLog(log);
});

test('the Undo tray: rows are patched not rebuilt (focus and nodes survive), a keyboard delete lands on Undo, Escape drops it, a live region announces only new rows', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'water');
  assert.equal(await page.locator('.m-toasts').getAttribute('aria-live'), 'polite'); assert.equal(await page.locator('.m-toasts').getAttribute('aria-atomic'), 'false');
  await page.evaluate(() => { ui.toast('first', () => {}); ui.toast('second', () => {}); ui.toast('third', () => {}); });
  assert.equal(await page.locator('.m-tray-h b').innerText(), '3 undos'); const ub = page.locator('.m-tray .m-toast button').nth(1); await ub.focus();
  await page.evaluate(() => { window.__n = [...document.querySelectorAll('.m-toast')]; window.__b = document.activeElement; ui.toast('plain note'); ui.toast('fourth', () => {}); });
  assert.equal(await page.evaluate(() => window.__n.every((n) => document.body.contains(n)) && document.activeElement === window.__b), true, 'old rows stay the same nodes and keep focus when toasts change');
  assert.equal(await page.locator('.m-tray-h').getAttribute('aria-live'), 'off', 'the count is not announced again');
  await page.evaluate(() => { for (const t of [...document.querySelectorAll('.m-tray .m-toast button')]) t.click(); }); await page.waitForTimeout(100);
  // keyboard delete
  const k = page.locator('m-list .ibtn').first(); const n0 = await page.evaluate(() => store.t('cup').rows.length);
  await k.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(350); await page.keyboard.press('Enter'); await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => store.t('cup').rows.length), n0 - 1);
  assert.equal(await page.evaluate(() => document.activeElement.textContent + '|' + !!document.activeElement.closest('.m-toast')), 'Undo|true', 'focus moved to the Undo');
  await page.keyboard.press('Escape'); assert.equal(await page.locator('.m-toast').count() >= 0, true); await page.waitForTimeout(50);
  assert.equal(await page.locator('.m-toast', { hasText: 'Removed' }).count(), 0, 'Escape drops the toast'); assert.equal(await page.evaluate(() => store.t('cup').rows.length), n0 - 1, 'the removal stays');
  assert.equal(await page.evaluate(() => !!document.activeElement.closest('m-list, .list')), true, 'focus goes back to the list');
  // Enter on Undo restores
  const k2 = page.locator('m-list .ibtn').first(); await k2.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(350); await page.keyboard.press('Enter'); await page.waitForTimeout(100);
  await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => store.t('cup').rows.length), n0 - 1, 'Enter on Undo brings the row back (one removed earlier stays removed)');
  await ctx.close(); noLog(log);
});

test('an Undo does not expire while it is hovered or focused, and then gets the time that was left', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'water', { real: true, before: (p) => p.clock.install({ time: new Date(2026, 10, 21, 12, 0, 0) }) });
  await page.evaluate(() => ui.toast('keep me', () => {})); const b = page.locator('.m-toast button').first(); await b.hover();
  await page.clock.runFor(4000); await page.mouse.move(0, 0); await page.clock.runFor(1);
  await b.hover(); await page.clock.runFor(30000); assert.equal(await page.locator('.m-toast', { hasText: 'keep me' }).count(), 1, 'hovered: still there after 30 s');
  await page.mouse.move(0, 0); await page.clock.runFor(5000); assert.equal(await page.locator('.m-toast', { hasText: 'keep me' }).count(), 1, 'less than the time left has passed');
  await page.clock.runFor(7000); assert.equal(await page.locator('.m-toast', { hasText: 'keep me' }).count(), 0, 'it expires once the time left is used');
  await page.evaluate(() => ui.toast('by focus', () => {})); await page.locator('.m-toast button').first().focus(); await page.clock.runFor(60000);
  assert.equal(await page.locator('.m-toast', { hasText: 'by focus' }).count(), 1, 'focused: still there');
  await ctx.close(); noLog(log);
});

test('generic helpers ($group $streaks $ema $aria $clock $hue $fit), none of them named after an app', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'habits');
  const r = await page.evaluate(() => { const el = document.querySelector('main'); const ev = (e) => Alpine.evaluate(el, e);
    return { clock: ev('$clock(90)'), clock0: ev('$clock(-5)'), hue: [ev('$hue(0)'), ev('$hue(7)'), ev('$hue(-1)')], aria: ev("$aria('Read', '2026-11-21', true)"), ariaOff: ev("$aria('Read', '2026-11-21', false, ['yes', 'no'])"),
      ema: ev("$ema([{k: 'a', v: 1}, {k: 'b', v: 0}], .5, 100)"), max: ev("$streaks(c, 'habit').max"), keys: ev("Object.keys($streaks(c, 'habit')).length"), maxHidden: ev("Object.keys($streaks(c, 'habit')).includes('max')"),
      group: ev("$group([{at: new Date(2026, 10, 21, 9).getTime(), n: 'a'}, {at: new Date(2026, 10, 21, 10).getTime(), n: 'b'}, {at: new Date(2026, 10, 20, 10).getTime(), n: 'a'}], 'day', 'n').map(g => g.day + g.n + g.rows.length)"),
      fit: ev('$fit(48)') }; });
  assert.deepEqual([r.clock, r.clock0], ['1:30', '0:00']); assert.deepEqual(r.hue, ['c1', 'c3', 'c2']); assert.match(r.aria, /^Read, .+, done$/); assert.match(r.ariaOff, /, no$/);
  assert.deepEqual(r.ema, [{ k: 'a', v: 50 }, { k: 'b', v: 25 }]); assert.equal(r.max, 12); assert.equal(r.keys, 6); assert.equal(r.maxHidden, false, 'max is not an enumerable habit');
  assert.deepEqual(r.group, ['2026-11-21a1', '2026-11-21b1', '2026-11-20a1']); assert.ok(Number.isInteger(r.fit) && r.fit >= 1);
  await ctx.close(); noLog(log);
});

test('page code cannot reach the transaction handle: no symbols on a table, no internal on window', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'water');
  const r = await page.evaluate(() => { const t = store.t('cup'); return { syms: Object.getOwnPropertySymbols(t).length, keys: Reflect.ownKeys(t).filter((k) => typeof k === 'symbol').length, reg: typeof t[Symbol.for('molde.tx')] + typeof t[Symbol.for('molde.meta')], win: ['sdk', 'internal', 'moldeHost', '__molde'].map((k) => typeof window[k]) }; });
  assert.deepEqual([r.syms, r.keys, r.reg], [0, 0, 'undefinedundefined']); assert.deepEqual(r.win, ['undefined', 'undefined', 'undefined', 'undefined']);
  await ctx.close(); noLog(log);
});

test('charts skip empty values instead of plotting 0, and the exercise progress line uses reps for bodyweight sets', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'exercise');
  await inject(page, '<m-chart :data="[{k: \'2026-11-18\', v: null}, {k: \'2026-11-19\', v: 5}, {k: \'2026-11-20\', v: 7}, {k: \'2026-11-21\', v: undefined}]"></m-chart>', '{}');
  assert.equal(await page.locator('#inj m-chart svg rect.m-b').count(), 2, 'two real values, two bars, nothing at 0');
  await page.locator('.item.slim button', { hasText: 'Pull-ups' }).first().click();
  assert.match(await page.locator('main > m-chart small').first().innerText(), /^Pull-ups/);
  const pts = await page.locator('main > m-chart polyline.m-line').first().getAttribute('points'); const ys = pts.trim().split(/\s+/).map((p) => Number(p.split(',')[1]));
  assert.ok(ys.length >= 4, 'a point per bodyweight session: ' + pts); assert.ok(new Set(ys).size > 1, 'the line moves (reps), it is not a flat 0 kg');
  const labels = await page.$$eval('main > m-chart svg text.m-hi', (ts) => ts.map((t) => t.textContent)); assert.ok(labels.every((t) => Number(t) > 0), 'no 0 kg label: ' + labels);
  await ctx.close(); noLog(log);
});

test('budget: adding an expense while a past month is shown jumps to the current month (the new row is visible)', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'budget');
  const label = () => page.locator('main > .row b').first().innerText(); const now = await label();
  await page.locator('button[aria-label="Previous month"]').click(); assert.notEqual(await label(), now);
  await page.fill('input[name=description]', 'Tea'); await page.fill('input[name=amount]', '400'); await page.click('button[type=submit]');
  assert.equal(await label(), now, 'back on the current month'); assert.match(await page.locator('m-list .item').first().innerText(), /Tea/);
  await ctx.close(); noLog(log);
});

test('journal: the mood faces are a fieldset with the legend "Mood"', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'journal');
  assert.equal(await page.locator('form fieldset legend').innerText(), 'Mood'); assert.equal(await page.locator('form fieldset input[type=radio]').count(), 5);
  await ctx.close(); noLog(log);
});

for (const f of ['budget', 'journal']) for (const w of [360, 412]) test(`${f} @${w}: every piece of text is at least 15 px (rows, labels, chart text)`, async () => {
  const { page, ctx, log } = await open(browser, srv.base, f, { w, h: 915 });
  const small = await page.evaluate(() => { const out = []; const wk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); for (let t; (t = wk.nextNode());) { if (!t.textContent.trim()) continue; const el = t.parentElement; if (!el.getClientRects().length || el.closest('.sr, .m-sr, script, template')) continue; const sv = el.closest('svg'); let px = parseFloat(getComputedStyle(el).fontSize); if (sv) px *= sv.getBoundingClientRect().width / (sv.viewBox.baseVal.width || sv.getBoundingClientRect().width); if (px < 14.9) out.push(el.localName + ' ' + px.toFixed(1) + ' ' + t.textContent.trim().slice(0, 20)); } return out; });
  assert.deepEqual(small, []); await ctx.close(); noLog(log);
});
