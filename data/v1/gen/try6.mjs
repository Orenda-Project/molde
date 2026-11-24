import {makeCreate} from './frame.mjs';import {makeEdit} from './edits.mjs';
import {ARCHS} from './archs3.mjs';
const styles=['custom_ui','short','detailed','multi_feature','typos','vague'];
for(const [A,DS] of ARCHS){let n=0,bad=0,eb=0;const errs={};
 for(const d of DS)for(let j=0;j<10;j++){const st=styles[j%6];const x=makeCreate(A,d,st,d.key+j+st);n++;
  if(x.err){bad++;const m=d.key+' '+x.err[0].slice(0,140);errs[m]=(errs[m]||0)+1;continue;}
  if(j<2&&DS.indexOf(d)==1)console.log(st,'|',x.request,'\n'+x.program);
  const e=makeEdit(A,d,d.key+j);if(e&&e.err){eb++;errs['E '+e.op+e.err[0].slice(0,100)]=1;}}
 console.log(A.name,n,bad,eb,Object.keys(errs).slice(0,6));}
