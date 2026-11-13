// Writes kit/shots/<fixture>-<w>x<h>.png (production molde.js, seeded demo data) + a theme/dark gallery for one fixture.
import { mkdirSync } from 'node:fs';
import { startServer, launch, open, FIXTURES, VIEWPORTS, THEMES, KIT } from './lib.mjs';
const out = KIT + '/shots'; mkdirSync(out, { recursive: true }); mkdirSync(out + '/vp', { recursive: true });
const s = await startServer(); const b = await launch(); let n = 0;
for (const f of FIXTURES) for (const [w, h] of VIEWPORTS) {
  const { page, ctx, log } = await open(b, s.base, f, { w, h });
  await page.screenshot({ path: `${out}/${f}-${w}x${h}.png`, fullPage: true }); await ctx.close(); n++;
  if (log.length) { console.error('console output!', f, w, log); process.exitCode = 1; }
}
for (const t of THEMES) for (const scheme of ['light', 'dark']) {
  if (t === 'ink' && scheme === 'light') continue;
  const { page, ctx } = await open(b, s.base, 'habits', { w: 412, h: 915, theme: t, scheme });
  await page.screenshot({ path: `${out}/themes-habits-${t}-${scheme}.png`, fullPage: true }); await ctx.close(); n++;
}
// viewport-only shots (what a person sees without scrolling) of the four apps, for blind side-by-side comparison
for (const f of ['habits', 'exercise', 'budget', 'journal']) {
  const { page, ctx } = await open(b, s.base, f, { w: 412, h: 915 });
  await page.screenshot({ path: `${out}/vp/${f}-412x915.png`, fullPage: false }); await ctx.close(); n++;
}
console.log(n + ' screenshots in kit/shots (4 of them viewport-only in kit/shots/vp)'); await b.close(); s.close();
