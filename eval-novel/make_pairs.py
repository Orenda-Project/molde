#!/usr/bin/env python3
"""Blind pair test: model screen vs reference screen for N create items (both valid, both with a screenshot), both orders.
  python3 make_pairs.py TAG [N=30]  -> judge/pairs/<TAG>_order1.json and _order2.json (+ _key.json, kept away from judges)"""
import json, os, sys, random
H = os.path.dirname(os.path.abspath(__file__))
tag = sys.argv[1]; N = int(sys.argv[2]) if len(sys.argv) > 2 else 30
os.makedirs(f'{H}/judge/pairs', exist_ok=True)
items = {x['id']: x for x in json.load(open(f'{H}/items.json'))}
m = {json.loads(l)['id']: json.loads(l) for l in open(f'{H}/scored/{tag}.jsonl')}
r = {json.loads(l)['id']: json.loads(l) for l in open(f'{H}/scored/ref.jsonl')}
ok = [i for i in m if items[i]['category'] != 'change' and m[i]['shot'] and r.get(i, {}).get('shot')]
random.Random(11).shuffle(ok); ok = sorted(ok[:N])
key = {}
for order in (1, 2):
    rows = []
    for i in ok:
        a, b = (m[i], r[i]) if order == 1 else (r[i], m[i])
        pid = f'{order}-{i}'
        key[pid] = {'A': 'model' if order == 1 else 'reference', 'B': 'reference' if order == 1 else 'model'}
        rows.append({'pid': pid, 'request': items[i]['request'], 'A': f"{H}/{a['shot']}", 'B': f"{H}/{b['shot']}"})
    random.Random(order).shuffle(rows)
    json.dump(rows, open(f'{H}/judge/pairs/{tag}_order{order}.json', 'w'), indent=1)
json.dump(key, open(f'{H}/judge/pairs/{tag}_key.json', 'w'), indent=1)
print(len(ok), 'items')
