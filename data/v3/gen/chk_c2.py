#!/usr/bin/env python3
import sys, json, re
ins=[json.loads(l) for l in open(sys.argv[1]) if l.strip()]
try: outs=[json.loads(l) for l in open(sys.argv[2]) if l.strip()]
except Exception as e: print('bad json',e); sys.exit(1)
by={o.get('id'):o for o in outs}; bad=[]
for it in ins:
    o=by.get(it['id'])
    if not o: bad.append((it['id'],'missing')); continue
    t=o.get('request','')
    if not isinstance(t,str) or not re.fullmatch(r"[\x20-\x7e]+",t or '') or not (2<=len(t.split())<=45): bad.append((it['id'],'bad request %r'%t)); continue
    if it['app_name'].lower() in t.lower(): bad.append((it['id'],'mentions current app name'))
for b in bad[:30]: print(*b)
print('items',len(ins),'out',len(outs),'problems',len(bad)); sys.exit(1 if bad else 0)
