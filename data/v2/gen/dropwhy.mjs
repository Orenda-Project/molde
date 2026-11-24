import { readFileSync } from 'node:fs';
import { canon } from '../../data-v1/gen/lib.mjs';
const v1 = readFileSync('../../data-v1/v1.jsonl','utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
const c={};const ex={};
for(const r of v1){const p=canon(r.program);if(!p.ok){const m=p.errors[0].replace(/line \d+: /,'').replace(/"[^"]*"/g,'"X"').slice(0,80);c[m]=(c[m]||0)+1;ex[m]=ex[m]||p.errors[0];}}
console.log(c);
