// Shared test helpers: a tiny static+page server (production molde.js, CSP from the contract) and a Playwright launcher.
import http from 'node:http';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
export const KIT = join(here, '..');
export const FIXTURES = ['exercise', 'journal', 'water', 'habits', 'budget'];
export const THEMES = ['mint', 'ocean', 'plum', 'slate', 'ink'];
export const VIEWPORTS = [[360, 640], [412, 915], [600, 960], [800, 1280], [1440, 900]];
export const CSP = "default-src 'none'; script-src 'self' 'unsafe-eval'; style-src 'self'; img-src data: blob:; connect-src 'none'; form-action 'none'; frame-src 'none'; base-uri 'none'";

export const FIXED_NOW = new Date(2026, 10, 21, 18, 40); // Saturday 21 Nov 2026, 18:40 local: every screenshot and number test uses it
export function seedFor(manifest, seed, now = new Date(FIXED_NOW)) {
  const out = { tables: {}, kv: seed.kv || {} };
  const p2 = (n) => String(n).padStart(2, '0');
  for (const [tbl, rows] of Object.entries(seed.tables || {})) {
    out.tables[tbl] = rows.map((r, i) => {
      const { d = 0, h = 12, m = 0, ...cols } = r;
      const t = new Date(now); t.setDate(t.getDate() - d); t.setHours(h, m, 0, 0);
      let at = t.getTime(); if (at > now.getTime()) at = now.getTime() - 60000 * (rows.length - i);
      for (const [c, ty] of Object.entries(manifest.tables[tbl])) if (ty === 'date' && !(c in cols)) cols[c] = t.getFullYear() + '-' + p2(t.getMonth() + 1) + '-' + p2(t.getDate());
      return { id: i + 1, at, deleted_at: null, data: cols };
    });
  }
  return out;
}

export function pageHtml(name, { theme, seed = true, grow = false, big = 0, locale = '', dir: dirArg = '', long: longArg = false } = {}) {
  const dir = join(KIT, 'fixtures', name), dirAttr = dirArg;
  const manifest = JSON.parse(readFileSync(join(dir, 'app.json'), 'utf8'));
  const html = readFileSync(join(dir, 'app.html'), 'utf8');
  if (locale) manifest.locale = locale;
  const sp = join(dir, 'seed.json');
  let s = seed && existsSync(sp) ? seedFor(manifest, JSON.parse(readFileSync(sp, 'utf8'))) : null;
  if (big && s) { // N generated rows in the first table (performance tests)
    const tbl = Object.keys(manifest.tables)[0], cols = manifest.tables[tbl], now = Date.now();
    s.tables[tbl] = Array.from({ length: big }, (_, i) => ({ id: i + 1, at: now - i * 60000, deleted_at: null, data: Object.fromEntries(Object.entries(cols).map(([c, ty]) => [c, ty === 'num' ? i % 500 : ty.startsWith('pick:') ? ty.slice(5).split('|')[i % 3] : ty === 'date' ? '2026-01-01' : 'Row ' + i])) }));
  }
  if (longArg && s) { // 400-character unbroken text in every text column of the first rows (URL, one word, Urdu without spaces)
    const L = ['https://example.com/' + 'a'.repeat(380), 'W'.repeat(400), 'کھانا'.repeat(80)];
    for (const [tbl, rows] of Object.entries(s.tables)) rows.slice(0, 3).forEach((r, i) => { for (const [c, ty] of Object.entries(manifest.tables[tbl])) if (ty === 'text' || ty === 'long') r.data[c] = L[i % 3]; });
  }
  if (grow) Object.assign(manifest.tables[Object.keys(manifest.tables)[0]], { stars: 'num', mood2: 'pick:calm|busy', ok: 'bool', note2: 'text', on: 'date' }); // columns added after rows exist
  return `<!doctype html>
<html lang="${locale ? locale.slice(0, 2) : 'en'}"${dirAttr ? ` dir="${dirAttr}"` : ''} data-theme="${theme || manifest.theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${manifest.name}</title>
<link rel="stylesheet" href="/themes.css"><link rel="stylesheet" href="/kit.css"></head><body>
<script type="application/json" id="molde-manifest">${JSON.stringify(manifest)}</script>
${s ? `<script type="application/json" id="molde-seed">${JSON.stringify(s)}</script>` : ''}
<script src="/molde.js" defer></script>
${html}</body></html>`;
}

