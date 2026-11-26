#!/usr/bin/env python3
import json,collections
def did(s):
    if s['k']=='renamefield': return bool(s.get('did_raw')) and s.get('applied')
    return s.get('did_final')
def load(f):
    rows=[json.loads(l) for l in open(f)]
    return [r for r in rows if r['type']=='chain' and not r.get('seed_failed')]
R={'r3':load('results/gemma-r3.jsonl'),'r4ep2':load('results/gemma-r4ep2.jsonl')}
kinds=['addfield','addoption','btn','renamefield','remove','reorder','addchart','addstat','sections','goalnum','theme']
print('| edit kind | r3 right / tried | r4 ep2 right / tried | wording sent to the model |')
print('|---|---|---|---|')
for k in kinds:
    out=[]
    for m in ('r3','r4ep2'):
        n=d=0
        for c in R[m]:
            for s in c['steps']:
                if s.get('na') or s['k']!=k or str(s.get('route'))!='model': continue
                n+=1; d+= 1 if did(s) else 0
        out.append(f"{d} / {n}")
    print(f"| {k} | {out[0]} | {out[1]} | model path only |")
for m in R:
    for grp,name in ((False,'short chains (4-30 lines)'),(True,'long programs (40-89 lines)')):
        n=d=noop=chk=blk=dmg=0
        for c in R[m]:
            if bool(c.get('long'))!=grp: continue
            for s in c['steps']:
                if s.get('na') or str(s.get('route'))!='model' or s['k'] in ('vague','refuse','undo'): continue
                n+=1; d+= 1 if did(s) else 0; noop+= 1 if s['outcome']=='noop_unchanged' else 0; chk+= 1 if s['outcome']=='failed_checker' else 0; blk+= 1 if s['outcome'].startswith('blocked') else 0
        print(m,name,'definite model steps',n,'right',d,f'({100*d/n:.0f}%)','unchanged',noop,'checker fail',chk,'blocked by app guards',blk)
# direct path
for m in R:
    n=d=0
    for c in R[m]:
        for s in c['steps']:
            if s.get('na') or str(s.get('route')).startswith('model') or s['k'] not in ('theme','dark','title','size','goalnum'): continue
            n+=1; d+= 1 if did(s) else 0
    print(m,'direct-path steps (colour, dark, title, size, goal "change X to N")',n,'right',d)
# na
for m in R:
    na=collections.Counter(s['k'] for c in R[m] for s in c['steps'] if s.get('na'))
    print(m,'n/a',dict(na))
