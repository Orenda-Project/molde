import {makeCreate} from './frame.mjs';
import * as P from './archs2.mjs';
let k=0;for(const d of P.FD) for(let j=0;j<10;j++){const st=['short','vague','detailed','multi_feature','typos'][j%5];const x=makeCreate(P.F,d,st,d.key+j+st);if(x.err&&k++<2)console.log(x.err[0],'\n'+x.text);}
