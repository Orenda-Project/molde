// describe(src): a fixed-template, plain-English summary of a program. It is "the plan" the app
// shows the user before and after a build, so it costs no model tokens and is deterministic.
// It is written for someone who has never seen code: no brackets, no operators, no code words.
import { check } from './check.mjs';
import { parseArg } from './parse.mjs';

const TYPE_WORDS = { text: 'text', long: 'long text', num: 'number', money: 'money', bool: 'yes or no', date: 'date', time: 'time of day', when: 'date and time', dur: 'length of time', image: 'picture' };
const nice = s => String(s).replace(/_/g, ' ');

export function typeWords(t) {
  if (t.t === 'pick') return 'one of ' + t.options.map(nice).join(', ');
  if (t.t === 'ref') return 'a ' + nice(t.table);
  return TYPE_WORDS[t.t] || t.t;
}

function fieldWords(f) {
  const bits = [typeWords(f.type)];
  if (f.range) bits.push(f.range.hi === null ? `at least ${f.range.lo}` : `${f.range.lo} to ${f.range.hi}`);
  if (f.unit) bits.push(`in ${f.unit}`);
  if (f.dflt) bits.push(`starts at ${lit(f.dflt)}`);
  if (f.optional) bits.push('optional');
  return `${f.label ? `"${f.label}"` : nice(f.name)}: ${bits.join(', ')}`;
}

const lit = l => l.k === 'str' ? `"${l.v}"` : l.k === 'word' ? nice(l.v) : l.k === 'bool' ? (l.v ? 'yes' : 'no') : l.k === 'dur' ? dur(l.v) : l.k === 'today' || l.k === 'now' ? l.k : String(l.v);
const dur = s => s % 3600 === 0 ? `${s / 3600} hour${s === 3600 ? '' : 's'}` : s % 60 === 0 ? `${s / 60} minute${s === 60 ? '' : 's'}` : `${s} seconds`;

// names of loop items: `each habit as h` makes h read as "the habit"
let NOUNS = [];
const itNoun = () => (NOUNS.length ? NOUNS[NOUNS.length - 1].it : null) || 'the item';
const nameNoun = n => { for (let i = NOUNS.length - 1; i >= 0; i--) if (NOUNS[i].as === n) return NOUNS[i].noun; return null; };

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
    case 'param': return ' ' + nice(w.name);
  }
  return '';
}

function headNoun(h) {
  if (h === 'it') return itNoun();
  return nameNoun(h) || `the ${nice(h)}`;
}
function path(p) {
  const parts = p.parts.map(nice);
  if (!parts.length) return p.head === 'it' ? itNoun() : (nameNoun(p.head) || nice(p.head));
  const owner = headNoun(p.head);
  if (owner === itNoun() && p.head === 'it') return `its ${parts.join(' ')}`;
  return `the ${parts.join(' ')} of ${owner}`;
}

function rowsNoun(p) {
  // the rows a query is about
  if (!p.parts.length) return p.head === 'it' ? itNoun() : (nameNoun(p.head) || `${nice(p.head)} entries`);
  if (p.parts.length === 1 && (p.head === 'it' || nameNoun(p.head))) return `${p.head === 'it' ? 'its' : headNoun(p.head) + "'s"} ${nice(p.parts[0])} entries`;
  return `${nice(p.parts[p.parts.length - 1])} of ${nice(p.head)}`;
}
function query(q, col) {
  let s = col ? `${nice(q.path.parts[q.path.parts.length - 1])} of ${q.path.parts.length > 1 || q.path.head === 'it' || nameNoun(q.path.head) ? rowsNoun({ head: q.path.head, parts: q.path.parts.slice(0, -1) }) : nice(q.path.head)}` : rowsNoun(q.path);
  s += win(q.win);
  if (q.where) s += ` where ${ex(q.where)}`;
  if (q.by) s += ` grouped by ${typeof q.by === 'string' ? nice(q.by) : [q.by.head, ...q.by.parts].map(nice).join(' of ')}`;
  if (q.sort) s += ` sorted by ${ex(q.sort)}${q.desc ? ', highest first' : ''}`;
  if (q.top) s += `, first ${q.top}`;
  return s;
}

