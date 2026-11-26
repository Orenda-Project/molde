// JS port of app/lib/src/rules.dart (app 0.6.1, branch phase-5-app): the pure rules the Flutter controller applies around the model.
// Ported by hand, line by line, so the harness can run the app's exact pre- and post-model steps. Keep in sync with rules.dart.
export const kFiller = new Set(['a', 'an', 'the', 'my', 'me', 'make', 'build', 'create', 'new', 'app', 'apps', 'please', 'simple', 'some', 'for', 'of', 'and', 'with', 'to', 'i', 'want', 'need', 'can', 'you', 'do', 'it', 'this', 'that', 'something', 'anything', 'stuff', 'thing', 'things', 'tool', 'give', 'get', 'help', 'is', 'be', 'have', 'like', 'just', 'one', 'on', 'in', 'up']);
export const wordsOf = t => (String(t).toLowerCase().match(/[a-z0-9]+/g) || []);
export const namesAThing = r => { const w = wordsOf(r); return w.length > 0 && w.length <= 14 && w.some(x => !kFiller.has(x)); };
export const bareNounPhrase = r => { const w = wordsOf(r); return w.length > 0 && w.length <= 3 && w.some(x => !kFiller.has(x)); };

export function appNames(source) {
  const out = new Set();
  const tm = /^app "([^"]*)"/m.exec(source);
  if (tm) wordsOf(tm[1]).forEach(w => out.add(w));
  for (const l of source.split('\n')) {
    const t = l.trim();
    if (/^(table|setting|state|let)\b/.test(t)) wordsOf(t.split('"')[0]).forEach(w => out.add(w));
  }
  const skip = new Set(['table', 'setting', 'state', 'let', 'num', 'text', 'date', 'time', 'bool', 'pick', 'money', 'long', 'unit', 'ref', 'set', 'when', 'dur', 'image', 'the', 'and']);
  return new Set([...out].filter(w => w.length >= 3 && !skip.has(w)));
}
export const kChangeVerbs = /^\s*(?:please\s+|can you\s+|could you\s+)?(?:change|rename|make(?!\s+(?:me|a|an|another|new)\b)|add|remove|delete|drop|hide|show|set|move|bigger|smaller|larger|turn|put|use|switch|update|increase|decrease|swap|replace|sort|reorder|let me|i want it|call it|tidy|clean|simplify|fix|improve|rearrange|group|split|merge|shorten|rewrite|translate|tweak|adjust|count|track more|stop|start|keep|allow|display|list the|give it|can it|also)\b/i;
export const startsWithChangeVerb = r => kChangeVerbs.test(r);
export function looksLikeNewApp(request, currentSource) {
  const r = request.trim().toLowerCase();
  if (!r || startsWithChangeVerb(r)) return false;
  const names = appNames(currentSource);
  if (wordsOf(r).some(w => names.has(w))) return false;
  const start = /^(please\s+)?(a|an|make me|make|build|create|i want|i need|give me|new|another)\b/;
  const kind = /\b(app|tracker|list|log|counter|timer|planner|diary|journal|calculator|scoreboard|checklist|notebook)\b/;
  if (start.test(r) && kind.test(r)) return true;
  return bareNounPhrase(r);
}

export const kAccents = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'grey'];
export const kOldThemes = ['ocean', 'mint', 'slate', 'ink', 'plum'];
export const kSizes = ['small', 'large', 'huge'];

export function parseAppLine(source) {
  const first = source.split('\n').find(l => l.startsWith('app ')) || '';
  const m = /^app\s+("[^"]*")((?:\s+\w+)*)\s*$/.exec(first);
  if (!m) return null;
  let icon = null, theme = null, mode = null, size = null;
  for (const t of m[2].trim().split(/\s+/).filter(Boolean)) {
    if (kAccents.includes(t) || kOldThemes.includes(t)) theme = t;
    else if (t === 'dark' || t === 'light') mode = t;
    else if (kSizes.includes(t)) size = t;
    else icon = t;
  }
  const a = { name: m[1], icon, theme, mode, size, get title() { return this.name.length >= 2 ? this.name.slice(1, -1) : this.name; } };
  a.toString = () => `app ${a.name}${a.icon ? ' ' + a.icon : ''}${a.theme ? ' ' + a.theme : ''}${a.mode ? ' ' + a.mode : ''}${a.size ? ' ' + a.size : ''}`;
  return a;
}
const replaceAppLine = (source, a) => { const lines = source.split('\n'); const i = lines.findIndex(l => l.startsWith('app ')); lines[i] = a.toString(); return lines.join('\n'); };

