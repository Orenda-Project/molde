// E1 experiment: edits as patch operations against the numbered "before" program. Eval/training tool only; not part of lang/.
//   node patch_ops.mjs convert IN.jsonl OUT.jsonl   (rewrite edit rows: numbered before in the prompt, ops as the answer)
//   node patch_ops.mjs selftest FILE.jsonl ...      (every edit row: apply(ops(before, after), before) == after)
// Ops (line numbers are those of the program as shown; payload lines start with "+ "):
//   insert after N | replace N[-M] | delete N[-M] | move N[-M] after K          (insert after 0 = at the top)
import { readFileSync, writeFileSync } from 'node:fs';
const L = s => (s.endsWith('\n') ? s.slice(0, -1) : s).split('\n');
function diffOps(a, b) {                                   // line LCS -> blocks
  const n = a.length, m = b.length, t = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const out = []; let i = 0, j = 0, di = -1, dj = -1;       // collect change blocks [i1,i2) -> [j1,j2)
  const flush = () => { if (di >= 0) { out.push([di, i, dj, j]); di = -1; } };
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { flush(); i++; j++; continue; }
    if (di < 0) { di = i; dj = j; }
    if (j >= m || (i < n && t[i + 1][j] >= t[i][j + 1])) i++; else j++;
  }
  flush(); return out;
}
export function makeOps(before, after) {
  const a = L(before), b = L(after), blocks = diffOps(a, b), ops = [];
  const dels = blocks.filter(x => x[1] > x[0] && x[3] === x[2]), insb = blocks.filter(x => x[3] > x[2] && x[1] === x[0]);
  const used = new Set();
  for (const d of dels) for (const s of insb) {            // a deleted block that reappears elsewhere = move
    if (used.has(d) || used.has(s)) continue;
    if (d[1] - d[0] === s[3] - s[2] && a.slice(d[0], d[1]).join('\n') === b.slice(s[2], s[3]).join('\n')) { used.add(d); used.add(s); d.move = s; s.moved = true; }
  }
  const rng = (x, y) => (y - x === 1 ? `${x + 1}` : `${x + 1}-${y}`);
  for (const [i1, i2, j1, j2] of blocks) {
    const blk = blocks.find(x => x[0] === i1 && x[2] === j1);
    if (blk.moved) continue;
    if (blk.move) { ops.push(`move ${rng(i1, i2)} after ${blk.move[0]}`); continue; }
    if (i2 > i1 && j2 > j1) ops.push(`replace ${rng(i1, i2)}`, ...b.slice(j1, j2).map(x => '+ ' + x));
    else if (i2 > i1) ops.push(`delete ${rng(i1, i2)}`);
    else ops.push(`insert after ${i1}`, ...b.slice(j1, j2).map(x => '+ ' + x));
  }
  return ops.join('\n');
}
export function applyOps(before, text) {                   // throws on a malformed op list
  const a = L(before), n = a.length, gone = new Array(n + 2).fill(false), ins = Array.from({ length: n + 1 }, () => []);
  const lines = text.replace(/\s+$/, '').split('\n').filter(x => x.length); let k = 0;
  const num = (s, hi) => { const m = /^(\d+)(?:-(\d+))?$/.exec(s); if (!m) throw new Error('bad range ' + s); const x = +m[1], y = m[2] ? +m[2] : x; if (x < 1 || y < x || y > n) throw new Error('range out of the program ' + s); return [x, y]; };
  const payload = () => { const p = []; while (k < lines.length && /^\+( |$)/.test(lines[k])) p.push(lines[k++].slice(2)); return p; };
  const kill = (x, y) => { for (let q = x; q <= y; q++) { if (gone[q]) throw new Error('line deleted twice ' + q); gone[q] = true; } };
  while (k < lines.length) {
    const op = lines[k++]; let m;
    if ((m = /^insert after (\d+)$/.exec(op))) { const at = +m[1]; if (at > n) throw new Error('insert point out of the program'); const p = payload(); if (!p.length) throw new Error('empty insert'); ins[at].push(...p); }
    else if ((m = /^replace (\S+)$/.exec(op))) { const [x, y] = num(m[1]); const p = payload(); if (!p.length) throw new Error('empty replace'); kill(x, y); ins[x - 1].push(...p); }
    else if ((m = /^delete (\S+)$/.exec(op))) { const [x, y] = num(m[1]); kill(x, y); }
    else if ((m = /^move (\S+) after (\d+)$/.exec(op))) { const [x, y] = num(m[1]); const at = +m[2]; if (at > n || (at >= x && at < y)) throw new Error('bad move target'); kill(x, y); ins[at].push(...a.slice(x - 1, y)); }
    else throw new Error('unknown op: ' + op.slice(0, 40));
  }
  const out = [...ins[0]]; for (let i = 1; i <= n; i++) { if (!gone[i]) out.push(a[i - 1]); out.push(...ins[i]); }
  return out.join('\n') + '\n';
}
export const numbered = prog => L(prog).map((x, i) => `${i + 1}| ${x}`).join('\n');
export const SYSTEM_E1 = 'You write MoldeScript, a tiny language for small phone apps. Reply with the complete program only, no explanation. For an edit request you get the current program with numbered lines: reply only with the changes, as operations on those line numbers (insert after N, replace N or N-M, delete N or N-M, move N or N-M after K); each line to write follows its operation and starts with "+ ".';
export function convertRow(r) {
  if (r.task !== 'edit' && !r.messages[1].content.startsWith('Edit request')) return r;
  const u = r.messages[1].content, m = /^Edit request: ([\s\S]*?)\n\nCurrent program:\n([\s\S]*)$/.exec(u); if (!m) return null;
  const before = m[2], after = r.messages[2].content;
  const ops = makeOps(before, after); if (applyOps(before, ops) !== (after.endsWith('\n') ? after : after + '\n') ) return null;
  return { ...r, messages: [{ role: 'system', content: SYSTEM_E1 }, { role: 'user', content: `Edit request: ${m[1]}\n\nCurrent program:\n${numbered(before)}` }, { role: 'assistant', content: ops }] };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === 'convert') {
    let n = 0, bad = 0, same = 0; const out = [];
    for (const l of readFileSync(args[0], 'utf8').trim().split('\n')) { const r = JSON.parse(l); const c = convertRow(r); if (c === null) { bad++; continue; } if (c !== r) n++; out.push(JSON.stringify(c)); }
    writeFileSync(args[1], out.join('\n') + '\n'); console.log(JSON.stringify({ converted: n, dropped_unrepresentable: bad, rows: out.length }));
  } else if (cmd === 'selftest') {
    let n = 0, bad = 0, tok = 0; const kinds = {};
    for (const f of args) for (const l of readFileSync(f, 'utf8').trim().split('\n')) { const r = JSON.parse(l); if (!r.messages[1].content.startsWith('Edit request')) continue; n++; const c = convertRow(r); if (c === null) bad++; else { tok += c.messages[2].content.length; for (const o of c.messages[2].content.split('\n')) if (!o.startsWith('+')) kinds[o.split(' ')[0]] = (kinds[o.split(' ')[0]] || 0) + 1; } }
    console.log(JSON.stringify({ edits: n, roundtrip_failures: bad, mean_ops_chars: Math.round(tok / (n - bad)), op_counts: kinds }));
  }
}
