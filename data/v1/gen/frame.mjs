// Spec-first program + request builder. A program is assembled from parts; each part carries the
// phrases that describe it, so request and program always agree.
import { rng, cap, canon } from './lib.mjs';

export const THEMES = ['ocean', 'mint', 'slate', 'ink', 'plum'];
export const THEME_WORDS = { ocean: ['blue', 'blue', 'ocean blue'], mint: ['green', 'mint green', 'green'], slate: ['grey', 'plain grey', 'slate'], ink: ['dark', 'black', 'dark and moody'], plum: ['purple', 'plum', 'purple'] };

// count of optional parts per style
const NOPT = { short: [0, 1], vague: [-1, -1], detailed: [3, 5], multi_feature: [3, 6], typos: [1, 3], custom_ui: [2, 4] };

export function chooseIds(A, spec, style, r) {
  const opts = Object.entries(A.opts).filter(([id, o]) => !o.only || o.only(spec));
  if (style === 'vague') return opts.filter(([id, o]) => o.dflt).map(([id]) => id);
  const [lo, hi] = NOPT[style] || [1, 3];
  const n = r.int(lo, hi);
  const chosen = [];
  const pool = r.shuffle(opts);
  for (const [id, o] of pool) {
    if (chosen.length >= n) break;
    if (o.excl && chosen.some(c => A.opts[c].excl === o.excl)) continue;
    chosen.push(id);
  }
  for (let i = 0; i < chosen.length; i++) { const nd = A.opts[chosen[i]].needs; if (nd && !chosen.includes(nd)) chosen.push(nd); }
  return chosen;
}

export function buildParts(A, spec) {
  const ids = spec.ids;
  const base = A.base(spec);
  const parts = ids.filter(id => A.opts[id]).map(id => ({ id, ...A.opts[id].make(spec) }));
  const tables = base.tables.map(t => ({ ...t, fields: [...t.fields] }));
  for (const p of parts) if (p.fields) tables[p.table ?? 0].fields.push(...p.fields);
  const lines = [...base.lines];
  for (const p of parts) if (p.lines) lines.push(...p.lines);
  return { base, parts, tables, lines };
}

export function assemble(A, spec) {
  const { base, parts, tables, lines } = buildParts(A, spec);
  const p = spec.p;
  const out = [`app "${p.name}" ${p.icon} ${p.theme}`];
  for (const t of tables) out.push(`table ${t.name}${t.was ? ' was ' + t.was : ''}${t.label ? ' "' + t.label + '"' : ''} ${t.fields.join(', ')}`.replace(/ $/, ''));
  const body = lines.map((l, i) => ({ ord: l[0], line: l[1], i })).sort((a, b) => a.ord - b.ord || a.i - b.i);
  const decl = body.filter(l => l.ord === 1), vis = body.filter(l => l.ord > 1 && l.ord < 9), tail = body.filter(l => l.ord >= 9);
  for (const l of decl) out.push(l.line);
  if (spec.ids.includes('tabs') && A.tabs) {
    const [t1, t2] = A.tabs(spec);
    const split = t1.split;
    for (const [t, sel] of [[t1, vis.filter(l => l.ord < split)], [t2, vis.filter(l => l.ord >= split)]]) {
      if (!sel.length) continue;
      out.push(`screen ${t.name} "${t.label}" ${t.icon}`);
      for (const l of sel) for (const x of l.line.split('\n')) out.push('  ' + x);
    }
  } else for (const l of vis) out.push(l.line);
  for (const l of tail) out.push(l.line);
  const text = out.join('\n') + '\n';
  return { text, parts, tables, base };
}

// ---------- request writing ----------
const OPEN_NP = ['', '', 'I need ', 'can you make ', 'please make ', 'I want ', 'build me ', 'make me ', "I'd like ", 'hi, I would like ', 'I am looking for ', 'create '];
const OPEN_IMP = ['', '', 'can you ', 'please ', 'I want to ', 'help me ', 'I need to ', 'hey, ', 'I would like to '];
function a(c) { return /^(a|an|the|my|some)\b/i.test(c) ? c : /^[aeiou]/i.test(c) ? 'an ' + c : 'a ' + c; }
function pickCore(A, spec, r, short) {
  const np = r.chance(0.55) && (short ? A.npShort(spec) : A.np(spec)).length;
  if (np) { const c = r.pick(short ? A.npShort(spec) : A.np(spec)); return { c, np: true, open: r.pick(OPEN_NP) }; }
  const c = r.pick(short && A.impShort ? A.impShort(spec) : A.imp(spec)); return { c, np: false, open: r.pick(OPEN_IMP) };
}
const WITH = ['with', 'with', 'that has', 'that also has', 'plus', 'and also'];
const NEED = ['It should have', 'I want', 'Include', 'Please add', 'Add', 'It needs', 'I would like'];
export function joinNP(list, r) {
  if (list.length <= 1) return list.join('');
  const sep = r.chance(0.2) ? ' and ' : ', ';
  if (sep === ' and ' && list.length === 2) return list.join(' and ');
  return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
}

