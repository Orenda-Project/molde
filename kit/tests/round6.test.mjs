// Round 6: visible selected state, locale-aware numbers, optional numbers, accessible habit names, calendar alignment,
// longest streak over ALL habits, goal labels, newline paste, friendly errors, midnight labels, 240 px budget, kept form values.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, open, del } from './lib.mjs';

let srv, browser;
before(async () => { srv = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });
const noLog = (log) => assert.deepEqual(log, [], 'console output: ' + log.join(' | '));

test('journal: the selected face is clearly different in computed style (ring, fill, scale of weight) and radios say checked', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'journal');
  const style = (n) => page.locator('form label', { hasText: n }).locator('svg').evaluate((e) => { const c = getComputedStyle(e); return { shadow: c.boxShadow, bg: c.backgroundColor, border: c.borderColor, color: c.color }; });
  const before = await style('good'); await page.locator('form label', { hasText: 'good' }).click();
  const after = await style('good'); const other = await style('okay');
  assert.notEqual(after.shadow, 'none', 'a ring (not colour alone)'); assert.equal(before.shadow, 'none'); assert.equal(other.shadow, 'none');
  assert.notEqual(after.bg, before.bg, 'a fill'); assert.notEqual(after.border, before.border);
  assert.equal(await page.locator('form input[type=radio][value=good]').isChecked(), true);
  assert.equal(await page.locator('form small', { hasText: 'good' }).evaluate((e) => getComputedStyle(e).fontWeight), '500', 'the label gets heavier');
  assert.equal(await page.locator('m-chart svg rect.m-b').count(), 14, 'a 14-day mood strip');
  await ctx.close(); noLog(log);
});

test('faces differ in eyes and mouth: five distinct shapes', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'journal');
  const ds = await page.$$eval('form label svg path', (ps) => ps.map((p) => p.getAttribute('d'))); assert.equal(new Set(ds).size, 5);
  assert.ok(ds.every((d) => (d.match(/M/g) || []).length >= 3), 'each face has two eyes and a mouth: ' + ds.join(' | '));
  await ctx.close(); noLog(log);
});

test('numbers: inputs are text with a decimal keypad; "82,5" is 82.5, Arabic-Indic digits work, junk shows a visible error, optional kg may stay empty', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'exercise');
  assert.equal(await page.$eval('input[name=kg]', (i) => i.type + '/' + i.inputMode), 'text/decimal');
  assert.match(await page.$eval('input[name=kg]', (i) => i.placeholder), /optional/i);
  const last = () => page.evaluate(() => { const r = store.t('set').rows; return r[r.length - 1]; });
  await page.fill('input[name=exercise]', 'Row'); await page.fill('input[name=kg]', '82,5'); await page.fill('input[name=reps]', '5'); await page.click('button[type=submit]');
  let r = await last(); assert.equal(r.kg, 82.5, 'a decimal comma is a decimal');
  await page.waitForTimeout(600); await page.fill('input[name=kg]', '۸۰'); await page.fill('input[name=reps]', '۱۰'); await page.click('button[type=submit]');
  r = await last(); assert.deepEqual([r.kg, r.reps], [80, 10], 'Arabic-Indic digits');
  await page.waitForTimeout(600); await page.fill('input[name=kg]', ''); await page.fill('input[name=reps]', '12'); await page.click('button[type=submit]');
  r = await last(); assert.equal(r.kg, null, 'empty optional number is null, not 0'); assert.ok((await page.locator('.list bdi.grow', { hasText: /^\d+\. 12 reps$/ }).count()) >= 1, 'a bodyweight set reads "12 reps"');
  await page.waitForTimeout(600); await page.fill('input[name=kg]', 'heavy'); await page.fill('input[name=reps]', '3'); await page.click('button[type=submit]');
  assert.match(await page.locator('.m-err').innerText(), /number for kg/i); assert.equal(await page.$eval('input[name=kg]', (i) => i.getAttribute('aria-invalid')), 'true'); assert.notEqual((await last()).reps, 3);
  await ctx.close(); noLog(log);
});

