#!/usr/bin/env python3
"""Applied model steps in which a line of an untouched kind was rewritten in place (guards said safe). python3 tools/silent_rewrite.py results/gemma-r3.jsonl"""
import json,sys,collections
def sig(l):
    t=l.strip()
    if t.startswith('"'):
        e=t.find('"',1); return 'text '+(t[e+1:].strip().split(' ')[0] if e>0 else '')
    return ' '.join(t.split()[:2])
rows=[json.loads(l) for l in open(sys.argv[1])]; ch=[r for r in rows if r['type']=='chain' and not r.get('seed_failed')]
n=0; hits=[]
for c in ch:
    prev=c['start']
    for i,s in enumerate(c['steps']):
        if s.get('na'): continue
        if str(s.get('route'))=='model' and s.get('outcome') in ('applied','applied_after_warning') and s.get('raw'):
            n+=1
            b=[l.rstrip() for l in prev.split('\n') if l.strip()]; a=[l.rstrip() for l in s['raw'].split('\n') if l.strip()]
            asig=collections.defaultdict(list)
            for l in a: asig[sig(l)].append(l)
            ch_=[l for l in b if l not in a and not l.startswith(('app ','table ','setting ')) and sig(l) in asig and l not in asig[sig(l)]]
            if ch_ and s['k'] not in ('sections','btn','reorder','renamefield','theme','goalnum'): hits.append((c['id'],i,s['k'],s['request'],ch_[0][:70]))
        if s.get('after'): prev=s['after']
print(sys.argv[1],'applied model steps',n,'silently rewritten untouched line',len(hits))
for h in hits: print('  ',h)