export function source(s) {
  switch (s.k) {
    case 'days': return `each day${win(s.win)}`;
    case 'options': return `each choice of ${path(s.path)}`;
    case 'list': return s.items.map(lit).join(', ');
    case 'range': return `each number from ${ex(s.a)} to ${ex(s.b)}`;
    case 'query': return s.q.by ? `each group of ${query({ ...s.q, by: null })} by ${typeof s.q.by === 'string' ? nice(s.q.by) : [s.q.by.head, ...s.q.by.parts].map(nice).join(' of ')}` : `each ${query(s.q).replace(/ entries/, '')}`;
  }
  return 'each item';
}
const sourceNoun = s => s.k === 'days' ? 'the day' : s.k === 'options' ? 'the choice' : s.k === 'range' ? 'the number' : s.k === 'list' ? 'the value' : s.k === 'query' ? (s.q.by ? 'the group' : `the ${nice(s.q.path.parts.length ? s.q.path.parts[s.q.path.parts.length - 1] : s.q.path.head)}`) : 'the item';

const OPS = { '+': 'plus', '-': 'minus', '*': 'times', '/': 'divided by', '%': 'leaves over when divided by', '=': 'is', '!=': 'is not', '<': 'is less than', '>': 'is more than', '<=': 'is at most', '>=': 'is at least', and: 'and', or: 'or' };
const COLOR_WORDS = { accent: 'the main colour', ink: 'the text colour', muted: 'a quiet colour', soft: 'a soft colour', good: 'green for good', warn: 'orange for warning', bad: 'red for bad', bg: 'the background colour', surface: 'the card colour', edge: 'the border colour' };

const AGG = {
  count: q => `how many ${query(q)}`,
  sum: q => `the total ${query(q, true)}`,
  avg: q => `the average ${query(q, true)}`,
  min: q => `the lowest ${query(q, true)}`,
  max: q => `the highest ${query(q, true)}`,
  last: q => `the latest ${query(q, q.path.parts.length > 0 && !(q.path.head === 'it' && q.path.parts.length === 1))}`,
  first: q => `the first ${query(q, q.path.parts.length > 0 && !(q.path.head === 'it' && q.path.parts.length === 1))}`,
  streak: q => `the current day streak of ${query(q)}`,
  best: q => `the longest day streak of ${query(q)}`,
  since: q => `days since the last of ${query(q)}`,
  gap: q => `the average days between ${query(q)}`,
};

export function ex(e) {
  if (!e) return '';
  switch (e.k) {
    case 'num': return String(e.v);
    case 'pi': return 'pi';
    case 'str': return `"${e.v}"`;
    case 'word': return nice(e.v);
    case 'time': return e.v;
    case 'dur': return dur(e.v);
    case 'bool': return e.v ? 'yes' : 'no';
    case 'today': return 'today';
    case 'now': return 'now';
    case 'index': return 'its position';
    case 'color': return COLOR_WORDS[e.v] || e.v;
    case 'paren': return e.a.k === 'bin' ? `the result of ${ex(e.a)}` : ex(e.a);
    case 'path': return path(e);
    case 'not': return `not ${ex(e.a)}`;
    case 'neg': return `minus ${ex(e.a)}`;
    case 'bin': return `${ex(e.a)} ${OPS[e.op] || e.op} ${ex(e.b)}`;
    case 'agg': return AGG[e.fn](e.q);
    case 'fold': {
      NOUNS.push({ it: sourceNoun(e.src) });
      const inner = ex(e.e);
      NOUNS.pop();
      return e.fn === 'countof' ? `how many of ${source(e.src).replace(/^each /, 'the ')} have ${inner}` : `the ${{ sumof: 'sum', maxof: 'highest', minof: 'lowest' }[e.fn]} of ${inner} over ${source(e.src).replace(/^each /, 'the ')}`;
    }
    case 'qfn': return e.fn === 'due' ? `${query(e.q)} is due: never done, or ${ex(e.e)} days or more since the last` : e.fn === 'nth' ? `entry number ${ex(e.e)} of ${query(e.q)}` : `a random one of ${query(e.q)}`;
    case 'ucall': return `${nice(e.name)} of ${e.args.map(ex).join(' and ')}`;
    case 'fn': {
      const A = e.args.map(ex);
      switch (e.fn) {
        case 'if': return `${A[1]} when ${A[0]}, otherwise ${A[2]}`;
        case 'round': return `${A[0]} rounded`;
        case 'floor': return `${A[0]} rounded down`;
        case 'abs': return `${A[0]} without its sign`;
        case 'clamp': return `${A[0]} kept between ${A[1]} and ${A[2]}`;
        case 'min': return `the smaller of ${A[0]} and ${A[1]}`;
        case 'max': return `the larger of ${A[0]} and ${A[1]}`;
        case 'len': return `the length of ${A[0]}`;
        case 'has': return `${A[0]} contains ${A[1]}`;
        case 'weekday': return `the weekday number of ${A[0]}`;
        case 'monthday': return `the day of the month of ${A[0]}`;
        case 'monthdays': return `the number of days in the month of ${A[0]}`;
        case 'dayname': return `the weekday of ${A[0]}`;
        case 'monthname': return `the month of ${A[0]}`;
        case 'addmonths': return `${A[0]} moved by ${A[1]} months`;
        case 'sin': return `the sine of ${A[0]} degrees`;
        case 'cos': return `the cosine of ${A[0]} degrees`;
        case 'hue': return `a colour with hue ${A[0]}`;
        case 'random': return `a random whole number from 1 to ${A[0]}`;
        case 'words': return `a description of ${A[0]}`;
        default: return `the ${e.fn} of ${A[0]}`;
      }
    }
  }
  return 'a value';
}

