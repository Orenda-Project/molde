// candidate bases for the hand-decided edit rows. node gen/cands.mjs KIND START COUNT   (prints compact descriptors)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { rng, sha } from '../../data-v1/gen/lib.mjs';
const [kind, start = '0', count = '40'] = process.argv.slice(2);
const rows = readFileSync('out/derived.jsonl', 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const R = rng('v4cands'); const seen = new Set(); const used = JSON.parse(existsSync('out/used_bases.json') ? readFileSync('out/used_bases.json', 'utf8') : '{}');
const tests = new Set(); // long test bases (program bodies) must never be used
const title = p => ((p.match(/^app "([^"]*)"/) || [])[1] || '');
let pool = []; const tcount = {};
for (const r of R.shuffle(rows)) { if (r.task !== 'create' || r.program.startsWith('ask ')) continue; const n = r.program.trim().split('\n').length; if (n < 4 || n > 25) continue; const h = sha(r.program); if (seen.has(h)) continue; seen.add(h); const t = title(r.program).toLowerCase(); if ((tcount[t] || 0) >= 2) continue; tcount[t] = (tcount[t] || 0) + 1; pool.push({ id: 'b' + h.slice(0, 8), program: r.program, n }); }
const L = p => p.trim().split('\n');
function desc(b) {
  const lines = L(b.program), t = title(b.program);
  if (kind === 'option') { const out = []; lines.forEach((l, i) => { const m = l.match(/^(table|setting|state)\b.*?\b(\w+) pick ([\w|]+)/); if (m && m[3].includes('|')) out.push(`${i + 1}:${m[2]}=[${m[3]}]`); }); return out.length ? `${b.id} ${t} :: ` + out.join(' ') : null; }
  if (kind === 'button') { const out = []; lines.forEach((l, i) => { let m; if ((m = l.match(/^\s*(topbar|form) \w+, "([^"]*)"/))) out.push(`${i + 1}:${m[1]}"${m[2]}"`); else if ((m = l.match(/button "([A-Za-z][^"]{2,})"/))) out.push(`${i + 1}:button"${m[1]}"`); }); return out.length ? `${b.id} ${t} :: ` + out.join(' ') : null; }
  if (kind === 'remove') { const out = []; lines.forEach((l, i) => { if (i === 0) return; if (/^(daybars|bars|trend|heat|share|goalbars|daygrid|weekdots|goal|stat|statcard|quick|calendar|list|remind|plot)\b/.test(l)) out.push(`${i + 1}:${l.slice(0, 46)}`); }); return out.length >= 2 ? `${b.id} ${t} (${b.n}) :: ` + out.join(' ‖ ') : null; }
  if (kind === 'reorder') { const blocks = []; lines.forEach((l, i) => { if (i > 0 && !/^\s/.test(l) && !/^(table|setting|state|let|remind)\b/.test(l)) blocks.push(`${i + 1}:${l.slice(0, 34)}`); }); return blocks.length >= 3 ? `${b.id} ${t} (${b.n}) :: ` + blocks.join(' ‖ ') : null; }
  if (kind === 'field') { const out = []; lines.forEach((l, i) => { const m = l.match(/^table (\w+)(?: (.*))?$/); if (m && m[2] && !/\bwas\b/.test(l)) out.push(`${i + 1}:${l.slice(0, 90)}`); }); return out.length ? `${b.id} ${t} :: ` + out.join(' ‖ ') : null; }
  if (kind === 'rename') { const out = []; lines.forEach((l, i) => { const m = l.match(/^table (\w+)(?: (.*))?$/); if (m && m[2]) out.push(`${i + 1}:${m[1]}(${[...m[2].matchAll(/(?:^|, )(\w+) (?:text|long|num|money|bool|date|time|pick|dur)/g)].map(x => x[1]).join(',')})`); }); return out.length ? `${b.id} ${t} (${b.n}) :: ` + out.join(' ') : null; }
  if (kind === 'chart') { const out = []; lines.forEach((l, i) => { const m = l.match(/^table (\w+)(?: (.*))?$/); if (m && m[2]) { const f = [...m[2].matchAll(/(?:^|, )(\w+) (num|money|dur)\b/g)].map(x => x[1]); if (f.length) out.push(`${i + 1}:${m[1]}.${f.join('/')}`); } }); const has = lines.some(l => /^(daybars|trend|bars|heat|goalbars)\b/.test(l)); return out.length && !has ? `${b.id} ${t} (${b.n}) :: ` + out.join(' ') + ' | ' + lines.filter(l => /^(list|form|stat|each)/.test(l)).slice(0, 3).map(l => l.slice(0, 24)).join(' ‖ ') : null; }
  if (kind === 'section') { return b.n >= 8 ? `${b.id} ${t} (${b.n}) :: ` + lines.map((l, i) => i > 0 && !/^\s/.test(l) ? `${i + 1}:${l.slice(0, 30)}` : null).filter(Boolean).join(' ‖ ') : null; }
  if (kind === 'setting') { const out = []; lines.forEach((l, i) => { const m = l.match(/^setting (\w+) (num|money) (?:[\d.]+\.\.[\d.]* )?= ([\d.]+)( ".*")?/); if (m) out.push(`${i + 1}:${m[1]}=${m[3]}${m[4] || ''}`); }); return out.length ? `${b.id} ${t} :: ` + out.join(' ') : null; }
}
const all = pool.map(b => [b, desc(b)]).filter(([b, d]) => d && !used[kind + ':' + b.id]);
writeFileSync(`out/cands-${kind}.json`, JSON.stringify(all.map(([b]) => b)));
console.log('pool', pool.length, 'for', kind, all.length);
for (const [, d] of all.slice(+start, +start + +count)) console.log(d);
