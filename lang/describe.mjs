// describe(src): a fixed-template, plain-English summary of a program. It is "the plan" the app
// shows the user before and after a build, so it costs no model tokens and is deterministic.
import { check } from './check.mjs';
import { parseArg } from './parse.mjs';

const TYPE_WORDS = { text: 'text', long: 'long text', num: 'number', money: 'money', bool: 'yes/no', date: 'date', time: 'time of day', when: 'date and time', dur: 'duration', image: 'picture' };

export function typeWords(t) {
  if (t.t === 'pick') return 'one of ' + t.options.join(', ');
  if (t.t === 'ref') return 'a ' + t.table;
  return TYPE_WORDS[t.t] || t.t;
}

function fieldWords(f) {
  const bits = [typeWords(f.type)];
  if (f.range) bits.push(f.range.hi === null ? `at least ${f.range.lo}` : `${f.range.lo} to ${f.range.hi}`);
  if (f.unit) bits.push(`in ${f.unit}`);
  if (f.dflt) bits.push(`starts at ${lit(f.dflt)}`);
  if (f.optional) bits.push('optional');
  return `${f.label ? `"${f.label}"` : f.name} (${bits.join(', ')})`;
}

const lit = l => l.k === 'str' ? `"${l.v}"` : l.k === 'bool' ? (l.v ? 'yes' : 'no') : l.k === 'dur' ? dur(l.v) : l.k === 'today' || l.k === 'now' ? l.k : String(l.v);
const dur = s => s % 3600 === 0 ? `${s / 3600} h` : s % 60 === 0 ? `${s / 60} min` : `${s} s`;

export function win(w) {
  if (!w) return '';
  switch (w.k) {
    case 'today': return ' today';
    case 'yesterday': return ' yesterday';
    case 'all': return '';
    case 'prev': return ` last ${w.p}`;
    case 'last': return ` in the last ${w.n} ${w.unit}`;
    case 'on': return w.e.k === 'path' && w.e.head === 'it' && !w.e.parts.length ? ' on that day' : ` on ${ex(w.e)}`;
    case 'period': return w.of ? ` in the ${w.p} of ${ex(w.of)}` : ` this ${w.p}`;
    case 'param': return ' ' + w.name;
  }
  return '';
}

function path(p) {
  const head = p.head === 'it' ? 'the item' : p.head;
  if (!p.parts.length) return head;
  if (p.head === 'it') return `its ${p.parts.join(' ')}`;
  return `${p.parts.join(' ')} of ${head}`;
}

function query(q) {
  let s = q.path.parts.length ? `${q.path.parts[q.path.parts.length - 1]} of ${q.path.head === 'it' ? 'the item' : q.path.head}` : (q.path.head === 'it' ? 'the item' : q.path.head);
  if (q.path.head === 'it' && q.path.parts.length === 1) s = `its ${q.path.parts[0]}`;
  s += win(q.win);
  if (q.where) s += ` where ${ex(q.where)}`;
  if (q.by) s += ` grouped by ${q.by}`;
  if (q.sort) s += ` sorted by ${path(q.sort)}${q.desc ? ' (highest first)' : ''}`;
  if (q.top) s += `, first ${q.top}`;
  return s;
}

const AGG = { count: 'number of', sum: 'total', avg: 'average', min: 'lowest', max: 'highest', last: 'latest', first: 'first', streak: 'current day streak of', best: 'longest day streak of', since: 'days since the last', gap: 'average days between' };

export function source(s) {
  switch (s.k) {
    case 'days': return `each day${win(s.win)}`;
    case 'options': return `each option of ${path(s.path)}`;
    case 'list': return s.items.map(lit).join(', ');
    case 'range': return `${ex(s.a)} to ${ex(s.b)}`;
    case 'query': return query(s.q);
  }
  return '?';
}

