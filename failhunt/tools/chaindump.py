#!/usr/bin/env python3
"""Readable dump of chain steps: python3 tools/chaindump.py results/x.jsonl START END [model-only]"""
import json,sys,difflib
rows=[json.loads(l) for l in open(sys.argv[1]) if l.strip()]
ch=[r for r in rows if r['type']=='chain' and not r.get('seed_failed')]
a,b=int(sys.argv[2]),int(sys.argv[3])
for c in ch[a:b]:
    print(f"##### {c['id']} long={c.get('long')} seed={c['seed'].get('request') or c['seed'].get('long_file')} start_lines={len(c['start'].splitlines())}")
    for i,s in enumerate(c['steps']):
        if s.get('na'): print(f"  [{i}] {s['k']} NA ({s['na']})"); continue
        r=str(s.get('route'))
        flag=f"route={r} outcome={s['outcome']} did_final={s['did_final']} did_raw={s['did_raw']} kept={s['diff_raw']['kept_ratio']} tok={s.get('tokens')} nl={s.get('intercepted_newapp')}"
        print(f"  [{i}] {s['k']}: \"{s['request']}\"  -> {flag}")
        if r=='model' or (len(sys.argv)>5):
            raw=s.get('raw') or ''
            before=s.get('after') if False else None
        if r=='model' and s.get('raw') is not None:
            prev=c['steps'][i-1].get('after') if i>0 and c['steps'][i-1].get('after') else c['start']
            # find the most recent 'after' of any earlier step
            prev=c['start']
            for t in c['steps'][:i]:
                if t.get('after'): prev=t['after']
            d=[l for l in difflib.unified_diff(prev.splitlines(), (s['raw'] or '').splitlines(), lineterm='', n=0) if not l.startswith(('---','+++','@@'))]
            if s['outcome'] in ('failed_checker',): print('      CHECKER:', (s.get('gen') or {}).get('errors',[''])[0][:150] if s.get('gen') else '')
            for l in d[:10]: print('      '+l[:130])
            if len(d)>10: print(f'      ... {len(d)-10} more diff lines')
            if not d: print('      (no change)')
