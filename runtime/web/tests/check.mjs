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
  try { await fn(page); if (logs.length) fail(`${name}: console output`, logs.join(' | ')); else { pass(name); console.log(`ok   ${name}`); } }
  catch (e) { fail(name, e.message.split('\n')[0]); }
  await ctx.close();
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const big = page => page.$eval('.mo-big', e => e.textContent.trim());

await scenario('water: quick add raises the total and fills the glass', 'ex=water&view=app', async page => {
  const before = await big(page);
  const h0 = await page.$eval('.mo-draw rect', r => +r.getAttribute('height'));
  await page.click('button.mo-btn:has-text("+ 250 ml")');
  const after = await big(page);
  const h1 = await page.$eval('.mo-draw rect', r => +r.getAttribute('height'));
  const num = s => +s.replace(/[^\d]/g, '');
  expect(num(after) === num(before) + 250, `total ${before} -> ${after}`);
  expect(h1 > h0, `glass height ${h0} -> ${h1}`);
});

await scenario('tasbeeh: a tap on the ring counts and the arc grows', 'ex=tasbeeh&view=app', async page => {
  const n0 = await page.$eval('.mo-draw.mo-tap .mo-lbl.mo-size-huge', e => +e.textContent);
  const d0 = await page.$eval('.mo-draw path', p => p.getAttribute('d'));
  await page.click('.mo-draw.mo-tap');
  const n1 = await page.$eval('.mo-draw.mo-tap .mo-lbl.mo-size-huge', e => +e.textContent);
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
  const clock = () => page.$eval('.mo-lbl.mo-size-huge', e => e.textContent.trim());
  const t0 = await clock();
  await page.click('button.mo-btn:has-text("Start") >> nth=0');
  await page.waitForTimeout(2300);
  const t1 = await clock();
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
  await page.waitForSelector('.dm-bot:has-text("Quick buttons are now 200, 330 and 500 ml.")');
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
        if (last.who !== 'bot' || /could not|lines? added|lines? removed/.test(last.html) || !S.app.ok || S.app.findAll(n => n.t === 'error').length) out.push(`${S.ex}: "${text}" ${last.html.slice(0, 80)} ${S.app.errors.join('; ')}`);
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

// ---------- 4. round 2 checks ----------
const MINE = ['water', 'habits', 'budget', 'exercise', 'journal', 'tasbeeh', 'cricket', 'tictactoe', 'quiz', 'savings', 'pomodoro'];
const total = page => page.$eval('.mo-big', e => +e.textContent.replace(/[^\d]/g, ''));

await scenario('S1: chat Undo keeps data added after the change', 'ex=water', async page => {
  const t0 = await total(page);
  await page.click('.dm-fab');
  await page.click('.dm-chip:has-text("quick buttons")');
  await page.keyboard.press('Escape');
  await page.click('button.mo-btn:has-text("+ 500 ml")');
  expect(await total(page) === t0 + 500, 'add after change');
  await page.click('.dm-fab');
  await page.click('.dm-undo');
  await page.waitForSelector('.dm-bot:has-text("Everything you added since is still here")');
  await page.waitForSelector('.mo-btn:has-text("+ 150 ml")');
  expect(await total(page) === t0 + 500, `after chat Undo the total is ${await total(page)}, expected ${t0 + 500}`);
});

await scenario('S1: a new field filled in, chat Undo, then the same change again shows the values', 'ex=water', async page => {
  await page.click('.dm-fab');
  await page.click('.dm-chip:has-text("note to each drink")');
  await page.keyboard.press('Escape');
  await page.click('[data-swipe] >> nth=0');
  await page.waitForSelector('.mo-sheet');
  const note = page.locator('.mo-sheet input[type=text]').first();
  await note.fill('after the gym'); await note.press('Tab');
  await page.click('.mo-sheet button:has-text("Done")');
  await page.waitForSelector('.mo-app :text("after the gym")');
  await page.click('.dm-fab');
  await page.click('.dm-undo');
  await page.waitForSelector('.dm-bot:has-text("kept but hidden")');
  expect(!(await page.$('.mo-app :text("after the gym")')), 'hidden field still shown after Undo');
  await page.click('.dm-chip:has-text("note to each drink")');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.mo-app :text("after the gym")');
});

await scenario('chat replies: a human sentence, data line only when data is involved, a labelled Undo', 'ex=water', async page => {
  await page.click('.dm-fab');
  await page.click('.dm-chip:has-text("Make it")');
  const last = await page.$eval('.dm-bot:last-child', e => e.textContent);
  expect(/The colours are now/.test(last) && !/still here|kept/.test(last), `theme reply: ${last}`);
  expect((await page.$eval('.dm-undo', e => e.textContent.trim())) === 'Undo', 'Undo label');
  await page.click('.dm-undo');
  await page.click('.dm-chip:has-text("note to each drink")');
  const l2 = await page.$eval('.dm-bot:last-child', e => e.textContent);
  expect(/note/.test(l2) && /still here/.test(l2), `field reply: ${l2}`);
});

await scenario('chat button: hidden under the edit sheet; Done works at its right edge', 'ex=water&view=app', async page => {
  await page.click('[data-swipe] >> nth=0');
  await page.waitForSelector('.mo-sheet');
  await page.waitForTimeout(250);
  expect(await page.$eval('.dm-fab', e => getComputedStyle(e).opacity) === '0', 'chat button visible over the sheet');
  const b = await (await page.$('.mo-sheet button:has-text("Done")')).boundingBox();
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y).closest('button')?.textContent, [b.x + b.width - 3, b.y + b.height / 2]);
  expect(hit === 'Done', `right edge of Done hits ${hit}`);
  await page.mouse.click(b.x + b.width - 3, b.y + b.height / 2);
  await page.waitForSelector('.mo-sheet', { state: 'detached' });
});

