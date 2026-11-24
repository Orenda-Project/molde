#!/usr/bin/env python3
import sys, json, re
ins=[json.loads(l) for l in open(sys.argv[1]) if l.strip()]
try: outs=[json.loads(l) for l in open(sys.argv[2]) if l.strip()]
except Exception as e: print('bad json',e); sys.exit(1)
by={o.get('id'):o for o in outs}; bad=[]
GEN={'app','tracker','list','log','tool','calculator','calc','counter','planner','manager','notes'}
for it in ins:
    o=by.get(it['id'])
    if not o: bad.append((it['id'],'missing')); continue
    s=o.get('short','')
    if not isinstance(s,str) or not (1<=len(s.split())<=3) or not re.fullmatch(r"[a-z0-9' -]+",s) or set(s.split())<=GEN: bad.append((it['id'],'bad short %r'%s))
for b in bad[:30]: print(*b)
print('items',len(ins),'out',len(outs),'problems',len(bad)); sys.exit(1 if bad else 0)
