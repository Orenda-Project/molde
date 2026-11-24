import { rng, canon, diff, cap } from './lib.mjs';
import { assemble, chooseIds, composeRequest, typo, THEMES, THEME_WORDS } from './frame.mjs';

const THEME_REQ = [w => `make it ${w}`, w => `change the colour to ${w}`, w => `I want it ${w}`, w => `${w} theme please`, w => `can it be ${w}?`, w => `switch to a ${w} look`, w => `make the whole thing ${w}`, w => `change the theme to ${w}`];
const NAME_SUFFIX = [n => `My ${n}`, n => `${n} Buddy`, n => `Daily ${n}`, n => `${n} Log`, n => `${n} Pro`, n => `${n} Diary`, n => `Little ${n}`];
const PREFIX = ['', '', '', 'please ', 'can you ', 'now ', 'also ', 'hey, ', 'could you ', 'I think ', ''];

function fin(req, r, noisy) {
  let t = (/^(can|could|please|also|now)\b/i.test(req) ? '' : PREFIX[r.int(0, PREFIX.length - 1)]) + req;
  t = t.charAt(0).toLowerCase() + t.slice(1);
  if (r.chance(0.35)) t = cap(t);
  if (noisy) t = typo(t, r, r.int(1, 3));
  return t.replace(/\s+/g, ' ').trim();
}

// returns {before, after, request, op} or null
export function makeEdit(A, d, seed) {
  const r = rng('edit' + seed);
  const style = 'detailed';
  const spec0 = { arch: A.name, d, style, p: A.params(d, r, style) };
  let ids = chooseIds(A, spec0, 'multi_feature', r).slice(0, r.int(1, 4));
  const needsOk = ids.slice();
  for (const id of ids) { const nd = A.opts[id].needs; if (nd && !ids.includes(nd)) ids.push(nd); }
  const before = { ...spec0, ids, p: { ...spec0.p } };
  const opKinds = ['add', 'add', 'add', 'add', 'add', 'add', 'remove', 'remove', 'theme', 'theme', 'name', 'param', 'param'];
  const op = r.pick(opKinds);
  let after = { ...before, ids: ids.slice(), p: { ...before.p } };
  let request = null, label = op;
  if (op === 'add') {
    const cand = Object.keys(A.opts).filter(id => !ids.includes(id) && (!A.opts[id].only || A.opts[id].only(before)) && !(A.opts[id].excl && ids.some(c => A.opts[c].excl === A.opts[id].excl)) && (!A.opts[id].needs || ids.includes(A.opts[id].needs)) && id !== 'tabs' && id !== 'log');
    const pool = cand.length ? cand : [];
    if (!pool.length) return null;
    const id = r.pick(pool);
    after.ids.push(id);
    const part = A.opts[id].make(after);
    const ph = part.edit && part.edit.length ? r.pick(part.edit) : null;
    if (!ph) return null;
    request = ph; label = 'add:' + id;
  } else if (op === 'remove') {
    const cand = ids.filter(id => (A.opts[id].make(before).rm || []).length && !Object.keys(A.opts).some(o => ids.includes(o) && A.opts[o].needs === id) && !['cat'].includes(id));
    if (!cand.length) return null;
    const id = r.pick(cand);
    after.ids = ids.filter(x => x !== id);
    request = r.pick(A.opts[id].make(before).rm); label = 'remove:' + id;
  } else if (op === 'theme') {
    const t = r.pick(THEMES.filter(x => x !== before.p.theme));
    after.p.theme = t; request = r.pick(THEME_REQ)(r.pick(THEME_WORDS[t])); label = 'theme';
  } else if (op === 'name') {
    const nn = r.pick(NAME_SUFFIX)(d.app); after.p.name = nn;
    request = r.pick([`rename the app to ${nn}`, `call it ${nn}`, `change the name to "${nn}"`, `name it ${nn} instead`]); label = 'rename-app';
  } else {
    const k = A.paramEdit && A.paramEdit(before, after, r);
    if (!k) return null;
    request = k; label = 'param';
  }
  const b = assemble(A, before), a = assemble(A, after);
  const cb = canon(b.text), ca = canon(a.text);
  if (!cb.ok || !ca.ok) return { err: (cb.errors || ca.errors || []).slice(0, 2), op: label, b: b.text, a: a.text };
  if (cb.text === ca.text) return null;
  const v = diff([cb.text], ca.text);
  if (v.verdict === 'refused') return { err: ['diff refused'], op: label };
  const noisy = r.chance(0.18);
  return { task: 'edit', request: fin(request, r, noisy), before: cb.text, program: ca.text, op: label, verdict: v.verdict, style: noisy ? 'typos' : 'plain', domain: d.key, method: 'edit-template:' + A.name };
}