export function ex(e) {
  if (!e) return '';
  switch (e.k) {
    case 'num': return String(e.v);
    case 'str': return `"${e.v}"`;
    case 'time': return e.v;
    case 'dur': return dur(e.v);
    case 'bool': return e.v ? 'yes' : 'no';
    case 'today': return 'today';
    case 'now': return 'now';
    case 'index': return 'its position';
    case 'color': return e.v;
    case 'paren': return `(${ex(e.a)})`;
    case 'path': return path(e);
    case 'not': return `not ${ex(e.a)}`;
    case 'neg': return `-${ex(e.a)}`;
    case 'bin': return `${ex(e.a)} ${e.op} ${ex(e.b)}`;
    case 'agg': return `${AGG[e.fn]} ${query(e.q)}`;
    case 'fold': return e.fn === 'countof' ? `how many of ${source(e.src)} have ${ex(e.e)}` : `${{ sumof: 'sum', maxof: 'highest', minof: 'lowest' }[e.fn]} of ${ex(e.e)} over ${source(e.src)}`;
    case 'fn':
      if (e.fn === 'if') return `${ex(e.args[1])} if ${ex(e.args[0])}, else ${ex(e.args[2])}`;
      if (e.fn === 'round') return `${ex(e.args[0])} rounded`;
      return `${e.fn}(${e.args.map(ex).join(', ')})`;
  }
  return '?';
}

const parts = ps => ps.map(p => p.k === 'str' ? `"${p.v}"` : `[${ex(p)}]`).join(' ');

export function action(a) {
  switch (a.a) {
    case 'add': return `adds a ${a.table}${a.assigns.length ? ` (${a.assigns.map(s => `${s.name} = ${ex(s.e)}`).join(', ')})` : ''}`;
    case 'set': return `sets ${path(a.target)} to ${ex(a.e)}`;
    case 'toggle': return `marks or unmarks ${path(a.target)}${win(a.win) || ' today'}`;
    case 'remove': return `removes ${ex(a.e)} (with undo)`;
    case 'edit': return `opens ${ex(a.e)} for editing`;
    case 'save': return `saves the new ${a.name}`;
    case 'go': return `opens the ${a.name} screen`;
    case 'notify': return `shows a notice ${parts(a.parts)}`;
    case 'remind': return `reminds "${a.text}" in ${ex(a.e)}`;
    case 'param': return a.name;
  }
  return '?';
}

function argWords(text) {
  const r = parseArg(text);
  if (!r) return text;
  if (r.kind === 'expr') return ex(r.ast);
  if (r.kind === 'window') return win(r.ast).trim() || 'all time';
  if (r.kind === 'source') return source(r.ast);
  return r.ast.map(action).join(', then ');
}

function tapWords(mods) {
  const t = mods?.find(m => m.m === 'tap');
  const s = mods?.find(m => m.m === 'swipe');
  return (t ? `; tap ${t.actions.map(action).join(', then ')}` : '') + (s ? `; swipe ${s.actions.map(action).join(', then ')}` : '');
}

