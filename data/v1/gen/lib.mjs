// shared helpers: language access, seeded rng, verification, normalisation
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
export const LANG = process.env.LANG_DIR || '/tmp/molde-data2/lang';
export const LANG_COMMIT = (() => { try { return execSync('git -C ' + LANG + ' rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch { return 'unknown'; } })();
const { check } = await import(LANG + '/check.mjs');
const { format } = await import(LANG + '/format.mjs');
const { load } = await import(LANG + '/eval.mjs');
const { diff } = await import(LANG + '/diff.mjs');
export { check, format, load, diff };

export const sha = s => createHash('sha1').update(s).digest('hex').slice(0, 16);
export const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function rng(seed) {
  let a = parseInt(sha(String(seed)).slice(0, 8), 16) >>> 0;
  const f = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  f.pick = arr => arr[Math.floor(f() * arr.length)];
  f.int = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1));
  f.chance = p => f() < p;
  f.shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  return f;
}
export const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

export const HELD = new Set(readFileSync(new URL('../../heldout_ids.txt', import.meta.url), 'utf8').split('\n').filter(Boolean));

// canonical text or null (+errors)
const CANON = new Map();
export function canon(src) { if (CANON.has(src)) return CANON.get(src); const r = canon0(src); if (CANON.size < 20000) CANON.set(src, r); return r; }
function canon0(src) {
  const t = src.endsWith('\n') ? src : src + '\n';
  const r = check(t);
  if (!r.ok) return { ok: false, errors: r.errors.map(String) };
  const f = format(t);
  return { ok: true, text: f.endsWith('\n') ? f : f + '\n' };
}
function hasErr(n) { if (!n || typeof n !== 'object') return false; if (n.t === 'error') return true; return (n.children || []).some(hasErr); }
// full verification: check, canonical, runs, no error nodes. tokens are added later in batch.
import { existsSync, writeFileSync } from 'node:fs';
const CACHE_F = new URL('../out/.verify-cache-' + LANG_COMMIT + '.json', import.meta.url).pathname;
let CACHE = {}; try { if (existsSync(CACHE_F)) CACHE = JSON.parse(readFileSync(CACHE_F, 'utf8')); } catch {}
export const saveCache = () => { try { writeFileSync(CACHE_F, JSON.stringify(CACHE)); } catch {} };
export function verify(src, history = null) { const k = sha(src + (history ? '\u0001' + history.join('\u0002') : '')); if (!process.env.NOCACHE && CACHE[k]) return CACHE[k]; const r = verify0(src, history); CACHE[k] = r; return r; }
function verify0(src, history) {
  const r = check(src);
  if (!r.ok) return { ok: false, why: 'check: ' + r.errors.map(String).slice(0, 2).join(' | ') };
  const f = format(src);
  if (f !== src) return { ok: false, why: 'not canonical' };
  try {
    const app = load(src, history ? { history } : {});
    if (!app.ok) return { ok: false, why: 'load: ' + app.errors.slice(0, 1) };
    if (app.prog.header && app.prog.header.kind === 'ask') return { ok: true, ask: true };
    const tree = app.tree();
    if (hasErr(tree)) return { ok: false, why: 'error node in tree' };
  } catch (e) { return { ok: false, why: 'eval throw: ' + e.message.slice(0, 100) }; }
  return { ok: true };
}

// mo.mjs migrate (the real CLI) over a list of program texts; returns migrated texts in the same order
import { mkdtempSync, readFileSync as rfs, writeFileSync as wfs } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
export function migrateBatch(list) {
  const dir = mkdtempSync((process.env.SCRATCH || tmpdir()) + '/molde-mig-');
  const files = list.map((t, i) => { const p = `${dir}/${i}.mo`; wfs(p, t); return p; });
  for (let i = 0; i < files.length; i += 300) spawnSync('node', [LANG + '/mo.mjs', 'migrate', ...files.slice(i, i + 300), '--write'], { encoding: 'utf8' });
  return files.map(p => rfs(p, 'utf8'));
}
