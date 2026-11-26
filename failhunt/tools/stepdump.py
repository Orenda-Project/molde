#!/usr/bin/env python3
"""Non-noop model-path steps with diffs: python3 tools/stepdump.py results/x.jsonl FIRST LAST  (chain index range)"""
import json,sys,difflib
rows=[json.loads(l) for l in open(sys.argv[1]) if l.strip()]
ch=[r for r in rows if r['type']=='chain' and not r.get('seed_failed')]
a,b=int(sys.argv[2]),int(sys.argv[3])
for c in ch[a:b]:
    prev=c['start']
    for i,s in enumerate(c['steps']):
        if s.get('na'): continue
        cur=prev
        if str(s.get('route')).startswith('model') and not s['diff_raw'].get('noop'):
            d=[l for l in difflib.unified_diff(prev.splitlines(), (s['raw'] or '').splitlines(), lineterm='', n=0) if not l.startswith(('---','+++','@@'))]
            print(f"{c['id']}.{i} {s['k']}: \"{s['request']}\" -> {s['outcome']} auto={s['did_final']}/{s['did_raw']} kept={s['diff_raw']['kept_ratio']}")
            if s['outcome']=='failed_checker': print('   CHK:', ((s.get('gen') or {}).get('errors') or [''])[0][:110])
            for l in d[:5]: print('   '+l[:118])
            if len(d)>5: print(f'   (+{len(d)-5} more diff lines)')
        if s.get('after'): prev=s['after']
