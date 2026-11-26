// Plan-coverage check: the plan line "# need: a, b/c, d" lists what the request asks for; every item must show up in the program.
// An item may give alternatives with "/". Words are matched on their stem in table, field, setting, label and string names, or through the concept map below.
export const CONCEPT = {
  chart: /^\s*(daybars|bars|trend|heat|pie|share|goalbars|daygrid|weekdots|plot)\b/m, 'bar chart': /^\s*(daybars|bars|goalbars)\b/m, 'line chart': /^\s*trend\b/m, 'heat map': /^\s*(heat|daygrid)\b/m,
  goal: /^\s*(goal|goalbars|statcard)\b|^setting \w*(goal|target|limit|budget)/m, total: /\bsum\(|\bcount\(|^\s*(stat|statcard)\b/m, average: /\bavg\(/, streak: /\bstreak\(/, count: /\bcount\(/,
  list: /^\s*(list|each)\b/m, form: /^\s*(form|topbar|quick)\b/m, reminder: /^\s*remind\b/m, timer: /\btimer\b|\bevery\b/, calendar: /\bcalendar\b|\bdaygrid\b/,
  tick: /\btoggle\b|\bbool\b/, 'quick buttons': /^\s*quick\b|\bbutton\b/m, week: /\bweek\b/, month: /\bmonth\b/, today: /\btoday\b/, picture: /\bimage\b/, date: /\bdate\b/, time: /\btime\b/,
};
const stem = w => w.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/(ing|es|s)$/, '');
export function parsePlan(line) {
  const m = /^#\s*need:\s*(.+)$/i.exec(line.trim()); if (!m) return null;
  return m[1].split(',').map(s => s.trim()).filter(Boolean).map(s => s.split('/').map(x => x.trim().toLowerCase()).filter(Boolean));
}
export function coverage(plan, program) {
  // item grammar: "field NAME" | "setting NAME" | "option A/B/C" (all must appear) | "cannot WHAT" (information, not checked) | concept words ("goal", "total month", "chart week", "list")
  const text = program.toLowerCase(); const idents = [...new Set(text.match(/[a-z0-9_]+/g) || [])];
  const has = w => { const sw = stem(w); return sw.length < 3 || idents.some(i => stem(i).includes(sw) || (sw.length > 3 && stem(i).length > 3 && sw.includes(stem(i)))) || text.includes(sw); };
  const miss = [];
  for (const alts of plan) {
    const first = alts[0].split(/\s+/)[0];
    if (first === 'cannot') continue;
    if (first === 'option') { const all = alts.map((a, k) => (k === 0 ? a.replace(/^option\s+/, '') : a)); if (!all.every(a => has(a))) miss.push(alts.join('/')); continue; }
    const ok = alts.some(a => (CONCEPT[a] && CONCEPT[a].test(program)) || a.split(/\s+/).filter(w => !['field', 'setting', 'of', 'the', 'a'].includes(w)).every(w => (CONCEPT[w] ? CONCEPT[w].test(program) : has(w))));
    if (!ok) miss.push(alts.join('/'));
  }
  return miss;
}
export function splitPlan(src) { const l = src.split('\n'); if (/^#\s*need:/i.test(l[0])) return { plan: parsePlan(l[0]), program: l.slice(1).join('\n') }; return { plan: null, program: src }; }
