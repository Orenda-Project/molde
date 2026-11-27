// hand-decided edits on real short programs. files hand/e-*.txt: first line `kind=KIND`, then one decision per line (fields split by |, request last)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { canon, verify, diff, sha } from '../../data-v1/gen/lib.mjs';
import { derivePatch } from './derive.mjs';
const rows = readFileSync('out/derived.jsonl', 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).concat(readFileSync('out/longbases.jsonl', 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)));
const byId = new Map(); for (const r of rows) if (r.task === 'create' && !r.program.startsWith('ask ')) byId.set('b' + sha(r.program).slice(0, 8), r.program);
const L = p => p.replace(/\n$/, '').split('\n');
const ind = l => l.match(/^ */)[0].length;
function blockEnd(lines, i) { let j = i + 1; while (j < lines.length && ind(lines[j]) > ind(lines[i])) j++; return j; } // exclusive, 0-based
const out = [], bad = [];
for (const f of readdirSync('hand').filter(f => /^e-.*\.txt$/.test(f)).sort()) {
  const all = readFileSync('hand/' + f, 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#')); const kind = all[0].replace('kind=', '').trim();
  for (const dl of all.slice(1)) {
    const p = dl.split('|').map(x => x.trim()); const id = p[0]; const base = byId.get(id); const request = p[p.length - 1];
    const fail = why => bad.push({ f, id, kind, why });
    if (!base) { fail('unknown base'); continue; }
    const lines = L(base); let after = null;
    try {
      if (kind === 'option') { const [, ln, field, nw] = p; const i = +ln - 1; const rx = new RegExp('(\\b' + field + ' pick )([\\w|]+)'); const m = lines[i].match(rx); if (!m || m[2].split('|').includes(nw)) throw 'option'; const l2 = lines.slice(); l2[i] = lines[i].replace(rx, `$1$2|${nw}`); after = l2.join('\n') + '\n'; }
      else if (kind === 'button') { const [, ln, nw] = p; const i = +ln - 1; const m = lines[i].match(/^(\s*(?:topbar|form) \w+, )"([^"]*)"/); const b = lines[i].match(/(button )"([A-Za-z][^"]{2,})"/); const l2 = lines.slice(); if (m) l2[i] = lines[i].replace(/^(\s*(?:topbar|form) \w+, )"[^"]*"/, `$1"${nw}"`); else if (b) l2[i] = lines[i].replace(/(button )"[A-Za-z][^"]{2,}"/, `$1"${nw}"`); else throw 'button'; after = l2.join('\n') + '\n'; }
      else if (kind === 'remove') { const [, rg] = p; const [a, b] = rg.split('-').map(Number); const s = a - 1; let e = blockEnd(lines, (b || a) - 1); const l2 = lines.slice(0, s).concat(lines.slice(e)); after = l2.join('\n') + '\n'; }
      else if (kind === 'reorder') { const [, from, afterLn] = p; const s = +from - 1, e = blockEnd(lines, s), k = blockEnd(lines, +afterLn - 1); if (k > s && k <= e) throw 'bad move'; const blk = lines.slice(s, e); const rest = lines.slice(0, s).concat(lines.slice(e)); const kk = k > s ? k - blk.length : k; const l2 = rest.slice(0, kk).concat(blk, rest.slice(kk)); after = l2.join('\n') + '\n'; }
      else if (kind === 'field') { const ln = p[1]; const spec = p.slice(2, -1).join('|'); const i = +ln - 1; if (!/^table \w+ /.test(lines[i])) throw 'table line'; const l2 = lines.slice(); l2[i] = lines[i] + ', ' + spec; after = l2.join('\n') + '\n'; }
      else if (kind === 'rename') { const [, tbl, oldn, newn] = p; const l2 = lines.map((l, i) => { if (i === 0) return l; if (/^\s*(["#])/.test(l) && false) return l; const parts = l.split(/("(?:[^"\\]|\\.)*")/); return parts.map((s, k) => k % 2 ? s : s.replace(new RegExp('\\b' + oldn + '\\b', 'g'), newn)).join(''); }); const ti = l2.findIndex(l => l.startsWith('table ' + tbl + ' ')); if (ti < 0) throw 'no table'; l2[ti] = l2[ti].replace(new RegExp('(\\b' + newn + ' (?:text|long|num|money|bool|date|time|when|pick|dur|image|ref)\\b\\??[^,]*)'), `$1 was ${oldn}`); after = l2.join('\n') + '\n'; if (!/ was /.test(l2[ti])) throw 'was not placed'; }
      else if (kind === 'chart') { const [, afterLn, text] = p; const l2 = lines.slice(); l2.splice(+afterLn, 0, text); after = l2.join('\n') + '\n'; }
      else if (kind === 'section') { const [, rg, ttl] = p; const [a, b] = rg.split('-').map(Number); const s = a - 1; const e = blockEnd(lines, b - 1); const mid = lines.slice(s, e).map(x => '  ' + x); const l2 = lines.slice(0, s).concat([`section "${ttl}"`], mid, lines.slice(e)); after = l2.join('\n') + '\n'; }
      else if (kind === 'setting') { const [, ln, v] = p; const i = +ln - 1; const m = lines[i].match(/^(setting \w+ (?:num|money) (?:[\d.]+\.\.[\d.]* )?= )[\d.]+(.*)$/); if (!m) throw 'setting'; const l2 = lines.slice(); l2[i] = m[1] + v + m[2].replace(/ set$/, '') + ' set'; after = l2.join('\n') + '\n'; }
      else throw 'kind';
    } catch (e) { fail(String(e)); continue; }
    const b0 = canon(base), a0 = canon(after); if (!b0.ok || !a0.ok) { fail('check: ' + (a0.errors || b0.errors)[0].slice(0, 100)); continue; }
    if (a0.text === b0.text) { fail('no-op'); continue; }
    const v = verify(a0.text, [b0.text]); if (!v.ok) { fail('verify ' + v.why); continue; }
    const d = diff([b0.text], a0.text); if (d.verdict === 'refused') { fail('diff refused ' + (d.refused || []).slice(0, 1)); continue; }
    const pt = derivePatch(b0.text, a0.text); if (!pt) { fail('patch'); continue; }
    out.push({ id: 'v4-e-' + sha(request + a0.text).slice(0, 10), task: 'edit', request, program_before: b0.text, before: b0.text, program: a0.text, answer: pt.answer, source: 'v4:hand-edit:' + kind, class: { option: 'add_option', button: 'rename_button', remove: 'remove_one', reorder: 'reorder', field: 'add_field', rename: 'rename_field', chart: 'add_chart_stat', section: 'sections', setting: 'setting_value' }[kind], meta: { style: 'hand', domain: id, language_commit: '4698991', ...(L(b0.text).length > 25 ? { long: true } : {}) } });
  }
}
writeFileSync('out/hand_edits.jsonl', out.map(r => JSON.stringify(r)).join('\n') + '\n');
const c = {}; for (const r of out) c[r.class] = (c[r.class] || 0) + 1;
console.log(JSON.stringify({ rows: out.length, per_class: c, failed: bad.length }));
for (const b of bad.slice(0, 12)) console.log('FAIL', b.f, b.kind, b.id, b.why);
