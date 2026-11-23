// Machine checks and interaction tests for the built demo (runtime/web/dist/molde-demo.html).
//   node runtime/web/build.mjs && node runtime/web/tests/check.mjs [--shots]
// Needs playwright-core (resolved from ./node_modules or PLAYWRIGHT_CORE) and a Chromium
// (CHROMIUM_PATH, else Playwright's default). Exit code 1 on any failure.
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(WEB, '../../package.json'));
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const DIST = join(WEB, 'dist', 'molde-demo.html');
const URL0 = pathToFileURL(DIST).href;
const SHOTS = process.argv.includes('--shots');
const { CATALOG } = await import(join(WEB, 'demo', 'catalog.mjs'));
const SIZES = [[360, 640], [412, 915], [600, 960], [800, 1280], [1440, 900]];
const exe = process.env.CHROMIUM_PATH || (existsSync('/home/oye/.claude/skills/seo/ms-playwright/chromium-1234/chrome-linux64/chrome') ? '/home/oye/.claude/skills/seo/ms-playwright/chromium-1234/chrome-linux64/chrome' : undefined);

let fails = 0, passes = 0;
const fail = (what, detail) => { fails++; console.log(`FAIL ${what}${detail ? '\n     ' + detail : ''}`); };
const pass = what => { passes++; if (process.env.VERBOSE) console.log(`ok   ${what}`); };

// runs in the page: overflow, target sizes, text sizes, contrast
function audit() {
  const out = { overflow: [], small: [], tiny: [], contrast: [] };
  const vw = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > vw + 1) out.overflow.push(`page scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);
  for (const el of document.querySelectorAll('.mo-scrollarea, .mo-screen, .dm-main, .dm-top')) if (el.scrollWidth > el.clientWidth + 1) out.overflow.push(`${el.className} ${el.scrollWidth} > ${el.clientWidth}`);
  const visible = el => { const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) return false; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; } return true; };
  const name = el => (el.getAttribute('aria-label') || el.textContent || el.className.baseVal || el.className || el.tagName).toString().trim().slice(0, 40);
  for (const el of document.querySelectorAll('button, input, textarea, select, a[href], [role="button"], [role="checkbox"], [role="radio"], [role="tab"]')) {
    if (!visible(el)) continue;
    if (el.type === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 43.5 || r.height < 43.5) out.small.push(`${el.tagName.toLowerCase()} "${name(el)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const over = (top, under) => { const a = top[3]; return [top[0] * a + under[0] * (1 - a), top[1] * a + under[1] * (1 - a), top[2] * a + under[2] * (1 - a), 1]; };
  const bgOf = el => {
    const layers = [];
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; } }
    let base = [255, 255, 255, 1];
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return base;
  };
  const shapeUnder = el => {
    const r = el.getBoundingClientRect();
    for (const e of document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2)) {
      if (e instanceof SVGElement && ['rect', 'circle', 'path'].includes(e.tagName)) { const f = parse(getComputedStyle(e).fill); if (f && f[3] > 0) { const op = +getComputedStyle(e).opacity; return over([f[0], f[1], f[2], op], bgOf(e.closest('.mo-draw'))); } }
    }
    return null;
  };
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    if (!t.textContent.trim()) continue;
    const el = t.parentElement;
    if (!el || seen.has(el) || el.closest('svg, script, style, [hidden]')) continue;
    seen.add(el);
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    const size = parseFloat(s.fontSize);
    if (size < 13.95) out.tiny.push(`"${t.textContent.trim().slice(0, 30)}" ${size}px`);
    const fg = parse(s.color);
    let op = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) op *= +getComputedStyle(e).opacity;
    const bg = (el.classList.contains('mo-lbl') && shapeUnder(el)) || bgOf(el);
    const col = over([fg[0], fg[1], fg[2], fg[3] * op], bg);
    const cr = ratio(col, bg);
    if (cr < 4.5) out.contrast.push(`"${t.textContent.trim().slice(0, 30)}" ${cr.toFixed(2)}:1 (${s.color} on rgb(${bg.slice(0, 3).map(Math.round).join(',')}))`);
  }
  for (const el of document.querySelectorAll('input:not([type=range]):not([type=file]), textarea')) {
    if (!visible(el) || !el.value) continue;
    const cr = ratio(parse(getComputedStyle(el).color), bgOf(el));
    if (cr < 4.5) out.contrast.push(`input value ${cr.toFixed(2)}:1`);
  }
  return out;
}

const browser = await chromium.launch(exe ? { executablePath: exe } : {});
async function open(w, h, mode, hash) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: mode });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => logs.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', e => logs.push(`pageerror: ${e.message}`));
  page.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) logs.push(`network: ${r.url()}`); });
  await page.goto(URL0 + '#' + hash);
  await page.waitForFunction(() => window.__molde && document.querySelector('.mo-app'));
  await page.waitForTimeout(150);
  return { page, ctx, logs };
}
function report(what, logs, a) {
  if (logs.length) fail(`${what}: console output`, logs.slice(0, 3).join(' | '));
  for (const k of ['overflow', 'small', 'tiny', 'contrast']) if (a[k].length) fail(`${what}: ${k} (${a[k].length})`, a[k].slice(0, 4).join(' | '));
  if (!logs.length && !a.overflow.length && !a.small.length && !a.tiny.length && !a.contrast.length) pass(what);
}

