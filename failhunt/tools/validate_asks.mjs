// Ask pairs in edits must (1) be one valid ask line, (2) leave the program untouched by construction (the app keeps `before`), and
// (3) each have follow-up rows under the same request and the same program whose "Question:" is the ask's question and whose "Answer:" is one of its choices.
import { readFileSync } from 'node:fs';
const APPJS = process.env.APPJS || '/tmp/molde-app/app/js';
const { check } = await import(`${APPJS}/vendor/lang/check.mjs`);
const rows = readFileSync(process.argv[2], 'utf8').trim().split('\n').map(l => JSON.parse(l));
let bad = 0;
for (const a of rows.filter(r => r.kind === 'edit_ask')) {
  const c = check(a.program); const h = c.ast && c.ast.header; const why = [];
  if (!c.ok || !h || h.kind !== 'ask') why.push('not an ask line');
  const q = h && h.question, opts = (h && h.options) || [];
  // what the app does with an ask result in an edit (controller.dart _afterGenerate): pendingAsk, nothing applied
  const appResult = (h && h.kind === 'ask') ? a.before : a.program; if (appResult !== a.before) why.push('the app would not keep the program');
  const fu = rows.filter(r => r.kind === 'edit' && r.request.startsWith(a.request + '\nQuestion: ') && r.before === a.before);
  const answers = fu.map(r => (/\nAnswer: (.*)$/.exec(r.request) || [])[1]); const qs = fu.map(r => (/\nQuestion: (.*)\nAnswer:/.exec(r.request) || [])[1]);
  if (!fu.length) why.push('no follow-up rows');
  for (const x of qs) if (x !== q) why.push('follow-up question differs from the ask');
  for (const x of answers) if (!opts.includes(x)) why.push('follow-up answer "' + x + '" is not one of the choices');
  const declines = opts.filter(o => !answers.includes(o)); 
  console.log(a.id, why.length ? 'PROBLEM ' + why.join('; ') : 'ok', '| choices', opts.length, '| follow-ups for', answers.length, '| not covered (decline or "leave it"):', JSON.stringify(declines));
  if (why.length) bad++;
}
console.log(bad ? bad + ' problems' : 'ask pairs ok'); process.exit(bad ? 1 : 0);
