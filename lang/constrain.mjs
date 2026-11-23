// Dynamic name constraint for decoding. The GBNF cannot know which names exist, so most name
// mistakes pass the grammar and only fail the checker. Given the program text so far, these
// functions say which NAMES may come next. Plain ES module (no Node APIs), like eval.mjs, so it
// runs inside the decoding loop on the phone (in the app's JS engine) or on a server.
//
//   nameContext(textSoFar)  -> { mode: 'free' }                  any word (a new name is declared here)
//                           -> { mode: 'names', names: [...] }    only these names (keywords are left to the GBNF)
//   allowedWords(textSoFar) -> the names allowed for the word being written, filtered by what is typed of it
//   prepareVocab(vocab)     -> an index of the tokenizer vocabulary (do this once)
//   tokenMask(textSoFar, vocabOrIndex) -> a Set of token indices the sampler may pick next
//
// Speed: the complete lines are checked ONCE per new line (and per indentation) and cached; each
// call then only scans the current partial line. Measured in tests/constrain.test.mjs and README.
import { check } from './check.mjs';
import { KEYWORDS } from './engine.mjs';
import { ICONS } from './check.mjs';
import { lex } from './lex.mjs';

const PROBE = 'zprobeq';
const WORDCH = /[A-Za-z0-9_]/;
const AGGS = new Set(['count(', 'sum(', 'avg(', 'min(', 'max(', 'last(', 'first(', 'streak(', 'best(', 'since(', 'gap(', 'due(', 'nth(', 'random(']);
const FOLDS = new Set(['sumof(', 'maxof(', 'minof(', 'countof(']);
const TARGETS = new Set(['set', 'field', 'choice', 'slider']);

const tname = t => typeof t === 'string' ? t : t && t.t;

// ---- caches: per complete-lines text ----
const LIMIT = 64;
const envCache = new Map(), scopeCache = new Map();
const remember = (m, k, v) => { if (m.size > LIMIT) m.delete(m.keys().next().value); m.set(k, v); return v; };

function envOf(done, indent = '') {
  if (envCache.has(done)) return envCache.get(done);
  if (done) { scopeAt(done, indent); if (envCache.has(done)) return envCache.get(done); }
  return envFrom(done, check(done || 'app "x"\n'));
}
function envFrom(done, r) {
  const env = r.ast.env || { tables: new Map(), settings: new Map(), states: new Map(), lets: new Map(), screens: new Map(), options: new Set() };
  const defMap = new Map([...(r.defs || new Map())].map(([k, v]) => [k, v.def]));
  const drafts = [];
  const walk = s => { if (s.kind === 'state' && s.draft) drafts.push(s.name); (s.children || []).forEach(walk); };
  (r.ast.body || []).forEach(walk);
  return remember(envCache, done, { env, defs: [...defMap.keys()], defMap, drafts });
}
// names and types in scope for a line at this indentation (one checker probe, cached)
function scopeAt(done, indent) {
  const key = done + '\u0000' + indent;
  if (scopeCache.has(key)) return scopeCache.get(key);
  const r = check(done + indent + 'text ' + PROBE + '\n', { probe: PROBE });
  if (!envCache.has(done)) envFrom(done, r);
  const p = r.ast.probe;
  const sc = p ? { values: p.values, types: p.types || {}, itType: p.itType || null, writable: p.writable || [], options: p.options || [] } : { values: [], types: {}, itType: null, writable: [], options: [] };
  return remember(scopeCache, key, sc);
}

