// Setting-only changes: a stored setting value beats a new default, so an edit that changes a setting's
// default must say `set` on that line (SPEC: `setting target num = 100 set`) or nothing visible happens.
// prepareEdit adds the `set` before the edit is applied and names what changed ("Goal is now 3000").
import { check } from '../vendor/lang/check.mjs';

const settingsOf = src => {
  const c = check(src);
  const out = new Map();
  if (c.ast && c.ast.body) for (const s of c.ast.body) if (s.kind === 'setting') out.set(s.name, s);
  return out;
};
const valueText = s => {
  const m = /^\s*setting\s+\S+\s+.*?=\s*(.+?)(?:\s+"[^"]*")?(?:\s+set)?\s*$/.exec(s.src || '');
  if (m) return m[1].replace(/\s+unit\s+"[^"]*"$/, '').trim();
  const d = s.dflt; return d && d.v !== undefined ? String(d.v) : '';
};
export const nice = name => { const t = name.replace(/_/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1); };

export function prepareEdit(oldSrc, newSrc) {
  let oldS, newS;
  try { oldS = settingsOf(oldSrc); newS = settingsOf(newSrc); } catch (e) { return { source: newSrc, settings: [] }; }
  const changed = [];
  for (const [name, n] of newS) {
    const o = oldS.get(name);
    if (!o || !n.dflt || !o.dflt) continue;
    if (JSON.stringify(o.dflt) === JSON.stringify(n.dflt)) continue;
    changed.push({ name, from: valueText(o), to: valueText(n), force: n.force });
  }
  if (!changed.length) return { source: newSrc, settings: [] };
  const lines = newSrc.split('\n');
  for (const c of changed) {
    if (c.force) continue;
    const i = lines.findIndex(l => new RegExp('^\\s*setting\\s+' + c.name + '\\s').test(l));
    if (i >= 0 && !/\sset\s*$/.test(lines[i])) lines[i] = lines[i].replace(/\s+$/, '') + ' set';
  }
  return { source: lines.join('\n'), settings: changed.map(c => ({ name: c.name, from: c.from, to: c.to, text: `${nice(c.name)} is now ${c.to}` })) };
}
