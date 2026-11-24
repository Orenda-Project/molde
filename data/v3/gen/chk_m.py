#!/usr/bin/env python3
import sys, json, re
ins=[json.loads(l) for l in open(sys.argv[1]) if l.strip()]
try: outs=[json.loads(l) for l in open(sys.argv[2]) if l.strip()]
except Exception as e: print('bad json',e); sys.exit(1)
by={o.get('id'):o for o in outs}; bad=[]; seen=set()
for it in ins:
    o=by.get(it['id'])
    if not o: bad.append((it['id'],'missing')); continue
    for k in ('orig','question','answer'):
        if not isinstance(o.get(k),str) or not re.fullmatch(r"[\x20-\x7e]+",o[k] or ''): bad.append((it['id'],k+' bad')); break
    else:
        op=o.get('options')
        if not isinstance(op,list) or not (3<=len(op)<=4) or len(set(op))!=len(op) or any((not isinstance(x,str)) or not (1<=len(x.split())<=4) or not re.fullmatch(r"[\x20-\x7e]+",x) for x in op): bad.append((it['id'],'options bad'))
        elif o['answer'] not in op: bad.append((it['id'],'answer not in options'))
        elif not (2<=len(o['orig'].split())<=12): bad.append((it['id'],'orig length'))
        if o['orig'].lower() in seen: bad.append((it['id'],'dup orig'))
        seen.add(o['orig'].lower())
for b in bad[:30]: print(*b)
print('items',len(ins),'out',len(outs),'problems',len(bad)); sys.exit(1 if bad else 0)
