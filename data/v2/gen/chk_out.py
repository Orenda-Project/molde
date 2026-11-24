#!/usr/bin/env python3
"""python3 chk_out.py IN.jsonl OUT.jsonl -> prints problems; exit 1 if any"""
import sys, json, re
inf, outf = sys.argv[1], sys.argv[2]
ins = [json.loads(l) for l in open(inf) if l.strip()]
try:
    outs = [json.loads(l) for l in open(outf) if l.strip()]
except Exception as e:
    print('bad json', e); sys.exit(1)
BAN = re.compile(r"^(i want (to )?(track|log)|track my|an? (simple )?(app|tracker)|i need an? (app|tracker)|can you make|please make|make me|build me|hi, i would like|i would like|i'd like|help me keep track|keep a record of|i am looking for|create an?|log my|quick one|hey molde|hello,|hi!)", re.I)
bad = []
byid = {o.get('id'): o for o in outs}
for it in ins:
    o = byid.get(it['id'])
    if not o: bad.append((it['id'], 'missing')); continue
    keys = ['r1', 'r2', 'r3', 'r4'] if it['kind'] == 'ask' else ['hurried', 'fuller']
    for k in keys:
        t = o.get(k)
        if not isinstance(t, str) or len(t.strip()) < 3: bad.append((it['id'], k + ' empty')); continue
        if not re.fullmatch(r"[\x20-\x7e]+", t): bad.append((it['id'], k + ' non-ascii')); continue
        n = len(t.split())
        if k in ('hurried', 'r1', 'r2') and n > 16: bad.append((it['id'], k + ' too long'))
        if k in ('fuller',) and (n < 8 or n > 70): bad.append((it['id'], k + ' length %d' % n))
        if BAN.search(t.strip()): bad.append((it['id'], k + ' banned opener: ' + t[:40]))
    if it['kind'] != 'ask' and o.get('hurried', '').strip().lower() == o.get('fuller', '').strip().lower(): bad.append((it['id'], 'same'))
for b in bad[:30]: print(*b)
print('items', len(ins), 'out', len(outs), 'problems', len(bad))
sys.exit(1 if bad else 0)