export function typo(text, r, n = 2) {
  let t = text;
  const words = t.split(' ');
  for (let k = 0; k < n; k++) {
    const idx = r.int(0, words.length - 1);
    let w = words[idx];
    if (w.length < 4 || /[0-9"]/.test(w)) continue;
    const kind = r.int(0, 4);
    const i = r.int(1, w.length - 2);
    if (kind === 0) w = w.slice(0, i) + w.slice(i + 1);                       // drop a letter
    else if (kind === 1) w = w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2); // swap
    else if (kind === 2) w = w.slice(0, i) + w[i] + w.slice(i);               // double
    else if (kind === 3) w = w.replace(/[aeiou]/, '');                         // drop vowel
    else w = w.replace(/ing$/, 'in').replace(/tion$/, 'shun');
    words[idx] = w;
  }
  t = words.join(' ');
  if (r.chance(0.6)) t = t.toLowerCase();
  if (r.chance(0.5)) t = t.replace(/[.,]/g, '');
  t = t.replace(/\bplease\b/g, r.pick(['pls', 'plz', 'please'])).replace(/\bto\b/g, m => r.chance(0.2) ? '2' : m);
  return t;
}

// parts: [{say:[...]}], A: archetype (np/imp cores, wish)
export function composeRequest(A, spec, parts, style, r) {
  const clauses = parts.filter(p => p.say && p.say.length).map(p => r.pick(p.say));
  const short = style === 'short' || style === 'multi_feature';
  const { c: core, np, open } = pickCore(A, spec, r, short);
  let t;
  if (style === 'vague') {
    const wish = A.wish(spec);
    t = r.pick([`${wish}. ${r.pick(['Can you make something for it?', 'Help me with that.', 'Make me an app for that.', 'Something simple please.', 'I need an app for this.', 'Any app that helps?', 'What can you build?'])}`, `${wish}, help`, `${wish}. an app for it?`, `${cap(wish)}. Please make something that helps me.`]);
  } else if (style === 'short') {
    t = clauses.length ? `${open}${core} ${r.pick(WITH)} ${clauses[0]}` : `${open}${core}`;
  } else if (style === 'multi_feature') {
    t = r.chance(0.6) ? `${cap(core)}: ${joinNP(clauses, r)}` : `${open || (np ? 'make me ' : 'I want to ')}${core} with ${joinNP(clauses, r)}`;
  } else if (style === 'typos') {
    t = clauses.length ? `${open}${core} ${r.pick(WITH)} ${joinNP(clauses, r)}` : `${open}${core}`;
    t = typo(t, r, r.int(2, 4));
  } else {
    t = clauses.length ? `${cap(core)}. ${r.pick(NEED)} ${joinNP(clauses, r)}.` : `${cap(core)}.`;
    if (r.chance(0.2)) t = t.replace(/^(\w)/, m => m.toLowerCase());
  }
  return decorate(t.replace(/\s+/g, ' ').trim(), r, style);
}
const LEAD = ['hi, ', 'hello, ', 'hey molde, ', 'quick one: ', 'hi! ', 'good morning, ', 'so, ', 'ok so ', 'listen, ', 'one thing: '];
const TAIL = [' thanks', ' please', ' thx', ' nothing fancy', ' keep it simple', ' asap', ' if possible', ' simple is fine', ' no ads please', ' make it clean', ' it is for me only', ' I use it on my phone'];
function decorate(t, r, style) {
  if (style === 'typos' || style === 'vague') { if (r.chance(0.1)) t = r.pick(LEAD) + t; return t; }
  if (r.chance(0.12) && !/^(hi|hello|hey|quick|so|ok|listen|one|good)/i.test(t)) t = r.pick(LEAD) + t.charAt(0).toLowerCase() + t.slice(1);
  if (r.chance(0.15)) t = t.replace(/[.]$/, '') + r.pick(TAIL) + (r.chance(0.5) ? '.' : '');
  if (r.chance(0.12)) t = t.charAt(0).toLowerCase() + t.slice(1).replace(/\.$/, '');
  return t;
}

// the common pipeline: returns a record or null
export function makeCreate(A, d, style, seed, extra = {}) {
  const r = rng(seed);
  const spec = { arch: A.name, d, style, p: A.params(d, r, style), ...extra };
  spec.ids = spec.ids || chooseIds(A, spec, style, r);
  const { text, parts: ps, base } = assemble(A, spec);
  const parts = ps.slice();
  if (base.say && base.say.length && (['detailed', 'multi_feature', 'typos', 'custom_ui'].includes(style) || (style === 'short' && r.chance(0.5)))) parts.unshift({ say: base.say });
  const c = canon(text);
  if (!c.ok) return { err: c.errors, text };
  const request = composeRequest(A, spec, parts, style, r);
  return { task: 'create', request, program: c.text, spec, style, domain: d.key, method: 'template:' + A.name, text: c.text };
}
