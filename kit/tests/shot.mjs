import { startServer, launch, open, FIXTURES } from './lib.mjs';
const [name = 'exercise', w = 412, h = 915, theme, scheme] = process.argv.slice(2);
const s = await startServer(); const b = await launch();
const { page, log } = await open(b, s.base, name, { w: +w, h: +h, theme, scheme: scheme || 'light' });
await page.screenshot({ path: `/tmp/molde-t02-bar/mine-${name}-${w}.png`, fullPage: true });
console.log(log.length ? log : 'no console output');
await b.close(); s.close();
