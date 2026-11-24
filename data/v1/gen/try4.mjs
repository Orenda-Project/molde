import {makeEdit} from './edits.mjs';
import * as P1 from './archs1.mjs'; import * as P from './archs2.mjs';
const sets={Q:[P1.Q,P1.QD],B:[P.B,P.BD],C:[P.C,P.CD],D:[P.D,P.DD],E:[P.E,P.ED],F:[P.F,P.FD],G:[P.G,P.GD]};
for(const [k,[A,DS]] of Object.entries(sets)){let n=0,none=0,bad=0;const errs={},ops={};
 for(const d of DS)for(let j=0;j<8;j++){const x=makeEdit(A,d,d.key+j);n++;if(!x){none++;continue;}if(x.err){bad++;const m=x.op+' '+x.err[0].slice(0,100);errs[m]=(errs[m]||0)+1;continue;} ops[x.op.split(':')[0]]=(ops[x.op.split(':')[0]]||0)+1; if(j==0&&DS.indexOf(d)%9==2)console.log(x.op,'|',x.request,x.verdict);}
 console.log(k,n,none,bad,ops,Object.entries(errs).slice(0,5));}
