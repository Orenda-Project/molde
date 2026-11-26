#!/usr/bin/env python3
import json,sys,collections
res=sys.argv[1]; lab=sys.argv[2]
rows={r['id']:r for r in map(json.loads,open(res)) if r['type']=='create'}
L={}
for l in open(lab):
    if l.startswith('#') or not l.strip(): continue
    p=l.split(); L[p[0]]=(int(p[1]),p[2:])
print('labeled',len(L),'of',len(rows))
d=collections.Counter(v[0] for v in L.values()); n=len(L)
print('did=2 strict',d[2],f'{100*d[2]/n:.1f}%','did>=1',d[1]+d[2],f'{100*(d[1]+d[2])/n:.1f}%','did=0',d[0])
tags=collections.Counter(); tag0=collections.Counter()
for k,(v,t) in L.items():
    for x in t:
        tags[x]+=1
        if v<2: tag0[x]+=1
print('tags',dict(tags.most_common()))
sty=collections.defaultdict(lambda:collections.Counter())
for k,(v,t) in L.items():
    s=rows[k]['style']; sty[s][v]+=1
for s,c in sty.items(): m=sum(c.values()); print(f"  {s:12} n={m:3} strict {100*c[2]/m:4.0f}%  >=1 {100*(c[1]+c[2])/m:4.0f}%  zero {100*c[0]/m:4.0f}%")
# of built (checker pass) apps
built=[k for k in L if rows[k]['ok']]
db=collections.Counter(L[k][0] for k in built)
print('among built',len(built),'strict',f"{100*db[2]/len(built):.1f}%",'>=1',f"{100*(db[1]+db[2])/len(built):.1f}%")
