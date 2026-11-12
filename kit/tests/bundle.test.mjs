import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { build } from '../build.mjs';
import { KIT } from './lib.mjs';
const gz = (f) => gzipSync(readFileSync(`${KIT}/${f}`), { level: 9 }).length;

test('molde.js is up to date with its sources', () => assert.equal(readFileSync(`${KIT}/molde.js`, 'utf8'), build()));
test('bundle budget: molde.js <= 60 KB gzip, kit.css <= 8 KB gzip', () => {
  const j = gz('molde.js'), c = gz('kit.css'), t = gz('themes.css');
  console.log(`# molde.js ${readFileSync(`${KIT}/molde.js`).length} B raw, ${j} B gzip (${(j / 1024).toFixed(1)} KB); kit.css ${c} B gzip; themes.css ${t} B gzip`);
  assert.ok(j <= 60 * 1024); assert.ok(c <= 8 * 1024);
});
test('molde.js has no runtime CDN or network code paths of its own', () => {
  const own = readFileSync(`${KIT}/src/sdk.cjs`, 'utf8') + readFileSync(`${KIT}/src/components.js`, 'utf8');
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|importScripts|https?:\/\/(?!www\.w3\.org)/.test(own));
});

test('the kit stays generic: no app-specific words or widgets in molde.js sources, kit.css or themes.css', () => {
  const src = ['src/sdk.cjs', 'src/components.js', 'kit.css', 'themes.css'].map((f) => readFileSync(`${KIT}/${f}`, 'utf8')).join('\n').toLowerCase();
  for (const w of ['habit', 'mood', 'glass', 'water', 'exercise', 'budget', 'journal', 'm-timer', 'heat']) assert.ok(!src.includes(w), 'app-specific word in the kit: ' + w);
  const comps = readFileSync(`${KIT}/src/components.js`, 'utf8'); assert.match(comps, /var COMP = \{ 'm-stat': mStat, 'm-chart': mChart, 'm-list': mList, 'm-form': mForm \};/);
});