// ---- types (a small mirror of the checker's path rules) ----
function fieldsOf(env, t) { const tb = env.tables.get(t); return tb ? tb.fields : new Map(); }
function fieldType(env, t, f) {
  if (f === 'at') return 'when';
  if (f === 'id') return 'num';
  const fd = fieldsOf(env, t).get(f);
  if (!fd) return null;
  return fd.type.t === 'ref' ? { t: 'ref', table: fd.type.table } : fd.type.t === 'pick' ? { t: 'pick' } : fd.type.t;
}
function backlinks(env, t) {
  const out = [];
  for (const [name, tb] of env.tables) if ([...tb.fields.values()].filter(f => f.type.t === 'ref' && f.type.table === t).length === 1) out.push(name);
  return out;
}
function partsOf(env, ty) {
  const n = tname(ty);
  if (n === 'row' || n === 'ref' || n === 'draft') return [...fieldsOf(env, ty.table).keys(), 'at', 'id', ...(n === 'draft' ? [] : backlinks(env, ty.table))];
  if (n === 'rows' && !ty.field) return [...fieldsOf(env, ty.table).keys(), 'at'];
  if (n === 'rows' && ty.field && tname(ty.ftype) === 'ref') return [...fieldsOf(env, ty.ftype.table).keys(), 'at'];
  if (n === 'group') return ['key', ...fieldsOf(env, ty.table).keys(), 'at'];
  return [];
}
function step(env, ty, part) {
  const n = tname(ty);
  if (n === 'row' || n === 'ref' || n === 'draft') {
    const ft = fieldType(env, ty.table, part);
    if (ft) return ft;
    if (n !== 'draft' && backlinks(env, ty.table).includes(part)) return { t: 'rows', table: part };
    return null;
  }
  if (n === 'rows' && !ty.field) { const ft = fieldType(env, ty.table, part); return ft ? { t: 'rows', table: ty.table, field: part, ftype: ft } : null; }
  if (n === 'rows' && ty.field && tname(ty.ftype) === 'ref') { const ft = fieldType(env, ty.ftype.table, part); return ft ? { t: 'rows', table: ty.table, field: part, ftype: ft } : null; }
  if (n === 'group') { if (part === 'key') return 'text'; const ft = fieldType(env, ty.table, part); return ft ? { t: 'rows', table: ty.table, field: part, ftype: ft } : null; }
  return null;
}

