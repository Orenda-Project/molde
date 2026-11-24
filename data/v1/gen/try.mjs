import {makeCreate} from './frame.mjs';
import * as P from './archs2.mjs';
const styles=['short','vague','detailed','multi_feature','typos'];
const which=process.argv[2]; const print=+process.argv[3]||0;
const sets={B:[P.B,P.BD],C:[P.C,P.CD],D:[P.D,P.DD],E:[P.E,P.ED],F:[P.F,P.FD],G:[P.G,P.GD]};
for(const [k,[A,DS]] of Object.entries(sets)){ if(which&&which!==k)continue;
 let bad=0,n=0;const errs={};
 for(const d of DS) for(let j=0;j<10;j++){const st=styles[j%5];const x=makeCreate(A,d,st,d.key+j+st);n++;
  if(x.err){bad++; const m=d.key+' '+x.err[0].replace(/line (\d+): /,'L$1 ').slice(0,130); errs[m]=(errs[m]||0)+1; continue;}
  if(print&&j<print&&DS.indexOf(d)%7==1)console.log(st,'|',x.request,'\n'+x.program);}
 console.log(k,n,bad,Object.entries(errs).slice(0,8));}
