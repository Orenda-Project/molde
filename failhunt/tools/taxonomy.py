#!/usr/bin/env python3
"""Failure classes with counts. python3 tools/taxonomy.py results/gemma-r3.jsonl labels/gemma-r3-creates.txt"""
import json,sys,collections
res,lab=sys.argv[1],sys.argv[2]
rows=[json.loads(l) for l in open(res) if l.strip()]
cr={r['id']:r for r in rows if r['type']=='create'}
L={}
for l in open(lab):
    if l.startswith('#') or not l.strip(): continue
    p=l.split(); L[p[0]]=(int(p[1]),set(p[2:]))
def primary(k):
    did,t=L[k]; r=cr[k]
    if did==2: return None
    if 'CHK' in t: return 'CHK_LOOP' if 'LOOP' in t else 'CHK_FAIL'
    if 'UNSUP' in t: return 'UNSUPPORTED_FAKED'
    if 'ROMAN' in t and did==0: return 'ROMAN_DRIFT'
    if 'TYPO' in t and did==0: return 'TYPO_DRIFT'
    if 'TOPIC' in t and did==0: return 'TOPIC_DRIFT'
    if 'LEAK' in t: return 'LABEL_LEAK'
    if 'SEM' in t: return 'SEMANTIC_NONSENSE'
    if 'MISS' in t: return 'MISSES_SPECIFIC'
    if 'THIN' in t: return 'TOO_THIN'
    if 'NUM' in t: return 'ABSURD_NUMBER'
    if 'ROMAN' in t: return 'ROMAN_PARTIAL'
    if 'GENERIC' in t: return 'GENERIC_SKELETON'
    return 'OTHER'
c=collections.Counter(); harm=collections.Counter(); ex=collections.defaultdict(list)
for k in L:
    p=primary(k)
    if not p: continue
    c[p]+=1; harm[p]+= 2 if L[k][0]==0 else 1; ex[p].append(k)
print(f"{'class':22}{'n':>4}{'zero':>5}{'part':>5}{'freq*harm':>10}  examples")
for p,n in sorted(c.items(), key=lambda x:-harm[x[0]]):
    z=sum(1 for k in ex[p] if L[k][0]==0)
    print(f"{p:22}{n:4}{z:5}{n-z:5}{harm[p]:10}  {' '.join(ex[p][:6])}")
# any-tag counts
tags=collections.Counter(t for k in L for t in L[k][1] if L[k][0]<2)
print('any-tag (a case can carry several):',dict(tags.most_common()))
# checker errors detail
fe=collections.Counter(cr[k].get('first_err') for k in L if 'CHK' in L[k][1])
print('checker first errors:',dict(fe.most_common()))
# roman overall
ro=[k for k in L if cr[k].get('cat')=='roman' or cr[k].get('style') in ('mixed','roman')]
d=collections.Counter(L[k][0] for k in ro)
print('roman+mixed requests',len(ro),'strict',d[2],'partial',d[1],'zero',d[0],'checker pass',sum(1 for k in ro if cr[k]['ok']))
en=[k for k in L if cr[k].get('cat')!='roman' and cr[k].get('style') not in ('mixed','roman','unsupported')]
d=collections.Counter(L[k][0] for k in en)
print('english-only (excl unsupported)',len(en),'strict',d[2],'partial',d[1],'zero',d[0],'checker pass',sum(1 for k in en if cr[k]['ok']))
