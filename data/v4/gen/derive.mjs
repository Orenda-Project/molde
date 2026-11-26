// derived forms: the `# need:` plan line for creates, the patch-operation answer for edits
import { makeOps, applyOps } from '../../failhunt/tools/patch_ops_ref.mjs';
import { parsePlan, coverage } from '../../failhunt/tools/plan_check.mjs';
export { makeOps, applyOps };
const STOP = new Set('a an the my me i to of for and or is it in on at with that this each every all can you make want need show list log app please'.split(' '));
const stem = w => w.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/(ing|es|s)$/, '');
const toks = s => (s.toLowerCase().match(/[a-z0-9]+/g) || []);
const CONC = [[/chart|graph|bars?\b|trend|line|plot/, 'chart', /^\s*(daybars|bars|trend|heat|share|goalbars|daygrid|weekdots|plot)\b/m], [/goal|target|limit|budget/, 'goal', /^\s*(goal|goalbars|statcard)\b|^setting \w*(goal|target|limit|budget)/m], [/total|sum|how much|altogether/, 'total', /\bsum\(|\bcount\(|^\s*(stat|statcard)\b/m], [/streak|in a row/, 'streak', /\bstreak\(/], [/remind|alert|notify/, 'reminder', /^\s*remind\b/m], [/timer|countdown|stopwatch/, 'timer', /\btimer\b|\bevery\b/], [/calendar/, 'calendar', /\bcalendar\b|\bdaygrid\b/], [/tick|checkbox|done|paid|taken/, 'tick', /\btoggle\b|\bbool\b/], [/quick|button/, 'quick buttons', /^\s*quick\b|\bbutton\b/m], [/average|avg|mean/, 'average', /\bavg\(|\/ max\(count/]];
export function parseTables(program) {
  const out = [];
  for (const l of program.split('\n')) { const m = l.match(/^table (\w+)(?: was \w+)?(?: "[^"]*")?(?: (.*))?$/); if (!m) continue; const fields = []; const rest = m[2] || ''; for (const part of rest.split(/, (?=\w+ (?:text|long|num|money|bool|date|time|when|dur|image|pick|ref)\b)/)) { const f = part.match(/^(\w+) (text|long|num|money|bool|date|time|when|dur|image|pick|ref)\??(?: (.*))?$/); if (!f) continue; const opts = f[2] === 'pick' ? (f[3] || '').split(/ = | "|\s/)[0].split('|').filter(Boolean) : null; fields.push({ name: f[1], type: f[2], opts }); } out.push({ name: m[1], fields }); }
  return out;
}
export function derivePlan(request, program) {
  if (program.startsWith('ask ')) return null;
  const req = request.split('\nQuestion:')[0] + ' ' + (request.split('Answer:')[1] || '');
  const rt = toks(req); const rs = new Set(rt.map(stem)); const items = [];
  const named = w => w.split('_').some(p => p.length > 2 && rs.has(stem(p)));
  const tabs = parseTables(program);
  for (const t of tabs) for (const f of t.fields) { if (f.name === 'at') continue; if (f.opts && f.opts.filter(named).length >= 2) items.push('option ' + f.opts.map(o => o.toLowerCase()).join('/')); else if (named(f.name) && !(f.type === 'ref')) items.push('field ' + f.name); }
  for (const m of program.matchAll(/^setting (\w+)/gm)) if (named(m[1])) items.push('setting ' + m[1]);
  for (const [rx, name, prx] of CONC) if (rx.test(req.toLowerCase()) && prx.test(program) && !items.includes(name)) items.push(name);
  if (!items.length) { const main = tabs[0]; if (main) for (const f of main.fields.filter(f => f.name !== 'at' && f.type !== 'ref').slice(0, 4)) items.push('field ' + f.name); for (const [, name, prx] of CONC) if (prx.test(program) && !items.includes(name)) items.push(name); if (/^\s*(list|each)\b/m.test(program) && !items.includes('list')) items.push('list'); }
  if (!items.length) return null;
  const uniq = [...new Set(items)].slice(0, 9); const line = '# need: ' + uniq.join(', ');
  const p = parsePlan(line); if (!p || coverage(p, program).length) return null;
  return line;
}
export function derivePatch(before, program) {
  if (program.startsWith('ask ')) return { answer: program.trim() };
  const ops = makeOps(before, program); if (applyOps(before, ops) !== (program.endsWith('\n') ? program : program + '\n')) return null; return { answer: ops };
}