// ---------- 1. every example, every size, light and dark ----------
for (const mode of ['light', 'dark']) for (const [w, h] of SIZES) {
  const { page, ctx, logs } = await open(w, h, mode, `ex=${CATALOG[0].id}`);
  for (const c of CATALOG) {
    await page.evaluate(id => { location.hash = 'ex=' + id; }, c.id);
    await page.waitForFunction(id => window.__molde.ex === id, c.id);
    await page.waitForTimeout(60);
    report(`${c.id} ${w}x${h} ${mode}`, logs.splice(0), await page.evaluate(audit));
    if (w === 412 && mode === 'light') {     // the chat sheet over the app
      await page.click('.dm-fab');
      report(`${c.id} chat open ${w}x${h}`, logs.splice(0), await page.evaluate(audit));
      await page.keyboard.press('Escape');
    }
  }
  await ctx.close();
}

// ---------- 2. app-only screenshots ----------
if (SHOTS) {
  mkdirSync(join(WEB, 'shots'), { recursive: true });
  for (const mode of ['light', 'dark']) for (const c of CATALOG) {
    const { page, ctx, logs } = await open(412, 915, mode, `ex=${c.id}&view=app`);
    await page.screenshot({ path: join(WEB, 'shots', `${c.id}-412x915${mode === 'dark' ? '-dark' : ''}.png`) });
    if (logs.length) fail(`${c.id} app view: console output`, logs.join(' | '));
    await ctx.close();
  }
}

// ---------- 3. interactions ----------
async function scenario(name, hash, fn) {
  const { page, ctx, logs } = await open(412, 915, 'light', hash);
  try { await fn(page); if (logs.length) fail(`${name}: console output`, logs.join(' | ')); else pass(name); console.log(`ok   ${name}`); }
  catch (e) { fail(name, e.message.split('\n')[0]); }
  await ctx.close();
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const big = page => page.$eval('.mo-big', e => e.textContent.trim());

await scenario('water: quick add raises the total and fills the glass', 'ex=water&view=app', async page => {
  const before = await big(page);
  const h0 = await page.$eval('.mo-draw rect', r => +r.getAttribute('height'));
  await page.click('button.mo-btn:has-text("250 ml")');
  const after = await big(page);
  const h1 = await page.$eval('.mo-draw rect', r => +r.getAttribute('height'));
  const num = s => +s.replace(/[^\d]/g, '');
  expect(num(after) === num(before) + 250, `total ${before} -> ${after}`);
  expect(h1 > h0, `glass height ${h0} -> ${h1}`);
});

await scenario('tasbeeh: a tap on the ring counts and the arc grows', 'ex=tasbeeh&view=app', async page => {
  const n0 = await page.$eval('.mo-lbl.mo-big', e => +e.textContent);
  const d0 = await page.$eval('.mo-draw path', p => p.getAttribute('d'));
  await page.click('.mo-draw.mo-tap');
  const n1 = await page.$eval('.mo-lbl.mo-big', e => +e.textContent);
  const d1 = await page.$eval('.mo-draw path', p => p.getAttribute('d'));
  expect(n1 === n0 + 1, `count ${n0} -> ${n1}`);
  expect(d0 !== d1, 'arc did not change');
});

await scenario('tic tac toe: playing a line shows the winner', 'ex=tictactoe&view=app', async page => {
  // seeded game 3: X on 5 and 3, O on 1; O to play
  const cells = await page.$$('.mo-grid > *');
  expect(cells.length === 9, `${cells.length} cells`);
  await (await page.$$('.mo-grid > *'))[1].click();      // O plays 2
  await (await page.$$('.mo-grid > *'))[6].click();      // X plays 7: 3-5-7
  const t = await big(page);
  expect(/X wins/.test(t), `status "${t}"`);
});

await scenario('undo: a removed row comes back from the toast', 'ex=water&view=app', async page => {
  const count = () => page.$$eval('[data-swipe]', els => els.length);
  const c0 = await count();
  const row = await page.$('[data-swipe]');
  await row.focus();
  await page.keyboard.press('Delete');
  await page.waitForSelector('.mo-toast:has-text("Removed")');
  expect(await count() === c0 - 1, 'row not removed');
  await page.click('.mo-toast button:has-text("Undo")');
  expect(await count() === c0, 'row not restored');
});

await scenario('undo by swipe: dragging a row sideways removes it', 'ex=todo&view=app', async page => {
  const count = () => page.$$eval('[data-swipe]', els => els.length);
  const c0 = await count();
  const box = await (await page.$('[data-swipe]')).boundingBox();
  await page.mouse.move(box.x + 200, box.y + box.height / 2); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + 200 - i * 20, box.y + box.height / 2);
  await page.mouse.up();
  await page.waitForSelector('.mo-toast:has-text("Removed")');
  expect(await count() === c0 - 1, 'row not removed by swipe');
});

