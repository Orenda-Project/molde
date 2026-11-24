#!/usr/bin/env python3
import sys, json, re
ins=[json.loads(l) for l in open(sys.argv[1]) if l.strip()]
try: outs=[json.loads(l) for l in open(sys.argv[2]) if l.strip()]
except Exception as e: print('bad json',e); sys.exit(1)
BAN=re.compile(r"^(i want (to )?(track|log)|track my|an? (simple )?(app|tracker)|i need an? (app|tracker)|can you make|please make|make me|build me|hi, i would like|i would like|i'd like|help me keep track|keep a record of|i am looking for|create an?|log my|quick one|hey molde|hello,|hi!)",re.I)
by={o.get('id'):o for o in outs}; bad=[]
for it in ins:
    o=by.get(it['id'])
    if not o: bad.append((it['id'],'missing')); continue
    t=o.get('request','')
    if not isinstance(t,str) or not re.fullmatch(r"[\x20-\x7e]+",t or ''): bad.append((it['id'],'request ascii/empty')); continue
    n=len(t.split())
    if n<12 or n>80: bad.append((it['id'],'request length %d'%n))
    if BAN.search(t.strip()): bad.append((it['id'],'banned opener: '+t[:40]))
    s=o.get('short','')
    if it.get('want_short'):
        if not isinstance(s,str) or not (1<=len(s.split())<=3) or not re.fullmatch(r"[a-z0-9' -]+",s): bad.append((it['id'],'short bad: %r'%s))
    elif s not in ('',None): bad.append((it['id'],'short should be empty'))
for b in bad[:30]: print(*b)
print('items',len(ins),'out',len(outs),'problems',len(bad)); sys.exit(1 if bad else 0)
