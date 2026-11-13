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

test('habits: the 41st habit and beyond are reachable with Show more habits', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'habits', { q: '&big=100' });
  assert.equal(await page.locator('.item.wrap').count(), 40); await page.locator('button', { hasText: 'Show more habits' }).click(); assert.equal(await page.locator('.item.wrap').count(), 80);
  await page.locator('button', { hasText: 'Show more habits' }).click(); assert.equal(await page.locator('.item.wrap').count(), 100); await page.locator('button', { hasText: 'Show more habits' }).waitFor({ state: 'hidden' });
  await ctx.close(); assert.deepEqual(log, []);
});
test('water: glass fills, formatted goal, double tap adds once, recent list remove + Undo, validated custom amount, goal bounds, clean console on an empty table, toast cap', async () => {
  const r = await open(browser, srv.base, 'water'); const p = r.page;
  const big = () => p.locator('.stat').innerText(); const level = () => p.locator('svg path[clip-path]').getAttribute('d');
  assert.equal(await big(), '1,500 ml'); const l0 = await level(); assert.equal(await p.locator('small [contenteditable]').innerText(), '2,000');
  await p.locator('.m-quick button', { hasText: '+500' }).dblclick(); assert.equal(await big(), '2,000 ml', 'a double tap adds once'); assert.notEqual(await level(), l0);
  await p.locator('.m-toast button', { hasText: 'Undo' }).first().click(); assert.equal(await big(), '1,500 ml');
  await del(p.locator('m-list .ibtn').first()); assert.equal(await big(), '1,250 ml');
  await p.locator('.m-toast button', { hasText: 'Undo' }).first().click(); assert.equal(await big(), '1,500 ml');
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
