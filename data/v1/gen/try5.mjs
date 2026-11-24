import {seeds,mutateCreate,mutateEdit} from './mutate.mjs';
const S=seeds();console.log(S.length);let c=0,ce=0,bc=0,be=0;const ex=[];
for(const s of S)for(let n=0;n<4;n++){const x=mutateCreate(s,n);if(x&&!x.err)c++;else if(x)bc++;const y=mutateEdit(s,n);if(y&&!y.err){ce++;if(ex.length<6)ex.push(y.request)}else if(y){be++;if(be<4)console.log(y.err)}}
console.log(c,bc,ce,be,ex);
