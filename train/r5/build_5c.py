#!/usr/bin/env python3
"""build_5c.py FMT(ops|whole) OUTDIR [--check R5B_TRAIN.jsonl]
Round 5c training set: v4.1 (hand rows, cleaned v3.1) with its 5,815 early c2 rows replaced by the reviewed data-v4/out/newc2_final.jsonl (5,802 rows).
Rows become chat messages exactly as r5b: creates = plan line + program; edits = patch ops against the numbered program (ops) or the whole program (whole).
--check compares messages with an r5b train file for every shared id (they must be identical)."""
import json, sys, hashlib, os
fmt, out = sys.argv[1], sys.argv[2]
D = os.path.dirname(os.path.abspath(__file__)) + '/../data-v4/'
SYS_C = "You write MoldeScript, a tiny language for small phone apps. Reply with the complete program only, no explanation. For an edit request you get the current program: reply with the full updated program."
SYS_E1 = 'You write MoldeScript, a tiny language for small phone apps. Reply with the complete program only, no explanation. For an edit request you get the current program with numbered lines: reply only with the changes, as operations on those line numbers (insert after N, replace N or N-M, delete N or N-M, move N or N-M after K); each line to write follows its operation and starts with "+ ".'
def convert(r):
    if r['task'] == 'create':
        a = (r['plan'] + '\n' if r.get('plan') else '') + r['program']
        return [{'role': 'system', 'content': SYS_C}, {'role': 'user', 'content': r['user_text']}, {'role': 'assistant', 'content': a}]
    if fmt == 'ops':
        return [{'role': 'system', 'content': SYS_E1}, {'role': 'user', 'content': r['user_text_numbered']}, {'role': 'assistant', 'content': r['answer']}]
    return [{'role': 'system', 'content': SYS_C}, {'role': 'user', 'content': r['user_text']}, {'role': 'assistant', 'content': r['program']}]
rd = lambda f: [json.loads(l) for l in open(f) if l.strip()]
base = [r for r in rd(D + 'v4.1.jsonl') if not r['id'].startswith('c2-')]
c2 = rd(D + 'out/newc2_final.jsonl')
if '--c2n' in sys.argv:   # keep only N c2 rows (stratified by class, seeded): the "mix" variant, because heavy c2 edit data hurt creates in r5b
    import random, collections
    n = int(sys.argv[sys.argv.index('--c2n') + 1]); rg = random.Random(7); by = collections.defaultdict(list)
    for r in c2: by[r.get('class')].append(r)
    c2 = [r for k in sorted(by, key=str) for r in rg.sample(by[k], min(len(by[k]), max(1, n * len(by[k]) // len(c2))))]
en = rd(D + 'out/en5c.jsonl')   # 61 new English hand creates (hand/c-en5c-01.txt), checked, leak-checked, kept 3 times (ids -x1..-x3) because they are few
rows = base + c2 + [dict(r, id=r['id'] + '-x%d' % k) for r in en for k in (1, 2, 3)]
if '--check' in sys.argv:
    ref = {json.loads(l)['id']: json.loads(l) for l in open(sys.argv[sys.argv.index('--check') + 1])}
    n = bad = 0
    for r in rows:
        if r['id'] in ref:
            n += 1
            if ref[r['id']]['messages'] != convert(r):
                bad += 1
                if bad <= 3: print('MISMATCH', r['id'], r['source'] if 'source' in r else '', '\n', json.dumps(ref[r['id']]['messages'])[:600], '\n', json.dumps(convert(r))[:600])
    print('shared ids', n, 'mismatches', bad); sys.exit(0)
os.makedirs(out, exist_ok=True)
tr, va = [], []
for r in rows:
    if r['task'] == 'edit' and fmt == 'ops' and 'answer' not in r: continue
    m = convert(r)
    x = {'id': r['id'], 'task': r['task'], 'src': r.get('source') or '', 'meta': {}, 'messages': m}
    (va if int(hashlib.sha1(('5c' + r['id']).encode()).hexdigest(), 16) % 24 == 0 else tr).append(x)
w = lambda f, L: open(out + '/' + f, 'w').write('\n'.join(json.dumps(x, ensure_ascii=False) for x in L) + '\n')
w('train.jsonl', tr); w('val.jsonl', va)
print(json.dumps({'fmt': fmt, 'train': len(tr), 'val': len(va), 'creates': sum(x['task'] == 'create' for x in tr), 'edits': sum(x['task'] == 'edit' for x in tr)}))
