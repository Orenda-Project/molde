// c2_review.mjs: print N random rows per kind for the human check.  node gen/c2_review.mjs [file] [perKind] [seed]
import { readFileSync } from 'node:fs';
import { rng } from '../../data-v1/gen/lib.mjs';
const f = process.argv[2] || 'out/c2_rows.jsonl', n = +(process.argv[3] || 10), r = rng(process.argv[4] || 'review1');
const rows = readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const by = {}; for (const x of rows) (by[x.class] ||= []).push(x);
const skip = new Set((process.argv[5] || '').split(',').filter(Boolean));
for (const k of Object.keys(by).sort()) {
  console.log(`\n######## ${k} (${by[k].length})`);
  for (const x of r.shuffle(by[k]).filter(x => !skip.has(x.id)).slice(0, n)) {
    const B = x.program_before.split('\n'), A = x.program.split('\n');
    console.log(`--- ${x.id} [${x.meta.sub}${x.meta.long ? ', long' : ''}, ${B.length - 1} lines]`);
    console.log('REQ: ' + x.request);
    console.log('ANS: ' + x.answer.split('\n').join('\n     '));
    if (x.answer === 'none') console.log('(program unchanged)');
    console.log('CONTEXT: ' + B[0] + ' ... ' + B.slice(1, 4).join(' / ').slice(0, 160));
  }
}
