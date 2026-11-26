// Every forced step's target must exist in its program, exactly once, and the start state must not already satisfy the request.
//   node tools/check_forced.mjs controls/forced_cases.jsonl        exit 1 on any step that fails
import { readFileSync } from 'node:fs';
const P = await import('./preds.mjs');
let bad = 0, n = 0;
const numEls = L => L.filter(l => (P.RX.stat.test(l) && !/^\s/.test(l)) || /^"[^"]*"\s+(sum|count|avg|last)\(.*\s(big|head)$/.test(l) || /^(sum|count|avg|last)\(.*\s(big|head)$/.test(l));
for (const l of readFileSync(process.argv[2], 'utf8').trim().split('\n')) {
  const c = JSON.parse(l); n++; const st = c.step, p = c.before, L = p.trimEnd().split('\n'); const why = [];
  if (st.k === 'addoption') { if (!L.some(x => /^table .*\bpick\b/.test(x))) why.push('no choice field'); if (p.toLowerCase().includes(st.word.toLowerCase())) why.push('option already there'); }
  else if (st.k === 'btn') { if (p.split('"' + st.old + '"').length !== 2) why.push('button label is not unique'); if (!c.step.request.includes(st.old)) why.push('request does not name the button'); }
  else if (st.k === 'remove') {
    if (st.what === 'stat' || st.what === 'goal') { const e = numEls(L); if (e.length !== 1) why.push('number elements: ' + e.length); if (/total/i.test(st.request)) why.push('request says "total" but the referent is a generic number element'); if (st.what === 'goal' && !/^\s*goal\b/.test(e[0] || '')) why.push('the only number element is not a goal'); }
    else if (L.filter(x => P.RX[st.what].test(x) && !/^\s/.test(x)).length !== 1) why.push(st.what + ' lines: not exactly one');
  } else if (st.k === 'reorder') { const i = L.findIndex(x => P.RX[st.a].test(x)), j = L.findIndex(x => P.RX[st.b].test(x)); if (i < 0 || j < 0) why.push('a part is missing'); else if (i < j) why.push('already in that order'); }
  if (why.length) { bad++; console.log('BAD', c.id, JSON.stringify(st.request), '-', why.join('; ')); }
}
console.log(n, 'steps checked,', bad, 'with a missing or ambiguous target'); process.exit(bad ? 1 : 0);
