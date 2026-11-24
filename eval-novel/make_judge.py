#!/usr/bin/env python3
"""Builds blind judge batches from scored/*.jsonl: one unit per (item, program hash) for VALID programs not judged yet.
Units from every model/config and the references are mixed and shuffled, so the judge never knows the source.
  python3 make_judge.py --size 25 [--controls] [--repeat 20] [--only TAG,TAG]
Writes judge/batches/bNNN.json; results go to judge/results/bNNN.json (written by the judge agents)."""
import json, os, sys, glob, random, subprocess, hashlib
H = os.path.dirname(os.path.abspath(__file__))
os.makedirs(f'{H}/judge/batches', exist_ok=True); os.makedirs(f'{H}/judge/results', exist_ok=True)
arg = lambda k, d=None: sys.argv[sys.argv.index('--' + k) + 1] if '--' + k in sys.argv else d
SIZE = int(arg('size', 25)); ONLY = arg('only'); REPEAT = int(arg('repeat', 0))
items = {x['id']: x for x in json.load(open(f'{H}/items.json'))}
runs = {os.path.basename(f)[:-6]: f for f in glob.glob(f'{H}/runs/*.jsonl')}

def judged():
    s = set()
    for f in glob.glob(f'{H}/judge/batches/*.json'):
        rf = f.replace('/batches/', '/results/')
        got = {r['uid'] for r in json.load(open(rf))} if os.path.exists(rf) else None
        for u in json.load(open(f)):
            if got is None or u['uid'] in got: s.add(u['key'])  # pending batches count as judged; a unit missing from a finished result is re-queued
    return s

def describe(h):
    p = f'{H}/work/desc_{h}.txt'
    if not os.path.exists(p):
        r = subprocess.run(['node', f'{H}/../lang/mo.mjs', 'describe', f'{H}/work/prog/{h}.mo'], capture_output=True, text=True, timeout=30)
        open(p, 'w').write((r.stdout or r.stderr)[:4000])
    return open(p).read()

def before_of(tag, iid):
    if tag == 'ref': return None
    for l in open(runs[tag]):
        r = json.loads(l)
        if r['id'] == iid: return r.get('before')

def unit(key, iid, h, before):
    it = items[iid]
    return {'key': key, 'uid': hashlib.sha1(key.encode()).hexdigest()[:8], 'category_hint': 'change' if it['category'] == 'change' else 'create',
            'request': it['request'], 'program_before': before,
            'checklist': [{'n': i + 1, 'item': c['item'], 'must': c['must']} for i, c in enumerate(it['checklist'])],
            'program': open(f'{H}/work/prog/{h}.mo').read(), 'describe': describe(h),
            'screenshot': f'{H}/shots/{h}.png' if os.path.exists(f'{H}/shots/{h}.png') else None}

seen = judged(); units = []
for f in sorted(glob.glob(f'{H}/scored/*.jsonl')):
    tag = os.path.basename(f)[:-6]
    if ONLY and tag not in ONLY.split(','): continue
    for l in open(f):
        r = json.loads(l)
        if not r['valid']: continue
        key = f"{r['id']}|{r['hash']}"
        if key in seen: continue
        seen.add(key)
        units.append(unit(key, r['id'], r['hash'], before_of(tag, r['id']) if r['category'] == 'change' else None))

if '--controls' in sys.argv:  # deliberately wrong programs: the reference of an unrelated item, judged against this request
    refs = json.load(open(f'{H}/refs/refs.json'))
    pairs = [('w1-t02', 'w2-u03'), ('w1-t03', 'w1-k05'), ('w1-k01', 'w2-d02'), ('w2-l02', 'w1-r02'), ('w2-d01', 'w1-t20'),
             ('w2-u01', 'w2-l10'), ('w1-r05', 'w1-t25'), ('w2-m01', 'w2-u07'), ('w1-t15', 'w2-d10'), ('w2-l15', 'w1-k10')]
    sh = {json.loads(l)['id']: json.loads(l)['hash'] for l in open(f'{H}/scored/ref.jsonl')}
    for a, b in pairs:
        units.append(unit(f'CONTROL|{a}|{b}|{sh[b]}', a, sh[b], None))

if REPEAT:  # a second, independent judgement of already judged units (judge agreement)
    done = []
    for f in sorted(glob.glob(f'{H}/judge/batches/b*.json')):
        done += [u for u in json.load(open(f)) if not u['key'].startswith('CONTROL')]
    random.Random(7).shuffle(done)
    units = []
    for u in done[:REPEAT]:
        v = dict(u); v['key'] = 'REPEAT|' + u['key']; v['uid'] = hashlib.sha1(v['key'].encode()).hexdigest()[:8]; units.append(v)

random.Random(len(units)).shuffle(units)
n0 = len(glob.glob(f'{H}/judge/batches/*.json'))
prefix = 'r' if REPEAT else 'b'
for i in range(0, len(units), SIZE):
    p = f'{H}/judge/batches/{prefix}{n0 + i // SIZE:03d}.json'
    json.dump(units[i:i + SIZE], open(p, 'w'), indent=1)
    print(p, len(units[i:i + SIZE]))
print('units', len(units), file=sys.stderr)
