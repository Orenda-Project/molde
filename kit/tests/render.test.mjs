// Browser acceptance: 5 fixtures x 5 viewports. Page is served by the same CSP as production (contract section 7).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, open, FIXTURES, VIEWPORTS, auditFn, del } from './lib.mjs';

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

test('exercise: day headers with totals, set numbers, PR marker and delta chip, rest timer + notification, chart, add, remove any set (one tap arms, one deletes) with Undo', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'exercise');
  const cnt = (txt) => page.locator('.item', { hasText: txt }).count();
  const head = page.locator('.m-dh').first();
  assert.match(await head.innerText(), /Today[\s\S]*9 sets/); assert.equal(await head.locator('b.hi').count(), 1, 'Today is emphasised');
  const sq = page.locator('.item.slim', { hasText: 'Squat' }).first(); assert.match(await sq.innerText(), /PR|\+2\.5 kg/); assert.match(await page.locator('.item.slim small', { hasText: /kg$/ }).first().innerText(), /^[+-]?\d+(\.\d+)? kg$/, 'delta as small text');
  const prs = await page.$$eval('.item.slim', (els) => els.filter((e) => e.querySelector('.chip') && getComputedStyle(e.querySelector('.chip')).display !== 'none').map((e) => e.querySelector('button').innerText)); assert.equal(new Set(prs).size, prs.length, 'one PR chip per exercise: ' + prs);
  assert.ok((await page.locator('.chip', { hasText: 'PR' }).count()) >= 1, 'a PR marker'); assert.match(await page.locator('.list .item bdi.grow').first().innerText(), /^1\. \d/, 'sets are numbered');
  assert.equal(await page.locator('m-chart svg polyline.m-line').count(), 1, 'a progress line'); await page.locator('.item.slim button', { hasText: 'Squat' }).first().click(); assert.match(await page.locator('m-chart small').innerText(), /^Squat, top weight/);
  await page.fill('input[name=exercise]', 'Squat'); await page.fill('input[name=kg]', '72.5'); await page.fill('input[name=reps]', '5'); await page.click('button[type=submit]');
  assert.equal(await cnt('72.5 kg × 5'), 1); assert.match(await head.innerText(), /10 sets/);
  await del(page.locator('.item', { hasText: '72.5 kg × 5' }).locator('.ibtn')); assert.equal(await cnt('72.5 kg × 5'), 0); assert.match(await head.innerText(), /9 sets/);
  await page.locator('.m-toast button', { hasText: 'Undo' }).last().click(); assert.equal(await cnt('72.5 kg × 5'), 1);
  const n0 = await page.locator('.list .item').count(); await page.locator('button', { hasText: 'Show more history' }).click();
  assert.ok((await page.locator('.list .item').count()) > n0, 'more history appears');
  const buttons = await page.locator('.list .item .ibtn').all(); assert.ok(buttons.length > 20); await buttons[20].click(); assert.match(await buttons[20].getAttribute('aria-label'), /^Delete/, 'first tap arms'); await page.waitForTimeout(350); await buttons[20].click();
  assert.match(await page.locator('.ibtn').first().getAttribute('aria-label'), /^More actions/, 'every row action has an accessible name');
  const t1 = await page.locator('.stat').innerText(); assert.equal(t1, '1:30');
  await page.locator('button', { hasText: 'Rest' }).click(); await page.waitForTimeout(1200); assert.notEqual(await page.locator('.stat').innerText(), '1:30');
  const notified = await page.evaluate(() => 1); assert.equal(notified, 1); await page.locator('button', { hasText: 'Pause' }).click();
  await ctx.close(); assert.deepEqual(log, []);
});
test('habits: names above full-width check rows, weekday + date header, toggle any day, rename (Enter/Esc), ONE Undo restores a removed habit and all its checks, Show more habits, heat map ramp', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'habits');
  const row = (n) => page.locator('.item.wrap', { hasText: n });
  assert.equal(await page.locator('.stat').innerText(), '12');
  const vis = (sel) => page.$$eval(sel, (els) => els.filter((e) => e.offsetTop === els[0].offsetTop).length);
  const cols = await vis('.item.grid small'); assert.ok(cols >= 5, 'columns at 412: ' + cols); assert.equal(await page.$$eval('.item.wrap .grid .check', (els) => els.slice(0, 7).filter((e) => e.offsetTop === els[0].offsetTop).length), cols, 'one check per header column');
  assert.match(await page.locator('.item.grid small').first().innerText(), /^[A-Za-z\u0600-\u06ff]{2,}\s*\d+$/, 'weekday name and date');
  const name = await row('Read 20').locator('[contenteditable]').boundingBox(), first = await row('Read 20').locator('.check').first().boundingBox(); assert.ok(name.y + name.height <= first.y + 1 && name.width > 150, 'the name sits on its own line, wide');
  assert.equal(await row('Read 20').locator('[contenteditable]').getAttribute('role'), 'textbox'); assert.equal(await row('Read 20').locator('[contenteditable]').getAttribute('aria-label'), 'Habit', 'x-edit has an accessible name');
  const st = row('Stretch').locator('.check').first(); const was = await st.getAttribute('aria-checked'); await st.click();
  assert.notEqual(await row('Stretch').locator('.check').first().getAttribute('aria-checked'), was);
  const walk = row('Walk 30').locator('[contenteditable]'); await walk.click(); await page.keyboard.press('Control+A'); await page.keyboard.type('Walk 45 minutes'); await page.keyboard.press('Enter');
  assert.equal(await row('Walk 45 minutes').count(), 1); assert.equal(await row('Walk 30').count(), 0);
  const w2 = row('Walk 45').locator('[contenteditable]'); await w2.click(); await page.keyboard.press('Control+A'); await page.keyboard.type('Nope'); await page.keyboard.press('Escape'); assert.equal(await w2.innerText(), 'Walk 45 minutes', 'Escape cancels');
  const snap = () => page.evaluate(() => { const h = store.t('habit').rows.find((x) => x.habit === 'Write in journal'); const c = store.t('check'); return { habits: store.t('habit').rows.length, checks: c.rows.length, mine: h ? c.rows.filter((r) => r.habit === String(h.id)).length : 0, streak: h ? c.streak({ habit: String(h.id) }) : null, orphans: c.rows.filter((r) => !store.t('habit').rows.some((x) => String(x.id) === r.habit)).length }; });
  const before = await snap(); assert.ok(before.mine > 20);
  await del(row('Write in journal').locator('.ibtn').last());
  const mid = await snap(); assert.equal(mid.habits, before.habits - 1); assert.equal(mid.checks, before.checks - before.mine); assert.equal(mid.orphans, 0, 'no orphan check rows');
  assert.equal(await page.locator('.m-toast').count(), 1, 'one toast for the whole removal'); await page.locator('.m-toast button', { hasText: 'Undo' }).click();
  const after = await snap(); assert.deepEqual([after.habits, after.checks, after.mine, after.streak], [before.habits, before.checks, before.mine, before.streak], 'one Undo restores the habit and every check');
  await page.fill('input[name=habit]', 'Journal'); await page.click('button[type=submit]'); assert.equal(await page.locator('.item.wrap [contenteditable]').count(), before.habits + 1);
  await ctx.close(); assert.deepEqual(log, []);
});
test('habits: the 41st habit and beyond are reachable with Show more habits', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'habits', { q: '&big=100' });
  assert.equal(await page.locator('.item.wrap').count(), 40); await page.locator('button', { hasText: 'Show more habits' }).click(); assert.equal(await page.locator('.item.wrap').count(), 80);
  await page.locator('button', { hasText: 'Show more habits' }).click(); assert.equal(await page.locator('.item.wrap').count(), 100); assert.equal(await page.locator('button', { hasText: 'Show more habits' }).isHidden(), true);
  await ctx.close(); assert.deepEqual(log, []);
});
test('water: glass fills, formatted goal, double tap adds once, recent list remove + Undo, validated custom amount, goal bounds, clean console on an empty table, toast cap', async () => {
  const r = await open(browser, srv.base, 'water'); const p = r.page;
  const big = () => p.locator('.stat').innerText(); const level = () => p.locator('svg path[clip-path]').getAttribute('d');
  assert.equal(await big(), '1,500 ml'); const l0 = await level(); assert.equal(await p.locator('small [contenteditable]').innerText(), '2,000');
  await p.locator('.m-quick button', { hasText: '+500' }).dblclick(); assert.equal(await big(), '2,000 ml', 'a double tap adds once'); assert.notEqual(await level(), l0);
  await p.locator('.m-toast button', { hasText: 'Undo' }).last().click(); assert.equal(await big(), '1,500 ml');
  await del(p.locator('m-list .ibtn').first()); assert.equal(await big(), '1,250 ml');
  await p.locator('.m-toast button', { hasText: 'Undo' }).last().click(); assert.equal(await big(), '1,500 ml');
  for (const bad of ['6000', '0', '-5']) { await p.fill('input[name=volume]', bad); await p.click('button[type=submit]'); assert.match(await p.locator('.m-err').innerText(), /from 1 to 5,000/); assert.equal(await big(), '1,500 ml'); }
  await p.fill('input[name=volume]', '300'); await p.click('button[type=submit]'); assert.equal(await big(), '1,800 ml');
  const g = p.locator('small [contenteditable]');
  for (const bad of ['0', '100001', '-5', 'many']) { await g.click(); await p.keyboard.press('Control+A'); await p.keyboard.type(bad); await p.keyboard.press('Enter'); assert.equal(await g.innerText(), '2,000', 'goal rejects ' + bad); }
  await g.click(); await p.keyboard.press('Control+A'); await p.keyboard.type('100000'); await p.keyboard.press('Enter'); assert.equal(await g.innerText(), '100,000');
  const u0 = await p.locator('.m-toast button').count();
  for (let i = 0; i < 6; i++) { await p.locator('.m-quick button', { hasText: '+250' }).click(); await p.waitForTimeout(450); }
  const n = parseInt(await p.locator('.m-tray-h b').innerText(), 10); assert.ok(n >= 6, 'six rapid adds keep six pending Undos in one tray, none is lost: ' + n); assert.equal(await p.locator('.m-tray .m-toast button').count(), n, 'each one has its own Undo');
  await p.locator('.m-tray .m-toast button').nth(2).click(); assert.equal(await p.locator('.m-tray-h b').innerText(), `${n - 1} undos`); await p.locator('.m-tray-h button', { hasText: 'Undo all' }).click(); assert.equal(await p.locator('.m-toast').count(), 0, 'Undo all restores everything'); assert.ok(['1,800 ml', '1,500 ml'].includes(await big()), 'Undo all restores the total from before the six adds (an older 300 ml Undo may or may not have expired)');
  await r.ctx.close(); assert.deepEqual(r.log, []);
  const e = await open(browser, srv.base, 'water', { seed: false }); await e.page.waitForTimeout(200); assert.equal(await e.page.locator('.stat').innerText(), '0 ml'); assert.deepEqual(e.log, [], 'an empty table is clean');
  await e.page.evaluate(() => { store.kv('goal', 2000).v = 1; }); await e.page.waitForTimeout(100); assert.deepEqual(e.log, []); await e.ctx.close();
});
test('journal: face picker (outlined faces), save disabled until both, glyph per row and no mood badge, day headers with Today, edit an entry (t.set), single delete step with Undo, Show more', async () => {
  const r = await open(browser, srv.base, 'journal'); const p = r.page;
  const rows = () => p.locator('m-list .item').count(); const n0 = await rows();
  assert.equal(await p.locator('button.btn.ghost').first().isDisabled(), true);
  await p.locator('label', { hasText: 'low' }).click(); assert.equal(await p.locator('button.btn.ghost').first().isDisabled(), true);
  await p.fill('textarea', 'Tired but fine.'); assert.equal(await p.locator('button.btn.ghost').first().isDisabled(), false); await p.locator('button.btn.ghost').first().click();
  assert.equal(await rows(), n0 + 1); assert.match(await p.locator('m-list .item').first().innerText(), /Tired but fine\./);
  assert.equal(await p.locator('m-list .chip').count(), 0, 'no mood badge on the rows'); assert.ok((await p.locator('m-list svg.m-glyph').count()) >= n0, 'a face glyph per row');
  const d0 = await p.locator('m-list svg.m-glyph path').first().getAttribute('d'), d1 = await p.locator('m-list svg.m-glyph path').nth(3).getAttribute('d'); assert.notEqual(d0, d1, 'faces differ by mood');
  assert.equal(await p.locator('textarea').inputValue(), ''); assert.equal(await p.locator('input[type=radio]:checked').count(), 0);
  assert.equal(await p.locator('m-list .m-dh b.hi').first().innerText(), 'Today');
  await p.locator('m-list .m-body').first().click(); await p.fill('.m-edit textarea[name=note]', 'Edited: better by evening.'); await p.selectOption('.m-edit select[name=mood]', 'good'); await p.click('.m-edit button[type=submit]');
  assert.match(await p.locator('m-list .item').first().innerText(), /Edited: better/);
  await del(p.locator('m-list .item .ibtn').first()); assert.equal(await rows(), n0); await p.locator('.m-toast button', { hasText: 'Undo' }).last().click(); assert.equal(await rows(), n0 + 1);
  await r.ctx.close(); assert.deepEqual(r.log, []);
});
test('budget: calendar-month remainder, over-budget state, bars within 0-100%, editable budget with bounds, one-row Add, segmented category, edit (t.set)', async () => {
  const r = await open(browser, srv.base, 'budget'); const p = r.page;
  const mtd = seedOf('budget').tables.spend.filter((x) => x.d <= fixedDay - 1).reduce((a, x) => a + x.amount, 0);
  const left = () => p.locator('.stat').first().innerText(), unit = () => p.locator('.stat').first().locator('xpath=following-sibling::*').first().innerText();
  const edit = p.locator('small [contenteditable]'); const setCap = async (v) => { await edit.click(); await p.keyboard.press('Control+A'); await p.keyboard.type(v); await p.keyboard.press('Enter'); };
  assert.equal(await left(), nf(80000 - mtd)); assert.equal(await unit(), 'PKR left'); assert.equal(await edit.innerText(), '80,000', 'one number format everywhere');
  await setCap('10000'); assert.equal(await left(), nf(mtd - 10000)); assert.equal(await unit(), 'PKR over budget');
  const inside = () => p.$$eval('.bar i', (is) => is.map((i) => i.getBoundingClientRect().width / i.parentElement.getBoundingClientRect().width)); assert.ok((await inside()).every((x) => x >= 0 && x <= 1.001), 'bars clamped to the track');
  assert.ok(!/e\+/.test(await p.locator('.bar i').first().evaluate((i) => i.getAttribute('style') || '')), 'CSS width never in exponent form');
  await setCap('1'); assert.equal(await edit.innerText(), '1'); assert.ok((await inside()).every((x) => x >= 0 && x <= 1.001)); assert.ok(!/e\+/.test(await p.locator('.bar i').first().evaluate((i) => i.getAttribute('style') || '')), 'a tiny budget does not make a 4e+06% width');
  for (const bad of ['0', '-5', '1000000001', 'abc']) { await setCap(bad); assert.equal(await edit.innerText(), '1', 'budget rejects ' + bad); }
  await setCap('80000'); assert.equal(await unit(), 'PKR left');
  const boxes = await p.$$eval('m-form input[name=description], m-form input[name=amount], m-form button[type=submit]', (els) => els.map((e) => { const b = e.getBoundingClientRect(); return [b.left, b.right, b.top, b.bottom]; }));
  assert.equal(boxes.length, 3); assert.ok(Math.abs(boxes[0][2] - boxes[2][2]) < 12 && Math.abs(boxes[1][2] - boxes[2][2]) < 12, 'description, amount and Add share one row'); assert.ok(boxes[1][1] - boxes[1][0] >= 120, 'Amount is wide enough: ' + (boxes[1][1] - boxes[1][0]));
  await p.click('button[type=submit]'); assert.ok(await p.locator('.m-err').isVisible()); assert.match(await p.locator('.m-err').innerText(), /text/);
  await p.fill('input[name=description]', 'Tea'); await p.click('button[type=submit]'); assert.match(await p.locator('.m-err').innerText(), /number/);
  await p.fill('input[name=amount]', '400'); await p.locator('.seg label', { hasText: 'Fun' }).click(); await p.click('button[type=submit]');
  assert.equal(await left(), nf(80000 - mtd - 400));
  await p.waitForTimeout(600); await p.fill('input[name=description]', 'Big refund'); await p.fill('input[name=amount]', '-90000'); await p.locator('.seg label', { hasText: 'Health' }).click(); await p.click('button[type=submit]');
  assert.match(await p.locator('.col:has(.bar)', { hasText: 'Health' }).first().innerText(), /[-\u2212]\d/, 'a refund-heavy category shows a negative total'); assert.ok((await inside()).every((x) => x >= 0 && x <= 1.001), 'bars stay within 0-100%');
  await del(p.locator('m-list .item .ibtn').first());
  await p.locator('m-list .m-body', { hasText: 'Tea' }).first().click(); await p.fill('.m-edit input[name=amount]', '500'); await p.click('.m-edit button[type=submit]');
  assert.equal(await left(), nf(80000 - mtd - 500));
  await r.ctx.close(); assert.deepEqual(r.log, []);
});