test('x-edit: a real label for goal fields, a pasted newline becomes a space, a 1,000+ character rename gives a friendly message', async () => {
  const w = await open(browser, srv.base, 'water');
  assert.equal(await w.page.locator('small [contenteditable]').getAttribute('aria-label'), 'Daily goal (ml)'); await w.ctx.close(); noLog(w.log);
  const b = await open(browser, srv.base, 'budget');
  assert.equal(await b.page.locator('small [contenteditable]').getAttribute('aria-label'), 'Monthly budget'); await b.ctx.close(); noLog(b.log);
  const j = await open(browser, srv.base, 'habits');
  const name = j.page.locator('.item.wrap [contenteditable]').first();
  assert.equal(await name.getAttribute('aria-label'), 'Habit');
  await name.click(); await j.page.keyboard.press('Control+A');
  await name.evaluate((el) => { const dt = new DataTransfer(); dt.setData('text', 'Line one\nline two\r\n  three'); el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
  assert.equal(await name.innerText(), 'Line one line two three', 'newlines in a paste become spaces'); await j.page.keyboard.press('Escape');
  await name.click(); await j.page.keyboard.press('Control+A'); await name.evaluate((el) => { el.textContent = 'y'.repeat(1200); }); await j.page.keyboard.press('Enter');
  const toast = await j.page.locator('.m-toast span').first().innerText(); assert.match(toast, /too long/i); assert.ok(!/E_ARG|E_/.test(toast), toast);
  await j.ctx.close(); noLog(j.log);
});

test('habits: accessible names say habit, date and state; the calendar is weekday-aligned; tapping a habit shows its history; the lead covers ALL habits', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'habits', { q: '&big=100' });
  const cb = page.locator('.item.wrap').first().locator('[role=checkbox]').first();
  assert.match(await cb.getAttribute('aria-label'), /^.+, .+ \d+|^.+, \w+, \w+ \d+, (done|not done)$/); assert.match(await cb.getAttribute('aria-label'), /(done|not done)$/);
  const was = await cb.getAttribute('aria-checked'); await cb.click(); assert.notEqual(await cb.getAttribute('aria-checked'), was);
  const head = await page.$$eval('.item.grid small', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ')).slice(0, 3)); assert.ok(head.every((t) => /^(\S{2,}\s\d+|\d+\s\S{2,})$/.test(t)), head.join('|'));
  const hdr = await page.$$eval('section .grid > small', (els) => els.map((e) => e.innerText)); assert.equal(hdr.length, 7); assert.equal(new Set(hdr).size, 7, 'seven different weekday names: ' + hdr);
  const cells = await page.$$eval('section .grid > .day', (els) => els.map((e) => ({ l: e.getAttribute('aria-label'), col: Math.round((e.getBoundingClientRect().left - els[0].parentElement.getBoundingClientRect().left) / (els[0].getBoundingClientRect().width))})));
  assert.ok(cells.length >= 28 && cells.length <= 35, 'five weeks ending today: ' + cells.length);
  const hdrX = await page.$$eval('section .grid > small', (els) => els.map((e) => e.getBoundingClientRect().left)); const dayX = await page.$$eval('section .grid > .day', (els) => els.slice(0, 7).map((e) => e.getBoundingClientRect().left + e.getBoundingClientRect().width / 2));
  hdrX.forEach((x, i) => assert.ok(Math.abs(x - dayX[i]) < 40, 'the first week lines up under the weekday headers: ' + [x, dayX[i]]));
  const wd = hdr[0]; assert.match(cells[0].l, new RegExp(', ' + wd.slice(0, 2)), 'the first cell is on the first header weekday: ' + cells[0].l + ' / ' + wd);
  const h2 = await page.locator('section m-chart small').innerText(); await page.locator('.item.wrap').nth(2).locator('button.ring').click(); assert.notEqual(await page.locator('section m-chart small').innerText(), h2, 'tap a habit to see its history');
  assert.equal(await page.locator('.item.wrap').nth(2).locator('button.ring').getAttribute('aria-pressed'), 'true'); assert.equal(await page.locator('m-chart svg polyline.m-line').count(), 1, 'a score line');
  // the best streak is over every habit, not only the first 40
  const best0 = Number(await page.locator('.stat').innerText());
  await page.evaluate(() => { const hs = store.t('habit').rows; const id = hs[hs.length - 1].id; const c = store.t('check'); const el = document.querySelector('main'); for (let i = 0; i < 30; i++) c.add({ habit: String(id), day: Alpine.evaluate(el, '$day(-' + i + ')') }); });
  assert.ok(Number(await page.locator('.stat').innerText()) >= 30, 'habit #100 (not on the first page) sets the longest current streak');
  assert.match(await page.locator('.row', { has: page.locator('.stat') }).innerText(), /Longest current streak/);
  await ctx.close(); noLog(log);
});

test('midnight: list day headers and relative labels move on (Today becomes Yesterday) without a reload', async () => {
  const t0 = new Date(2026, 10, 21, 23, 59, 58);
  const { page, ctx, log } = await open(browser, srv.base, 'journal', { real: true, before: (p) => p.clock.install({ time: t0 }) });
  const first = () => page.locator('m-list .m-dh b').first().innerText();
  assert.equal(await first(), 'Today'); await page.clock.runFor(6000); assert.equal(await first(), 'Yesterday');
  await ctx.close(); noLog(log);
});

test('budget at 240 px: the description input does not collapse (inputs stack) and nothing overflows', async () => {
  for (const w of [240, 320]) {
    const { page, ctx, log } = await open(browser, srv.base, 'budget', { w, h: 800 });
    const d = await page.$eval('m-form input[name=description]', (i) => i.getBoundingClientRect().width); assert.ok(d >= 150, `description is ${d}px at ${w}`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow at ' + w);
    await ctx.close(); noLog(log);
  }
});

test('exercise: the form keeps the last name, kg and reps, suggests earlier names, and a long name is a friendly message', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'exercise');
  const v = () => page.evaluate(() => ['exercise', 'kg', 'reps'].map((n) => document.querySelector(`input[name=${n}]`).value));
  await page.waitForTimeout(100); const primed = await v(); assert.ok(primed[0] && primed[2], 'the fields start from the last set: ' + primed);
  await page.fill('input[name=reps]', '7'); await page.click('button[type=submit]'); assert.deepEqual((await v()).slice(0, 1), [primed[0]], 'the name is not retyped');
  await page.locator('input[name=exercise]').focus(); const opts = await page.$$eval('datalist option', (os) => os.map((o) => o.value)); assert.ok(opts.length >= 4 && new Set(opts).size === opts.length, 'earlier names are suggested: ' + opts);
  await page.waitForTimeout(600); await page.$eval('input[name=exercise]', (i) => { i.value = 'z'.repeat(1001); }); await page.click('button[type=submit]');
  const msg = await page.locator('.m-err').innerText(); assert.match(msg, /too long/i); assert.ok(!/E_ARG/.test(msg), msg);
  await ctx.close(); noLog(log);
});
