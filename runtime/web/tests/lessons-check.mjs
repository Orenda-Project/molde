// Checks the lessons page (dist/molde-lessons.html): every lesson and view draws with no console or
// page errors and no page overflow at 412x915 and 1440x900, light and dark; answers and notes stay
// through chat edits, Undo and a reload. With --shots OUTDIR it saves six screenshots.
//   node runtime/web/build.mjs && node runtime/web/tests/lessons-check.mjs [--shots DIR]
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(WEB, '../../package.json'));
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const URL0 = pathToFileURL(join(WEB, 'dist', 'molde-lessons.html')).href;
const si = process.argv.indexOf('--shots'); const SHOTS = si > 0 ? process.argv[si + 1] : null;
const exe = process.env.CHROMIUM_PATH || (existsSync('/home/oye/.claude/skills/seo/ms-playwright/chromium-1234/chrome-linux64/chrome') ? '/home/oye/.claude/skills/seo/ms-playwright/chromium-1234/chrome-linux64/chrome' : undefined);
const browser = await chromium.launch({ executablePath: exe });
let fails = 0;
const ok = (c, msg) => { if (c) console.log('ok   ' + msg); else { fails++; console.log('FAIL ' + msg); } };

async function open(ctx, hash) {
  const p = await ctx.newPage(); const logs = [];
  p.on('console', m => logs.push(`${m.type()}: ${m.text()}`)); p.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await p.goto(URL0 + '#' + hash);
  await p.waitForFunction(() => window.__lessons && document.querySelector('.mo-app'));
  await p.waitForTimeout(200);
  return { p, logs };
}
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
const texts = p => p.$$eval('.mo-app', els => els.map(e => e.innerText).join('\n'));

// 1. every lesson x view, both sizes, both modes
for (const [w, h] of [[412, 915], [1440, 900]]) for (const mode of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: mode });
  const { p, logs } = await open(ctx, `lesson=g3&mode=${mode}`);
  for (const lesson of ['g3', 'g6', 'tt']) {
    await p.click(`.ls-pick .dm-item:nth-of-type(${['g3', 'g6', 'tt'].indexOf(lesson) + 1})`);
    const n = await p.$$eval('.ls-views .dm-item', e => e.length);
    for (let i = 0; i < n; i++) {
      await p.click(`.ls-views .dm-item >> nth=${i}`);
      await p.waitForTimeout(60);
      const errNodes = await p.$$eval('.mo-error', e => e.length);
      ok(!errNodes && !(await overflow(p)), `${w}x${h} ${mode} ${lesson} view ${i + 1}: no error nodes, no overflow`);
    }
  }
  ok(!logs.length, `${w}x${h} ${mode}: no console or page errors ${logs.join(' | ')}`);
  await ctx.close();
}

// 2. answers and notes survive chat edits, Undo and a reload
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { p, logs } = await open(ctx, 'lesson=g6&mode=light');
  await p.click('.ls-views .dm-item >> nth=1');                 // steps with notes
  await p.fill('.mo-app input[type="text"], .mo-app textarea', 'Vapour is invisible');
  await p.click('.mo-app button:has-text("Save note")');
  await p.click('.ls-views .dm-item >> nth=2');                 // quiz
  await p.click('.mo-app button:has-text("Heat from the sun")');
  ok((await texts(p)).includes('Right!'), 'quiz answer marked right');
  const kept = () => p.evaluate(() => { const a = __lessons.app(); return [a.rows('answer').length, a.rows('note').length]; });
  ok(JSON.stringify(await kept()) === '[1,1]', 'one answer and one note kept');
  await p.click('.ls-chip:has-text("Show me which ones I got wrong"), .ls-chip:has-text("got wrong")');
  ok(JSON.stringify(await kept()) === '[1,1]', 'after a chat edit: still one answer, one note');
  ok(await p.$eval('.mo-app', e => e.dataset.mode) === 'dark', 'the program\'s dark mode wins over the light page');
  await p.click('.ls-chip:has-text("Make it green")');
  ok(await p.$eval('.mo-app', e => e.dataset.theme) === 'green', 'make it green');
  await p.click('.ls-undo');
  ok(await p.$eval('.mo-app', e => e.dataset.theme) === 'blue', 'Undo goes back a program');
  ok(JSON.stringify(await kept()) === '[1,1]', 'after Undo: still one answer, one note');
  await p.reload(); await p.waitForFunction(() => window.__lessons && document.querySelector('.mo-app'));
  ok(JSON.stringify(await kept()) === '[1,1]', 'after a reload: still one answer, one note');
  await p.click('.ls-views .dm-item >> nth=1');
  ok((await texts(p)).includes('Vapour is invisible'), 'the note shows again in the steps view after the reload');
  ok(!logs.length, 'edit flow: no console or page errors ' + logs.join(' | '));
  // every edit pair applies from its own program
  const pairs = await p.evaluate(async () => {
    const out = [];
    for (const l of ['g3', 'g6', 'tt']) { document.querySelectorAll('.ls-pick .dm-item')[['g3', 'g6', 'tt'].indexOf(l)].click(); await new Promise(r => setTimeout(r, 30));
      for (const b of document.querySelectorAll('.ls-views .dm-item')) { b.click(); await new Promise(r => setTimeout(r, 30)); for (const o of __lessons.options()) out.push(o.msg); } }
    return [...new Set(out)];
  });
  ok(pairs.length >= 12, `requests offered across the views: ${pairs.join(', ')}`);
  await ctx.close();
}

// 3. six screenshots
if (SHOTS) {
  mkdirSync(SHOTS, { recursive: true });
  const shot = async (w, h, mode, hash, name, act) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: mode });
    const { p } = await open(ctx, hash);
    if (act) await act(p);
    await p.waitForTimeout(250);
    await p.screenshot({ path: join(SHOTS, name) });
    await ctx.close();
  };
  await shot(1440, 900, 'light', 'lesson=g6&mode=light', '1-desktop-light-water-cycle-tabs.png');
  await shot(1440, 900, 'dark', 'lesson=g3&mode=dark', '2-desktop-dark-fractions-quiz-feedback.png', async p => { await p.click('.ls-views .dm-item >> nth=0'); await p.evaluate(() => document.querySelector('.mo-scrollarea').scrollTo(0, 1e6)); await p.click('.mo-app button:has-text("5")'); });
  await shot(1440, 900, 'light', 'lesson=tt&mode=light', '3-desktop-light-teacher-chat-edit.png', async p => { await p.click('.ls-views .dm-item >> nth=0'); await p.click('.ls-chip:has-text("dark")'); });
  await shot(412, 915, 'light', 'lesson=g3&mode=light', '4-phone-light-step-by-step.png', async p => { await p.click('.ls-views .dm-item >> nth=1'); await p.evaluate(() => document.querySelector('.dm-phone').scrollIntoView()); });
  await shot(412, 915, 'dark', 'lesson=g3&mode=dark', '5-phone-dark-flashcards.png', async p => { await p.click('.ls-views .dm-item >> nth=2'); await p.evaluate(() => document.querySelector('.dm-phone').scrollIntoView()); });
  await shot(412, 915, 'light', 'lesson=g6&mode=light', '6-phone-light-water-cycle-overview.png', async p => { await p.click('.ls-views .dm-item >> nth=3'); await p.evaluate(() => document.querySelector('.dm-phone').scrollIntoView()); });
}
await browser.close();
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