const parts = ps => ps.map(p => p.k === 'str' ? `"${p.v}"` : ex(p)).join(', ');

export function action(a) {
  switch (a.a) {
    case 'add': return `adds a ${nice(a.table)}${a.assigns.length ? ` with ${a.assigns.map(s => `${nice(s.name)} set to ${ex(s.e)}`).join(', ')}` : ''}`;
    case 'set': return `sets ${path(a.target)} to ${ex(a.e)}`;
    case 'setall': return `sets ${path(a.target)} to ${ex(a.e)} for every ${nice(a.target.head)}${a.where ? ` where ${ex(a.where)}` : ''}`;
    case 'removeall': return `removes all ${query(a.q)}, with one undo`;
    case 'toggle': return `marks or unmarks ${path(a.target)}${win(a.win) || ' today'}`;
    case 'remove': return `removes ${ex(a.e)}, with undo`;
    case 'edit': return `opens ${ex(a.e)} for editing`;
    case 'save': return `saves the new ${nice(a.name)}`;
    case 'go': return `opens the ${nice(a.name)} screen`;
    case 'notify': return `shows the notice ${parts(a.parts)}`;
    case 'remind': return `reminds "${a.text}" in ${ex(a.e)}`;
    case 'param': return nice(a.name);
  }
  return 'does something';
}

function argWords(text) {
  const r = parseArg(text);
  if (!r) return text;
  if (r.kind === 'expr') return ex(r.ast);
  if (r.kind === 'window') return win(r.ast).trim() || 'all time';
  if (r.kind === 'source') return source(r.ast).replace(/^each /, '');
  return r.ast.map(action).join(', then ');
}

function tapWords(mods) {
  const t = mods?.find(m => m.m === 'tap');
  const s = mods?.find(m => m.m === 'swipe');
  return (t ? `; a tap ${t.actions.map(action).join(', then ')}` : '') + (s ? `; a swipe ${s.actions.map(action).join(', then ')}` : '');
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
        say(e.doc.replace(/\{(\w+)\}/g, (_, k) => vals[k] ?? '').replace(/ \(""\)| \(\)|, labelled ""/g, '').replace(/[()]/g, '').replace(/\s+/g, ' ').trim() + '.');
      } else say(`the part ${nice(s.name)} defined in this app${s.args.length ? `, given ${s.args.map(argWords).join('; ')}` : ''}.`);
      return;
    }
    case 'def': say(`defines a part called ${nice(s.name)}${s.params.length ? `, taking ${s.params.map(p => nice(p.name)).join(', ')}` : ''}.`); return;
    case 'screen': say(`a screen "${s.label}":`); return kids(depth + 1);
    case 'each': {
      say(`for ${source(s.source)}:`);
      NOUNS.push(s.as ? { as: s.as, noun: sourceNoun(s.source), it: NOUNS.length ? NOUNS[NOUNS.length - 1].it : null } : { it: sourceNoun(s.source) });
      kids(depth + 1);
      NOUNS.pop();
      return;
    }
    case 'if': say(`if ${ex(s.cond)}:`); return kids(depth + 1);
    case 'else': say('otherwise:'); return kids(depth + 1);
    case 'box':
      if (s.box === 'grid') { say(`a grid of ${s.cols} columns${tapWords(s.mods)}:`); return kids(depth + 1); }
      if (tapWords(s.mods)) { say(`a group${tapWords(s.mods)}:`); return kids(depth + 1); }
      return kids(depth);
    case 'draw': {
      const n = []; const walk = c => { if (c.kind === 'shape') n.push({ rect: 'rectangles', circle: 'circles', arc: 'arcs', line: 'lines', path: 'outlines', label: 'labels' }[c.shape]); (c.children || []).forEach(walk); if (c.kind === 'poly') n.push('a line through points'); };
      (s.children || []).forEach(walk);
      say(`a drawing made of ${[...new Set(n)].join(', ') || 'nothing yet'}${tapWords(s.mods)}.`);
      return;
    }
    case 'text': say(`text: ${parts(s.parts)}${tapWords(s.mods)}.`); return;
    case 'button': say(`a button ${parts(s.parts)}${tapWords(s.mods)}.`); return;
    case 'icon': say(`an icon${tapWords(s.mods)}.`); return;
    case 'image': say(`a picture of ${ex(s.e)}.`); return;
    case 'field': say(`a box to fill in ${path(s.target)}${s.label ? `, labelled "${s.label}"` : ''}.`); return;
    case 'toggle': say(`a tick box for ${path(s.target)}${s.where ? ` where ${ex(s.where)}` : ''}${win(s.win)}.`); return;
    case 'choice': say(`a choice of ${path(s.target)}.`); return;
    case 'slider': say(`a slider for ${path(s.target)} from ${s.range.lo} to ${s.range.hi}.`); return;
    case 'every': say(`every ${dur(s.every)}${s.cond ? ` while ${ex(s.cond)}` : ''}, it ${s.actions.map(action).join(', then ')}.`); return;
    case 'when': say(`when ${ex(s.cond)}, it ${s.actions.map(action).join(', then ')}.`); return;
    default: return;
  }
}

