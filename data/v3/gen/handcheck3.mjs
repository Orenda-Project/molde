// node gen/handcheck3.mjs DIR/ [FILEPREFIX] [--limit=450] [--needs]
import { verify } from '../../data-v1/gen/lib.mjs';
import { tokenCounts } from '../../data-v1/gen/tokcount.mjs';
import { readHand3 } from './hand3.mjs';
const [dir, filt] = process.argv.slice(2).filter(a => !a.startsWith('--')); const limit = Number((process.argv.find(a => a.startsWith('--limit=')) || '--limit=450').slice(8));
const reqNeeds = process.argv.includes('--needs');
const { out, fails } = readHand3(dir.endsWith('/') ? dir : dir + '/', filt);
const tk = tokenCounts(out.map(o => o.program)); let bad = 0;
out.forEach((o, i) => { const v = verify(o.program); const probs = []; if (!v.ok) probs.push('EVAL ' + v.why); if (tk[i] > limit) probs.push('TOKENS ' + tk[i]); if (reqNeeds && (o.needs.length < 3 || o.needs.length > 6)) probs.push('NEEDS count ' + o.needs.length); if (reqNeeds && o.kind !== 'long' && !o.from && !o.request) probs.push('NO REQUEST'); if (probs.length) { bad++; console.log(o.id, probs.join(' ; ')); } });
for (const f of fails) { console.log('FAIL', f.id, '|', f.request || '', '|', f.why); }
console.log(`records=${out.length + fails.length} ok=${out.length - bad} fail=${fails.length + bad}`);