// ---- the partial line: where is the cursor? ----
// Returns the innermost query context ({table, inWhere, atHead, afterBy}), the fold item type for
// `it`, and the call context of a component.
function lineState(toks, env, scope) {
  const stack = []; // {fn, startIdx, comma: number, head: path tokens, where, sort, by}
  const top = { fn: toks[0] && toks[0].v === 'each' ? 'each' : (toks[0] && (toks[0].v === 'toggle')) ? 'toggle' : null, comma: 0, headTok: [], where: false, sort: false, by: false };
  if (toks[0] && toks[0].v === 'set' && toks[1] && toks[1].v === 'all') top.fn = 'setall';
  stack.push(top);
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]; const cur = stack[stack.length - 1];
    if (t.t === 'func' || (t.t === 'p' && t.v === '(')) { stack.push({ fn: t.t === 'func' ? t.v : '(', comma: 0, headTok: [], where: false, sort: false, by: false, start: i }); continue; }
    if (t.t === 'p' && t.v === ')') { if (stack.length > 1) stack.pop(); continue; }
    if (t.t === 'p' && t.v === ',') { cur.comma++; continue; }
    if (t.t === 'word' && (t.v === 'where' || t.v === 'sort')) { cur[t.v] = true; cur.by = false; continue; }
    if (t.t === 'word' && t.v === 'by') { cur.by = true; continue; }
    if (t.t === 'word' && ['tap', 'swipe', 'then'].includes(t.v) && stack.length === 1) { cur.where = false; cur.sort = false; cur.by = false; }
    // a query can start anywhere on the line: each T, toggle T (also after tap), set all T, remove all T
    if (t.t === 'word' && stack.length === 1 && (t.v === 'toggle' || t.v === 'each' || (t.v === 'all' && i > 0 && (toks[i - 1].v === 'set' || toks[i - 1].v === 'remove')))) {
      Object.assign(cur, { fn: t.v === 'all' ? 'setall' : t.v, comma: 0, headTok: [], where: false, sort: false, by: false, headDone: false, startAt: i });
      continue;
    }
    if (cur.comma === 0 && !cur.where && !cur.sort && !cur.headDone && (t.t === 'word' || (t.t === 'p' && t.v === '.')) && cur.headTok.length < 9) {
      if (['each', 'setall', 'toggle'].includes(cur.fn) && i > (cur.startAt ?? 0) || AGGS.has(cur.fn) || FOLDS.has(cur.fn)) {
        const lastH = cur.headTok[cur.headTok.length - 1];
        if (t.t === 'word' && cur.headTok.length && lastH !== '.') cur.headDone = true; // a window or another word after the path
        else cur.headTok.push(t.v);
      }
    } else if (cur.headTok.length && !(t.t === 'word' || t.v === '.')) cur.headDone = true;
  }
  // `it` in effect inside each frame, from the outside in (a fold's value sees its source's item)
  const itAt = []; let it = null;
  for (let j = 0; j < stack.length; j++) {
    const f = stack[j];
    itAt[j] = it;
    if (FOLDS.has(f.fn) && f.comma >= 1) it = sourceItemType(env, scope, f.headTok, it);
  }
  // the innermost frame with a table query
  let query = null;
  for (let j = stack.length - 1; j >= 0; j--) {
    const f = stack[j];
    if (!query && (AGGS.has(f.fn) || FOLDS.has(f.fn) || ['each', 'setall', 'toggle'].includes(f.fn)) && f.comma === 0) {
      const head = f.headTok.filter(x => x !== '.');
      const ty = headType(env, scope, head, itAt[j]);
      const table = ty && (tname(ty) === 'rows' || tname(ty) === 'group') ? ty.table : null;
      query = { table, inWhere: (f.where || f.sort) && table, afterBy: f.by && table, atHead: !f.where && !f.sort && !f.by, it: itAt[j] };
    }
  }
  return { query, foldIt: it, depth: stack.length };
}
function sourceItemType(env, scope, headTok, outerIt) {
  const head = headTok.filter(x => x !== '.');
  if (head[0] === 'days') return 'date';
  const ty = headType(env, scope, head, outerIt);
  if (ty && (tname(ty) === 'rows' && !ty.field || tname(ty) === 'group')) return { t: 'row', table: ty.table };
  return null;
}
function headType(env, scope, path, foldIt, whereTable) {
  if (!path.length) return null;
  const [h, ...parts] = path;
  let ty;
  if (h === 'it') ty = foldIt || scope.itType;
  else if (whereTable && (fieldsOf(env, whereTable).has(h) || h === 'at' || h === 'id')) ty = fieldType(env, whereTable, h);
  else if (h in scope.types) ty = scope.types[h];
  else if (env.tables.has(h)) ty = { t: 'rows', table: h };
  else return null;
  for (const p of parts) { if (!ty) return null; ty = step(env, ty, p); }
  return ty;
}

