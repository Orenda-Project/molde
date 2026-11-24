import {makeCreate} from './frame.mjs';
import {Q,QD} from './archs1.mjs';
const styles=['short','vague','detailed','multi_feature','typos'];
for(const d of QD) for(let k=0;k<8;k++){const st=styles[k%5];const x=makeCreate(Q,d,st,d.key+k+st);
 if(x.err){console.log(d.key,x.err[0]);}}