await scenario('timer: start counts down in real time', 'ex=pomodoro&view=app', async page => {
  const t0 = await big(page);
  await page.click('button.mo-btn:has-text("Start") >> nth=0');
  await page.waitForTimeout(2300);
  const t1 = await big(page);
  expect(t0 === '25:00' && /^24:5\d$/.test(t1), `timer ${t0} -> ${t1}`);
});

await scenario('edit sheet: tapping a row opens it and a change is saved', 'ex=reading&view=app', async page => {
  await page.click('.mo-row.mo-card.mo-tap >> nth=0');
  await page.waitForSelector('.mo-sheet');
  const input = page.locator('.mo-sheet input[type=text]').first();
  await input.fill('Raja Gidh (2nd read)');
  await input.press('Tab');
  await page.click('.mo-sheet button:has-text("Done")');
  await page.waitForSelector('text=Raja Gidh (2nd read)');
});

await scenario('form: saving a new row adds it to the list', 'ex=todo&view=app', async page => {
  const open0 = await page.$eval('.mo-head-t', e => e.textContent);
  await page.fill('.mo-form input[type=text] >> nth=0', 'Buy milk');
  await page.click('button.mo-btn:has-text("Add")');
  await page.waitForSelector('text=Buy milk');
  const open1 = await page.$eval('.mo-head-t', e => e.textContent);
  expect(open0 !== open1, `count text unchanged: ${open1}`);
});

await scenario('tabs: switching screens in a two-screen app', 'ex=medicine&view=app', async page => {
  await page.click('.dm-fab');
  await page.click('.dm-chip:has-text("History")');
  await page.keyboard.press('Escape');
  await page.click('.mo-tab:has-text("History")');
  await page.waitForSelector('.mo-tab[aria-selected="true"]:has-text("History")');
});

await scenario('chat: a request swaps the program live, keeps data, and undoes', 'ex=water', async page => {
  const total0 = await big(page);
  await page.click('.dm-fab');
  await page.click('.dm-chip:has-text("quick buttons")');
  await page.waitForSelector('.dm-bot:has-text("What changed")');
  await page.waitForSelector('.mo-btn:has-text("330 ml")');
  expect(await big(page) === total0, 'data changed after an edit');
  expect(await page.$$eval('.dm-ln.dm-new', e => e.length) > 0, 'changed lines not marked');
  await page.click('.dm-undo');
  await page.waitForSelector('.mo-btn:has-text("150 ml")');
});

await scenario('chat: "make me a new app" switches to another program', 'ex=water', async page => {
  await page.click('.dm-fab');
  await page.click('.dm-chip-new >> nth=0');
  await page.waitForSelector('.dm-bot:has-text("new app")');
  expect(await page.evaluate(() => window.__molde.ex) !== 'water', 'still on water');
});

await scenario('every scripted request produces a program that checks and is safe', 'ex=water', async page => {
  const bad = await page.evaluate(async () => {
    const S = window.__molde; const out = [];
    for (const b of document.querySelectorAll('.dm-item')) {
      b.click();
      await new Promise(r => setTimeout(r, 20));
      S.openChat();
      const chips = [...document.querySelectorAll('.dm-chip:not(.dm-chip-new)')].map(c => c.textContent);
      for (const text of chips) {
        const chip = [...document.querySelectorAll('.dm-chip')].find(c => c.textContent === text);
        if (!chip) { out.push(`${S.ex}: "${text}" gone`); continue; }
        chip.click();
        await new Promise(r => setTimeout(r, 20));
        const last = S.chat[S.chat.length - 1];
        if (!/What changed/.test(last.html) || !S.app.ok || S.app.findAll(n => n.t === 'error').length) out.push(`${S.ex}: "${text}" ${S.app.errors.join('; ')}`);
        S.undo();
      }
      document.querySelector('.dm-chatwrap').click();
    }
    return out;
  });
  expect(!bad.length, bad.join(' | '));
});

await scenario('sandboxed iframe with a strict CSP runs the demo', 'ex=water', async page => {
  const html = readFileSync(DIST, 'utf8');
  await page.setContent(`<iframe sandbox="allow-scripts" width="412" height="800"></iframe>`);
  await page.$eval('iframe', (f, h) => { f.srcdoc = h; }, html);
  const frame = await (await page.waitForSelector('iframe')).contentFrame();
  await frame.waitForSelector('.mo-app .mo-big', { timeout: 5000 });
  await frame.click('.dm-item:has-text("Tasbeeh")');
  await frame.waitForSelector('.mo-app .mo-title:has-text("Tasbeeh")');
});

await browser.close();
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
