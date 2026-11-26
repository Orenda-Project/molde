// Automatic checks of "did the change do what was asked" (a first pass; the hand rubric in REPORT.md is the judge).
import { parseAppLine, programLines, removedLines, wordsOf } from './rules.mjs';
export const RX = {
  chart: /^\s*(daybars|bars|trend|heat|pie|share|goalbars|daygrid|weekdots|plot)\b/,
  list: /^\s*(list|each)\b/, form: /^\s*(form|topbar|quick)\b/, stat: /^\s*(stat|statcard|goal)\b/, goal: /^\s*(goal|goalbars)\b|^\s*statcard\b.*,\s*\d+\s*$/, section: /^\s*section\b/,
};
const count = (src, rx) => src.split('\n').filter(l => rx.test(l)).length;
const first = (src, rx) => src.split('\n').findIndex(l => rx.test(l));
const aggr = src => (src.match(/\b(sum|count|avg|max|min)\(/g) || []).length;
const tableLine = src => src.split('\n').find(l => /^table\b/.test(l)) || '';
const fieldsOf = l => l.replace(/^table\s+\w+\s*(was\s+\w+\s*)?("[^"]*"\s*)?/, '').split(',').map(s => s.trim()).filter(Boolean);
const norm = s => programLines(s).join('\n');
export const stem = w => w.toLowerCase().replace(/(s|es)$/, '');
export function resolveStep(step, P) {
  const s = { ...step };
  if (s.request.includes('{BTN}')) {
    const m = /^\s*button\s+"([^"]+)"/m.exec(P) || /^\s*topbar\s+\w+,\s*"([^"]+)"/m.exec(P) || /^\s*form\s+\w+,\s*"([^"]+)"/m.exec(P) || /^\s*quick\s+\w+,\s*\w+,\s*\[/m.exec(P) && null;
    // a form / topbar without a caption has the default caption "Add"
    const dflt = !m && /^\s*(form|topbar)\s+\w+\s*$/m.test(P) ? ['', 'Add'] : null;
    const mm = m || dflt;
    if (!mm) return { ...s, na: 'no button label in the program' };
    s.old = mm[1]; s.request = s.request.replace('{BTN}', mm[1]);
  }
  if (s.request.includes('{FIELD}')) {
    const fs = fieldsOf(tableLine(P)); if (!fs.length) return { ...s, na: 'no table' };
    const f = fs[Math.min(1, fs.length - 1)].split(/\s+/)[0]; s.old = f; s.request = s.request.replace('{FIELD}', f.replace(/_/g, ' '));
  }
  if (s.k === 'remove' && !count(P, RX[s.what])) return { ...s, na: `no ${s.what} to remove` };
  if (s.k === 'reorder') { const i = first(P, RX[s.a]), j = first(P, RX[s.b]); if (i < 0 || j < 0) return { ...s, na: 'one of the two parts is missing' }; if (i < j) return { ...s, na: 'already in that order' }; }
  if (s.k === 'addoption' && !/\bpick\b/.test(P)) return { ...s, na: 'no choice field in the program' };
  return s;
}
// returns true/false/null (null = needs the hand judge)
export function did(step, before, after) {
  const hb = parseAppLine(before) || {}, ha = parseAppLine(after) || {};
  const ln = (a, b) => programLines(a).length - programLines(b).length;
  switch (step.k) {
    case 'theme': return ha.theme === step.color || (step.color === 'green' && ha.theme === 'mint');
    case 'dark': return ha.mode === 'dark' || ha.theme === 'ink';
    case 'title': return (ha.title || '') === step.to;
    case 'size': return (ha.size || '') !== (hb.size || '');
    case 'btn': return after.includes(`"${step.to}"`) && !after.includes(`"${step.old}"`);
    case 'addfield': { const a = fieldsOf(tableLine(after)), b = fieldsOf(tableLine(before)); return a.length > b.length && a.some(f => f.toLowerCase().includes(stem(step.word).slice(0, 4)) && !b.includes(f)); }
    case 'addoption': { const w = step.word.toLowerCase(); const hit = l => /\bpick\b|quick/.test(l) && l.toLowerCase().includes(w); return after.split('\n').some(hit) && !before.split('\n').some(hit); }
    case 'remove': return count(after, RX[step.what]) < count(before, RX[step.what]) && removedLines(before, after).length <= Math.max(3, Math.ceil(programLines(before).length * 0.25));
    case 'reorder': { const i = first(after, RX[step.a]), j = first(after, RX[step.b]); return i >= 0 && j >= 0 && i < j && removedLines(before, after).length <= 2; }
    case 'addchart': return count(after, RX.chart) > count(before, RX.chart);
    case 'goalnum': { const vals = s => [...s.matchAll(/^setting \w+ (?:num|money)[^=\n]*= (-?\d+(?:\.\d+)?)/gm)].map(m => +m[1]); const goalArgs = s => [...s.matchAll(/^\s*goal [^\n]*,\s*(\d+)\s*,/gm)].map(m => +m[1]); return [...vals(after), ...goalArgs(after)].includes(step.n) && ![...vals(before), ...goalArgs(before)].includes(step.n); }
    case 'addstat': return count(after, RX.stat) + aggr(after) > count(before, RX.stat) + aggr(before);
    case 'sections': return count(after, RX.section) > count(before, RX.section);
    case 'undo': return step.target != null && norm(after) === norm(step.target);
    case 'vague': return null;
    case 'refuse': return norm(after) === norm(before);
    case 'renamefield': { const t = tableLine(after); return new RegExp(`\\b${step.to}\\b`).test(t) && new RegExp(`${step.to}\\s[^,]*\\bwas\\s+${step.old}\\b`).test(t); }
  }
  return null;
}
export function diffStats(before, after) {
  const b = programLines(before), a = programLines(after);
  const lost = removedLines(before, after), added = removedLines(after, before);
  return { before_lines: b.length, after_lines: a.length, kept_ratio: b.length ? +(1 - lost.length / b.length).toFixed(3) : 1, lost: lost.slice(0, 12), added: added.slice(0, 12), noop: lost.length === 0 && added.length === 0 };
}
export function repeats(program) {
  const ls = program.split('\n').filter(Boolean); let run = 1, maxrun = 1;
  for (let i = 1; i < ls.length; i++) { run = ls[i] === ls[i - 1] ? run + 1 : 1; maxrun = Math.max(maxrun, run); }
  const dupLines = ls.length - new Set(ls).size;
  return { max_run: maxrun, dup_lines: dupLines, loop: maxrun >= 3 || dupLines >= 6 };
}
// must-have tags of a create request (automatic, coarse)
export const NEED = {
  table: p => /^table\b/m.test(p), add: p => /^\s*(form|quick|topbar)\b|\btap add\b|^\s*button\b/m.test(p), list: p => /^\s*(list|each)\b/m.test(p),
  chart: p => RX.chart.test(p) || /^\s*(daybars|bars|trend|heat|pie|share|goalbars|daygrid|weekdots|plot)\b/m.test(p), goal: p => /^\s*(goal|goalbars|statcard)\b|^setting \w*(goal|target|limit|budget)/m.test(p),
  stat: p => /\b(sum|count|avg|max|min)\(|^\s*(stat|statcard|goal)\b/m.test(p), setting: p => /^setting\b/m.test(p), timer: p => /\btimer\b|\bevery\b/.test(p), calendar: p => /\b(calendar|daygrid)\b/.test(p),
  let: p => /^let\b/m.test(p), state: p => /^state\b/m.test(p), pick: p => /\bpick\b/.test(p), money: p => /\bmoney\b/.test(p), date: p => /\bdate\b/.test(p), long: p => /\blong\b/.test(p), image: p => /\bimage\b/.test(p),
};
export const needHits = (program, needs) => needs.map(n => [n, NEED[n] ? NEED[n](program) : null]);
