import json,collections,sys
cs={json.loads(l)['id']:json.loads(l) for l in open('../failhunt/cases.jsonl') if json.loads(l)['type']=='create'}
def load(f): return {l.split()[0]:int(l.split()[1]) for l in open(f) if l.strip() and not l.startswith('#')}
for f in sys.argv[1:]:
    L=load(f); en=[i for i in L if cs[i]['style'] not in('roman','mixed')]; un=[i for i in L if cs[i]['style']=='unsupported']
    pct=lambda ids,k: f"{sum(L[i]>=k for i in ids)}/{len(ids)} ({100*sum(L[i]>=k for i in ids)/len(ids):.0f}%)"
    print(f"{f:34s} exact all {pct(L,2)}  exact English-only {pct(en,2)}  right-kind-or-better all {pct(L,1)}")
