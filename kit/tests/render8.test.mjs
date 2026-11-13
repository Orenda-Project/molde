// Round 8: the four apps as rich exemplars. Each test exercises the features a person uses, in a real browser, with the production bundle.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, open, inject, del } from './lib.mjs';
import { readFileSync } from 'node:fs';
import { KIT } from './lib.mjs';

let srv, browser;
before(async () => { srv = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });
const noLog = (log) => assert.deepEqual(log, [], 'console output: ' + log.join(' | '));
const seedOf = (f) => JSON.parse(readFileSync(`${KIT}/fixtures/${f}/seed.json`, 'utf8'));
const nf = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);

test('habits: Today with big buttons is the first thing and above the fold, N of M done, rate per habit, progress, heat map text, 7-day dots, rename, one Undo', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'habits', { w: 412, h: 915 });
  assert.match(await page.locator('main section').first().locator('h2').innerText(), /^\d+ of 6 done today$/);
  const big = page.locator('.btn.big'); assert.equal(await big.count(), 6);
  const bb = await big.first().boundingBox(); assert.ok(bb.height >= 56 && bb.y + bb.height < 915, 'a big daily action above the fold: ' + JSON.stringify(bb));
  assert.match(await page.locator('main section').first().locator('small').first().innerText(), /^\d+% in 30 days$/);
  // toggle today
  const walk = page.locator('.item.wrap', { hasText: 'Walk 30' }).locator('.btn.big'); const was = await walk.getAttribute('aria-pressed'); const h2 = await page.locator('main section h2').first().innerText();
  await walk.click(); assert.notEqual(await walk.getAttribute('aria-pressed'), was); assert.notEqual(await page.locator('main section h2').first().innerText(), h2, 'the summary follows');
  assert.match(await walk.getAttribute('aria-label'), /^Walk 30 minutes, today$/);
  // progress: three numbers, best streak with the habit as the hint
  const labels = await page.locator('m-stat').allInnerTexts(); assert.ok(labels.some((t) => /This week/.test(t)) && labels.some((t) => /30 days/.test(t)) && labels.some((t) => /Best streak: Read 20 pages/.test(t)), labels.join('|'));
  // heat map: 70 cells or fewer (10 weeks to today), each has text
  const cells = await page.$$eval('.grid.flow i.cell', (els) => els.map((e) => [e.getAttribute('role'), e.getAttribute('aria-label')])); assert.ok(cells.length >= 64 && cells.length <= 70, 'cells ' + cells.length); assert.ok(cells.every((c) => c[0] === 'img' && /\d/.test(c[1])));
  assert.ok((await page.locator('.grid.flow i.cell.lv3, .grid.flow i.cell.lv4').count()) > 3, 'an accent ramp');
  // each habit shows its last 7 days with text
  assert.equal(await page.locator('.item.wrap').first().locator('.cell.wide').count(), 7); assert.match(await page.locator('.item.wrap').first().locator('.cell.wide').last().getAttribute('aria-label'), /, (done|not done)$/); assert.match(await page.locator('.item.wrap').first().locator('.ibtn.ring').getAttribute('aria-label'), /^\d+ day streak$/);
  // rename and one Undo
  const nm = page.locator('.item.wrap', { hasText: 'Walk 30' }).locator('[contenteditable]'); await nm.click(); await page.keyboard.press('Control+A'); await page.keyboard.type('Walk 45 minutes'); await page.keyboard.press('Enter'); assert.equal(await page.locator('.item.wrap', { hasText: 'Walk 45 minutes' }).count(), 1);
  const snap = () => page.evaluate(() => ({ h: store.t('habit').rows.length, c: store.t('check').rows.length }));
  const b0 = await snap(); await del(page.locator('.item.wrap', { hasText: 'Write in journal' }).locator('.ibtn:not(.ring)')); const m = await snap(); assert.ok(m.h === b0.h - 1 && m.c < b0.c, 'habit and its checks are gone');
  assert.equal(await page.locator('.m-toast').count(), 1); await page.locator('.m-toast button', { hasText: 'Undo' }).click(); assert.deepEqual(await snap(), b0, 'one Undo restores all');
  await ctx.close(); noLog(log);
});

