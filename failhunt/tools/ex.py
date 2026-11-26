#!/usr/bin/env python3
import json,sys
f=sys.argv[1]; rows={r['id']:r for r in map(json.loads,open(f)) if r['type']=='create'}
n=int(sys.argv[2])
for i in sys.argv[3:]:
    r=rows[i]; pl=r['program'].rstrip().split('\n')
    print(f"[{i}] {r['request']}  (ok={r['ok']} {r.get('first_err') or ''})")
    print('\n'.join('    '+l[:100] for l in pl[:n]))
    if len(pl)>n: print(f'    ... ({len(pl)} lines)')
