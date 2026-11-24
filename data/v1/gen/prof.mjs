import { verify, canon } from './lib.mjs';
import { readFileSync } from 'node:fs';
const rows = readFileSync('../out/stageA.jsonl','utf8').split('\n').filter(Boolean).slice(0,200).map(l=>JSON.parse(l));
let t=Date.now(); for(const r of rows) canon(r.program); console.log('canon',Date.now()-t);
t=Date.now(); for(const r of rows) verify(r.program); console.log('verify',Date.now()-t);
