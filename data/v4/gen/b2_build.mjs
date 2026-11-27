// b2: hand/b2-*.txt -> out/b2_rows.jsonl  (new bases as creates, edits by anchor, ask + follow-up rows, calculators)
// record = head lines / program / decisions, records split by a line "===", sections by a line "---"
// head:  @base id=NAME class=CLS   |  @use id=bXXXXXXXX (existing base, edits only)  |  @calc class=CLS
//        request: ...   plan: ...   (request makes a create row)
// decisions: KIND|fields...|request   (anchors: ~text = first line containing text, or a line number)
//   opt|anchor|field|NewOpt   btn|anchor|NewLabel   rm|anchor[>>anchor]   mv|anchor|afteranchor|0   ren|table|old|new
//   sec|anchor>>anchor|Title   fld|anchor|spec   ins|afteranchor|line   rep|anchor|line
//   A|class|request|question|choice1|choice2..   then A1|KIND|fields.. (no request) for each choice that makes an edit
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { canon, verify, diff, sha } from '../../data-v1/gen/lib.mjs';
import { tokenCounts } from '../../data-v1/gen/tokcount.mjs';
import { derivePatch, derivePlan } from './derive.mjs';
import { parsePlan, coverage } from '../../failhunt/tools/plan_check.mjs';
const rows0 = readFileSync('out/derived.jsonl', 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).concat(readFileSync('out/longbases.jsonl', 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)));
const old = new Map(); for (const r of rows0) if (r.task === 'create' && !r.program.startsWith('ask ')) old.set('b' + sha(r.program).slice(0, 8), r.program);
const L = p => p.replace(/\n$/, '').split('\n');
const ind = l => l.match(/^ */)[0].length;
const blockEnd = (lines, i) => { let j = i + 1; while (j < lines.length && ind(lines[j]) > ind(lines[i])) j++; return j; };
const CLS = { opt: 'add_option', btn: 'rename_button', rm: 'remove_one', mv: 'reorder', ren: 'rename_field', sec: 'sections', fld: 'add_field', ins: 'add_chart_stat', rep: 'setting_value' };
function applyDecision(base, p) { // p = [kind, ...fields]; returns after text
  const lines = L(base); const kind = p[0]; const at = a => { if (/^\d+$/.test(a)) return +a - 1; const t = a.replace(/^~/, ''); const i = lines.findIndex((l, k) => k > 0 && l.includes(t)); if (i < 0) throw new Error('anchor ' + a); return i; };
  let l2 = lines.slice();
  if (kind === 'opt') { const [, a, field, nw] = p; const i = at(a); const rx = new RegExp('(\\b' + field + ' pick )([\\w|]+)'); const m = lines[i].match(rx); if (!m || m[2].split('|').includes(nw)) throw new Error('option'); l2[i] = lines[i].replace(rx, `$1$2|${nw}`); }
  else if (kind === 'btn') { const [, a, nw] = p; const i = at(a); const m = lines[i].match(/^(\s*(?:topbar|form) \w+, )"[^"]*"/); const b = lines[i].match(/(button )"[^"]{2,}"/); if (m) l2[i] = lines[i].replace(/^(\s*(?:topbar|form) \w+, )"[^"]*"/, `$1"${nw}"`); else if (b) l2[i] = lines[i].replace(/(button )"[^"]{2,}"/, `$1"${nw}"`); else throw new Error('button'); }
  else if (kind === 'rm') { const [a, b] = p[1].split('>>'); const s = at(a); const e = blockEnd(lines, b ? at(b) : s); l2 = lines.slice(0, s).concat(lines.slice(e)); }
  else if (kind === 'mv') { const s = at(p[1]), e = blockEnd(lines, s); const k = p[2] === '0' ? 1 : blockEnd(lines, at(p[2])); if (k > s && k <= e) throw new Error('bad move'); const blk = lines.slice(s, e); const rest = lines.slice(0, s).concat(lines.slice(e)); const kk = k > s ? k - blk.length : k; l2 = rest.slice(0, kk).concat(blk, rest.slice(kk)); }
  else if (kind === 'ren') { const [, tbl, oldn, newn] = p; l2 = lines.map((l, i) => i === 0 ? l : l.split(/("(?:[^"\\]|\\.)*")/).map((s, k) => k % 2 ? s : s.replace(new RegExp('\\b' + oldn + '\\b', 'g'), newn)).join('')); const ti = l2.findIndex(l => l.startsWith('table ' + tbl + ' ')); if (ti < 0) throw new Error('no table'); l2[ti] = l2[ti].replace(new RegExp('(\\b' + newn + ' (?:text|long|num|money|bool|date|time|when|pick|dur|image|ref)\\b\\??[^,]*)'), `$1 was ${oldn}`); if (!/ was /.test(l2[ti])) throw new Error('was not placed'); }
  else if (kind === 'sec') { const [a, b] = p[1].split('>>'); const s = at(a); const e = blockEnd(lines, b ? at(b) : s); l2 = lines.slice(0, s).concat([' '.repeat(ind(lines[s])) + `section "${p[2]}"`], lines.slice(s, e).map(x => '  ' + x), lines.slice(e)); }
  else if (kind === 'fld') { const i = at(p[1]); if (!/^table \w+ /.test(lines[i])) throw new Error('table line'); l2[i] = lines[i] + ', ' + p[2]; }
  else if (kind === 'ins') { const i = p[1] === '0' ? -1 : blockEnd(lines, at(p[1])) - 1; l2.splice(i + 1, 0, ...pl(p[2])); }
  else if (kind === 'rep') { const i = at(p[1]); l2.splice(i, 1, ...pl(p[2])); }
  else throw new Error('kind ' + kind);
  return l2.join('\n') + '\n';
}
const chain = (base, fields) => { let cur = base; const parts = []; let seg = []; for (const f of fields) { if (f === ';;') { parts.push(seg); seg = []; } else seg.push(f); } parts.push(seg); for (const q of parts) { const a = applyDecision(cur, q); const c = canon(a); cur = c.ok ? c.text : a; } return cur; };
const pl = t => t.split('\\n').map(x => x.replace(/^@(\d+)/, (_, n) => ' '.repeat(+n)));
const askLine = a => 'ask ' + a.map(x => '"' + x.replace(/"/g, '') + '"').join(' ') + '\n';
const out = [], bad = [], pending = [];
const files = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync('hand').filter(f => /^b2-.*\.txt$/.test(f)).sort();
for (const f of files) {
  const recs = readFileSync(f.includes('/') ? f : 'hand/' + f, 'utf8').split(/^===\s*$/m).map(x => x.trim()).filter(x => x && !x.startsWith('#'));
  recs.forEach((rec, n) => {
    const id0 = `${f}#${n}`; const fail = why => bad.push({ id: id0, why });
    const parts = rec.split(/^---\s*$/m).map(x => x.trim()); const head = parts[0].split('\n');
    const hm = head[0].match(/^@(\w+)\s*(.*)$/); if (!hm) return fail('head'); const meta = Object.fromEntries([...hm[2].matchAll(/(\w+)=(\S+)/g)].map(x => [x[1], x[2]]));
    const get = k => { const l = head.find(x => x.startsWith(k + ':')); return l ? l.slice(k.length + 1).trim() : null; };
    let base, decs;
    if (hm[1] === 'use') { base = old.get(meta.id); decs = parts[1]; if (!base) return fail('unknown base ' + meta.id); }
    else { base = parts[1]; decs = parts[2]; }
    const c0 = canon(base); if (!c0.ok) return fail('base check: ' + c0.errors[0].slice(0, 120)); base = c0.text;
    const long = L(base).length > 25; const cls = meta.class || (long ? 'long_base' : 'short_base');
    if (hm[1] === 'base' || hm[1] === 'calc') { const req = get('request'); if (!req) return fail('no request'); pending.push({ kind: 'create', id0, request: req, program: base, plan: get('plan'), cls: hm[1] === 'calc' ? (meta.class || 'calculator') : cls, long }); }
    for (const dl of (decs || '').split('\n').filter(x => x.trim())) {
      const p = dl.replace(/ ;; /g, '|;;|').split('|').map(x => x.trim());
      try {
        if (p[0] === 'A') { // ask line + follow-ups
          const [, acls, req, q, ...ch] = p; const fol = (decs || '').split('\n').filter(x => x.startsWith('A') && /^A\d\|/.test(x));
          pending.push({ kind: 'ask', id0, request: req, q, ch, program: base, cls: acls, long }); 
          ch.forEach((c, k) => { const fl = (decs || '').split('\n').find(x => x.startsWith(`A${k + 1}|`)); if (!fl) return; const fp = fl.replace(/ ;; /g, '|;;|').split('|').slice(1).map(x => x.trim()); const after = chain(base, fp); pending.push({ kind: 'follow', id0, request: `${req}\nQuestion: ${q}\nAnswer: ${c}`, before: base, program: after, cls: acls, long }); });
        } else if (/^A\d$/.test(p[0])) continue;
        else { const req = p[p.length - 1]; const after = chain(base, p.slice(0, -1)); pending.push({ kind: 'edit', id0, request: req, before: base, program: after, cls: CLS[p[0]], long }); }
      } catch (e) { fail(dl.slice(0, 50) + ' -> ' + e.message); }
    }
  });
}
const tk = tokenCounts(pending.flatMap(r => r.before ? [r.program, r.before] : [r.program])); let ti = 0;
for (const r of pending) {
  const t = tk[ti++], tb = r.before ? tk[ti++] : 0; const lim = r.long ? 900 : 500; const fail = why => bad.push({ id: r.id0, request: r.request.slice(0, 40), why });
  if (t > lim || tb > lim) { fail('tokens ' + t); continue; }
  const c = canon(r.program); if (!c.ok) { fail('check ' + c.errors[0].slice(0, 110)); continue; }
  const meta = { style: 'hand', domain: r.id0, tokens: t, language_commit: '4698991', ...(r.long ? { long: true } : {}) };
  if (r.kind === 'create') { const v = verify(c.text, null); if (!v.ok) { fail('verify ' + v.why); continue; } let plan = r.plan || derivePlan(r.request, c.text); if (plan) { const p = parsePlan(plan); const m = p ? coverage(p, c.text) : ['unparsed']; if (m.length) { fail('plan: ' + m.join('|')); continue; } } out.push({ id: 'v4-c-' + sha(r.request + c.text).slice(0, 10), task: 'create', request: r.request, program: c.text, ...(plan ? { plan } : {}), source: 'v4:hand:' + r.cls, class: r.cls, meta }); }
  else if (r.kind === 'ask') { const al = askLine([r.q, ...r.ch]); const b = canon(r.program).text; const v = verify(b, null); if (!v.ok) { fail('verify base'); continue; } out.push({ id: 'v4-e-' + sha(r.request + b + 'ask').slice(0, 10), task: 'edit', request: r.request, program_before: b, before: b, program: al, answer: al.trim(), source: 'v4:hand:' + r.cls, class: r.cls, meta: { ...meta, ask_target: true } }); }
  else { const b0 = canon(r.before).text; const v = verify(c.text, [b0]); if (!v.ok) { fail('verify ' + v.why); continue; } if (b0 === c.text) { fail('no-op'); continue; } const d = diff([b0], c.text); if (d.verdict === 'refused') { fail('diff refused ' + (d.refused || []).slice(0, 1)); continue; } const pt = derivePatch(b0, c.text); if (!pt) { fail('patch'); continue; } out.push({ id: 'v4-e-' + sha(r.request + c.text).slice(0, 10), task: 'edit', request: r.request, program_before: b0, before: b0, program: c.text, answer: pt.answer, source: 'v4:hand:' + (r.kind === 'follow' ? 'ask_follow:' : 'edit:') + r.cls, class: r.cls, meta }); }
}
writeFileSync('out/b2_rows.jsonl', out.map(r => JSON.stringify(r)).join('\n') + '\n');
const cc = {}; for (const r of out) cc[r.class + (r.meta.long ? '/long' : '')] = (cc[r.class + (r.meta.long ? '/long' : '')] || 0) + 1;
console.log(JSON.stringify({ rows: out.length, per_class: cc, failed: bad.length }));
for (const b of bad.slice(0, +(process.env.SHOW || 25))) console.log('FAIL', b.id, b.request || '', b.why);