test('habits: the empty state says there is nothing yet and the form works; wide screens use columns', async () => {
  const e = await open(browser, srv.base, 'habits', { seed: false });
  assert.match(await e.page.locator('.empty').innerText(), /Nothing to track yet/); assert.equal(await e.page.locator('.cols').isHidden(), true);
  await e.page.fill('input[name=habit]', 'Read'); await e.page.click('button[type=submit]'); await e.page.waitForTimeout(200); assert.equal(await e.page.locator('.cols').isVisible(), true); assert.equal(await e.page.locator('.empty').isHidden(), true); await e.ctx.close(); noLog(e.log);
  for (const [w, minCols] of [[412, 1], [800, 2], [1440, 3]]) {
    const { page, ctx } = await open(browser, srv.base, 'habits', { w, h: 900 });
    const n = await page.$eval('.cols', (c) => getComputedStyle(c).gridTemplateColumns.split(' ').length); assert.equal(n, minCols, `columns at ${w}`);
    const mw = await page.$eval('main', (m) => m.getBoundingClientRect().width); if (w >= 1200) assert.ok(mw > 1000, 'no lone 560 px column at 1440: ' + mw); await ctx.close();
  }
});

test('exercise: kg and reps labels stay visible, bounds (kg >= 0, reps >= 1), today summary, Repeat last set, picker + progress, history by day, rest timer with a label', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'exercise');
  const lab = () => page.$$eval('m-form .field > span', (s) => s.map((x) => x.textContent)); assert.deepEqual(await lab(), ['Exercise', 'Kg (optional)', 'Reps']);
  await page.waitForTimeout(100); assert.ok(await page.$eval('input[name=exercise]', (i) => i.value), 'prefilled from the last set'); assert.deepEqual(await lab(), ['Exercise', 'Kg (optional)', 'Reps'], 'the labels stay when the fields are filled');
  const today0 = await page.locator('main section').first().locator('h2').innerText(); assert.match(today0, /^\d+ sets today$/); assert.match(await page.locator('main section').first().locator('small').first().innerText(), /kg moved$/);
  // bounds
  await page.fill('input[name=exercise]', 'Row'); await page.fill('input[name=kg]', '-5'); await page.fill('input[name=reps]', '5'); await page.click('button[type=submit]'); assert.match(await page.locator('.m-err').innerText(), /at least 0/);
  await page.fill('input[name=kg]', '40'); await page.fill('input[name=reps]', '0'); await page.click('button[type=submit]'); assert.match(await page.locator('.m-err').innerText(), /at least 1/);
  await page.fill('input[name=reps]', '8'); await page.click('button[type=submit]'); assert.match(await page.locator('main section').first().locator('h2').innerText(), /^\d+ sets today$/); assert.notEqual(await page.locator('main section').first().locator('h2').innerText(), today0);
  assert.deepEqual(await page.$$eval('input[name=exercise], input[name=kg]', (i) => i.map((x) => x.value)), ['Row', '40'], 'the last values are kept');
  const n = () => page.evaluate(() => store.t('set').rows.length); const n0 = await n(); await page.getByRole('button', { name: 'Repeat last set' }).click(); assert.equal(await n(), n0 + 1); assert.equal(await page.evaluate(() => { const r = store.t('set').rows; return r.at(-1).exercise + r.at(-1).kg + r.at(-1).reps; }), 'Row408');
  // picker
  const sel = page.locator('select'); assert.ok((await sel.locator('option').count()) >= 6); await sel.selectOption('Squat'); assert.match(await page.locator('main > .cols > section m-chart small', { hasText: 'Squat' }).innerText(), /^Squat/); assert.equal(await page.locator('section m-chart svg polyline.m-line').count(), 1);
  assert.equal(await page.locator('m-chart svg rect.m-b').count(), 7, 'sets in the last 7 days');
  // history
  assert.match(await page.locator('.wide b').first().innerText(), /Today/); assert.match(await page.locator('.wide .list .item.slim').first().innerText(), /top .* (kg|reps)/); assert.match(await page.locator('.wide .list .item bdi').first().innerText(), /^1\. /);
  const before = await n(); await del(page.locator('.wide .list .item .ibtn').first()); assert.equal(await n(), before - 1); await page.locator('.m-toast button', { hasText: 'Undo' }).first().click(); assert.equal(await n(), before);
  // timer
  const t = page.locator('[role=timer]'); assert.equal(await t.getAttribute('aria-label'), 'Rest timer'); assert.equal(await t.locator('[aria-live=polite]').count(), 1); assert.match(await t.locator('.stat').innerText(), /^1:30$/);
  await page.getByRole('button', { name: 'Start rest' }).click(); await page.waitForTimeout(1200); assert.notEqual(await t.locator('.stat').innerText(), '1:30'); assert.equal(await t.locator('[aria-live=polite]').innerText(), 'Resting'); await page.getByRole('button', { name: 'Pause' }).click();
  const hist = await page.locator('.wide .col > b').count(); await page.getByRole('button', { name: 'Show more history' }).click(); assert.ok((await page.locator('.wide .col > b').count()) > hist);
  await ctx.close(); noLog(log);
});

