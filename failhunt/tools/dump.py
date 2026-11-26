#!/usr/bin/env python3
"""Readable dump of create cases: python3 tools/dump.py results/gemma-r3.jsonl START END"""
import json,sys
rows=[json.loads(l) for l in open(sys.argv[1]) if l.strip()]
cr=[r for r in rows if r['type']=='create']
a,b=int(sys.argv[2]),int(sys.argv[3])
for r in cr[a:b]:
    nd=' '.join(n+('+' if h else '-') for n,h in r.get('needs',[]))
    print(f"### {r['id']} [{r.get('style')}/{r.get('cat')}] ok={r.get('ok')} {r.get('first_err') or ''} ask={r.get('asked')} lines={r.get('lines')} tok={r.get('tokens')} s={r.get('seconds')} rs={r.get('resamples')} fb={r.get('fallbacks')} | {nd}")
    print('REQ:', r['request'])
    if r.get('asked'): print('ASK:', r['first'].get('ask'))
    pl=r.get('program','').rstrip().split('\n')
    if not r.get('ok'): pl=pl[:5]+(['  ... (%d lines)'%len(pl)] if len(pl)>5 else [])
    elif len(pl)>16: pl=pl[:16]+['  ... (%d lines)'%len(pl)]
    print('\n'.join(pl))
    if not r.get('ok'): print('ERR:', (r.get('errors') or [''])[0][:200])
    print()
