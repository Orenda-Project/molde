// programmatic edits on long base programs: colour, title, reorder, bigger, remove section, add chart, setting change (with `set`)
import { canon, verify, diff, rng, sha } from '../../data-v1/gen/lib.mjs';
const ACCENTS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'grey'];
const TUNED = ['ocean', 'mint', 'slate', 'ink', 'plum'];
const lines = p => p.replace(/\n$/, '').split('\n');
const indentOf = l => l.match(/^ */)[0].length;
export function blocks(prog) {
  const L = lines(prog); const out = []; let cur = null;
  for (let i = 1; i < L.length; i++) { if (indentOf(L[i]) === 0) { cur = { lines: [L[i]] }; out.push(cur); } else if (cur) cur.lines.push(L[i]); }
  return { head: L[0], blocks: out };
}
const join = (head, bs) => [head, ...bs.flatMap(b => b.lines)].join('\n') + '\n';
const kindOf = b => { const w = b.lines[0].split(/[ (]/)[0]; if (['table', 'setting', 'state', 'let', 'def', 'lib', 'remind', 'when', 'every'].includes(w)) return 'decl'; if (w === 'screen') return 'screen'; if (w === 'topbar') return 'topbar'; if (w === 'section') return 'section'; if (['goalbars', 'daybars', 'bars', 'trend', 'heat', 'daygrid', 'weekdots', 'share', 'plot'].includes(w)) return 'chart'; if (w === 'list' || w === 'each') return 'list'; if (['form', 'quick', 'timer', 'calendar', 'monthnav', 'statcard', 'stat', 'goal'].includes(w)) return w; return 'other'; };
const hdr = h => { const m = h.match(/^app "([^"]*)"(?: (\w+))?(?: (\w+))?(?: (\w+))?$/); return m ? { name: m[1], icon: m[2], theme: m[3], mode: m[4] } : null; };
const setHdr = (h, o) => `app "${o.name}"${o.icon ? ' ' + o.icon : ''}${o.theme ? ' ' + o.theme : ''}${o.mode ? ' ' + o.mode : ''}`;
function label(b) {
  const l = b.lines[0]; const k = kindOf(b);
  let m;
  if (k === 'section' && (m = l.match(/^section "([^"]*)"/))) return `the "${m[1]}" section`;
  if (k === 'chart') return { goalbars: 'the weekly bar chart with the goal line', daybars: 'the daily bar chart', bars: 'the bar chart', trend: 'the trend line', heat: 'the heat map', daygrid: 'the habit grid', weekdots: 'the week dots', share: 'the category bars', plot: 'the chart' }[l.split(' ')[0]];
  if (k === 'list') return l.startsWith('list ') ? `the list (${l.slice(0, 40)})` : `the list of items (${l.slice(0, 40)})`;
  if (k === 'statcard') return 'the stat card'; if (k === 'stat') return 'the big number'; if (k === 'goal') return 'the goal bar'; if (k === 'form') return 'the add form'; if (k === 'quick') return 'the quick buttons';
  return `the block "${l.slice(0, 40)}"`;
}
const tables = prog => lines(prog).filter(l => l.startsWith('table ')).map(l => { const m = l.match(/^table (\w+)(?: was \w+)?(?: "[^"]*")?(?: (.*))?$/); const f = [...(m[2] || '').matchAll(/(?:^|, )(\w+) (num|money|dur)\b/g)].map(x => x[1]); return { name: m[1], numf: f, text: l }; });
const settings = prog => lines(prog).map(l => l.match(/^setting (\w+) (num|money) (?:[\d.]+\.\.[\d.]* )?= ([\d.]+)( .*)?$/)).filter(Boolean).map(m => ({ name: m[1], type: m[2], val: Number(m[3]) }));

export function applyOp(prog, op, r) {
  const { head, blocks: bs } = blocks(prog); const H = hdr(head); if (!H) return null;
  const hasScreen = bs.some(b => kindOf(b) === 'screen');
  let after, text, touched = 1;
  if (op === 'colour') {
    const choice = H.mode === 'dark' ? r.pick(['accent', 'light']) : r.pick(['accent', 'accent', 'accent', 'accent', 'dark']);
    if (choice === 'accent') { const c = r.pick(ACCENTS.filter(x => x !== H.theme)); const o = { ...H, theme: c }; after = join(setHdr(head, o), bs); text = `the colour theme (third word of the first line) changed from ${H.theme} to ${c}`; var word = c; }
    else if (choice === 'dark') { if (H.mode === 'dark') return null; const o = { ...H, theme: H.theme || 'ocean', mode: 'dark' }; after = join(setHdr(head, o), bs); text = 'the app is set to dark mode (the word dark added to the first line)'; word = 'dark'; }
    else { if (H.mode === 'light' || H.mode === 'dark') { const o = { ...H, mode: 'light' }; if (H.mode === 'light') return null; after = join(setHdr(head, o), bs); text = 'the app is set to light mode (dark changed to light)'; word = 'light'; } else return null; }
    return { after, text: text, kind: 'colour', touched, word };
  }
  if (op === 'title') {
    const names = ['Daily Log', 'My Tracker', 'Home Base', 'The Book', 'Quick Notes', 'Little Helper', 'Everyday', 'Ledger', 'Pocket Planner', 'Check In', 'Nest', 'Daybook', 'My Corner', 'Keeper', 'Pulse'];
    const nn = r.pick(names.filter(n => n !== H.name)); const old = H.name;
    const nb = bs.map(b => ({ lines: b.lines.map((l, i) => i === 0 && l.startsWith('topbar "' + old + '"') ? l.replace('topbar "' + old + '"', 'topbar "' + nn + '"') : l) }));
    after = join(setHdr(head, { ...H, name: nn }), nb); touched = 1 + nb.filter((b, i) => b.lines[0] !== bs[i].lines[0]).length;
    return { after, text: `the app title changed from "${old}" to "${nn}" (first line and the app bar title)`, kind: 'title', touched, name: nn };
  }
  if (hasScreen && (op === 'reorder' || op === 'addchart')) return null;
  if (op === 'reorder') {
    const idx = bs.map((b, i) => [kindOf(b), i]).filter(([k]) => ['section', 'chart', 'list', 'statcard', 'stat', 'goal', 'other', 'form', 'quick'].includes(k)).map(([, i]) => i);
    if (idx.length < 3) return null;
    for (let t = 0; t < 8; t++) {
      const a = r.pick(idx), b = r.pick(idx); if (a === b || Math.abs(a - b) < 1) continue;
      const nb = bs.slice(); const [mv] = nb.splice(a, 1); const target = nb.findIndex(x => x === bs[b]); nb.splice(target + (a < b ? 1 : 0) - (a < b ? 0 : 0), 0, mv);
      const na = join(head, nb); if (na === prog) continue;
      return { after: na, text: `${label(mv)} was moved ${a < b ? 'below' : 'above'} ${label(bs[b])}`, kind: 'reorder', touched: mv.lines.length, moved: label(mv), anchor: label(bs[b]), dir: a < b ? 'below' : 'above' };
    }
    return null;
  }
  if (op === 'remove') {
    const idx = bs.map((b, i) => [kindOf(b), i]).filter(([k]) => ['section', 'chart', 'statcard', 'goal', 'stat', 'list', 'form', 'quick', 'calendar'].includes(k)).map(([, i]) => i);
    if (idx.length < 3) return null; const i = r.pick(idx); const nb = bs.slice(); const [gone] = nb.splice(i, 1);
    return { after: join(head, nb), text: `${label(gone)} was removed (${gone.lines.length} lines)`, kind: 'remove', touched: gone.lines.length, removed: label(gone) };
  }
  if (op === 'addchart') {
    const Ts = tables(prog); const T = Ts.find(t => t.numf.length); if (!T) return null; const f = T.numf[0];
    if (bs.some(b => kindOf(b) === 'chart' && /^(daybars|goalbars)/.test(b.lines[0])) && r.chance(0.7)) { /* prefer a different kind below */ }
    const opts = [];
    const S = settings(prog)[0];
    if (!/^\s*(daybars|goalbars)/m.test(prog)) { opts.push([`section "Last 7 days"\n  daybars last 7 days, sum(${T.name}.${f} on it)`, 'a bar chart of the last 7 days']); if (S) opts.push([`section "This week"\n  goalbars last 7 days, sum(${T.name}.${f} on it), ${S.name}`, 'a weekly bar chart with a goal line']); }
    if (!/^\s*trend/m.test(prog)) opts.push([`section "Trend"\n  trend days last 30 days, sum(${T.name}.${f} on it)`, 'a trend line for the last 30 days']);
    if (!/^\s*daygrid/m.test(prog)) opts.push([`section "Last 6 weeks"\n  daygrid last 42 days, count(${T.name} on it), 3`, 'a habit grid for the last 6 weeks']);
    if (!opts.length) return null;
    const [code, desc] = r.pick(opts); const nbk = { lines: code.split('\n') };
    const vis = bs.map((b, i) => [kindOf(b), i]).filter(([k]) => k !== 'decl'); const pos = vis.length >= 2 ? vis[vis.length - 1][1] : bs.length; // before the last visual block
    const nb = bs.slice(); nb.splice(pos, 0, nbk);
    return { after: join(head, nb), text: `${desc} was added as a new section`, kind: 'addchart', touched: nbk.lines.length, added: desc };
  }
  if (op === 'setting') {
    const Ss = settings(prog); if (!Ss.length) return null; const S = r.pick(Ss);
    const f = r.pick([1.5, 2, 0.5, 1.25, 3, 0.8]); let nv = Math.round(S.val * f); if (S.val < 10) nv = Math.round(S.val * f * 10) / 10; if (nv === S.val || nv <= 0) nv = S.val + (S.val >= 100 ? 100 : 1);
    const re = new RegExp('^(setting ' + S.name + ' (?:num|money) (?:[\\d.]+\\.\\.[\\d.]* )?= )[\\d.]+(.*)$');
    const L = lines(prog).map(l => { const m = l.match(re); return m ? m[1] + nv + m[2] + ' set' : l; });
    return { after: L.join('\n') + '\n', text: `the setting "${S.name.replace(/_/g, ' ')}" now defaults to ${nv} instead of ${S.val} and carries the word set so the new value is applied`, kind: 'setting', touched: 1, setting: S.name, value: nv, old: S.val };
  }

  if (op === 'addfield') {
    const L = lines(prog); const cands = [];
    L.forEach((l, i) => { const m = l.match(/^table (\w+)(?: "[^"]*")? (.+)$/); if (m && /\b(text|num|money|pick|date|bool)\b/.test(m[2])) cands.push([i, m[1], m[2]]); });
    if (!cands.length) return null; const [i, tname, rest] = r.pick(cands);
    const FIELDS = [['note', 'note text?', 'note'], ['rating', 'rating num? 1..5', 'rating'], ['phone', 'phone text?', 'phone number'], ['method', 'method pick Cash|Card|Online = Cash', 'payment method'], ['due', 'due date?', 'due date'], ['comment', 'comment text?', 'comment'], ['place', 'place text?', 'place'], ['priority', 'priority pick Low|Normal|High = Normal', 'priority']];
    const ok = FIELDS.filter(f => !new RegExp('\\b' + f[0] + '\\b').test(prog)); if (!ok.length) return null;
    const f = r.pick(ok); L[i] = L[i] + ', ' + f[1];
    const human = tname.replace(/_/g, ' ');
    return { after: L.join('\n') + '\n', text: `a new field "${f[2]}" is added to each ${human} entry (${f[1].split(' ').slice(1).join(' ')}); the add form shows it`, kind: 'addfield', touched: 1, field: f[2], table: human, must: f[2].split(' ').pop() };
  }
  if (op === 'addoption') {
    const L = lines(prog); const cands = [];
    L.forEach((l, i) => { const m = l.match(/(\b(\w+) pick ([\w]+(?:\|[\w]+)+))/); if (m && /^(table|setting|state)\b/.test(l)) cands.push([i, m]); });
    if (!cands.length) return null; const [i, m] = r.pick(cands); const opts = m[3].split('|');
    const bank = ['Other', 'Misc', 'Extra', 'Later', 'Spare', 'Special', 'Urgent', 'Maybe'].filter(x => !opts.includes(x)); if (!bank.length) return null; const nw = r.pick(bank);
    L[i] = L[i].replace(m[1], m[1] + '|' + nw);
    return { after: L.join('\n') + '\n', text: `the choice "${nw}" is added to the options of ${m[2].replace(/_/g, ' ')} (${opts.join(', ')})`, kind: 'addoption', touched: 1, option: nw, fieldname: m[2].replace(/_/g, ' '), must: nw };
  }
  if (op === 'renamebutton') {
    const L = lines(prog); const cands = [];
    L.forEach((l, i) => { let m; if ((m = l.match(/^(\s*topbar \w+, )"([^"]*)"/))) cands.push([i, m[2], 'the app bar button']); if ((m = l.match(/button "([A-Za-z][^"]{2,})"/))) cands.push([i, m[1], 'a button']); if ((m = l.match(/^(\s*form \w+, )"([^"]*)"/))) cands.push([i, m[2], 'the form button']); });
    if (!cands.length) return null; const [i, old, where] = r.pick(cands);
    const bank = ['New entry', 'Log it', 'Done', 'Save entry', 'Add one', 'Create', 'Record', 'Add now', 'Submit', 'Go']; const nw = r.pick(bank.filter(x => x !== old));
    L[i] = L[i].replace('"' + old + '"', '"' + nw + '"');
    return { after: L.join('\n') + '\n', text: `${where} that says "${old}" is renamed to "${nw}"`, kind: 'renamebutton', touched: 1, old, nw, must: nw };
  }
  if (op === 'bigger') {
    const cand = []; const L = lines(prog);
    L.forEach((l, i) => { if (i === 0 || /^\s*(table|setting|state|let|def|topbar|section|remind|screen|each|if|else|row|stack|grid|box|draw|rect|circle|arc|line|label|path|poly|pt|button|field|toggle|choice|slider|form|quick|statcard|stat|goal|list|daybars|goalbars|trend|heat|daygrid|weekdots|share|bars|calendar|timer|monthnav)\b/.test(l)) return; if (/ (faint|bold|head)$/.test(l) && (l.trim().startsWith('"') || /^\s*[\w.]+\(/.test(l) || /^\s*[\w.]+ /.test(l))) cand.push(i); });
    if (!cand.length) return null; const i = r.pick(cand); const l = L[i];
    const nl = / head$/.test(l) ? l.replace(/ head$/, ' big') : / bold$/.test(l) ? l.replace(/ bold$/, ' head') : l.replace(/ faint$/, ' bold');
    const w = l.trim().slice(0, 50); L[i] = nl;
    return { after: L.join('\n') + '\n', text: `the text line "${w}" is now bigger (${l.trim().split(' ').pop()} -> ${nl.trim().split(' ').pop()})`, kind: 'bigger', touched: 1, line: w };
  }
  return null;
}
export const OPS3 = ['addfield', 'addoption', 'renamebutton', 'reorder', 'remove', 'addchart'];
export const OPS = ['colour', 'title', 'reorder', 'bigger', 'remove', 'addchart', 'setting'];
export function keepRate(before, after, touched) {
  const a = lines(before), b = lines(after); const cnt = new Map(); for (const l of b) cnt.set(l, (cnt.get(l) || 0) + 1);
  let kept = 0; for (const l of a) { const n = cnt.get(l) || 0; if (n > 0) { kept++; cnt.set(l, n - 1); } }
  const others = Math.max(1, a.length - touched);
  return { kept_all: +(kept / a.length).toFixed(3), kept_others: +Math.min(1, kept / others).toFixed(3) };
}
export function makeLongEdit(base, op, seed) {
  const r = rng('le' + seed + op);
  const res = applyOp(base, op, r); if (!res) return null;
  const b = canon(base), a = canon(res.after); if (!b.ok || !a.ok) return { err: (a.errors || b.errors)[0], op };
  if (a.text === b.text) return null;
  const v = verify(a.text, [b.text]); if (!v.ok) return { err: v.why, op };
  const d = diff([b.text], a.text); if (d.verdict === 'refused') return { err: 'diff refused', op };
  return { before: b.text, after: a.text, op, ...res, ...keepRate(b.text, a.text, res.touched), verdict: d.verdict };
}