function stmt(s, defs, out, depth) {
  const say = t => out.push('  '.repeat(depth) + '- ' + t);
  const kids = d => (s.children || []).forEach(c => stmt(c, defs, out, d));
  switch (s.kind) {
    case 'use': {
      const e = defs.get(s.name);
      const def = e?.def;
      if (e?.std && e.doc && def) {
        const vals = {};
        def.params.forEach((p, i) => { vals[p.name] = s.args[i] !== undefined ? argWords(s.args[i]) : (p.dflt !== null ? argWords(p.dflt) : ''); });
        say(e.doc.replace(/\{(\w+)\}/g, (_, k) => vals[k] ?? '').replace(/ \(""\)| \(\)/g, '').replace(/\s+/g, ' ').trim() + '.');
      } else say(`${s.name} (a component defined in this app)${s.args.length ? ': ' + s.args.map(argWords).join('; ') : ''}.`);
      return;
    }
    case 'def': say(`defines a component "${s.name}"${s.params.length ? ` taking ${s.params.map(p => p.name).join(', ')}` : ''}.`); return;
    case 'screen': say(`screen "${s.label}":`); return kids(depth + 1);
    case 'each': say(`for ${source(s.source)}:`); return kids(depth + 1);
    case 'if': say(`if ${ex(s.cond)}:`); return kids(depth + 1);
    case 'else': say('otherwise:'); return kids(depth + 1);
    case 'box':
      if (s.box === 'grid') { say(`a grid of ${s.cols} columns${tapWords(s.mods)}:`); return kids(depth + 1); }
      if (tapWords(s.mods)) { say(`a ${s.box}${tapWords(s.mods)}:`); return kids(depth + 1); }
      return kids(depth);
    case 'draw': {
      const n = []; const walk = c => { if (c.kind === 'shape') n.push(c.shape); (c.children || []).forEach(walk); if (c.kind === 'poly') n.push('line through points'); };
      (s.children || []).forEach(walk);
      say(`a drawing (${[...new Set(n)].join(', ') || 'empty'})${tapWords(s.mods)}.`);
      return;
    }
    case 'text': say(`text ${parts(s.parts)}${tapWords(s.mods)}.`); return;
    case 'button': say(`a button ${parts(s.parts)}${tapWords(s.mods)}.`); return;
    case 'icon': say(`an icon${tapWords(s.mods)}.`); return;
    case 'image': say(`a picture of ${ex(s.e)}.`); return;
    case 'field': say(`an input for ${path(s.target)}${s.label ? ` ("${s.label}")` : ''}.`); return;
    case 'toggle': say(`a tick box for ${path(s.target)}${s.where ? ` where ${ex(s.where)}` : ''}${win(s.win) || (s.target.parts.length || s.where ? '' : '')}.`); return;
    case 'choice': say(`a choice of ${path(s.target)}.`); return;
    case 'slider': say(`a slider for ${path(s.target)} from ${s.range.lo} to ${s.range.hi}.`); return;
    case 'state': case 'let': return;
    case 'every': say(`every ${dur(s.every)}${s.cond ? ` while ${ex(s.cond)}` : ''}: ${s.actions.map(action).join(', then ')}.`); return;
    case 'when': say(`when ${ex(s.cond)}: ${s.actions.map(action).join(', then ')}.`); return;
    default: return;
  }
}

export function describe(src) {
  const r = check(src);
  const p = r.ast;
  if (!p.header) return 'This is not a MoldeScript program yet.';
  if (p.header.kind === 'ask') return `Question for you: "${p.header.question}" Answers: ${p.header.options.map(o => `"${o}"`).join(', ')}.`;
  const out = [];
  const h = p.header;
  out.push(`${h.name}${h.icon || h.theme ? ` (${[h.icon && `icon ${h.icon}`, h.theme && `theme ${h.theme}`].filter(Boolean).join(', ')})` : ''}.`);
  const tables = p.body.filter(s => s.kind === 'table');
  if (tables.length) {
    out.push('Keeps:');
    for (const t of tables) out.push(`- ${t.label ? `"${t.label}"` : t.name}: ${t.fields.length ? t.fields.map(fieldWords).join(', ') : 'just the time of each entry'}. Every entry also keeps when it was added.`);
  }
  const settings = p.body.filter(s => s.kind === 'setting');
  if (settings.length) out.push(`You can change: ${settings.map(fieldWords).join(', ')}.`);
  const lets = p.body.filter(s => s.kind === 'let');
  if (lets.length) { out.push('Works out:'); for (const l of lets) out.push(`- ${l.name} = ${ex(l.e)}.`); }
  const states = p.body.filter(s => s.kind === 'state');
  if (states.length) out.push(`Remembers while you use it: ${states.map(s => `${s.name}${s.draft ? ` (a new ${s.draft} being filled in)` : s.init ? ` (starts at ${ex(s.init)})` : ''}`).join(', ')}.`);
  const reminders = p.body.filter(s => s.kind === 'remind');
  const shows = [];
  for (const s of p.body) if (!['table', 'setting', 'remind', 'let', 'state'].includes(s.kind)) stmt(s, r.defs, shows, 0);
  if (shows.length) { out.push('Shows:'); out.push(...shows); }
  for (const m of reminders) {
    const when = m.every === undefined ? (m.times.length ? `at ${m.times.join(', ')}` : `at each ${path(m.at)}`) + (m.days?.length ? ` on ${m.days.join(', ')}` : '') : `every ${dur(m.every)}${m.from ? ` from ${m.from} to ${m.to}` : ''}`;
    out.push(`Reminder "${m.text}" ${when}${m.cond ? ` if ${ex(m.cond)}` : ''}.`);
  }
  if (!r.ok) out.push(`Problems: ${r.errors.length} (run check).`);
  return out.join('\n') + '\n';
}
