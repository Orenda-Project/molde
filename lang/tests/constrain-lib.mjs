// Helpers for the name-constraint tests: simulate decoding with random name choices.
import { nameContext, namePositions } from '../constrain.mjs';
import { KEYWORDS } from '../engine.mjs';

// Is the word at p used as a name (not as a keyword)? Decided on the original program.
export function usedAsName(src, p) {
  if (src[p.at - 1] === '.') return { name: true };
  const ctx = nameContext(src.slice(0, p.at));
  if (ctx.mode !== 'names') return { name: false };
  return { name: ctx.names.includes(p.word) || !KEYWORDS.has(p.word), ctx };
}
// leaf positions: nothing written later depends on which name is there
export function isLeaf(src, p) {
  const lineStart = src.lastIndexOf('\n', p.at - 1) + 1;
  const line = src.slice(lineStart, src.indexOf('\n', p.at) < 0 ? src.length : src.indexOf('\n', p.at)).trim();
  if (src[p.at + p.word.length] === '.') return false;                     // a head with parts after it
  if (/^(each|let|state|table|setting|def|screen|remind) /.test(line)) return false; // declares or binds what later lines use
  const first = line.split(' ')[0];
  if (/^[a-z][a-z0-9_]* /.test(line) && !/^(text|button|toggle|field|choice|slider|if|icon|image|row|stack|box|grid|scroll|draw|plot|when|every)\b/.test(line) && line.indexOf(p.word) >= 0 && src.slice(lineStart, p.at).trim().split(' ')[0] === first) return false; // component values
  return true;
}

export function decodeRandom(src, seed) {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let out = src;
  let shift = 0;
  let positions = 0, changed = 0, dead = 0;
  for (const p of namePositions(src)) {
    const at = p.at + shift;
    if (!usedAsName(src, p).name) continue;
    const ctx = nameContext(out.slice(0, at));
    if (ctx.mode !== 'names') continue;
    positions++;
    if (!isLeaf(src, p)) continue;
    let names = ctx.names;
    if (ctx.groups) names = out[at + p.word.length] === '.' ? ctx.groups.dotted : ctx.groups.component;
    const pool = names.filter(n => !KEYWORDS.has(n) || n === p.word || out[at - 1] === '.');
    if (!pool.length) { dead++; continue; }
    const keep = pool.includes(p.word) && rnd() < 0.5;
    const w = keep ? p.word : pool[Math.floor(rnd() * pool.length)];
    if (w !== p.word) changed++;
    out = out.slice(0, at) + w + out.slice(at + p.word.length);
    shift += w.length - p.word.length;
  }
  return { out, positions, changed, dead };
}

