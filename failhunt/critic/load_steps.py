import json, collections
recs=[json.loads(l) for l in open('/home/oye/Documents/free_work/molde-model/failhunt/results/gemma-r3.jsonl')]
chains=[r for r in recs if r.get('type')=='chain']
print('chains',len(chains), 'keys', sorted(chains[0].keys()))
print('types', collections.Counter(r.get('type') for r in recs))
steps=[]
for c in chains:
    st=c.get('steps')
    if st is None:
        print('no steps in', c.get('id'), sorted(c.keys())); break
    for i,s in enumerate(st): steps.append((c['id'],i,s))
print('steps',len(steps))
if steps:
    s=steps[0][2]; print(sorted(s.keys()))

import random
allsteps=[]
prev_after={}
for c in chains:
    st=c.get('steps')
    if not st: continue
    cur=c['start']
    for i,s in enumerate(st):
        allsteps.append((c['id'],i,s,cur,c.get('seed',{}).get('request')))
        cur=s.get('after') or cur
print('edit steps total', len(allsteps))
random.seed(7)
samp=random.sample(allsteps,40)
json.dump([[a,b,c,d,e] for a,b,c,d,e in samp], open('/home/oye/Documents/free_work/molde-model/failhunt/critic/edit_sample_raw.json','w'))
for cid,i,s,before,seedreq in samp:
    df=s.get('diff_final') or {}
    print(f"== {cid}.{i} k={s.get('k')} route={s.get('route')} outcome={s.get('outcome')} verdict={s.get('verdict')} applied={s.get('applied')} refused={s.get('refused')} warn={s.get('warnings')}")
    print(f"   REQ: {s.get('request')}  args={s.get('args')}")
    print(f"   lines {df.get('before_lines')}->{df.get('after_lines')} kept={df.get('kept_ratio')} lost={str(df.get('lost'))[:160]} added={str(df.get('added'))[:200]}")
    if s.get('gen') and not s['gen'].get('ok'): print('   GEN ERR', str(s['gen'].get('errors'))[:150])
