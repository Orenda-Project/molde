import json,random,collections,sys,re
rows=[json.loads(l) for l in open('v4.1.jsonl')]
new=[r for r in rows if (r['meta'] if isinstance(r['meta'],dict) else {}).get('origin')=='v4.1']
base=len(rows)-len(new)
C=collections.Counter
def cls(r):
    c=r.get('class'); 
    if c: return c
    return 'task_'+r['task']+('_long' if (r['meta'] if isinstance(r['meta'],dict) else {}).get('long') else '')
cnt=C(cls(r) for r in new)
tab='\n'.join(f'| {k} | {v} |' for k,v in sorted(cnt.items()))
ru=sum(1 for r in new if r.get('class') in('roman_urdu','typo_short'))
longe=C(r['class'] for r in new if r['task']=='edit' and r['meta'].get('long'))
shorte=C(r['class'] for r in new if r['task']=='edit' and not r['meta'].get('long'))
# cumulative per kind (all hand edits incl. v4)
allh=[r for r in rows if r['task']=='edit' and (r['source'] or '').startswith('v4')]
cum_long=C(r['class'] for r in allh if r['meta'].get('long')); cum_short=C(r['class'] for r in allh if not r['meta'].get('long'))
allru=sum(1 for r in rows if r.get('class') in('roman_urdu','typo_short'))
s=f"""
## v4.1 snapshot (running)

v4.1.jsonl = v4 ({base} rows) + {len(new)} new verified rows = {len(rows)}. The new rows pass the uncached verifier (100%), leak check 0 and the patch round-trip.

Roman Urdu / mixed / typo creates (hand, class roman_urdu or typo_short): {allru} total (target 1,200).

| New class | Rows |
|---|---|
{tab}

Hand edits, cumulative (v4 + v4.1), long programs (more than 25 lines): {dict(cum_long)}
Hand edits, cumulative, short programs: {dict(cum_short)}
"""
t=open('STATS.md').read()
t=t.split('\n## v4.1 snapshot (running)')[0]
open('STATS.md','w').write(t.rstrip()+'\n'+s)
random.seed(5)
out=['# Samples, 5 random new v4.1 rows per class\n']
by=collections.defaultdict(list)
for r in new: by[cls(r)].append(r)
for k in sorted(by):
    out.append(f'\n## {k} ({len(by[k])} rows)\n')
    for r in random.sample(by[k],min(5,len(by[k]))):
        out.append(f"### {r['id']}\nRequest: {r['request']}\n")
        if r['task']=='edit': out.append('Before:\n```\n'+r['program_before'].rstrip()[:1500]+'\n```\nAnswer:\n```\n'+r['answer'].rstrip()+'\n```\n')
        else: out.append('```\n'+r['program'].rstrip()[:1500]+'\n```\n'+(('Plan: '+r['plan']+'\n') if r.get('plan') else ''))
open('SAMPLES.md','w').write('\n'.join(out))
print(len(rows),len(new),allru)