export function startServer() {
  const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const h = { 'content-security-policy': CSP, 'cache-control': 'no-store' };
    let m;
    if ((m = u.pathname.match(/^\/app\/(\w+)$/))) {
      res.writeHead(200, { ...h, 'content-type': 'text/html' });
      return res.end(pageHtml(m[1], { theme: u.searchParams.get('theme'), seed: u.searchParams.get('seed') !== '0', grow: u.searchParams.get('grow') === '1', big: +u.searchParams.get('big') || 0, long: u.searchParams.get('long') === '1', locale: u.searchParams.get('locale') || '', dir: u.searchParams.get('dir') || '' }));
    }
    if (u.pathname === '/specimen') { res.writeHead(200, { ...h, 'content-type': 'text/html' }); return res.end(readFileSync(join(here, 'specimen.html'), 'utf8')); }
    const f = join(KIT, u.pathname.replace(/\.\./g, ''));
    if (['/molde.js', '/kit.css', '/themes.css'].includes(u.pathname) && existsSync(f)) {
      res.writeHead(200, { ...h, 'content-type': types[f.slice(f.lastIndexOf('.'))] });
      return res.end(readFileSync(f));
    }
    res.writeHead(404, h); res.end('not found');
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok({ srv, base: 'http://127.0.0.1:' + srv.address().port, close: () => srv.close() })));
}

export async function launch() {
  const require = createRequire(import.meta.url);
  const { chromium } = require('playwright-core');
  // Playwright 1.65 wants its own browser build; offline we reuse any installed chromium (override: MOLDE_CHROME).
  let exe = process.env.MOLDE_CHROME;
  if (!exe) {
    const root = join(process.env.HOME || '', '.cache/ms-playwright');
    const dirs = existsSync(root) ? readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort() : [];
    exe = dirs.length ? join(root, dirs[dirs.length - 1], 'chrome-linux64/chrome') : undefined;
  }
  return chromium.launch(exe && existsSync(exe) ? { executablePath: exe } : {});
}

/** Open a fixture, collecting every console message, page error and failed request. */
export async function open(browser, base, name, { w = 412, h = 915, theme, scheme = 'light', seed = true, q = '', ctxOpts = {}, before, real = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 1, ...ctxOpts });
  const page = await ctx.newPage();
  const log = [];
  page.on('console', (m) => log.push(`console.${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => log.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => log.push('requestfailed: ' + r.url()));
  page.on('response', (r) => { if (r.status() >= 400) log.push(`http ${r.status()}: ${r.url()}`); });
  if (!real) await page.clock.setFixedTime(FIXED_NOW);
  if (before) await before(page);
  await page.goto(`${base}/app/${name}?seed=${seed ? 1 : 0}${theme ? '&theme=' + theme : ''}${q}`);
  await page.waitForFunction(() => document.querySelectorAll('m-stat,m-chart,m-list,m-form,m-timer').length === 0 || Array.from(document.querySelectorAll('m-stat,m-chart,m-list,m-form,m-timer')).every((e) => e.firstElementChild));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450);
  return { page, ctx, log };
}

/** Add markup with its own Alpine scope to a running page and wait for the kit components inside it. */
export async function inject(page, html, data = '{}') {
  await page.evaluate(({ html, data }) => { const d = document.createElement('div'); d.id = 'inj'; d.setAttribute('x-data', data); d.innerHTML = html; document.querySelector('main').prepend(d); }, { html, data });
  await page.waitForFunction(() => Array.from(document.querySelectorAll('#inj m-chart,#inj m-stat,#inj m-list')).every((e) => e.firstElementChild));
  await page.waitForTimeout(150);
}

/** Layout audit run inside the page: overflow, targets under 44 px, text under 12 px (SVG text measured after scaling). */
export const auditFn = () => {
  const out = { overflow: [], small: [], tiny: [] };
  const vw = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > vw) out.overflow.push(`document scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || (r.width === 0 && r.height === 0)) continue;
    if (el.closest('svg') && el.localName !== 'svg') { if (el.localName === 'text' && parseFloat(cs.fontSize) * (el.ownerSVGElement.getBoundingClientRect().width / (el.ownerSVGElement.viewBox.baseVal.width || 1)) < 11.9) out.tiny.push('svg text'); continue; }
    if (el.closest('.m-toasts') === null && (r.right > vw + 0.5 || r.left < -0.5) && !el.closest('.scroll, .seg')) out.overflow.push(`${el.localName}.${el.className} [${Math.round(r.left)},${Math.round(r.right)}] vs ${vw}`);
    if (!el.classList.contains('sr') && el.matches('button, a[href], select, textarea, input:not([type=hidden]), [role=button], [role=textbox], [contenteditable=true], summary') && Math.min(r.width, r.height) < 43.99) out.small.push(`${el.localName}${el.name ? '[' + el.name + ']' : ''}.${el.className} ${Math.round(r.width)}x${Math.round(r.height)}`);
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim() && parseFloat(cs.fontSize) < 11.9) out.tiny.push(`${el.localName} ${cs.fontSize}`);
  }
  return out;
};

/** Row actions are a kebab: the first tap arms "Delete", the second tap does it. */
export async function del(loc) { await loc.click(); await loc.page().waitForTimeout(350); await loc.click(); } /* two separate taps: a double tap (< 300 ms) only arms */
