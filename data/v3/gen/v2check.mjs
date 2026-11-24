import { readFileSync } from 'node:fs';
import { canon, migrateBatch, LANG_COMMIT, verify, diff } from '../../data-v1/gen/lib.mjs';
const rows = readFileSync('../data-v2/v2.jsonl','utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
const progs=[...new Set(rows.flatMap(r=>r.program_before?[r.program,r.program_before]:[r.program]))];
const mig=migrateBatch(progs); const m=new Map(progs.map((p,i)=>[p,mig[i]]));
let bad=0,changed=0;const why={};
for(const r of rows){const p=canon(m.get(r.program)); if(!p.ok){bad++;const k=p.errors[0].replace(/line \d+: /,'').slice(0,70);why[k]=(why[k]||0)+1;continue;} if(p.text!==r.program)changed++;}
console.log(LANG_COMMIT,rows.length,'bad',bad,'changed',changed,why);
