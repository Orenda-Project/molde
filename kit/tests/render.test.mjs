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

test('exercise: sets grouped by day and exercise, delta vs last session, add, remove any set with Undo, Show more history', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'exercise');
  const cnt = (txt) => page.locator('.item', { hasText: txt }).count();
  assert.match(await page.locator('.list .item', { hasText: 'Squat' }).first().innerText(), /Squat · Nov 21[\s\S]*\+2\.5 kg/);
  await page.fill('input[name=exercise]', 'Squat'); await page.fill('input[name=kg]', '72.5'); await page.fill('input[name=reps]', '5'); await page.click('button[type=submit]');
  assert.equal(await cnt('72.5 kg × 5'), 1);
  await page.locator('.item', { hasText: '72.5 kg × 5' }).locator('.ibtn').click(); assert.equal(await cnt('72.5 kg × 5'), 0);
  await page.locator('.m-toast button', { hasText: 'Undo' }).last().click(); assert.equal(await cnt('72.5 kg × 5'), 1);
  const n0 = await page.locator('.list .item').count(); await page.locator('button', { hasText: 'Show more history' }).click();
  assert.ok((await page.locator('.list .item').count()) > n0, 'more history appears');
  await page.locator('.list .item .ibtn').nth(40).click(); // any set, not only today's
  await ctx.close(); assert.deepEqual(log, []);
});
test('habits: check grid toggles any day, best streak lead, rename in place, remove with Undo, add, heat grid', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'habits');
  const row = (n) => page.locator('.item', { hasText: n });
  assert.equal(await page.locator('.stat').innerText(), '12');
  assert.equal(await page.locator('.grid .cell').count() >= 84, true); assert.ok((await page.locator('.grid .cell.lv4, .grid .cell.lv3').count()) > 3);
  const st = row('Stretch').locator('.check').first(); const was = await st.getAttribute('aria-pressed');
  await st.click(); assert.notEqual(await row('Stretch').locator('.check').first().getAttribute('aria-pressed'), was);
  await row('Stretch').locator('.check').nth(3).click();
  const walk = row('Walk 30').locator('[contenteditable]'); await walk.click(); await page.keyboard.press('Control+A'); await page.keyboard.type('Walk 45 minutes'); await page.keyboard.press('Tab');
  assert.equal(await row('Walk 45 minutes').count(), 1); assert.equal(await row('Walk 30').count(), 0);
  const n0 = await page.locator('.list .item .check').count(); const n = await page.locator('.list > div[class], .list template').count();
  const rows0 = await page.locator('.list [contenteditable]').count();
  await row('Write in journal').locator('.ibtn[aria-label=Remove]').click(); assert.equal(await page.locator('.list [contenteditable]').count(), rows0 - 1);
  await page.locator('.m-toast button', { hasText: 'Undo' }).last().click(); assert.equal(await page.locator('.list [contenteditable]').count(), rows0);
  await page.fill('input[name=habit]', 'Journal'); await page.click('button[type=submit]'); assert.equal(await page.locator('.list [contenteditable]').count(), rows0 + 1);
  void n0; void n; await ctx.close(); assert.deepEqual(log, []);
});
test('water: glass fills, quick add + Undo, recent list remove + Undo, validated custom amount, toast cap of 3', async () => {
  const r = await open(browser, srv.base, 'water'); const p = r.page;
  const big = () => p.locator('.stat').innerText(); const glass = () => p.locator('svg rect').nth(1).getAttribute('height');
  assert.equal(await big(), '1500'); const h0 = await glass();
  await p.locator('button', { hasText: '+500' }).click(); assert.equal(await big(), '2000'); assert.ok(+(await glass()) > +h0);
  await p.locator('.m-toast button', { hasText: 'Undo' }).last().click(); assert.equal(await big(), '1500');
  await p.locator('m-list .ibtn').first().click(); assert.equal(await big(), '1250');
  await p.locator('.m-toast button', { hasText: 'Undo' }).last().click(); assert.equal(await big(), '1500');
  for (const bad of ['6000', '0', '-5']) { await p.fill('input[name=volume]', bad); await p.click('button[type=submit]'); assert.match(await p.locator('.m-err').innerText(), /from 1 to 5,000/); assert.equal(await big(), '1500'); }
  await p.fill('input[name=volume]', '300'); await p.click('button[type=submit]'); assert.equal(await big(), '1800');
  for (let i = 0; i < 6; i++) await p.locator('button', { hasText: '+250' }).click();
  assert.equal(await p.locator('.m-toast').count(), 3, 'at most 3 toasts'); assert.match(await p.locator('.m-toast').last().innerText(), /Added 250/);
  await r.ctx.close(); assert.deepEqual(r.log, []);
});
test('journal: face picker + note, save disabled until both, edit a note in place (t.set), remove with Undo', async () => {
  const r = await open(browser, srv.base, 'journal'); const p = r.page;
  const rows = () => p.locator('.list .item').count(); const n0 = await rows();
  assert.equal(await p.locator('button.btn').isDisabled(), true);
  await p.locator('label', { hasText: 'low' }).click(); assert.equal(await p.locator('button.btn').isDisabled(), true);
  await p.fill('textarea', 'Tired but fine.'); assert.equal(await p.locator('button.btn').isDisabled(), false); await p.click('button.btn');
  assert.equal(await rows(), n0 + 1); assert.match(await p.locator('.list .item').first().innerText(), /Tired but fine\./);
  assert.equal(await p.locator('textarea').inputValue(), ''); assert.equal(await p.locator('input[type=radio]:checked').count(), 0);
  const note = p.locator('.list [contenteditable]').first(); await note.click(); await p.keyboard.press('Control+A'); await p.keyboard.type('Edited: better by evening.'); await p.keyboard.press('Tab');
  assert.match(await p.locator('.list .item').first().innerText(), /Edited: better/);
  await note.click(); await p.keyboard.press('Control+A'); await p.keyboard.press('Delete'); await p.keyboard.press('Tab'); assert.match(await p.locator('.list .item').first().innerText(), /Edited: better/, 'an empty edit reverts');
  await p.locator('.list .item .ibtn').first().click(); assert.equal(await rows(), n0); await p.locator('.m-toast button', { hasText: 'Undo' }).last().click(); assert.equal(await rows(), n0 + 1);
  await r.ctx.close(); assert.deepEqual(r.log, []);
});
test('budget: lead is the calendar-month remainder, category bars, empty submit shows a visible message, segmented category, edit (t.set)', async () => {
  const r = await open(browser, srv.base, 'budget'); const p = r.page;
  const mtd = seedOf('budget').tables.spend.filter((x) => x.d <= fixedDay - 1).reduce((a, x) => a + x.amount, 0);
  const left = () => p.locator('.stat').first().innerText();
  assert.equal(await left(), nf(80000 - mtd));
  await p.click('button[type=submit]'); assert.ok(await p.locator('.m-err').isVisible()); assert.match(await p.locator('.m-err').innerText(), /description/);
  await p.fill('input[name=description]', 'Tea'); await p.click('button[type=submit]'); assert.match(await p.locator('.m-err').innerText(), /number/);
  await p.fill('input[name=amount]', '400'); await p.locator('.seg label', { hasText: 'Fun' }).click(); await p.click('button[type=submit]');
  assert.equal(await left(), nf(80000 - mtd - 400));
  assert.ok((await p.locator('.bar').count()) >= 6, 'one bar for the lead and one per category');
  await p.waitForTimeout(600); await p.fill('input[name=description]', 'Big refund'); await p.fill('input[name=amount]', '-90000'); await p.locator('.seg label', { hasText: 'Other' }).click(); await p.click('button[type=submit]');
  assert.match(await p.locator('.col:has(.bar)', { hasText: 'Other' }).first().innerText(), /[-\u2212]\d/, 'a refund-heavy category shows a negative total');
  await p.locator('m-list .ibtn').first().click();
  await p.locator('m-list .m-body', { hasText: 'Tea' }).first().click(); await p.fill('.m-edit input[name=amount]', '500'); await p.click('.m-edit button[type=submit]');
  assert.equal(await left(), nf(80000 - mtd - 500));
  await r.ctx.close(); assert.deepEqual(r.log, []);
});
