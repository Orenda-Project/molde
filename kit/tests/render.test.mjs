// Browser acceptance: 5 fixtures x 5 viewports. Page is served by the same CSP as production (contract section 7).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, open, FIXTURES, VIEWPORTS } from './lib.mjs';

let srv, browser;
before(async () => { srv = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });

const audit = () => {
  const out = { overflow: [], small: [], tiny: [], remote: [] };
  const vw = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > vw) out.overflow.push(`document scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || (r.width === 0 && r.height === 0)) continue;
    if (el.closest('svg') && el.localName !== 'svg') { if (el.localName === 'text' && parseFloat(cs.fontSize) * (el.ownerSVGElement.getBoundingClientRect().width / (el.ownerSVGElement.viewBox.baseVal.width || 1)) < 11.9) out.tiny.push('svg text'); continue; }
    if (el.closest('.m-toasts') === null && (r.right > vw + 0.5 || r.left < -0.5) && !el.closest('.scroll')) out.overflow.push(`${el.localName}.${el.className} [${Math.round(r.left)},${Math.round(r.right)}] vs ${vw}`);
    if (el.matches('button, a[href], select, textarea, input:not([type=hidden]), [role=button], summary')) {
      if (Math.min(r.width, r.height) < 43.99) out.small.push(`${el.localName}${el.name ? '[' + el.name + ']' : ''}.${el.className} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim() && parseFloat(cs.fontSize) < 11.9) out.tiny.push(`${el.localName} ${cs.fontSize}`);
  }
  return out;
};

for (const f of FIXTURES) for (const [w, h] of VIEWPORTS) {
  test(`${f} @ ${w}x${h}: no console output, no overflow, targets >= 44 px, text >= 12 px, no remote requests`, async () => {
    const { page, ctx, log } = await open(browser, srv.base, f, { w, h });
    const reqs = []; // second load to capture requests with a listener attached from the start
    const p2 = await ctx.newPage(); p2.on('request', (r) => reqs.push(r.url()));
    await p2.goto(`${srv.base}/app/${f}`); await p2.waitForTimeout(300);
    const a = await page.evaluate(audit);
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

test('interaction: exercise set grouped with last session, remove with Undo, timer', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'exercise');
  const squat = () => page.locator('.m-gh', { hasText: 'Squat' });
  assert.match(await squat().innerText(), /Mon|Tue|Wed|Thu|Fri|Sat|Sun/, 'old session is dated');
  await page.fill('input[name=exercise]', 'Squat'); await page.fill('input[name=kg]', '62.5'); await page.fill('input[name=reps]', '5'); await page.click('button[type=submit]');
  assert.match(await squat().innerText(), /Last time 60 kg × 7 · 3 sets/);
  assert.match(await page.locator('.m-row', { hasText: '62.5 kg × 5' }).innerText(), /Set 1/);
  await page.locator('.m-row', { hasText: '62.5 kg × 5' }).locator('.m-x').click();
  assert.equal(await page.locator('.m-row', { hasText: '62.5 kg × 5' }).count(), 0);
  await page.locator('.m-toast button', { hasText: 'Undo' }).click(); assert.equal(await page.locator('.m-row', { hasText: '62.5 kg × 5' }).count(), 1);
  await page.locator('m-timer button', { hasText: 'Start' }).click(); await page.waitForTimeout(1200);
  assert.notEqual(await page.locator('.m-clock').innerText(), '1:30'); await page.locator('m-timer button', { hasText: 'Pause' }).click();
  await ctx.close(); assert.deepEqual(log, []);
});
test('interaction: habits grid tap today and a past day, streak lead, add habit', async () => {
  const { page, ctx, log } = await open(browser, srv.base, 'habits');
  const walk = page.locator('.m-hrow', { hasText: 'Walk 30 minutes' });
  assert.match(await page.locator('.m-lead').innerText(), /7\s+day streak[\s\S]*Done today: 2 of 4/);
  assert.equal(await walk.locator('.m-cell').first().getAttribute('aria-pressed'), 'false');
  await walk.locator('.m-cell').first().click();
  assert.equal(await walk.locator('.m-cell').first().getAttribute('aria-pressed'), 'true');
  assert.match(await walk.innerText(), /4 days in a row/); assert.match(await page.locator('.m-lead').innerText(), /Done today: 3 of 4/);
  await walk.locator('.m-cell').nth(4).click(); assert.equal(await walk.locator('.m-cell').nth(4).getAttribute('aria-pressed'), 'true');
  await page.fill('input[name=name]', 'Journal'); await page.click('button[type=submit]');
  assert.equal(await page.locator('.m-hrow').count(), 5); assert.match(await page.locator('.m-lead').innerText(), /of 5/);
  await ctx.close(); assert.deepEqual(log, []);
});
test('interaction: water glass + quick add + undo, journal faces, budget lead', async () => {
  let r = await open(browser, srv.base, 'water');
  assert.equal(await r.page.locator('m-stat .stat').innerText(), '1,250'); assert.equal(await r.page.locator('m-stat svg.m-glass').count(), 1);
  const h0 = await r.page.locator('.g-fill').getAttribute('points');
  await r.page.locator('button', { hasText: '+500' }).click();
  assert.equal(await r.page.locator('m-stat .stat').innerText(), '1,750'); assert.notEqual(await r.page.locator('.g-fill').getAttribute('points'), h0);
  await r.page.locator('.m-toast button', { hasText: 'Undo' }).click(); assert.equal(await r.page.locator('m-stat .stat').innerText(), '1,250');
  await r.ctx.close(); assert.deepEqual(r.log, []);
  r = await open(browser, srv.base, 'journal');
  const before = await r.page.locator('m-list .m-row').count();
  await r.page.fill('textarea[name=note]', 'Tired but fine.'); await r.page.click('button[type=submit]');
  assert.equal(await r.page.locator('m-list .m-row').count(), before, 'no mood chosen: nothing is saved');
  await r.page.locator('label.m-face', { hasText: 'Low' }).click(); await r.page.click('button[type=submit]');
  assert.match(await r.page.locator('m-list .m-row').first().innerText(), /Tired but fine\./); assert.equal(await r.page.locator('m-list .m-row').count(), before + 1);
  await r.ctx.close(); assert.deepEqual(r.log, []);
  r = await open(browser, srv.base, 'budget');
  assert.equal(await r.page.locator('m-stat .stat').innerText(), '30,800');
  await r.page.fill('input[name=description]', 'Tea'); await r.page.fill('input[name=amount]', '400'); await r.page.click('button[type=submit]');
  assert.equal(await r.page.locator('m-stat .stat').innerText(), '30,400');
  await r.ctx.close(); assert.deepEqual(r.log, []);
});
