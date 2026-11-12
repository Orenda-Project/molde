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

export function seedFor(manifest, seed, now = new Date()) {
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

export function pageHtml(name, { theme, seed = true } = {}) {
  const dir = join(KIT, 'fixtures', name);
  const manifest = JSON.parse(readFileSync(join(dir, 'app.json'), 'utf8'));
  const html = readFileSync(join(dir, 'app.html'), 'utf8');
  const sp = join(dir, 'seed.json');
  const s = seed && existsSync(sp) ? seedFor(manifest, JSON.parse(readFileSync(sp, 'utf8'))) : null;
  return `<!doctype html>
<html lang="en" data-theme="${theme || manifest.theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${manifest.name}</title>
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
      return res.end(pageHtml(m[1], { theme: u.searchParams.get('theme'), seed: u.searchParams.get('seed') !== '0' }));
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
export async function open(browser, base, name, { w = 412, h = 915, theme, scheme = 'light', seed = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const log = [];
  page.on('console', (m) => log.push(`console.${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => log.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => log.push('requestfailed: ' + r.url()));
  page.on('response', (r) => { if (r.status() >= 400) log.push(`http ${r.status()}: ${r.url()}`); });
  await page.goto(`${base}/app/${name}?seed=${seed ? 1 : 0}${theme ? '&theme=' + theme : ''}`);
  await page.waitForFunction(() => document.querySelectorAll('m-stat,m-chart,m-list,m-form,m-timer').length === 0 || Array.from(document.querySelectorAll('m-stat,m-chart,m-list,m-form,m-timer')).every((e) => e.firstElementChild));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450);
  return { page, ctx, log };
}
