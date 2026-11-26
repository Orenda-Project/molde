#!/usr/bin/env python3
"""Aggregate numbers from results/<label>.jsonl. python3 tools/analyze.py results/gemma-r3.jsonl [...]"""
import json, sys, collections, statistics as st
def load(p): return [json.loads(l) for l in open(p) if l.strip()]
def pct(a, b): return f"{100*a/b:.1f}%" if b else "-"
def med(x): x=[v for v in x if v is not None]; return round(st.median(x),2) if x else None
for p in sys.argv[1:]:
    rows = load(p); cr = [r for r in rows if r['type']=='create']; ch = [r for r in rows if r['type']=='chain']
    print('=====', p, 'creates', len(cr), 'chains', len(ch))
    n=len(cr); ok=sum(1 for r in cr if r.get('ok')); loads=sum(1 for r in cr if r.get('loads',{}).get('ok'))
    asked=sum(1 for r in cr if r.get('asked')); loop=sum(1 for r in cr if r.get('rep',{}).get('loop'))
    print(f"create: checker pass {ok}/{n} {pct(ok,n)}; loads {loads}; asked {asked} {pct(asked,n)}; loops {loop}; median tokens {med([r.get('tokens') for r in cr])}; median s {med([r.get('seconds') for r in cr])}; median lines {med([r.get('lines') for r in cr if r.get('ok')])}")
    errs = collections.Counter(r.get('first_err') or ('ASK' if r.get('asked') else 'none') for r in cr if not r.get('ok'))
    print(' first errors of failed creates:', dict(errs.most_common()))
    bystyle = collections.defaultdict(lambda:[0,0])
    for r in cr: bystyle[r.get('style')][1]+=1; bystyle[r.get('style')][0]+= 1 if r.get('ok') else 0
    print(' pass by style:', {k:f"{a}/{b}" for k,(a,b) in bystyle.items()})
    hits=collections.defaultdict(lambda:[0,0])
    for r in cr:
        if r.get('ok'):
            for n_,h in r.get('needs',[]): hits[n_][1]+=1; hits[n_][0]+= 1 if h else 0
    print(' need present (built apps):', {k:pct(a,b) for k,(a,b) in hits.items()})
    allneeds=sum(1 for r in cr if r.get('ok') and r.get('needs') and all(h for _,h in r['needs']))
    print(f" all coarse needs present: {allneeds}/{ok}")
    # chains
    steps=[(c,s) for c in ch if not c.get('seed_failed') for s in c['steps']]
    print('chains run', sum(1 for c in ch if not c.get('seed_failed')), 'seed failed', sum(1 for c in ch if c.get('seed_failed')), 'steps', len(steps))
    bykind=collections.defaultdict(lambda:collections.Counter())
    for c,s in steps:
        k=s['k']
        if s.get('na'): bykind[k]['na']+=1; continue
        bykind[k]['n']+=1; bykind[k]['did_final']+= 1 if s.get('did_final') else 0; bykind[k]['did_raw']+= 1 if s.get('did_raw') else 0
        bykind[k]['applied']+= 1 if s.get('applied') else 0; bykind[k]['direct']+= 1 if str(s.get('route','')).startswith('direct') else 0
        bykind[k]['judge']+= 1 if s.get('did_final') is None else 0
    print(f" {'kind':12} {'n':>4} {'did_final':>10} {'did_raw':>8} {'applied':>8} {'direct':>7} {'na':>4}")
    for k,c in sorted(bykind.items()): print(f" {k:12} {c['n']:4} {c['did_final']:10} {c['did_raw']:8} {c['applied']:8} {c['direct']:7} {c['na']:4}")
    outc=collections.Counter(s.get('outcome') for c,s in steps if not s.get('na'))
    print(' outcomes:', dict(outc.most_common()))
    model_steps=[s for c,s in steps if not s.get('na') and not str(s.get('route','')).startswith('direct')]
    print(' model-path steps', len(model_steps), 'median s', med([s.get('seconds') for s in model_steps]), 'median tokens', med([s.get('tokens') for s in model_steps]), 'intercepted as new app', sum(1 for s in model_steps if s.get('intercepted_newapp')))
    print(' raw model output: noop', sum(1 for s in model_steps if s.get('diff_raw',{}).get('noop')), 'lost>=1 unasked line', sum(1 for s in model_steps if s.get('diff_raw',{}).get('lost')), 'kept<0.8', sum(1 for s in model_steps if s.get('diff_raw',{}).get('kept_ratio',1)<0.8))
    fe=collections.Counter((s.get('gen') or {}).get('first_err') for s in model_steps if s.get('outcome')=='failed_checker')
    print(' edit checker first errors:', dict(fe.most_common()))
