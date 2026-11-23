// Helpers for the name-constraint tests: simulate decoding with random name choices.
import { nameContext, namePositions } from '../constrain.mjs';
import { KEYWORDS } from '../engine.mjs';

// Is the word at p used as a name (not as a keyword)? Decided on the original program.
export function usedAsName(src, p) {
  if (src[p.at - 1] === '.' && src[p.at - 2] !== '.') return { name: true };
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

const STRUCTURE = new Set(['it', 'all']);
export function decodeRandom(src, seed, leafOnly = false) {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let out = src;
  let shift = 0;
  let positions = 0, changed = 0, dead = 0;
  let skipUntil = -1;
  for (const p of namePositions(src)) {
    if (p.at < skipUntil) continue;
    const at = p.at + shift;
    if (!usedAsName(src, p).name) continue;
    const ctx = nameContext(out.slice(0, at));
    if (ctx.mode !== 'names') continue;
    positions++;
    if (leafOnly && !isLeaf(src, p)) continue;
    let names = ctx.names;
    if (ctx.groups) names = out[at + p.word.length] === '.' ? ctx.groups.dotted : ctx.groups.component;
    const dotNext = out[at + p.word.length] === '.' && out[at + p.word.length + 1] !== '.';
    const canDot = n => { const c = nameContext(out.slice(0, at) + n + '.'); return c.mode === 'free' || c.names.length > 0; };
    let pool = names.filter(n => !STRUCTURE.has(n) && (!dotNext || canDot(n))); // as the mask does: no dot after a name nothing can follow
    if (!pool.length && dotNext) { // every choice ends the path here: the decoder writes the name and drops the rest of the dotted path
      pool = names.filter(n => !STRUCTURE.has(n));
      if (pool.length) {
        const w = pool[Math.floor(rnd() * pool.length)];
        const m = out.slice(at + p.word.length).match(/^(\.[a-z][a-z0-9_]*)+/);
        out = out.slice(0, at) + w + out.slice(at + p.word.length + m[0].length);
        shift += w.length - p.word.length - m[0].length; skipUntil = p.at + p.word.length + m[0].length; changed++; continue;
      }
    }
    if (!pool.length) { dead++; continue; }
    const keep = pool.includes(p.word) && rnd() < 0.5;
    const w = keep ? p.word : pool[Math.floor(rnd() * pool.length)];
    if (w !== p.word) changed++;
    out = out.slice(0, at) + w + out.slice(at + p.word.length);
    shift += w.length - p.word.length;
  }
  return { out, positions, changed, dead };
}

