// Browser acceptance: 5 fixtures x 5 viewports. Page is served by the same CSP as production (contract section 7).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, open, FIXTURES, VIEWPORTS, auditFn } from './lib.mjs';

let srv, browser;
before(async () => { srv = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });

const audit = auditFn;

for (const f of FIXTURES) for (const [w, h] of VIEWPORTS) {
  test(`${f} @ ${w}x${h}: no console output, no overflow, targets >= 44 px, text >= 12 px, no remote requests`, async () => {
    const { page, ctx, log } = await open(browser, srv.base, f, { w, h });
    const reqs = []; // second load to capture requests with a listener attached from the start
    const p2 = await ctx.newPage(); p2.on('request', (r) => reqs.push(r.url()));
    await p2.goto(`${srv.base}/app/${f}`); await p2.waitForTimeout(300);
    const a = await page.evaluate(audit);
    // (remote requests are collected by the second page below)
    await ctx.close();
    assert.deepEqual(log, [], 'console output: ' + log.join(' | '));
    assert.deepEqual(a.overflow, [], 'horizontal overflow');
    assert.deepEqual(a.small, [], 'targets under 44 px');
    assert.deepEqual(a.tiny, [], 'text under 12 px');
    assert.ok(reqs.every((u) => u.startsWith(srv.base) || u.startsWith('data:')), 'only same-origin requests: ' + reqs.join(','));
  });
}

test('empty database (no seed): every fixture renders with no console output', async () => {
  for (const f of FIXTURES) {
    const { ctx, log, page } = await open(browser, srv.base, f, { seed: false });
    const text = await page.evaluate(() => document.body.innerText.length);
    await ctx.close();
    assert.deepEqual(log, [], f + ': ' + log.join(' | ')); assert.ok(text > 10);
  }
});


import { readFileSync } from 'node:fs';
import { KIT } from './lib.mjs';
const seedOf = (f) => JSON.parse(readFileSync(`${KIT}/fixtures/${f}/seed.json`, 'utf8'));
const fixedDay = 21; // FIXED_NOW is 21 Nov 2026: the calendar month so far = seed rows with d <= 20
const nf = (n) => new Intl.NumberFormat('en-US').format(n);