// returns { program, label, unchanged } or null
export function appLineEdit(request, source) {
  const r = request.trim();
  if (!r) return null;
  const a = parseAppLine(source);
  if (!a) return null;
  const low = r.toLowerCase(), w = wordsOf(low);
  const rn = /^(?:please\s+)?(?:(?:change|set|make|update)\s+(?:the\s+)?(?:title|name)(?:\s+of\s+(?:the\s+|this\s+)?app)?\s+(?:to|as)|rename\s+(?:the\s+app\s+|this\s+app\s+|it\s+|the\s+title\s+)?(?:to|as)?|call\s+it)\s+(.+?)\s*$/i.exec(r);
  if (rn) {
    const t = rn[1].replace(/"/g, '').replace(/[.!]+$/, '').trim();
    if (!t || t.length > 40) return null;
    const same = t === a.title; a.name = `"${t}"`;
    return { program: replaceAppLine(source, a), label: `title is now ${t}`, unchanged: same };
  }
  if (w.length > 6) return null;
  const verbs = new Set(['make', 'change', 'set', 'turn', 'use', 'switch', 'paint', 'go', 'put', 'give', 'me', 'it', 'the', 'app', 'this', 'to', 'in', 'colour', 'color', 'theme', 'please', 'a', 'be', 'mode', 'text', 'font', 'screen', 'much', 'bit', 'little', 'size', 'bigger', 'larger', 'smaller', 'everything', 'my']);
  const colour = [...kAccents, ...kOldThemes].filter(c => w.includes(c));
  if (colour.length === 1 && w.every(x => verbs.has(x) || colour.includes(x) || x === 'dark' || x === 'light')) {
    const c = colour[0]; const same = a.theme === c; a.theme = c;
    return { program: replaceAppLine(source, a), label: c, unchanged: same };
  }
  const wantsDark = w.includes('dark') || w.includes('night');
  const wantsLight = (w.includes('light') && (w.includes('mode') || w.includes('theme'))) || w.includes('bright');
  if ((wantsDark !== wantsLight) && w.every(x => verbs.has(x) || ['dark', 'night', 'light', 'bright', 'mode', 'theme'].includes(x))) {
    const m = wantsDark ? 'dark' : 'light'; const same = a.mode === m; a.mode = m; a.theme = a.theme || 'mint';
    return { program: replaceAppLine(source, a), label: `${m} mode`, unchanged: same };
  }
  const bigger = w.includes('bigger') || w.includes('larger') || w.includes('increase');
  const smaller = w.includes('smaller') || w.includes('decrease');
  if ((bigger !== smaller) && w.every(x => verbs.has(x) || ['bigger', 'larger', 'smaller', 'increase', 'decrease', 'text', 'font', 'size', 'words', 'letters', 'writing'].includes(x))) {
    const order = ['small', 'normal', 'large', 'huge'];
    const cur = order.indexOf(a.size || 'normal');
    const next = Math.max(0, Math.min(3, cur + (bigger ? 1 : -1)));
    const s = order[next]; a.size = s === 'normal' ? null : s;
    return { program: replaceAppLine(source, a), label: bigger ? 'bigger text' : 'smaller text', unchanged: next === cur };
  }
  return null;
}

export function settingEditProgram(request, source) {
  const m = /^\s*(?:please\s+)?(?:change|set|make|update|put)\s+(?:the\s+|my\s+)?(.+?)\s+(?:to|=|as|at)\s+(-?[0-9][0-9,]*(?:\.[0-9]+)?)\s*$/i.exec(request);
  if (!m) return null;
  const target = wordsOf(m[1]).filter(w => !kFiller.has(w));
  if (!target.length) return null;
  const value = m[2].replace(/,/g, '');
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const sm = /^(\s*setting\s+)(\w+)(\s+(?:num|money)\b[^=\n]*=\s*)(-?[0-9][0-9.]*)(.*)$/.exec(lines[i]);
    if (!sm) continue;
    const q = lines[i].split('"');
    const ws = new Set([...wordsOf(sm[2]), ...wordsOf(q.length > 1 ? q[1] : '')]);
    if (target.every(t => ws.has(t))) {
      if (sm[4] === value) return source;
      lines[i] = `${sm[1]}${sm[2]}${sm[3]}${value}${sm[5]}`;
      return lines.join('\n');
    }
  }
  return null;
}

export const kRemovalWords = /\b(remove|delete|drop|hide|without|get rid)\b/i;
export const programLines = src => src.split('\n').map(l => l.trimEnd()).filter(l => l.trim());
export function removedLines(oldSrc, newSrc) {
  const have = new Map();
  for (const l of programLines(newSrc)) have.set(l, (have.get(l) || 0) + 1);
  const out = [];
  for (const l of programLines(oldSrc)) { const n = have.get(l) || 0; if (n > 0) have.set(l, n - 1); else out.push(l); }
  return out;
}
export function lineSignature(l) {
  const line = l.trim();
  if (line.startsWith('"')) { const end = line.indexOf('"', 1); const rest = end < 0 ? '' : line.slice(end + 1).trim(); return 'text ' + rest.split(/\s+/)[0]; }
  return line.split(/\s+/).slice(0, 2).join(' ');
}
export function dropsUnasked(request, oldSrc, newSrc) {
  const newSigs = new Set(programLines(newSrc).map(lineSignature));
  const newLines = new Set(programLines(newSrc));
  const asked = new Set(wordsOf(request).filter(w => !kFiller.has(w) && w.length > 2));
  const out = [];
  for (const l of programLines(oldSrc)) {
    if (l.startsWith('app ') || newLines.has(l) || newSigs.has(lineSignature(l))) continue;
    if (wordsOf(l).some(w => asked.has(w))) continue;
    out.push(l.trim());
  }
  return out;
}

// titles for creates
export function betterTitle(program, request) {
  const a = parseAppLine(program); if (!a) return null;
  const t = a.title.trim();
  const bad = t.includes('?') || t.endsWith('.') || t.split(/\s+/).length > 5 || !t;
  if (!bad) return null;
  const main = wordsOf(request).filter(x => !kFiller.has(x));
  const pick = main.slice(0, 2); if (!pick.length) return null;
  const title = pick.join(' '); return title[0].toUpperCase() + title.slice(1);
}
export function withTitle(program, title) {
  const a = parseAppLine(program); if (!a) return program;
  a.name = `"${title.replace(/"/g, '')}"`;
  const lines = program.split('\n'); const i = lines.findIndex(l => l.startsWith('app ')); lines[i] = a.toString(); return lines.join('\n');
}