// Where is the cursor? `text` ends where the next name would start.
export function nameContext(text) {
  const nl = text.lastIndexOf('\n');
  const done = text.slice(0, nl + 1), line = text.slice(nl + 1);
  const E = envOf(done, line.match(/^ */)[0]);
  const env = E.env;
  const tables = [...env.tables.keys()];
  const names = n => ({ mode: 'names', names: [...new Set(n)] });
  const strict = n => ({ mode: 'names', names: [...new Set(n)], strict: true }); // no keyword can stand here either
  if (!done) { // the header line
    let t0; try { t0 = lex(line); } catch { return { mode: 'free' }; }
    return t0[0] && t0[0].v === 'app' && t0.length === 2 ? names([...ICONS]) : { mode: 'free' };
  }
  const indent = line.match(/^ */)[0];
  const body = line.slice(indent.length);
  let toks;
  try { toks = lex(body); } catch { return { mode: 'free' }; }
  if (/"[^"]*$/.test(body.replace(/"(?:[^"\\]|\\.)*"/g, ''))) return { mode: 'free' }; // inside a quoted text
  let scope = scopeAt(done, indent);
  const lp = body.match(/^let [a-z][a-z0-9_]*\(([^)]*)\)/); // a formula's parameters are in scope in its body
  if (lp) {
    const types = { ...scope.types };
    for (const pr of lp[1].split(',')) { const [n, t] = pr.trim().split(' '); if (n) types[n] = env.tables.has(t) ? { t: 'row', table: t } : t; }
    scope = { ...scope, types };
  }
  const last = toks[toks.length - 1];
  const prev = last ? last.v : null;
  const first = toks[0] ? toks[0].v : null;
  const values = Object.keys(scope.types).filter(k => k !== PROBE);
  // nothing yet on the line: a component call, or a text line that starts with a dotted name
  if (!toks.length) {
    const dotted = [...values, ...tables];
    return { mode: 'names', names: [...new Set([...E.defs, ...dotted])], groups: { component: [...E.defs], dotted } };
  }
  // declarations: any new name
  if (['table', 'setting', 'state', 'let', 'def', 'screen', 'as', 'was'].includes(prev)) return { mode: 'free' };
  if (first === 'table' && (prev === ',' || toks.length === 2 || (toks.length === 3 && last.t === 'str'))) return { mode: 'free' };
  if ((first === 'def' || (first === 'let' && body.includes('('))) && (prev === ',' || prev === '(' || (last.t === 'func' && toks.length === 2) || (first === 'def' && toks.length === 2))) return { mode: 'free' };
  if ((first === 'table' || first === 'setting' || first === 'state') && prev === 'ref') return strict(tables);
  if ((first === 'table' || first === 'setting' || first === 'state') && prev !== 'new' && !body.includes('=')) return { mode: 'free' };
  if (first === 'state' && prev === 'new') return strict(tables);
  if (prev === 'options') return strict(tables.filter(t => [...fieldsOf(env, t).values()].some(f => f.type.t === 'pick'))); // only tables with a pick field
  if (prev === 'ref' || prev === 'add') return strict(tables);
  if (prev === 'icon' || (first === 'screen' && last && last.t === 'str' && toks.length === 3)) return strict([...ICONS]);
  if (prev === 'go') return strict([...env.screens.keys()]);
  if (prev === 'save') return strict(E.drafts);
  // the field names of an add: add T f = ..., g = ...
  const depth0 = (() => { let d = 0; for (const t of toks) { if (t.t === 'func' || t.v === '(') d++; else if (t.v === ')') d--; } return d === 0; })();
  const add = depth0 && body.match(/\badd ([a-z][a-z0-9_]*)((?: [a-z][a-z0-9_]* = [^,]*?,)*)( |, )$/);
  if (add && (prev === add[1] || prev === ',')) return strict([...fieldsOf(env, add[1]).keys(), 'at']);
  // the values of a component call: the parameter's kind decides
  const comp = E.defMap.get(first);
  if (comp && (prev === ',' || (toks.length === 1 && /\s$/.test(body)))) {
    const parts = body.slice(first.length).split(',');
    const idx = parts.length - 1;
    const kind = comp.params[idx] && comp.params[idx].kind;
    if (kind === 'table') return strict(tables);
    if (kind === 'name') {
      const ti = comp.params.findIndex(p => p.kind === 'table');
      if (ti >= 0 && ti < idx) return strict([...fieldsOf(env, parts[ti].trim()).keys()]);
      return strict([...env.states.keys(), ...env.settings.keys()]);
    }
    if (kind === 'win' || kind === 'act') return names([]); // only keywords come next (a window, or an action word)
  }
  // after a dot: the parts of what is before it
  const st = lineState(toks, env, scope);
  if (comp && (prev === ',' || toks.length > 1)) { // a component's source value is a query (share spend month by ..., log t where ...)
    const parts = body.slice(first.length).split(',');
    const idx = parts.length - 1;
    const kind = comp.params[idx] && comp.params[idx].kind;
    if (kind === 'src' || kind === 'table') {
      let at; try { at = lex('each ' + parts[idx].trim()); } catch { at = null; }
      if (at) { const q = lineState(at, env, scope); if (q.query && !(at.length === 1)) st.query = q.query; }
    }
  }
  if (comp && !st.foldIt) { // inside a component's values, `it` is the component's item (each day of daybars, each row of trend)
    const parts = body.slice(first.length).split(',');
    const idx = parts.length - 1;
    const srcI = comp.params.findIndex(p => p.kind === 'src' || p.kind === 'win' || p.kind === 'table');
    if (srcI >= 0 && srcI < idx) {
      const k = comp.params[srcI].kind;
      const head = parts[srcI].trim().split(' ')[0];
      if (k === 'win' || head === 'days') st.foldIt = 'date';
      else { const ty = headType(env, scope, head.split('.'), null); if (ty && tname(ty) === 'rows' && !ty.field) st.foldIt = { t: 'row', table: ty.table }; else if (ty && tname(ty) === 'group') st.foldIt = ty; else if (ty && tname(ty) === 'rows' && ty.field === undefined) st.foldIt = { t: 'row', table: ty.table }; }
      if (/\bby\b/.test(parts[srcI])) { const t0 = headType(env, scope, head.split('.'), null); if (t0 && t0.table) st.foldIt = { t: 'group', table: t0.table }; }
    }
  }
  if (prev === '.') {
    let j = toks.length - 1; const path = [];
    while (j > 0 && toks[j].v === '.' && toks[j - 1].t === 'word') { path.unshift(toks[j - 1].v); j -= 2; }
    if (j >= 0 && toks[j].v === '.' && toks[j - 1] && toks[j - 1].v === ')') return strict(funcResultParts(env, scope, toks, j - 1, st));
    if (toks.slice(0, toks.length - 1).some((t, i) => t.v === 'options' && i === toks.length - 3)) return strict([...fieldsOf(env, path[0])].filter(([, f]) => f.type.t === 'pick').map(([k]) => k));
    const ty = headType(env, scope, path, st.foldIt, st.query && st.query.inWhere ? st.query.table : null);
    let ps = ty ? partsOf(env, ty) : [];
    // the source of an each or of a component's src is rows, never a column: only the parts that are rows
    const cArgs = comp ? body.slice(first.length).split(',') : null;
    const cKind = cArgs && comp.params[cArgs.length - 1] && comp.params[cArgs.length - 1].kind;
    const srcHead = (st.query && st.query.atHead && st.depth === 0 && toks.some(t => t.v === 'each')) || ((cKind === 'src' || cKind === 'table') && !/\S\s/.test(cArgs[cArgs.length - 1].trim() + '.'));
    if (srcHead) ps = ps.filter(p => { const t = step(env, ty, p); return t && ((tname(t) === 'rows' && !t.field) || tname(t) === 'group'); });
    return strict(ps);
  }
  // things that are changed or opened
  const itOk = scope.itType || st.foldIt ? ['it'] : [];
  if (TARGETS.has(prev)) return strict([...itOk, ...scope.writable, ...values.filter(v => ['row', 'draft'].includes(tname(scope.types[v]))), ...(scope.itType && ['row'].includes(tname(scope.itType)) ? [] : [])]);
  if (prev === 'edit' || prev === 'remove') return strict([...itOk, 'all', ...scope.writable, ...values.filter(v => ['row', 'group'].includes(tname(scope.types[v])))]);
  if (prev === 'toggle') return names([...scope.writable, ...values, ...tables]);
  if (st.query && st.query.afterBy) return names([...fieldsOf(env, st.query.table).keys()]); // day, week, month are keywords
  if (st.query && st.query.atHead && (AGGS.has(prev) || FOLDS.has(prev) || prev === 'each' || (prev === 'all' && toks[toks.length - 2] && toks[toks.length - 2].v === 'set'))) return names([...tables, ...values]);
  // any formula: your values, tables, option words, and inside where/sort the queried table's fields
  const whereFields = st.query && st.query.inWhere ? [...fieldsOf(env, st.query.table).keys(), 'at', 'id'] : [];
  return names([...whereFields, ...values, ...tables, ...scope.options]);
}

