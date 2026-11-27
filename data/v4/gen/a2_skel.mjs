// a2: skeleton cap check over all a2 creates (reads out/hand_creates.jsonl rows whose id0/domain starts with a2-)
import { readFileSync } from 'node:fs';
import { skeleton } from '../../failhunt/tools/skeleton_check.mjs';
const CAP = +(process.env.CAP || 2);
const rows = readFileSync('out/hand_creates.jsonl','utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l)).filter(r=>/^a2-/.test(r.meta.domain)&&!r.program.startsWith('ask '));
const g = new Map(); for (const r of rows){const k=skeleton(r.program); if(!g.has(k))g.set(k,[]); g.get(k).push(r.meta.domain);}
let bad=0; for (const [k,v] of g) if (v.length>CAP){bad++; console.log('OVER x'+v.length, v.join(' '));}
console.log(rows.length,'programs',g.size,'skeletons',bad,'over cap',CAP);
