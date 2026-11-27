// What a program would do as an edit of the running app, without applying it (the page's `evaluate`; also used by the host-side
// measuring tools, which have no DOM).
import { evolve } from '../vendor/lang/diff.mjs';
import { check } from '../vendor/lang/check.mjs';
import { format } from '../vendor/lang/format.mjs';
import { prepareEdit } from './edit_prep.mjs';

// edits to what is drawn (not tables or settings, which the data diff already names), as plain lines
export function uiChanges(oldSrc, newSrc) {
  const lines = s => format(s).split('\n').filter(l => l.trim() && !/^(table|setting)\b/.test(l.trim()));
  const count = xs => xs.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map());
  let a, b;
  try { a = count(lines(oldSrc)); b = count(lines(newSrc)); } catch (e) { return []; }
  const out = [];
  for (const [l, n] of b) for (let i = a.get(l) || 0; i < n; i++) out.push(`adds: ${l.trim()}`);
  for (const [l, n] of a) for (let i = b.get(l) || 0; i < n; i++) out.push(`removes from the screen: ${l.trim()}`);
  return out.slice(0, 40);
}

export function evaluateEdit(app, source) {
  if (!app) return { verdict: 'refused', refused: ['no app is open'], changes: [], warnings: [] };
  const c = check(source);
  if (!c.ok) return { verdict: 'refused', refused: c.errors.map(String), changes: [], warnings: [] };
  const prep = prepareEdit(app.source, source);
  const r = evolve(app.ever, prep.source);
  const ui = uiChanges(app.source, prep.source);
  const sets = prep.settings.map(x => x.text);
  return { verdict: r.verdict, warnings: r.warnings || [], changes: [...sets, ...(r.changes || []).filter(c => !sets.length || !/default|setting/i.test(c)), ...ui], refused: r.refused || [], notes: r.notes || [], settings: prep.settings };
}
