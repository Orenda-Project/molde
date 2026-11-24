// Side-by-side shots: the original demo programs (left) and lang/examples/demo15 (right), 412x915,
// light and dark, each scrolled page by page (up to 3 screens).
//   node runtime/web/build.mjs && PROGRAMS=lang/examples/demo15 OUT=molde-demo15.html node runtime/web/build.mjs
//   node runtime/web/tests/side.mjs OUTDIR     (then python3 runtime/web/tests/side.py OUTDIR joins them)
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(WEB, '../../package.json'));
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { CATALOG } = await import(join(WEB, 'demo', 'catalog.mjs'));
const OUT = process.argv[2]; mkdirSync(OUT, { recursive: true });
const exe = process.env.CHROMIUM_PATH || (existsSync('/home/oye/.claude/skills/seo/ms-playwright/chromium-1234/chrome-linux64/chrome') ? '/home/oye/.claude/skills/seo/ms-playwright/chromium-1234/chrome-linux64/chrome' : undefined);
const browser = await chromium.launch({ executablePath: exe });
for (const [tag, file] of [['old', 'molde-demo.html'], ['new', 'molde-demo15.html']]) for (const mode of ['light', 'dark']) for (const c of CATALOG) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, colorScheme: mode });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(pathToFileURL(join(WEB, 'dist', file)).href + `#ex=${c.id}&view=app`);
  await page.waitForFunction(() => window.__molde && document.querySelector('.mo-app'));
  await page.waitForTimeout(200);
  const total = await page.$eval('.mo-scrollarea', e => Math.ceil(e.scrollHeight / e.clientHeight));
  for (let i = 0; i < Math.min(total, 3); i++) {
    await page.$eval('.mo-scrollarea', (e, i) => { e.scrollTop = i * e.clientHeight; }, i);
    await page.waitForTimeout(80);
    await page.screenshot({ path: join(OUT, `${c.id}-${mode}-${tag}-${i}.png`) });
  }
  if (errs.length) console.log(tag, c.id, mode, errs.join(' | '));
  await ctx.close();
}
await browser.close();
