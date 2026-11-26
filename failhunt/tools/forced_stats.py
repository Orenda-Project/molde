#!/usr/bin/env python3
import json,sys,collections
for f in sys.argv[1:]:
    rows=[json.loads(l) for l in open(f) if l.strip()]
    by=collections.defaultdict(collections.Counter)
    for r in rows:
        k=r['k']; b=by[k]; b['n']+=1
        b['right']+= 1 if r.get('did_final') else 0
        b['raw_right']+= 1 if r.get('did_raw') else 0
        b['unchanged']+= 1 if r.get('outcome')=='noop_unchanged' else 0
        o=r.get('outcome',''); b['checker_fail']+= 1 if o=='failed_checker' else 0; b['blocked']+= 1 if o.startswith('blocked') else 0
        b['applied_wrong']+= 1 if (o=='applied' and not r.get('did_final')) else 0; b['refused']+= 1 if o=='refused_data' else 0
    print(f)
    tot=collections.Counter()
    for k,b in sorted(by.items()):
        print(f"  {k:10} n={b['n']:3} right={b['right']:3} unchanged={b['unchanged']:3} checker_fail={b['checker_fail']:2} blocked={b['blocked']:2} applied_wrong={b['applied_wrong']:2} model_right_but_not_applied={b['raw_right']-b['right']:2}")
        tot.update(b)
    print(f"  all        n={tot['n']} right={tot['right']} ({100*tot['right']/max(1,tot['n']):.0f}%) unchanged={tot['unchanged']} ({100*tot['unchanged']/max(1,tot['n']):.0f}%)")