export function describe(src) {
  NOUNS = [];
  const r = check(src);
  const p = r.ast;
  if (!p.header) return 'This is not a MoldeScript program yet.\n';
  if (p.header.kind === 'ask') return `Question for you: "${p.header.question}" Answers: ${p.header.options.map(o => `"${o}"`).join(', ')}.`;
  const out = [];
  const h = p.header;
  out.push(`${h.name}${h.theme ? `, in the ${h.theme} colours` : ''}.`);
  const tables = p.body.filter(s => s.kind === 'table');
  if (tables.length) {
    out.push('Keeps:');
    for (const t of tables) out.push(`- ${t.label ? `"${t.label}"` : nice(t.name)}: ${t.fields.length ? t.fields.map(fieldWords).join('; ') : 'just the time of each entry'}. Every entry also keeps when it was added.`);
  }
  const settings = p.body.filter(s => s.kind === 'setting');
  if (settings.length) out.push(`You can change: ${settings.map(fieldWords).join('; ')}.`);
  const lets = p.body.filter(s => s.kind === 'let' && !s.params);
  if (lets.length) { out.push('Works out:'); for (const l of lets) out.push(`- ${nice(l.name)} is ${ex(l.e)}.`); }
  const states = p.body.filter(s => s.kind === 'state');
  if (states.length) out.push(`Remembers while you use it: ${states.map(s => `${nice(s.name)}${s.draft ? `, a new ${nice(s.draft)} being filled in` : s.init ? `, starting at ${ex(s.init)}` : ''}`).join('; ')}.`);
  const reminders = p.body.filter(s => s.kind === 'remind');
  const shows = [];
  for (const s of p.body) if (!['table', 'setting', 'remind', 'let', 'state'].includes(s.kind)) stmt(s, r.defs, shows, 0);
  if (shows.length) { out.push('Shows:'); out.push(...shows); }
  for (const m of reminders) {
    let when;
    if (m.at) when = `on each ${nice(m.at.parts[0])} of the ${nice(m.at.head)} entries${m.offset ? `, ${dur(Math.abs(m.offset))} ${m.offset < 0 ? 'before' : 'after'}` : ''}${m.time ? ` at ${m.time}` : ''}`;
    else if (m.monthly) when = `every month on day ${m.monthly.join(' and ')} at ${m.times.join(' and ')}`;
    else if (m.every !== undefined) when = `every ${dur(m.every)}${m.from ? ` from ${m.from} to ${m.to}` : ''}`;
    else when = `at ${m.times.join(', ')}${m.days?.length ? ` on ${m.days.map(d => d[0].toUpperCase() + d.slice(1)).join(', ')}` : ' every day'}`;
    out.push(`Reminder "${m.text}" ${when}${m.cond ? `, only if ${ex(m.cond)}` : ''}.`);
  }
  if (!r.ok) out.push(`There are ${r.errors.length} problems to fix first.`);
  return out.join('\n') + '\n';
}
