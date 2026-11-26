#!/usr/bin/env python3
"""Edit failure classes over definite-kind model-path steps. python3 tools/edit_taxonomy.py results/x.jsonl"""
import json,sys,collections
rows=[json.loads(l) for l in open(sys.argv[1]) if l.strip()]
ch=[r for r in rows if r['type']=='chain' and not r.get('seed_failed')]
def did(s):
    if s['k']=='renamefield': return bool(s.get('did_raw')) and s.get('applied')
    return s.get('did_final')
cls=collections.Counter(); ex=collections.defaultdict(list); tot=0; good=0
bykind=collections.defaultdict(collections.Counter)
for c in ch:
    prev=c['start']; n0=len([l for l in prev.splitlines() if l.strip()])
    for i,s in enumerate(c['steps']):
        if s.get('na'): continue
        if str(s.get('route'))=='model' and s['k'] not in ('vague','refuse','undo'):
            tot+=1; o=s['outcome']; kr=s['diff_raw']['kept_ratio']
            if did(s): good+=1; k='OK'
            elif o=='noop_unchanged': k='NOOP'
            elif o=='failed_checker': k='CHECKER_FAIL'
            elif o=='model_error': k='NATIVE_HANG'
            elif o=='refused_data': k='DATA_REFUSED'
            elif o.startswith('blocked'):
                k='GUARD_FALSE_POSITIVE' if (s.get('did_raw') and kr>=0.85 and s['k'] in('remove','addfield','addstat','theme')) else ('LONG_PROGRAM_DAMAGE' if c.get('long') else 'COLLATERAL_DAMAGE')
            elif o=='applied': k='APPLIED_WRONG'
            else: k=o
            cls[k]+=1; bykind[s['k']][k]+=1; ex[k].append(f"{c['id']}.{i}")
        if s.get('after'): prev=s['after']
print('model-path definite steps',tot,'ok',good,f'{100*good/tot:.1f}%')
for k,n in cls.most_common(): print(f"{k:22}{n:4} {100*n/tot:5.1f}%  {' '.join(ex[k][:6])}")
print('per kind:')
for k,b in sorted(bykind.items()): print(f"  {k:12}",dict(b.most_common()))
