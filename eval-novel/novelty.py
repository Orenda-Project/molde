#!/usr/bin/env python3
"""Novelty check: each eval request vs every training / corpus request.
Metrics: word Jaccard (lowercase word sets, stopwords removed) and character 5-gram Jaccard.
Writes novelty.json (per item max scores + nearest training request) and prints the distribution."""
import json, re, random, sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
M = '/home/oye/Documents/free_work/molde-model'
STOP = set('a an the and or of to for in on my me i is it with that this be by at as can do want need app track tracker keep please just also so how much many what when show like have has from your you our we us each every day'.split())

def words(s):
    return {w for w in re.findall(r"[a-z0-9']+", s.lower()) if w not in STOP}
def grams(s, n=5):
    s = re.sub(r'\s+', ' ', s.lower()).strip()
    return {s[i:i+n] for i in range(max(1, len(s) - n + 1))}
def jac(a, b):
    return len(a & b) / len(a | b) if a and b else 0.0

train = []
def add(path, reqkey, src, domkey=None):
    for l in open(path):
        if not l.strip(): continue
        d = json.loads(l)
        r = d.get(reqkey)
        if r: train.append((r, src, (d.get('meta') or {}).get('domain') or d.get('domain') or '', d.get('program') or d.get('ref') or ''))
add(f'{M}/data-v1/v1.jsonl', 'request', 'v1')
add(f'{M}/data-v2/v2.jsonl', 'request', 'v2')
add(f'{HERE}/../lang/corpus/requests.jsonl', 'text', 'corpus')
if os.path.exists(f'{M}/data-v2/heldout2.jsonl'): add(f'{M}/data-v2/heldout2.jsonl', 'request', 'heldout2')
print('training/corpus requests:', len(train), file=sys.stderr)
TW = [words(t[0]) for t in train]; TG = [grams(t[0]) for t in train]

items = json.load(open(f'{HERE}/items.json'))
out = []
for it in items:
    w, g = words(it['request']), grams(it['request'])
    bw = max(range(len(train)), key=lambda i: jac(w, TW[i]))
    bg = max(range(len(train)), key=lambda i: jac(g, TG[i]))
    out.append({'id': it['id'], 'category': it['category'], 'request': it['request'],
                'max_word': round(jac(w, TW[bw]), 3), 'nearest_word': train[bw][0][:160], 'max_char5': round(jac(g, TG[bg]), 3),
                'nearest_char5': train[bg][0][:160], 'nearest_src': train[bg][1], 'nearest_domain': train[bg][2],
                'nearest_program_head': train[bg][3].split('\n')[0][:80]})
json.dump(out, open(f'{HERE}/novelty.json', 'w'), indent=1)
def dist(k):
    v = sorted(x[k] for x in out)
    q = lambda p: v[min(len(v) - 1, int(p * len(v)))]
    return f'{k}: min {v[0]} p25 {q(.25)} median {q(.5)} p75 {q(.75)} p90 {q(.9)} max {v[-1]}'
print(dist('max_word')); print(dist('max_char5'))
TH = float(sys.argv[1]) if len(sys.argv) > 1 else 0.5
flag = [x for x in out if x['max_word'] >= TH or x['max_char5'] >= TH]
print(f'above threshold {TH}: {len(flag)}')
for x in flag: print(' ', x['id'], x['max_word'], x['max_char5'], '|', x['request'][:70], '||', x['nearest_char5'][:70])