await scenario('chat button: steps aside on scroll down, returns on scroll up; hidden while typing', 'ex=budget&view=app', async page => {
  const op = () => page.$eval('.dm-fab', e => getComputedStyle(e).opacity);
  await page.$eval('.mo-scrollarea', e => { e.scrollTop = 0; });
  await page.mouse.move(200, 400);
  await page.mouse.wheel(0, 600); await page.waitForTimeout(300);
  expect(await op() === '0', 'still visible while scrolling down');
  await page.mouse.wheel(0, -300); await page.waitForTimeout(300);
  expect(await op() === '1', 'not back on scroll up');
  await page.$eval('.mo-scrollarea', e => { e.scrollTop = 0; });
  await page.click('button.mo-btn:has-text("Add expense")');
  await page.click('.mo-app input[type=text] >> nth=0');
  await page.waitForTimeout(250);
  expect(await op() === '0', 'visible while typing');
});

await scenario('undo toast: one line, beside the chat button, Undo never wraps', 'ex=water&view=app', async page => {
  await (await page.$('[data-swipe]')).focus();
  await page.keyboard.press('Delete');
  const t = await (await page.waitForSelector('.mo-toast')).boundingBox();
  const u = await (await page.$('.mo-toast button')).boundingBox();
  const f = await (await page.$('.dm-fab')).boundingBox();
  expect(t.height <= 56, `toast ${t.height}px tall`);
  expect(u.height <= 48 && u.width >= 44, `Undo ${u.width}x${u.height}`);
  expect(t.x + t.width <= f.x, 'toast runs under the chat button');
});

await scenario('primary action: one accent button on each app that has one', 'ex=water&view=app', async page => {
  const bad = [];
  for (const id of ['water', 'habits', 'budget', 'exercise', 'journal', 'savings', 'pomodoro', 'tictactoe']) {
    await page.evaluate(i => { location.hash = 'ex=' + i + '&view=app'; }, id);
    await page.waitForFunction(i => window.__molde.ex === i, id);
    const n = await page.$$eval('.mo-app .mo-btn.mo-primary', els => els.filter(e => e.getBoundingClientRect().height > 0).map(e => e.textContent));
    if (n.length !== 1) bad.push(`${id}: ${JSON.stringify(n)}`);
  }
  expect(!bad.length, bad.join(' | '));
});

await scenario('empty states: every demo program says what to do when it has no data', 'ex=water', async page => {
  const bad = [];
  for (const id of MINE) {
    await page.evaluate(i => window.__molde.showBlank(i), id);
    const txt = await page.$eval('.mo-app', e => e.innerText);
    const errs = await page.$$('.mo-error');
    if (!/(Nothing|No [a-z]+ yet|Add a|Write on|Log )/.test(txt) && !['tictactoe', 'cricket', 'tasbeeh'].includes(id)) bad.push(`${id}: no empty message`);
    if (errs.length) bad.push(`${id}: error node`);
    if (/\bNaN\b|undefined|Infinity/.test(txt)) bad.push(`${id}: ${txt.match(/\bNaN\b|undefined|Infinity/)[0]}`);
    const a = await page.evaluate(audit);
    for (const k of ['overflow', 'small', 'tiny', 'contrast']) if (a[k].length) bad.push(`${id} empty ${k}: ${a[k][0]}`);
  }
  expect(!bad.length, bad.join(' | '));
});

await scenario('copy: plurals, the quiz shows the right answer, budget stays in the present', 'ex=water&view=app', async page => {
  const bad = [];
  for (const id of MINE) {
    await page.evaluate(i => { location.hash = 'ex=' + i + '&view=app'; }, id);
    await page.waitForFunction(i => window.__molde.ex === i, id);
    const txt = await page.$eval('.mo-app', e => e.innerText);
    const m = txt.match(/\b1 (days|drinks|exercises|sessions|questions|rounds|habits)\b/);
    if (m) bad.push(`${id}: "${m[0]}"`);
  }
  await page.evaluate(() => { location.hash = 'ex=quiz&view=app'; });
  await page.waitForSelector('.mo-app :text("Not quite. The answer is 300")');
  await page.evaluate(() => { location.hash = 'ex=budget&view=app'; });
  await page.waitForFunction(() => window.__molde.ex === 'budget');
  if (await page.$('.mo-btn:text-is(">")')) bad.push('budget: can page into a future month');
  expect(!bad.length, bad.join(' | '));
});