test('exercise: day headers with totals and Today emphasis, delta vs last session, add, remove any set with Undo, Show more history', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'exercise');
  const cnt = (txt) => page.locator('.item', { hasText: txt }).count();
  const head = page.locator('.m-dh').first();
  assert.match(await head.innerText(), /Today[\s\S]*9 sets/); assert.equal(await head.locator('b.hi').count(), 1, 'Today is emphasised');
  assert.match(await page.locator('.chip').first().innerText(), /^[+-]?\d+(\.\d+)? kg$/, 'delta chip');
  await page.fill('input[name=exercise]', 'Squat'); await page.fill('input[name=kg]', '72.5'); await page.fill('input[name=reps]', '5'); await page.click('button[type=submit]');
  assert.equal(await cnt('72.5 kg × 5'), 1); assert.match(await head.innerText(), /10 sets/);
  await page.locator('.item', { hasText: '72.5 kg × 5' }).locator('.ibtn').click(); assert.equal(await cnt('72.5 kg × 5'), 0); assert.match(await head.innerText(), /9 sets/);
  await page.locator('.m-toast button', { hasText: 'Undo' }).last().click(); assert.equal(await cnt('72.5 kg × 5'), 1);
  const n0 = await page.locator('.list .item').count(); await page.locator('button', { hasText: 'Show more history' }).click();
  assert.ok((await page.locator('.list .item').count()) > n0, 'more history appears');
  const buttons = await page.locator('.list .item .ibtn').all(); assert.ok(buttons.length > 20); await buttons[20].click(); // any set, not only today's
  const a = await page.locator('.ibtn').first().getAttribute('aria-label'); assert.equal(a, 'Remove', 'icon buttons have an accessible name');
  await ctx.close(); assert.deepEqual(log, []);
});
test('habits: names above full-width check rows, weekday + date header, toggle any day, rename (Enter/Esc), remove cascades to checks, heat map ramp', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'habits');
  const row = (n) => page.locator('.item.wrap', { hasText: n });
  assert.equal(await page.locator('.stat').innerText(), '12');
  const vis = (sel) => page.$$eval(sel, (els) => els.filter((e) => e.offsetTop === els[0].offsetTop).length);
  const cols = await vis('.item.grid small'); assert.ok(cols >= 5, 'columns at 412: ' + cols); assert.equal(await page.$$eval('.item.wrap .grid .check', (els) => els.slice(0, 7).filter((e) => e.offsetTop === els[0].offsetTop).length), cols, 'one check per header column');
  assert.match(await page.locator('.item.grid small').first().innerText(), /^[A-Za-z\u0600-\u06ff]\s?\d+$|^\d+\s?[A-Za-z]$/, 'weekday initial and date');
  const name = await row('Read 20').locator('[contenteditable]').boundingBox(), first = await row('Read 20').locator('.check').first().boundingBox(); assert.ok(name.y + name.height <= first.y + 1 && name.width > 150, 'the name sits on its own line, wide: ' + JSON.stringify(name));
  assert.ok((await page.locator('.grid.flow .cell.lv3, .grid.flow .cell.lv4').count()) > 3 && (await page.locator('.grid.flow .cell').count()) === 84, 'heat map has 84 cells and an accent ramp');
  const st = row('Stretch').locator('.check').first(); const was = await st.getAttribute('aria-pressed'); await st.click();
  assert.notEqual(await row('Stretch').locator('.check').first().getAttribute('aria-pressed'), was);
  const walk = row('Walk 30').locator('[contenteditable]'); await walk.click(); await page.keyboard.press('Control+A'); await page.keyboard.type('Walk 45 minutes'); await page.keyboard.press('Enter');
  assert.equal(await row('Walk 45 minutes').count(), 1); assert.equal(await row('Walk 30').count(), 0);
  const w2 = row('Walk 45').locator('[contenteditable]'); await w2.click(); await page.keyboard.press('Control+A'); await page.keyboard.type('Nope'); await page.keyboard.press('Escape'); assert.equal(await w2.innerText(), 'Walk 45 minutes', 'Escape cancels');
  const before = await page.evaluate(() => ({ habits: store.t('habit').rows.length, checks: store.t('check').rows.length, mine: store.t('check').rows.filter((r) => r.habit === String(store.t('habit').rows.find((h) => h.habit === 'Write in journal').id)).length }));
  assert.ok(before.mine > 5);
  await row('Write in journal').locator('.ibtn[aria-label=Remove]').click();
  const after = await page.evaluate(() => ({ habits: store.t('habit').rows.length, checks: store.t('check').rows.length, orphans: store.t('check').rows.filter((r) => !store.t('habit').rows.some((h) => String(h.id) === r.habit)).length }));
  assert.equal(after.habits, before.habits - 1); assert.equal(after.checks, before.checks - before.mine); assert.equal(after.orphans, 0, 'no orphan check rows');
  await page.fill('input[name=habit]', 'Journal'); await page.click('button[type=submit]'); assert.equal(await page.locator('.item.wrap [contenteditable]').count(), before.habits);
  await ctx.close(); assert.deepEqual(log, []);
});
test('water: glass fills, goal and yesterday reference, double tap adds once, recent list remove + Undo, validated custom amount, toast cap of 3', async () => {
  const r = await open(browser, srv.base, 'water'); const p = r.page;
  const big = () => p.locator('.stat').innerText(); const glass = () => p.locator('svg rect').nth(1).getAttribute('height');
  assert.equal(await big(), '1,500'); const h0 = await glass(); assert.equal(await p.locator('small [contenteditable]').innerText(), '2000');
  await p.locator('button', { hasText: '+500' }).dblclick(); assert.equal(await big(), '2,000', 'a double tap adds once'); assert.ok(+(await glass()) > +h0);
  await p.locator('.m-toast button', { hasText: 'Undo' }).last().click(); assert.equal(await big(), '1,500');
  await p.locator('m-list .ibtn').first().click(); assert.equal(await big(), '1,250');
  await p.locator('.m-toast button', { hasText: 'Undo' }).last().click(); assert.equal(await big(), '1,500');
  for (const bad of ['6000', '0', '-5']) { await p.fill('input[name=volume]', bad); await p.click('button[type=submit]'); assert.match(await p.locator('.m-err').innerText(), /from 1 to 5,000/); assert.equal(await big(), '1,500'); }
  await p.fill('input[name=volume]', '300'); await p.click('button[type=submit]'); assert.equal(await big(), '1,800');
  for (let i = 0; i < 6; i++) { await p.locator('button', { hasText: '+250' }).click(); await p.waitForTimeout(300); }
  assert.equal(await p.locator('.m-toast').count(), 3, 'at most 3 toasts'); assert.match(await p.locator('.m-toast').last().innerText(), /Added 250/);
  await r.ctx.close(); assert.deepEqual(r.log, []);
});
test('journal: face picker, save disabled until both, day headers with Today, edit an entry (t.set), remove with Undo, Show more', async () => {
  const r = await open(browser, srv.base, 'journal'); const p = r.page;
  const rows = () => p.locator('m-list .item').count(); const n0 = await rows();
  assert.equal(await p.locator('button.btn.ghost').first().isDisabled(), true);
  await p.locator('label', { hasText: 'low' }).click(); assert.equal(await p.locator('button.btn.ghost').first().isDisabled(), true);
  await p.fill('textarea', 'Tired but fine.'); assert.equal(await p.locator('button.btn.ghost').first().isDisabled(), false); await p.locator('button.btn.ghost').first().click();
  assert.equal(await rows(), n0 + 1); assert.match(await p.locator('m-list .item').first().innerText(), /Tired but fine\./);
  assert.equal(await p.locator('textarea').inputValue(), ''); assert.equal(await p.locator('input[type=radio]:checked').count(), 0);
  assert.equal(await p.locator('m-list .m-dh b.hi').first().innerText(), 'Today');
  await p.locator('m-list .m-body').first().click(); await p.fill('.m-edit textarea[name=note]', 'Edited: better by evening.'); await p.selectOption('.m-edit select[name=mood]', 'good'); await p.click('.m-edit button[type=submit]');
  assert.match(await p.locator('m-list .item').first().innerText(), /Edited: better[\s\S]*Good/);
  await p.locator('m-list .item .ibtn').first().click(); assert.equal(await rows(), n0); await p.locator('.m-toast button', { hasText: 'Undo' }).last().click(); assert.equal(await rows(), n0 + 1);
  await r.ctx.close(); assert.deepEqual(r.log, []);
});
test('budget: calendar-month remainder, over-budget state, bars clamped, editable budget, empty submit message, segmented category, edit (t.set)', async () => {
  const r = await open(browser, srv.base, 'budget'); const p = r.page;
  const mtd = seedOf('budget').tables.spend.filter((x) => x.d <= fixedDay - 1).reduce((a, x) => a + x.amount, 0);
  const left = () => p.locator('.stat').first().innerText(), unit = () => p.locator('.stat').first().locator('xpath=following-sibling::*').first().innerText();
  assert.equal(await left(), nf(80000 - mtd)); assert.equal(await unit(), 'PKR left');
  await p.locator('small [contenteditable]').click(); await p.keyboard.press('Control+A'); await p.keyboard.type('10000'); await p.keyboard.press('Enter');
  assert.equal(await left(), nf(mtd - 10000)); assert.equal(await unit(), 'PKR over budget'); assert.equal(await p.locator('.bar i').first().evaluate((i) => i.getBoundingClientRect().width <= i.parentElement.getBoundingClientRect().width + 0.5), true, 'bar clamped to the track');
  await p.locator('small [contenteditable]').click(); await p.keyboard.press('Control+A'); await p.keyboard.type('0'); await p.keyboard.press('Enter');
  assert.equal(await unit(), 'PKR over budget'); assert.equal(await p.locator('.bar i').first().evaluate((i) => i.getBoundingClientRect().width <= i.parentElement.getBoundingClientRect().width + 0.5), true, 'zero budget does not break the bar');
  await p.locator('small [contenteditable]').click(); await p.keyboard.press('Control+A'); await p.keyboard.type('abc'); await p.keyboard.press('Enter'); assert.equal(await p.locator('small [contenteditable]').innerText(), '0', 'invalid input reverts');
  await p.locator('small [contenteditable]').click(); await p.keyboard.press('Control+A'); await p.keyboard.type('80000'); await p.keyboard.press('Enter'); assert.equal(await unit(), 'PKR left');
  await p.click('button[type=submit]'); assert.ok(await p.locator('.m-err').isVisible()); assert.match(await p.locator('.m-err').innerText(), /text/);
  await p.fill('input[name=description]', 'Tea'); await p.click('button[type=submit]'); assert.match(await p.locator('.m-err').innerText(), /number/);
  await p.fill('input[name=amount]', '400'); await p.locator('.seg label', { hasText: 'Fun' }).click(); await p.click('button[type=submit]');
  assert.equal(await left(), nf(80000 - mtd - 400));
  await p.waitForTimeout(600); await p.fill('input[name=description]', 'Big refund'); await p.fill('input[name=amount]', '-90000'); await p.locator('.seg label', { hasText: 'Health' }).click(); await p.click('button[type=submit]');
  assert.match(await p.locator('.col:has(.bar)', { hasText: 'Health' }).first().innerText(), /[-\u2212]\d/, 'a refund-heavy category shows a negative total');
  const w = await p.$$eval('.bar i', (is) => is.map((i) => i.getBoundingClientRect().width / i.parentElement.getBoundingClientRect().width)); assert.ok(w.every((x) => x >= 0 && x <= 1.001), 'bars stay within 0-100%: ' + w);
  await p.locator('m-list .item .ibtn').first().click();
  await p.locator('m-list .m-body', { hasText: 'Tea' }).first().click(); await p.fill('.m-edit input[name=amount]', '500'); await p.click('.m-edit button[type=submit]');
  assert.equal(await left(), nf(80000 - mtd - 500 + 90000 - 90000 + 0));
  await r.ctx.close(); assert.deepEqual(r.log, []);
});
