#!/usr/bin/env python3
"""gallery.json: 40 items for a page. For each phone config (Q4_K_M, arm E) of r1 and r2 (or r1 only if r2 is missing):
the best, the worst valid, a middle band and some failures, spread over categories. Screenshots: gallery/<hash>.png (palette PNG)."""
import json, os, random, shutil
from PIL import Image
H = os.path.dirname(os.path.abspath(__file__))
items = {x['id']: x for x in json.load(open(f'{H}/items.json'))}
P = [json.loads(l) for l in open(f'{H}/results/per_item.jsonl')]
tags = [t for t in ('r1_Q4_K_M_E', 'r2_Q4_K_M_E') if any(r['tag'] == t for r in P)]
per = 40 // len(tags)
os.makedirs(f'{H}/gallery', exist_ok=True)
out = []
def verdict(r):
    if not r['valid']: return f"invalid ({r['err_code']}): {(r['first_error'] or '')[:140]}"
    s = f"must-haves {round(100 * (r['must'] or 0))}%, works {'yes' if r['works'] else 'no'}, looks {r['looks']}/5"
    return s + (f"; worst: {r['worst']}" if r.get('worst') else '')
for t in tags:
    rows = [r for r in P if r['tag'] == t]
    val = sorted([r for r in rows if r['valid'] and r['judged']], key=lambda r: (r['must'] or 0, r['looks'] or 0))
    bad = [r for r in rows if not r['valid']]
    rnd = random.Random(5)
    pick = val[-(per * 3 // 10):] + val[:per * 2 // 10]
    mid = [r for r in val if r not in pick]; rnd.shuffle(mid); pick += mid[:per * 3 // 10]
    rnd.shuffle(bad); pick += bad[:per - len(pick)]
    for r in pick:
        shot = None
        if r['shot']:
            shot = f"gallery/{r['hash']}.png"
            if not os.path.exists(f'{H}/{shot}'):
                Image.open(f"{H}/{r['shot']}").convert('RGB').quantize(64).save(f'{H}/{shot}', optimize=True)
        out.append({'id': r['id'], 'request': items[r['id']]['request'], 'category': r['cat'], 'model': t.replace('_', ' '),
                    'valid': r['valid'], 'works': r['works'], 'must_met': r['must'], 'looks': r['looks'], 'verdict': verdict(r),
                    'program': open(f"{H}/work/prog/{r['hash']}.mo").read(), 'screenshot': shot,
                    'reference_screenshot': None})
refsh = {json.loads(l)['id']: json.loads(l) for l in open(f'{H}/scored/ref.jsonl')}
for g in out:
    rr = refsh.get(g['id'])
    if rr and rr['shot']:
        p = f"gallery/{rr['hash']}.png"
        if not os.path.exists(f'{H}/{p}'): Image.open(f"{H}/{rr['shot']}").convert('RGB').quantize(64).save(f'{H}/{p}', optimize=True)
        g['reference_screenshot'] = p
json.dump(out, open(f'{H}/gallery.json', 'w'), indent=1)
print(len(out), 'gallery items')