await scenario('dates and times read as text, never mm/dd/yyyy', 'ex=todo&view=app', async page => {
  const shown = await page.$$eval('.mo-dt-v', els => els.map(e => e.textContent));
  expect(shown.length && shown.every(t => t === 'Pick a date' || /^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2} \d{4}/.test(t)), JSON.stringify(shown));
  await page.click('.mo-row.mo-card.mo-tap >> nth=0');
  await page.waitForSelector('.mo-sheet');
  const s2 = await page.$$eval('.mo-sheet .mo-dt-v', els => els.map(e => e.textContent));
  expect(s2.some(t => /^Tue 24 Nov 2026$/.test(t)), JSON.stringify(s2));
  expect(!(await page.evaluate(() => /mm\/dd\/yyyy|--:--/.test(document.body.innerText))), 'raw format visible');
});

await scenario('sideways chips show a fade cue when there is more', 'ex=tasbeeh&view=app', async page => {
  expect(await page.$eval('.mo-scroll', e => e.classList.contains('mo-more-end')), 'no cue on the phrase chips');
  await page.$eval('.mo-scroll', e => { e.scrollLeft = 9999; e.dispatchEvent(new Event('scroll')); });
  await page.waitForTimeout(50);
  expect(await page.$eval('.mo-scroll', e => !e.classList.contains('mo-more-end')), 'cue stays at the end');
});

await scenario('custom screens are centred, not stuck top-left', 'ex=tasbeeh&view=app', async page => {
  const bad = [];
  for (const id of ['tasbeeh', 'tictactoe', 'pomodoro']) {
    await page.evaluate(i => { location.hash = 'ex=' + i + '&view=app'; }, id);
    await page.waitForFunction(i => window.__molde.ex === i, id);
    await page.waitForTimeout(80);
    const r = await page.evaluate(() => { const d = document.querySelector('.mo-draw, .mo-grid'); const b = d.getBoundingClientRect(); return { l: b.left, r: innerWidth - b.right }; });
    if (Math.abs(r.l - r.r) > 4) bad.push(`${id}: left ${r.l} right ${r.r}`);
  }
  expect(!bad.length, bad.join(' | '));
});

// system text size: 200% root font at 360 px wide
function audit200() {
  const out = [];
  const vw = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > vw + 1) out.push(`page ${document.documentElement.scrollWidth} > ${vw}`);
  for (const el of document.querySelectorAll('.mo-scrollarea, .mo-screen')) if (el.scrollWidth > el.clientWidth + 1) out.push(`${el.className} ${el.scrollWidth} > ${el.clientWidth}`);
  const walker = document.createTreeWalker(document.querySelector('.mo-app'), NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const s = t.textContent.trim();
    const el = t.parentElement;
    if (!s || !el || el.closest('svg') || !el.getClientRects().length) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    const r = el.getBoundingClientRect();
    if (r.width > 0 && s.replace(/\s/g, '').length >= 4 && /[A-Za-z]{3}/.test(s) && r.width < 1.6 * fs) out.push(`letter per line: "${s.slice(0, 20)}" ${Math.round(r.width)}px`);
    for (const m of s.matchAll(/\d[\d,.:]*\d/g)) {
      const i = t.textContent.indexOf(m[0]);
      const range = document.createRange(); range.setStart(t, i); range.setEnd(t, i + m[0].length);
      const tops = new Set([...range.getClientRects()].map(x => Math.round(x.top)));
      if (tops.size > 1) out.push(`number broken: ${m[0]}`);
    }
  }
  return out;
}
await scenario('200% system text at 360 px: no overflow, no letter-per-line, numbers whole', 'ex=water&view=app', async page => {
  await page.setViewportSize({ width: 360, height: 640 });
  const bad = [];
  for (const c of CATALOG) {
    await page.evaluate(i => { location.hash = 'ex=' + i + '&view=app'; }, c.id);
    await page.waitForFunction(i => window.__molde.ex === i, c.id);
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await page.waitForTimeout(80);
    for (const x of await page.evaluate(audit200)) bad.push(`${c.id}: ${x}`);
  }
  expect(!bad.length, bad.slice(0, 8).join(' | ') + (bad.length > 8 ? ` (+${bad.length - 8})` : ''));
});

await scenario('narrow 300 px still works (no page overflow)', 'ex=water&view=app', async page => {
  await page.setViewportSize({ width: 300, height: 640 });
  const bad = [];
  for (const c of CATALOG) {
    await page.evaluate(i => { location.hash = 'ex=' + i + '&view=app'; }, c.id);
    await page.waitForFunction(i => window.__molde.ex === i, c.id);
    await page.waitForTimeout(50);
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) bad.push(c.id);
  }
  expect(!bad.length, bad.join(', '));
});

await browser.close();
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