// parts of a function result: last(t).name, random(card).front, nth(t, 1).x
function funcResultParts(env, scope, toks, closeIdx, st) {
  let depth = 0, k = closeIdx;
  for (; k >= 0; k--) { if (toks[k].v === ')') depth++; else if (toks[k].t === 'func' || toks[k].v === '(') { depth--; if (depth === 0) break; } }
  const fn = toks[k] && toks[k].v;
  const path = [];
  for (let i = k + 1; i < closeIdx && (toks[i].t === 'word' || toks[i].v === '.'); i++) if (toks[i].t === 'word') path.push(toks[i].v);
  const ty = headType(env, scope, path, st.foldIt);
  if (!ty || tname(ty) !== 'rows') return [];
  if (ty.field) return tname(ty.ftype) === 'ref' ? partsOf(env, { t: 'ref', table: ty.ftype.table }) : [];
  if (['last(', 'first(', 'nth(', 'random('].includes(fn)) return partsOf(env, { t: 'row', table: ty.table });
  return [];
}

// the allowed completions of the word being typed (text may end in the middle of a word)
export function allowedWords(text) {
  let i = text.length;
  while (i > 0 && WORDCH.test(text[i - 1])) i--;
  const partial = text.slice(i);
  if (/^[0-9]/.test(partial)) return { mode: 'free', partial };
  const ctx = nameContext(text.slice(0, i));
  if (ctx.mode === 'free') return { mode: 'free', partial };
  return { mode: 'names', partial, names: ctx.names.filter(n => n.startsWith(partial)), all: ctx.names };
}