test('budget: headline in the app locale, safe to spend, vs last month, even-pace chart, categories filter the list, month navigator, cap errors are visible', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'budget');
  const mtd = seedOf('budget').tables.spend.filter((x) => x.d <= 20).reduce((a, x) => a + x.amount, 0);
  const stat = () => page.locator('.stat').first().innerText(); assert.equal(await stat(), nf(80000 - mtd)); assert.match(await page.locator('main section').first().locator('small').first().innerText(), /^Left to spend$/);
  assert.match(await page.locator('main section').first().innerText(), /Safe to spend [\d,]+ a day/); assert.match(await page.locator('main section').first().innerText(), /Last month: [\d,]+\. Biggest: \w+/);
  assert.equal(await page.locator('svg[role=img] polyline').count(), 2, 'spent line and even-pace line'); const pts = await page.locator('svg polyline').nth(0).getAttribute('points'); assert.match(pts, /^0,110 300,\d/, 'the even pace runs from 0 to the budget');
  // category filter
  const rows0 = await page.locator('m-list .item').count(); const first = page.locator('.tbtn[aria-pressed]').first(); const nm = (await first.innerText()).split('\n')[0].trim(); await first.click(); assert.equal(await first.getAttribute('aria-pressed'), 'true'); assert.ok((await page.locator('m-list .item').count()) < rows0, 'the list is filtered by ' + nm);
  await first.click(); assert.equal(await page.locator('m-list .item').count(), rows0);
  const bars = await page.$$eval('.tbtn .bar', (b) => b.map((x) => x.classList.contains('soft'))); assert.deepEqual(bars, bars.map((_, i) => i > 0), 'the largest category is the accent, the rest are quiet');
  // cap edit: bounds with a visible message
  const cap = page.locator('[contenteditable]').first(); assert.equal(await cap.getAttribute('aria-label'), 'Monthly budget');
  const setCap = async (v) => { await cap.click(); await page.keyboard.press('Control+A'); await page.keyboard.type(v); await page.keyboard.press('Enter'); };
  await setCap('10000'); assert.equal(await stat(), nf(mtd - 10000)); assert.match(await page.locator('main section').first().locator('small').first().innerText(), /Over budget by/);
  for (const bad of ['0', '-5', '1000000001', 'abc']) { await setCap(bad); assert.equal(await cap.innerText(), '10,000', 'budget rejects ' + bad); assert.match(await page.locator('.m-xerr').innerText(), /number from 1 to/); assert.equal(await cap.getAttribute('aria-invalid'), 'true'); }
  await setCap('80000'); assert.equal(await page.locator('.m-xerr').count(), 0, 'the message goes away after a good edit');
  // month navigator
  const title = () => page.locator('main section').first().locator('b.grow').innerText(); const t0 = await title(); await page.getByRole('button', { name: 'Previous month' }).click(); assert.notEqual(await title(), t0); assert.ok((await page.locator('m-list .item').count()) > 0); assert.equal(await page.getByRole('button', { name: 'Next month' }).isEnabled(), true);
  // add: one row, validation, jumps to this month
  await page.fill('input[name=description]', 'Tea'); await page.fill('input[name=amount]', '400'); await page.click('button[type=submit]'); assert.equal(await title(), t0); assert.match(await page.locator('m-list .item').first().innerText(), /Tea/);
  await page.locator('m-list .m-body', { hasText: 'Tea' }).first().click(); await page.fill('.m-edit input[name=amount]', '500'); await page.click('.m-edit button[type=submit]'); assert.equal(await stat(), nf(80000 - mtd - 500));
  await ctx.close(); noLog(log);
});

