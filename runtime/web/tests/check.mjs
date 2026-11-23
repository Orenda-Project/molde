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
      await page.waitForTimeout(300);   // after the sheet's rise animation
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
  const open0 = await page.$eval('.mo-screen .mo-head-t', e => e.textContent);
  await page.click('button.mo-btn:has-text("Add task")');
  await page.fill('.mo-card input[type=text] >> nth=0', 'Buy milk');
  await page.click('button.mo-btn:has-text("Save task")');
  await page.waitForSelector('text=Buy milk');
  const open1 = await page.$eval('.mo-screen .mo-head-t', e => e.textContent);
  expect(open0 !== open1, `count text unchanged: ${open1}`);
});

await scenario('tabs: switching screens in a two-screen app', 'ex=water&view=app', async page => {
  const zakat = readFileSync(join(WEB, '../../lang/examples/29-zakat-tip.mo'), 'utf8');
  await page.evaluate(src => window.__molde.mountSource(src), zakat);
  await page.click('.mo-tab:has-text("Tip")');
  await page.waitForSelector('.mo-tab[aria-selected="true"]:has-text("Tip")');
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
        S.undoLatest();
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
const MINE = CATALOG.map(c => c.id);
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

await scenario('chat button: never over any control at the top, middle or end of every app', 'ex=water&view=app', async page => {
  const bad = [];
  for (const c of CATALOG) {
    await page.evaluate(i => { location.hash = 'ex=' + i + '&view=app'; }, c.id);
    await page.waitForFunction(i => window.__molde.ex === i, c.id);
    for (const where of [0, 0.5, 1]) {
      const hits = await page.evaluate(f => {
        const sc = document.querySelector('.mo-scrollarea');
        sc.scrollTop = (sc.scrollHeight - sc.clientHeight) * f;
        const fab = document.querySelector('.dm-fab');
        const vis = sc.getBoundingClientRect();
        const out = [];
        for (const el of document.querySelectorAll('.mo-app button, .mo-app input, .mo-app textarea, .mo-app [role=button], .mo-app [role=checkbox], .mo-app .mo-text, .mo-app .mo-row')) {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          for (const [x, y] of [[r.left + r.width / 2, r.top + r.height / 2], [r.right - 2, r.bottom - 2]]) {
            if (y < vis.top || y >= vis.bottom || x < vis.left || x >= vis.right) continue;   // only what is visible
            const hit = document.elementFromPoint(x, y);
            if (hit && fab.contains(hit)) out.push((el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 24));
          }
        }
        return out;
      }, where);
      for (const x of hits) bad.push(`${c.id}@${where}: ${x}`);
    }
  }
  expect(!bad.length, bad.slice(0, 6).join(' | '));
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
  for (const id of ['water', 'habits', 'budget', 'exercise', 'journal', 'savings', 'pomodoro', 'tictactoe', 'reading', 'todo', 'medicine']) {
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
    if (!/(Nothing|No [a-z ]+yet|Add a|Write on|Log )/.test(txt) && !['tictactoe', 'cricket', 'tasbeeh'].includes(id)) bad.push(`${id}: no empty message`);
    if (errs.length) bad.push(`${id}: error node`);
    if (/\bNaN\b|undefined|Infinity/.test(txt)) bad.push(`${id}: ${txt.match(/\bNaN\b|undefined|Infinity/)[0]}`);
    const noise = txt.match(/\b0 of 0\b|\b0 t moved|^\s*[–-]\s*$|Best streak\s*\n\s*\n/m);
    if (noise) bad.push(`${id}: noise "${noise[0].trim()}"`);
    if (id !== 'tictactoe' && await page.$('.mo-screen .mo-middle')) bad.push(`${id}: empty state floats mid-screen`);
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
    const m = txt.match(/\b1 (days|drinks|exercises|sessions|questions|rounds|habits|tasks|books|doses)\b/);
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
  await page.click('button.mo-btn:has-text("Add task")');
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

await scenario('centring: only a one-block screen is centred; lists and forms start at the top', 'ex=tictactoe&view=app', async page => {
  const bad = [];
  for (const c of CATALOG) {
    await page.evaluate(i => { location.hash = 'ex=' + i + '&view=app'; }, c.id);
    await page.waitForFunction(i => window.__molde.ex === i, c.id);
    const single = !!(await page.$('.mo-screen .mo-middle'));
    if (single !== (c.id === 'tictactoe')) bad.push(`${c.id}: middle=${single}`);
    if (!single) {   // lists and forms start right under the app bar
      const gap = await page.evaluate(() => document.querySelector('.mo-screen').firstElementChild.getBoundingClientRect().top - document.querySelector('.mo-head').getBoundingClientRect().bottom);
      if (gap > 40) bad.push(`${c.id}: content starts ${Math.round(gap)}px below the bar`);
    }
  }
  const r = await page.evaluate(() => { location.hash = 'ex=tictactoe&view=app'; return null; });
  await page.waitForFunction(() => window.__molde.ex === 'tictactoe');
  const g = await page.evaluate(() => { const b = document.querySelector('.mo-middle').getBoundingClientRect(); const a = document.querySelector('.mo-scrollarea').getBoundingClientRect(); const h = document.querySelector('.mo-head').getBoundingClientRect(); return { l: b.left - a.left, r: a.right - b.right, t: b.top - h.bottom, bt: a.bottom - b.bottom }; });
  if (Math.abs(g.l - g.r) > 4) bad.push(`board off centre ${g.l} vs ${g.r}`);
  if (Math.abs(g.t - g.bt) > 40) bad.push(`board not in the middle of the free height ${g.t} vs ${g.bt}`);
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
    if (!s || !el || el.closest('svg, .mo-sr') || !el.getClientRects().length) continue;
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

// ---------- 5. round 3 checks ----------
await scenario('S1: Done closes on the first real mouse click after typing a value', 'ex=water&view=app', async page => {
  await page.click('.mo-head [aria-label="Settings"]');
  const inp = page.locator('.mo-sheet input').first();
  await inp.fill('2500');
  const b = await (await page.$('.mo-sheet button:has-text("Done")')).boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForSelector('.mo-sheet', { state: 'detached', timeout: 1500 });
  await page.waitForSelector('.mo-app :text("of 2,500 ml today")');
});

await scenario('S1: Tab then Enter closes the sheet and keeps the value', 'ex=water&view=app', async page => {
  await page.click('.mo-head [aria-label="Settings"]');
  const inp = page.locator('.mo-sheet input').first();
  await inp.fill('3000');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement.textContent) === 'Done', 'Tab did not reach Done');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.mo-sheet', { state: 'detached', timeout: 1500 });
  await page.waitForSelector('.mo-app :text("of 3,000 ml today")');
});

await scenario('S1: a row editor closes on the first click too', 'ex=budget&view=app', async page => {
  await page.click('.mo-row.mo-card.mo-tap >> nth=0');
  const inp = page.locator('.mo-sheet input[type=text]').first();
  await inp.fill('Weekly shop');
  const b = await (await page.$('.mo-sheet button:has-text("Done")')).boundingBox();
  await page.mouse.click(b.x + b.width - 4, b.y + b.height / 2);
  await page.waitForSelector('.mo-sheet', { state: 'detached', timeout: 1500 });
  await page.waitForSelector('.mo-app :text("Weekly shop")');
});

await scenario('data: undoing a new-app request keeps what was entered in that app', 'ex=water', async page => {
  await page.click('.dm-fab');
  await page.click('.dm-chip:has-text("count my zikr")');
  await page.keyboard.press('Escape');
  const n0 = await page.$eval('.mo-draw.mo-tap .mo-lbl.mo-size-huge', e => +e.textContent);
  for (let i = 0; i < 3; i++) await page.click('.mo-draw.mo-tap');
  await page.click('.dm-fab');
  await page.click('.dm-undo');
  await page.waitForSelector('.dm-bot:has-text("Back to Water")');
  await page.click('.dm-chip:has-text("count my zikr")');
  await page.keyboard.press('Escape');
  const n1 = await page.$eval('.mo-draw.mo-tap .mo-lbl.mo-size-huge', e => +e.textContent);
  expect(n1 === (n0 + 3) % 33, `tasbeeh count ${n1}, expected ${(n0 + 3) % 33}`);
});

await scenario('data: the picker never reseeds a changed app; Reset demo data does', 'ex=water', async page => {
  const t0 = await total(page);
  await page.click('button.mo-btn:has-text("+ 500 ml")');
  await page.click('.dm-item[data-ex="habits"]');
  await page.click('.dm-item[data-ex="water"]');
  expect(await total(page) === t0 + 500, 'water was reseeded by the picker');
  await page.click('.dm-btn:has-text("Reset demo data")');
  expect(await total(page) === t0, 'reset did not put the demo data back');
});

await scenario('data: every change keeps its own Undo, so a second Undo is reachable', 'ex=water', async page => {
  const src0 = await page.evaluate(() => window.__molde.app.source);
  await page.click('.dm-fab');
  await page.click('.dm-chip:has-text("quick buttons")');
  await page.click('.dm-chip:has-text("Make it")');
  await page.click('.dm-undo');
  expect(await page.$$eval('.dm-undo', e => e.length) === 1, 'no Undo for the first change after undoing the second');
  await page.click('.dm-undo');
  expect(await page.evaluate(() => window.__molde.app.source) === src0, 'program not back to the start');
});

await scenario('medicine: doses taken never exceed doses due', 'ex=medicine&view=app', async page => {
  const t = await page.$eval('.mo-screen .mo-head-t', e => e.textContent);
  const m = /^(\d+)\s+of\s+(\d+)/.exec(t);
  expect(m && +m[1] <= +m[2], t);
  for (let i = 0; i < 2; i++) await page.click('.mo-toggle >> nth=0');
  const t2 = await page.$eval('.mo-screen .mo-head-t', e => e.textContent);
  const m2 = /^(\d+)\s+of\s+(\d+)/.exec(t2);
  expect(m2 && +m2[1] <= +m2[2], t2);
});

await scenario('act first: habits Today list before the heat grid; workouts log near the top', 'ex=habits&view=app', async page => {
  const y = await page.evaluate(() => [document.querySelector('.mo-toggle').getBoundingClientRect().top, document.querySelector('.mo-grid').getBoundingClientRect().top]);
  expect(y[0] < y[1], 'heat grid above today\'s habits');
  expect(y[0] < 915, 'first habit tick box below the fold');
});

await scenario('heat grid: one tab stop, arrow keys, named cells, ring selection, true legend', 'ex=habits&view=app', async page => {
  const g = await page.$('.mo-grid[data-rove]');
  expect(g, 'grid is not one tab stop');
  expect(await page.$$eval('.mo-grid[data-rove] > [tabindex="0"]', e => e.length) === 1, 'more than one tab stop');
  await page.focus('.mo-grid[data-rove] > [tabindex="0"]');
  const a = await page.evaluate(() => document.activeElement.textContent);
  await page.keyboard.press('ArrowLeft');
  const b = await page.evaluate(() => document.activeElement.textContent);
  expect(a !== b && /^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}, \d of \d habits done$/.test(b.replace(/\s+/g, ' ').trim()), `cell name "${b}"`);
  await page.keyboard.press('Enter');
  const sel = await page.$eval('.mo-grid[data-rove] > [tabindex="0"]', e => ({ ring: getComputedStyle(e).boxShadow, swatch: getComputedStyle(e.firstElementChild).backgroundColor, ink: getComputedStyle(document.querySelector('.mo-app')).color }));
  expect(/inset/.test(sel.ring), 'selection is not a ring');
  expect(sel.swatch !== sel.ink, 'selection painted as an ink fill');
  const legend = await page.$eval('.mo-app', e => /Less[\s\S]*More/.test(e.innerText));
  expect(legend, 'no legend');
});

await scenario('pickers: the exercise chips are one sideways row with a cue', 'ex=exercise&view=app', async page => {
  const tops = await page.$$eval('.mo-scroll .mo-btn', e => [...new Set(e.map(x => Math.round(x.getBoundingClientRect().top)))]);
  expect(tops.length === 1, `chips on ${tops.length} lines`);
  expect(await page.$eval('.mo-scroll', e => e.classList.contains('mo-more-end') || e.scrollWidth <= e.clientWidth), 'no cue');
});

await scenario('charts: three y ticks, month names under savings bars, reached bars marked', 'ex=budget&view=app', async page => {
  const ticks = await page.$$eval('.mo-plot-y span', e => e.length);
  expect(ticks >= 3, `budget y ticks: ${ticks}`);
  await page.evaluate(() => { location.hash = 'ex=savings&view=app'; });
  await page.waitForFunction(() => window.__molde.ex === 'savings');
  const months = await page.$eval('.mo-app', e => e.innerText);
  expect(/Jun[\s\S]*Jul[\s\S]*Aug[\s\S]*Sep[\s\S]*Oct[\s\S]*Nov/.test(months), 'no month names under the bars');
  await page.evaluate(() => { location.hash = 'ex=water&view=app'; });
  await page.waitForFunction(() => window.__molde.ex === 'water');
  expect(/Reached/.test(await page.$eval('.mo-app', e => e.innerText)), 'no legend for reached bars');
});

await scenario('warnings carry words; board cells are named', 'ex=todo&view=app', async page => {
  expect(/Late/.test(await page.$eval('.mo-app', e => e.innerText)), 'late tasks only shown by colour');
  await page.evaluate(() => { location.hash = 'ex=tictactoe&view=app'; });
  await page.waitForFunction(() => window.__molde.ex === 'tictactoe');
  const names = await page.$$eval('.mo-grid > [role=button]', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  expect(names.length && names.every(n => /^Row \d, column \d, empty$/.test(n)), JSON.stringify(names));
});

await scenario('toast: a removed row reads as a phrase', 'ex=budget&view=app', async page => {
  await (await page.$('[data-swipe]')).focus();
  await page.keyboard.press('Delete');
  const t = await (await page.waitForSelector('.mo-toast span')).textContent();
  expect(/^Removed [A-Z][^·]*, Rs\s[\d,]+$/.test(t.replace(/\s+/g, ' ')), `toast "${t}"`);
});

await scenario('200%: drawing labels stay inside their drawings', 'ex=tasbeeh&view=app', async page => {
  await page.setViewportSize({ width: 360, height: 640 });
  const bad = [];
  for (const id of ['tasbeeh', 'cricket', 'habits', 'pomodoro']) {
    await page.evaluate(i => { location.hash = 'ex=' + i + '&view=app'; }, id);
    await page.waitForFunction(i => window.__molde.ex === i, id);
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await page.waitForTimeout(60);
    const out = await page.evaluate(() => [...document.querySelectorAll('.mo-lbl')].filter(l => { const d = l.closest('.mo-draw').getBoundingClientRect(), r = l.getBoundingClientRect(); return r.left < d.left - 2 || r.right > d.right + 2; }).map(l => l.textContent));
    for (const x of out) bad.push(`${id}: "${x}"`);
  }
  expect(!bad.length, bad.join(' | '));
});

// ---------- 6. round 4 checks ----------
await scenario('no guessed app bar: the bar is the name only; each main action is the first thing under it', 'ex=budget&view=app', async page => {
  const bad = [];
  for (const [id, label] of [['budget', 'Previous'], ['habits', 'Add habit'], ['exercise', 'Log exercise'], ['reading', 'Add book'], ['todo', 'Add task'], ['medicine', 'Add medicine'], ['journal', 'Write']]) {
    await page.evaluate(i => { location.hash = 'ex=' + i + '&view=app'; }, id);
    await page.waitForFunction(i => window.__molde.ex === i, id);
    if (await page.$eval('.mo-head', e => e.querySelectorAll('.mo-head-bar *').length)) bad.push(`${id}: something moved into the app bar`);
    const first = await page.$eval('.mo-screen > :first-child', (e, l) => !![...e.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent).trim() === l), label);
    if (!first) bad.push(`${id}: "${label}" is not the first thing under the title`);
  }
  expect(!bad.length, bad.join(' | '));
});

await scenario('no guessed numbers: every text is drawn exactly as the evaluator wrote it', 'ex=water&view=app', async page => {
  const bad = [];
  for (const c of CATALOG) {
    await page.evaluate(i => { location.hash = 'ex=' + i + '&view=app'; }, c.id);
    await page.waitForFunction(i => window.__molde.ex === i, c.id);
    const miss = await page.evaluate(() => {
      const norm = x => x.replace(/\s+/g, ' ').trim();
      const dom = norm(document.querySelector('.mo-app').innerText);
      const texts = window.__molde.app.findAll(n => n.t === 'text' && !(n.style && n.style.opacity === 0)).map(n => norm(n.text)).filter(Boolean);
      return texts.filter(t => !dom.includes(t)).slice(0, 3);
    });
    for (const m of miss) bad.push(`${c.id}: "${m}" was changed`);
  }
  expect(!bad.length, bad.slice(0, 6).join(' | '));
});

await scenario('S1: a fixed grid keeps its 7 columns at 320, 360 and 412, headers over their days', 'ex=habits&view=app', async page => {
  const bad = [];
  for (const w of [320, 360, 412]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.waitForTimeout(80);
    const r = await page.$eval('.mo-grid[data-rove]', g => {
      const kids = [...g.children];
      const cols = new Set(kids.map(k => Math.round(k.getBoundingClientRect().left))).size;
      const heads = kids.slice(0, 7).map(k => Math.round(k.getBoundingClientRect().left));
      const cells = kids.slice(7, 14).map(k => Math.round(k.getBoundingClientRect().left));
      return { cols, aligned: heads.every((x, i) => Math.abs(x - cells[i]) < 2) };
    });
    if (r.cols !== 7) bad.push(`${w}px: ${r.cols} columns`);
    if (!r.aligned) bad.push(`${w}px: day headers not over their cells`);
  }
  expect(!bad.length, bad.join(' | '));
});

await scenario('S1: a row editor changes a pick by mouse and by Space; the value reads back after Done', 'ex=budget&view=app', async page => {
  await page.click('.mo-row.mo-card.mo-tap >> nth=0');
  await page.waitForSelector('.mo-sheet');
  await page.click('.mo-sheet .mo-chip:text-is("Health")');
  expect(await page.$eval('.mo-sheet .mo-chip:text-is("Health")', e => e.getAttribute('aria-checked')) === 'true', 'mouse: chip not selected');
  await page.focus('.mo-sheet .mo-chip:text-is("Transport")');
  await page.keyboard.press('Space');
  expect(await page.$eval('.mo-sheet .mo-chip:text-is("Transport")', e => e.getAttribute('aria-checked')) === 'true', 'Space: chip not selected');
  await page.click('.mo-sheet button:has-text("Done")');
  await page.waitForSelector('.mo-sheet', { state: 'detached' });
  await page.click('.mo-row.mo-card.mo-tap >> nth=0');
  await page.waitForSelector('.mo-sheet');
  expect(await page.$eval('.mo-sheet .mo-chip:text-is("Transport")', e => e.getAttribute('aria-checked')) === 'true', 'pick not saved');
});

await scenario('S2: Escape cancels a sheet edit and Remove works, with no page error', 'ex=budget&view=app', async page => {
  const name0 = await page.$eval('.mo-row.mo-card.mo-tap', e => e.innerText);
  await page.click('.mo-row.mo-card.mo-tap >> nth=0');
  const inp = page.locator('.mo-sheet input[type=text]').first();
  await inp.fill('Something else');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.mo-sheet', { state: 'detached' });
  expect(await page.$eval('.mo-row.mo-card.mo-tap', e => e.innerText) === name0, 'Escape kept the edit');
  await page.click('.mo-row.mo-card.mo-tap >> nth=0');
  await page.locator('.mo-sheet input[type=text]').first().fill('Changed then removed');
  await page.click('.mo-sheet button:has-text("Remove")');
  await page.waitForSelector('.mo-toast:has-text("Removed")');
});

await scenario('S2: Enter saves a sheet; Tab stays inside it', 'ex=water&view=app', async page => {
  await page.click('.mo-head [aria-label="Settings"]');
  const inp = page.locator('.mo-sheet input').first();
  await inp.fill('2200');
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => !!document.activeElement.closest('.mo-sheet')), 'focus left the sheet');
  await inp.focus();
  await page.keyboard.press('Enter');
  await page.waitForSelector('.mo-sheet', { state: 'detached' });
  await page.waitForSelector('.mo-app :text("of 2200 ml today")');
});

// text boxes that overprint each other
function overlaps() {
  const leaf = [...document.querySelectorAll('.mo-app .mo-text, .mo-app .mo-btn, .mo-app .mo-chip, .mo-app .mo-lbl, .mo-app .mo-plot-x span, .mo-app .mo-plot-y span, .mo-app .mo-title')].filter(e => e.getClientRects().length && e.textContent.trim() && !e.closest('.mo-sr'));
  const box = e => { const r = document.createRange(); r.selectNodeContents(e); const b = r.getBoundingClientRect(); return b; };
  const out = [];
  const bs = leaf.map(e => [e, box(e)]);
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
    const [a, A] = bs[i], [b, B] = bs[j];
    if (a.contains(b) || b.contains(a)) continue;
    const w = Math.min(A.right, B.right) - Math.max(A.left, B.left), h = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
    if (w > 2 && h > 2) out.push(`"${a.textContent.trim().slice(0, 14)}" over "${b.textContent.trim().slice(0, 14)}"`);
  }
  return out;
}
await scenario('S2: no text overprints other text at 200% system text, 360 and 320 px', 'ex=water&view=app', async page => {
  const bad = [];
  for (const w of [360, 320]) {
    await page.setViewportSize({ width: w, height: 700 });
    for (const c of CATALOG) {
      await page.evaluate(i => { location.hash = 'ex=' + i + '&view=app'; }, c.id);
      await page.waitForFunction(i => window.__molde.ex === i, c.id);
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      await page.waitForTimeout(60);
      for (const x of (await page.evaluate(overlaps)).slice(0, 2)) bad.push(`${c.id}@${w}: ${x}`);
    }
  }
  expect(!bad.length, bad.slice(0, 8).join(' | ') + (bad.length > 8 ? ` (+${bad.length - 8})` : ''));
});

await scenario('S2: no plural or grammar slips in any app', 'ex=water&view=app', async page => {
  const bad = [];
  for (const c of CATALOG) {
    await page.evaluate(i => { location.hash = 'ex=' + i + '&view=app'; }, c.id);
    await page.waitForFunction(i => window.__molde.ex === i, c.id);
    const txt = (await page.$eval('.mo-app', e => e.innerText)).replace(/\s+/g, ' ');
    const m = txt.match(/\b\w+ ises\b|\w(?<!pro|cl|r|w|prom)ises\b|\b1 (days|drinks|exercises|sessions|questions|rounds|habits|tasks|books|doses|times|sets)\b|\b(0|[2-9]|\d\d+) (day|drink|task|book|dose|habit|set) (is|was)\b/);
    if (m) bad.push(`${c.id}: "${m[0]}"`);
  }
  expect(!bad.length, bad.join(' | '));
});

await scenario('S2: Journal opens on the mood trend and entries; chart words come from the plot, not hand labels', 'ex=journal&view=app', async page => {
  expect(!(await page.$('.mo-plot .mo-plot-lbl')), 'hand-placed labels in the mood chart');
  expect((await page.$$eval('.mo-plot-y span', e => e.length)) >= 3, 'no y ticks');
  const inside = await page.$eval('.mo-plot', p => { const b = p.getBoundingClientRect(); return [...p.querySelectorAll('.mo-plot-x span')].every(s => { const r = s.getBoundingClientRect(); return r.left >= b.left - 1 && r.right <= b.right + 1; }); });
  expect(inside, 'x labels outside the plot');
  const top = await page.$eval('.mo-plot', e => e.getBoundingClientRect().top);
  expect(top < 600, 'mood trend below the first screen');
  expect(!(await page.$('.mo-app textarea')), 'opens on a blank text box');
});

await scenario('S2: the demo keeps data on this device across a reload', 'ex=water&view=app', async page => {
  const t0 = await total(page);
  await page.click('button.mo-btn:has-text("+ 500 ml")');
  await page.reload();
  await page.waitForFunction(() => window.__molde && document.querySelector('.mo-app'));
  expect(await total(page) === t0 + 500, `after reload ${await total(page)}, expected ${t0 + 500}`);
});

await browser.close();
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
