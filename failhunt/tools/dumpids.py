#!/usr/bin/env python3
import json,sys
rows={r['id']:r for r in map(json.loads,open(sys.argv[1])) if r['type']=='create'}
maxl=int(sys.argv[2])
for i in sys.argv[3:]:
    r=rows[i]; pl=r['program'].rstrip().split('\n')
    print(f"### {i} [{r.get('style')}] ok={r['ok']} {r.get('first_err') or ''} lines={r['lines']} | REQ: {r['request']}")
    if not r['ok']: pl=pl[:3]
    print('\n'.join(l[:105] for l in pl[:maxl]))
    if len(pl)>maxl: print(f'  ... ({r["lines"]} lines)')