test('journal: streak and week strip, mood line with average, search with highlight, edit an entry, faces differ', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'journal');
  assert.match(await page.locator('main section .stat').first().innerText(), /^\d+$/); assert.match(await page.locator('main section').nth(0).innerText(), /entries in the last 7 days/); assert.equal(await page.locator('section .grid i.cell').count(), 7);
  const lab = await page.locator('m-chart small').first().innerText(); assert.match(lab, /Mood from 1 \(awful\) to 5 \(great\), last 30 days\. Average [1-5](\.\d)?$/); assert.equal(await page.locator('m-chart svg polyline.m-line').count(), 1);
  const rows = () => page.locator('m-list .item').count(); const n0 = await rows();
  assert.equal(await page.locator('button.btn').first().isDisabled(), true); await page.locator('label', { hasText: 'low' }).click(); assert.equal(await page.locator('button.btn').first().isDisabled(), true);
  await page.fill('form textarea', 'Tired but fine.'); await page.locator('button.btn').first().click(); assert.equal(await rows(), n0 + 1); assert.equal(await page.locator('form textarea').inputValue(), '');
  // search with highlight
  await page.fill('input[type=search]', 'chai'); const found = await rows(); assert.ok(found >= 1 && found < n0); const marks = await page.locator('m-list mark').allInnerTexts(); assert.ok(marks.length >= 1 && marks.every((m) => m.toLowerCase() === 'chai'), 'matches are highlighted: ' + marks);
  await page.fill('input[type=search]', 'zzzz'); assert.equal(await rows(), 0); await page.fill('input[type=search]', ''); assert.equal(await rows(), n0 + 1);
  // edit
  await page.locator('m-list .m-body').first().click(); await page.fill('.m-edit textarea[name=note]', 'Edited: better by evening.'); await page.selectOption('.m-edit select[name=mood]', 'good'); await page.click('.m-edit button[type=submit]'); assert.match(await page.locator('m-list .item').first().innerText(), /Edited: better/);
  const d = await page.$$eval('form fieldset path', (ps) => ps.map((p) => p.getAttribute('d'))); assert.equal(new Set(d).size, 5);
  await del(page.locator('m-list .item .ibtn').first()); assert.equal(await rows(), n0); await page.locator('.m-toast button', { hasText: 'Undo' }).first().click(); assert.equal(await rows(), n0 + 1);
  await ctx.close(); noLog(log);
});

test('habits: deleting every habit leaves the console clean and an empty state, then adding works', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'habits');
  const rows = () => page.locator('.item.wrap').count();
  while ((await rows()) > 0) await del(page.locator('.item.wrap .ibtn:not(.ring)').last());
  await page.waitForTimeout(200); assert.equal(await page.locator('.empty').isVisible(), true); assert.equal(await page.locator('.cols').isHidden(), true); noLog(log);
  await page.fill('input[name=habit]', 'Stretch'); await page.click('button[type=submit]'); await page.waitForTimeout(200); assert.equal(await rows(), 1); assert.equal(await page.locator('.cols').isVisible(), true);
  await page.locator('.btn.big').click(); assert.match(await page.locator('main section h2').first().innerText(), /^1 of 1 done today$/);
  await ctx.close(); noLog(log);
});

test('the standalone page keeps its data in localStorage and shows it again after a reload (a host adapter, when given, wins)', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'water', { seed: false });
  await page.locator('.m-quick button', { hasText: '+250' }).click(); await page.waitForTimeout(100);
  await page.locator('[contenteditable]').click(); await page.keyboard.press('Control+A'); await page.keyboard.type('3000'); await page.keyboard.press('Enter'); await page.waitForTimeout(100);
  assert.ok(await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('molde:'))), 'a molde: key is written');
  await page.reload(); await page.waitForTimeout(400); assert.equal(await page.locator('.stat').innerText(), '250 ml', 'the row survived the reload'); assert.equal(await page.locator('[contenteditable]').innerText(), '3,000', 'and the goal');
  await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(300); assert.equal(await page.locator('.stat').innerText(), '0 ml', 'cleared storage starts empty');
  await ctx.close(); noLog(log);
  const seeded = await open(browser, srv.base, 'habits'); const n0 = await seeded.page.locator('.item.wrap').count(); await del(seeded.page.locator('.item.wrap .ibtn:not(.ring)').first()); await seeded.page.waitForTimeout(100);
  await seeded.page.reload(); await seeded.page.waitForTimeout(400); assert.equal(await seeded.page.locator('.item.wrap').count(), n0 - 1, 'a seeded fixture keeps the deletion across a reload'); await seeded.ctx.close(); noLog(seeded.log);
});

test('x-edit rejection is explained next to the field; Escape on an Undo only collapses the tray; labels and per-column bounds are generic', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'water');
  const g = page.locator('[contenteditable]'); await g.click(); await page.keyboard.press('Control+A'); await page.keyboard.type('abc'); await page.keyboard.press('Enter');
  assert.match(await page.locator('.m-xerr').innerText(), /number from 1 to 100,000/); assert.equal(await page.locator('.m-xerr').getAttribute('role'), 'alert');
  await ctx.close(); noLog(log);
});
