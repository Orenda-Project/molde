// Validates DATA_SPEC example pairs with the app's checker (vendor/lang at 4698991) and, for edits, the data-safety verdict.
//   node tools/validate_spec.mjs spec_examples.jsonl
import { readFileSync } from 'node:fs';
const APPJS = process.env.APPJS || '/tmp/molde-app/app/js';
const { check } = await import(`${APPJS}/vendor/lang/check.mjs`);
const { load } = await import(`${APPJS}/vendor/lang/eval.mjs`);
const { evolve } = await import(`${APPJS}/vendor/lang/diff.mjs`);
const { prepareEdit } = await import(`${APPJS}/src/edit_prep.mjs`);
const { format } = await import(`${APPJS}/vendor/lang/format.mjs`);
let bad = 0, n = 0;
for (const l of readFileSync(process.argv[2], 'utf8').trim().split('\n')) {
  const r = JSON.parse(l); n++;
  const why = [];
  const c = check(r.program); if (!c.ok) why.push('program: ' + String(c.errors[0]).slice(0, 140));
  if (c.ok) { try { const f = format(r.program); if (f.trim() !== r.program.trim()) why.push('not in formatter form'); } catch (e) { why.push('format threw'); } }
  if (r.before) {
    const cb = check(r.before); if (!cb.ok) why.push('before: ' + String(cb.errors[0]).slice(0, 140));
    if (cb.ok && c.ok) { const a = load(r.before, { now: Date.UTC(2026, 10, 26), currency: 'Rs', tz: 'UTC' }); const prep = prepareEdit(a.source, r.program); const ev = evolve(a.ever, prep.source); if (ev.verdict === 'refused') why.push('edit refused by data rules: ' + (ev.refused || []).join(' ').slice(0, 120)); }
  }
  if (why.length) { bad++; console.log(r.id || n, r.class, '-', why.join(' | ')); }
}
console.log(`${n} examples, ${bad} problems`);