// ---- vocabulary masks ----
// A token is [boundary][word][rest]: a boundary is a leading space or a word-start marker
// (Ġ for GPT-2/Qwen byte BPE, ▁ for SentencePiece); word is [A-Za-z0-9_]*; rest is anything else.
// prepareVocab groups the tokens by boundary and first character, once per vocabulary.
const vocabIndex = new WeakMap();
export function prepareVocab(vocab) {
  if (vocab && vocab.buckets) return vocab;
  if (vocabIndex.has(vocab)) return vocabIndex.get(vocab);
  const n = vocab.length, tokens = new Array(n), buckets = new Map(), byWord = new Map();
  const noWordNoB = new Uint8Array(n), notBoundary = new Uint8Array(n), noWordB = [], dots = [];
  for (let i = 0; i < n; i++) {
    const m = String(vocab[i]).match(/^([ \u0120\u2581]*)([A-Za-z0-9_]*)([\s\S]*)$/);
    const t = tokens[i] = { b: m[1].length > 0, w: m[2], rest: m[3].length > 0 };
    if (!t.b) notBoundary[i] = 1;
    if (!t.w) { if (t.b) noWordB.push(i); else { noWordNoB[i] = 1; if (/^\.(?!\.)/.test(t.rest ? String(vocab[i]) : '')) dots.push(i); } }
    else {
      const k = (t.b ? 'b' : 'n') + (/[0-9]/.test(t.w[0]) ? '0' : t.w[0]); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(i);
      const kw = (t.b ? 'b' : 'n') + t.w; if (!byWord.has(kw)) byWord.set(kw, []); byWord.get(kw).push(i);
    }
  }
  const idx = { tokens, buckets, byWord, noWordNoB, notBoundary, noWordB, dots, size: n };
  vocabIndex.set(vocab, idx);
  return idx;
}
// A mask over the vocabulary: bits[i] = 1 when token i may come next. Iterable like a Set of indices.
export class Mask {
  constructor(bits) { this.bits = bits; }
  has(i) { return this.bits[i] === 1; }
  get size() { let c = 0; for (const b of this.bits) c += b; return c; }
  *[Symbol.iterator]() { const b = this.bits; for (let i = 0; i < b.length; i++) if (b[i]) yield i; }
}
const KW = [...KEYWORDS];
function trieOf(words) {
  const root = { c: new Map(), end: false };
  for (const w of words) { let n = root; for (const ch of w) { if (!n.c.has(ch)) n.c.set(ch, { c: new Map(), end: false }); n = n.c.get(ch); } n.end = true; }
  return root;
}
const walk = (n, s) => { for (const ch of s) { n = n.c.get(ch); if (!n) return null; } return n; };
const trieCache = new Map(); // the same name sets come back again and again
function allowedTrie(a) {
  if (a.mode === 'free') return null;
  const words = a.strict ? (a.all || a.names) : [...(a.all || a.names), ...KW];
  const key = (a.strict ? 's' : 'k') + words.join(',');
  let t = trieCache.get(key);
  if (!t) { if (trieCache.size > 256) trieCache.clear(); t = { trie: trieOf(words), numbers: !a.strict }; trieCache.set(key, t); }
  return t;
}
// add the tokens of one bucket kind ('n' no boundary, 'b' boundary) whose word continues trie node `node`
// Walks the allowed words below `node` and looks every prefix up in the word index, so the cost
// grows with the allowed names, not with the vocabulary.
function addWords(V, bits, kind, node, numbers) {
  const stack = [[node, kind]];
  while (stack.length) {
    const [n, path] = stack.pop();
    for (const [ch, c] of n.c) {
      const p = path + ch, ids = V.byWord.get(p);
      if (ids) for (const i of ids) if (!V.tokens[i].rest || c.end) bits[i] = 1;
      stack.push([c, p]);
    }
  }
  if (numbers) for (const i of V.buckets.get(kind + '0') || []) bits[i] = 1;
}

