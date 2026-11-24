#!/usr/bin/env python3
"""Failure taxonomy per config from results/per_item.jsonl -> results/taxonomy.json (and printed).
Every item lands in exactly one class (first match wins):
  invalid:<code>[:<detail>]   checker rejects it (the phone app shows nothing new)
  runs-broken                 valid, but error node / undefined / NaN on load
  ask                         a one-line ask program
  driver-dead                 valid and runs, but filling forms / tapping changed nothing or stored nothing, or crashed
  wrong-app                   works, but under 25% of must-haves met
  half-app                    works, 25% to <75% of must-haves met
  good                        works, at least 75% of must-haves met"""
import json, os, re, collections
H = os.path.dirname(os.path.abspath(__file__))
P = [json.loads(l) for l in open(f'{H}/results/per_item.jsonl')]
def detail(e):
    e = e or ''
    if 'E_TYPE' in e:
        if re.search(r'cannot use \S+ between', e): return 'operator-types'
        if 'expected a table' in e: return 'needs-table'
        if 'expected a number' in e or 'number' in e: return 'needs-number'
        return 'other'
    return ''
def cls(r):
    if r['empty']: return 'invalid:EMPTY'
    if not r['valid']:
        d = detail(r.get('first_error')); return f"invalid:{r['err_code']}" + (f':{d}' if d else '')
    if not r['runs']: return 'runs-broken'
    if r.get('is_ask'): return 'ask'
    if not r['works']: return 'driver-dead'
    m = r['must'] if r['must'] is not None else 0
    return 'wrong-app' if m < .25 else 'half-app' if m < .75 else 'good'
T = {}
for tag in sorted({r['tag'] for r in P}):
    T[tag] = dict(collections.Counter(cls(r) for r in P if r['tag'] == tag).most_common())
json.dump(T, open(f'{H}/results/taxonomy.json', 'w'), indent=1)
for k, v in T.items(): print(k, v)
