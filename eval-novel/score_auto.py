#!/usr/bin/env python3
"""Automatic layers a-c (+ screenshots, layer e input) for every run and the references.
Programs are deduplicated by sha1 of their text: work/prog/<h>.mo, work/drive/<h>.json, work/snap/<h>.json, shots/<h>.png.
Writes scored/<TAG>.jsonl (one row per item) for runs/*.jsonl and scored/ref.jsonl for refs/refs.json.
  python3 score_auto.py [--no-shots]"""
import json, os, sys, hashlib, subprocess, glob
from concurrent.futures import ThreadPoolExecutor
H = os.path.dirname(os.path.abspath(__file__))
for d in ('work/prog', 'work/drive', 'work/snap', 'shots', 'scored'): os.makedirs(f'{H}/{d}', exist_ok=True)
items = {x['id']: x for x in json.load(open(f'{H}/items.json'))}

def h_of(src): return hashlib.sha1(src.encode()).hexdigest()[:12]

def drive(h):
    out = f'{H}/work/drive/{h}.json'
    if os.path.exists(out): return
    tmp = out + '.tmp'
    try:
        subprocess.run(['node', f'{H}/drive.mjs', f'{H}/work/prog/{h}.mo', tmp], timeout=60, check=False, capture_output=True)
        d = json.load(open(tmp))
    except Exception as e:
        d = {'valid': None, 'runs': False, 'works': False, 'driver_crash': str(e)[:200]}
    snap = d.pop('snap_shot', None)
    if snap is not None: json.dump(snap, open(f'{H}/work/snap/{h}.json', 'w'))
    json.dump(d, open(out, 'w'))
    if os.path.exists(tmp): os.remove(tmp)

def rows_of_runs():
    for f in sorted(glob.glob(f'{H}/runs/*.jsonl')):
        tag = os.path.basename(f)[:-6]
        yield tag, [json.loads(l) for l in open(f) if l.strip()]
    if os.path.exists(f'{H}/refs/refs.json'):
        refs = json.load(open(f'{H}/refs/refs.json'))
        yield 'ref', [{'id': k, 'output': v['program'], 'expressible': v.get('expressible'), 'wall_s': None} for k, v in refs.items()]

allrows = list(rows_of_runs())
hs = set()
for tag, rows in allrows:
    for r in rows:
        src = r.get('output') or ''
        if not src.endswith('\n'): src += '\n'
        h = h_of(src); r['_h'] = h; hs.add(h)
        p = f'{H}/work/prog/{h}.mo'
        if not os.path.exists(p): open(p, 'w').write(src)
todo = [h for h in hs if not os.path.exists(f'{H}/work/drive/{h}.json')]
print(f'programs {len(hs)}, to drive {len(todo)}', file=sys.stderr)
with ThreadPoolExecutor(4) as ex: list(ex.map(drive, todo))

if '--no-shots' not in sys.argv:
    jobs = []
    for h in hs:
        d = json.load(open(f'{H}/work/drive/{h}.json'))
        if d.get('valid') and not os.path.exists(f'{H}/shots/{h}.png'):
            jobs.append({'key': h, 'program_file': f'{H}/work/prog/{h}.mo', 'snap_file': f'{H}/work/snap/{h}.json', 'png': f'{H}/shots/{h}.png'})
    if jobs:
        json.dump(jobs, open(f'{H}/work/shot_jobs.json', 'w'))
        print(f'shots to take {len(jobs)}', file=sys.stderr)
        subprocess.run(['node', f'{H}/shoot.mjs', f'{H}/work/shot_jobs.json'], check=False)

for tag, rows in allrows:
    with open(f'{H}/scored/{tag}.jsonl', 'w') as fo:
        for r in rows:
            d = json.load(open(f'{H}/work/drive/{r["_h"]}.json'))
            it = items[r['id']]
            o = {'id': r['id'], 'tag': tag, 'category': it['category'], 'hash': r['_h'], 'before_from': r.get('before_from'),
                 'wall_s': r.get('wall_s'), 'tok_s': r.get('tok_s'), 'load_start': r.get('load_start'), 'load_end': r.get('load_end'),
                 'calls': r.get('calls'), 'empty': not (r.get('output') or '').strip(),
                 'shot': f'shots/{r["_h"]}.png' if os.path.exists(f'{H}/shots/{r["_h"]}.png') else None}
            o.update({k: d.get(k) for k in ('valid', 'runs', 'works', 'add_and_see', 'stored', 'changed_any', 'reload_same', 'reload_visible_same', 'clean', 'err_code', 'first_error', 'lines', 'is_ask', 'tables', 'screens', 'forms', 'refusals', 'driver_errors', 'end_problems', 'run_problems', 'driver_crash')})
            if tag == 'ref': o['expressible'] = r.get('expressible')
            fo.write(json.dumps(o) + '\n')
print('scored', [t for t, _ in allrows], file=sys.stderr)