// The token indices that may come next, as a Mask (has(i), iterable). In a free position every
// token passes (the GBNF decides) except, after a space, tokens that would add a second space.
export function tokenMask(text, vocab) {
  const V = prepareVocab(vocab);
  const now = allowedWords(text);
  const cur = allowedTrie(now);
  const partial = now.partial || '';
  const endsSpace = /\s$/.test(text);
  if (!cur) return new Mask(endsSpace ? V.notBoundary.slice() : new Uint8Array(V.size).fill(1));
  const numericPartial = /^[0-9]/.test(partial);
  const node = numericPartial ? null : walk(cur.trie, partial);
  const complete = partial === '' || numericPartial || !!(node && node.end);
  // tokens without a word end the current word (or do not start one)
  const bits = complete ? V.noWordNoB.slice() : new Uint8Array(V.size);
  // a dot after a name only when something can follow it (a table with no parts cannot take one)
  if (complete && partial && !numericPartial) { const d = allowedWords(text + '.'); if (d.mode === 'names' && !d.all.length) for (const i of V.dots) bits[i] = 0; }
  if (numericPartial) { for (const [k, ids] of V.buckets) if (k[0] === 'n') for (const i of ids) if (/^[0-9]/.test(V.tokens[i].w)) bits[i] = 1; }
  else if (node) addWords(V, bits, 'n', node, partial === '' && cur.numbers);
  // tokens that start a new word (a leading space or marker): only after a complete word, never after a space
  if (complete && !endsSpace) {
    for (const i of V.noWordB) bits[i] = 1;
    const nx = allowedTrie(allowedWords(text + ' '));
    if (!nx) { for (const [k, ids] of V.buckets) if (k[0] === 'b') for (const i of ids) bits[i] = 1; }
    else addWords(V, bits, 'b', nx.trie, nx.numbers);
  }
  return new Mask(bits);
}

// Every name position in a program, with the name written there (for tests and data checks).
export function namePositions(src) {
  const out = [];
  const lines = src.split('\n');
  let before = '';
  for (const line of lines) {
    const re = /[a-z][a-z0-9_]*/g; let m;
    while ((m = re.exec(line))) {
      const pre = line.slice(0, m.index);
      if ((pre.split('"').length - 1) % 2 === 1) continue;     // inside a quoted text
      if (m.index > 0 && WORDCH.test(line[m.index - 1])) continue;
      out.push({ at: before.length + m.index, word: m[0], prefix: before + pre });
    }
    before += line + '\n';
  }
  return out;
}

export { PROBE };
