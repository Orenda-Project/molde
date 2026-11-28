#!/usr/bin/env python3
"""score_creates.py FILE.jsonl ... : checker pass + asks + judge (strict / lenient) for 407-create app-path runs. Run from failhunt/ (needs cases.jsonl, judge_model_*.json)."""
import sys, json, math, importlib.util
spec = importlib.util.spec_from_file_location('judge', 'tools/judge.py'); J = importlib.util.module_from_spec(spec); spec.loader.exec_module(J)
ms = json.load(open('judge_model_strict.json')); ml = json.load(open('judge_model_lenient.json'))
needs = {json.loads(l)['id']: json.loads(l).get('needs') for l in open('cases.jsonl') if json.loads(l)['type'] == 'create'}
sig = lambda z: 1 / (1 + math.exp(-z))
for f in sys.argv[1:]:
    rows = [r for r in map(json.loads, open(f)) if r['type'] == 'create']
    n = len(rows); ok = sum(1 for r in rows if r.get('ok')); s = l = 0; progs = {}
    for r in rows:
        x = J.feats(r, needs.get(r['id']))
        s += sig(sum(c * v for c, v in zip(ms['coef'], x)) + ms['intercept']) >= .5
        l += sig(sum(c * v for c, v in zip(ml['coef'], x)) + ml['intercept']) >= .5
    med = sorted(r.get('seconds') or 0 for r in rows)[n // 2]
    lines = sorted(r.get('lines') or 0 for r in rows)[n // 2]
    print(f"{f.split('/')[-1]:34s} n={n} valid={ok} ({100*ok/n:.1f}%) judge_strict={s} ({100*s/n:.1f}%) judge_ok={l} ({100*l/n:.1f}%) asked={sum(1 for r in rows if r.get('asked'))} median_s={med} median_lines={lines}")
