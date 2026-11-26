#!/usr/bin/env python3
import json,sys,collections
a_res,a_lab,b_res,b_lab=sys.argv[1:5]
def lab(p):
    L={}
    for l in open(p):
        if l.startswith('#') or not l.strip(): continue
        x=l.split(); L[x[0]]=(int(x[1]),set(x[2:]))
    return L
A=lab(a_lab); B=lab(b_lab)
ids=[k for k in B if k in A]
print('paired ids',len(ids))
def summ(L,ids,name):
    d=collections.Counter(L[k][0] for k in ids); n=len(ids)
    print(f"{name}: strict {d[2]} ({100*d[2]/n:.0f}%), partial {d[1]}, zero {d[0]} ({100*d[0]/n:.0f}%), chk fails {sum(1 for k in ids if 'CHK' in L[k][1])}")
summ(A,ids,'A'); summ(B,ids,'B')
better=sum(1 for k in ids if B[k][0]>A[k][0]); worse=sum(1 for k in ids if B[k][0]<A[k][0]); same=len(ids)-better-worse
print('B better',better,'worse',worse,'same',same)
rows=lambda p:{r['id']:r for r in map(json.loads,open(p)) if r['type']=='create'}
ra,rb=rows(a_res),rows(b_res)
for grp,name in ((lambda r:r.get('cat')=='roman' or r.get('style') in ('mixed','roman'),'roman+mixed'),(lambda r:not (r.get('cat')=='roman' or r.get('style') in ('mixed','roman','unsupported')),'english')):
    s=[k for k in ids if grp(ra[k])]
    if s: summ(A,s,f'  A {name} n={len(s)}'); summ(B,s,f'  B {name}')
