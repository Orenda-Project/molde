#!/usr/bin/env node
// Screenshots at 412x915 (light) with runtime/web for a list of jobs: [{key, program_file, snap_file, png}]
//   node shoot.mjs JOBS_JSON     (needs the static server: python3 -m http.server 8250 in the worktree root)
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/tmp/molde-t02/node_modules/');
const { chromium } = require('playwright-core');
const exe = '/home/oye/.claude/skills/seo/ms-playwright/chromium-1234/chrome-linux64/chrome';
const jobs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:8250/eval-novel/shot/index.html');
await page.waitForFunction('window.ready === true');
let n = 0;
for (const j of jobs) {
  if (existsSync(j.png) && !process.env.FORCE) continue;
  const src = readFileSync(j.program_file, 'utf8');
  const snap = j.snap_file && existsSync(j.snap_file) ? JSON.parse(readFileSync(j.snap_file, 'utf8')) : null;
  errors.length = 0;
  try {
    await page.evaluate(([s, d]) => window.show(s, d), [src, snap]);
    await page.waitForTimeout(150);
    await page.screenshot({ path: j.png });
    n++;
  } catch (e) { console.error('shot fail', j.key, String(e).slice(0, 200)); }
  if (errors.length) console.error('page error', j.key, errors[0]);
}
await browser.close();
console.error('shots', n);
