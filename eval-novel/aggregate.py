#!/usr/bin/env python3
"""Joins scored/*.jsonl with judge results; writes results/summary.json, results/per_item.jsonl and prints tables.
Must-have score per item: mean over must items of yes=1, partly=0.5, no=0; an invalid program scores 0 (the phone app
rejects it, the user gets nothing). all_musts = every must is yes."""
import json, os, glob, statistics as st, collections
H = os.path.dirname(os.path.abspath(__file__))
os.makedirs(f'{H}/results', exist_ok=True)
items = {x['id']: x for x in json.load(open(f'{H}/items.json'))}
refs = json.load(open(f'{H}/refs/refs.json')) if os.path.exists(f'{H}/refs/refs.json') else {}
expr = {k: v.get('expressible', 'in') for k, v in refs.items()}

J = {}  # key -> verdict (first judgement wins; REPEAT/CONTROL kept apart)
REP, CTRL = {}, {}
for f in sorted(glob.glob(f'{H}/judge/batches/*.json')):
    rf = f.replace('/batches/', '/results/')
    if not os.path.exists(rf): continue
    res = {r['uid']: r for r in json.load(open(rf))}
    for u in json.load(open(f)):
        r = res.get(u['uid'])
        if not r: continue
        r = dict(r, _musts=[c['must'] for c in u['checklist']])
        if u['key'].startswith('REPEAT|'): REP[u['key'][7:]] = r
        elif u['key'].startswith('CONTROL|'): CTRL[u['key']] = r
        else: J.setdefault(u['key'], r)
VAL = {'yes': 1.0, 'partly': 0.5, 'no': 0.0}
def must_score(r):
    m = [VAL.get(c['v'], 0) for c, must in zip(r['checks'], r['_musts']) if must]
    return sum(m) / len(m) if m else None
def all_musts(r): return all(c['v'] == 'yes' for c, must in zip(r['checks'], r['_musts']) if must)
def nice_score(r):
    m = [VAL.get(c['v'], 0) for c, must in zip(r['checks'], r['_musts']) if not must]
    return sum(m) / len(m) if m else None

per = []
for f in sorted(glob.glob(f'{H}/scored/*.jsonl')):
    tag = os.path.basename(f)[:-6]
    for l in open(f):
        r = json.loads(l)
        it = items[r['id']]
        r['expressible'] = expr.get(r['id'], 'in')
        # the references found no fully impossible request; the 9 partly impossible creates (sync, PDF, scanning, network...) form the out-of-language slice
        r['cat'] = 'out-of-language' if (r['expressible'] in ('out', 'partial') and r['category'] != 'change') else r['category']
        j = J.get(f"{r['id']}|{r['hash']}") if r['valid'] else None
        r['judged'] = j is not None
        r['must'] = (must_score(j) if j else (0.0 if not r['valid'] else None))
        r['all_musts'] = bool(j and all_musts(j))
        r['nice'] = nice_score(j) if j else None
        r['looks'] = j.get('looks') if j else None
        r['worst'] = j.get('worst') if j else None
        r['checks'] = j['checks'] if j else None
        per.append(r)
with open(f'{H}/results/per_item.jsonl', 'w') as fo:
    for r in per: fo.write(json.dumps(r) + '\n')

def pct(xs): xs = [x for x in xs if x is not None]; return round(100 * sum(xs) / len(xs), 1) if xs else None
def mean(xs): xs = [x for x in xs if x is not None]; return round(st.mean(xs), 2) if xs else None
def med(xs): xs = [x for x in xs if x is not None]; return round(st.median(xs), 1) if xs else None
def summ(rows):
    tabled = [r for r in rows if r['valid'] and (r.get('tables') or 0) > 0]
    return {'n': len(rows), 'valid': pct([r['valid'] for r in rows]), 'runs': pct([bool(r['runs']) for r in rows]),
            'works': pct([bool(r['works']) for r in rows]),
            'add_and_see_of_tabled': pct([bool(r['add_and_see']) for r in tabled]), 'n_tabled': len(tabled),
            'must_met': pct([r['must'] for r in rows]), 'all_musts': pct([r['all_musts'] for r in rows]),
            'judged': sum(r['judged'] for r in rows), 'unjudged_valid': sum(1 for r in rows if r['valid'] and not r['judged']),
            'looks_valid_mean': mean([r['looks'] for r in rows]), 'ask': sum(1 for r in rows if r.get('is_ask')),
            's_app_median': med([r['wall_s'] for r in rows]), 'tok_s_median': med([r['tok_s'] for r in rows]),
            'load_min': min([r['load_start'] for r in rows if r.get('load_start') is not None], default=None),
            'load_max': max([r['load_end'] for r in rows if r.get('load_end') is not None], default=None),
            'load_median': med([r['load_start'] for r in rows])}
tags = sorted({r['tag'] for r in per}, key=lambda t: (t == 'ref', t))
S = {'headline': {}, 'by_category': {}, 'errors': {}, 'controls': {}, 'repeat': {}}
for t in tags:
    rows = [r for r in per if r['tag'] == t]
    S['headline'][t] = summ(rows)
    S['by_category'][t] = {c: summ([r for r in rows if r['cat'] == c]) for c in ['tracker', 'list', 'calculator', 'timer', 'devtool', 'customui', 'multi', 'change', 'out-of-language']}
    S['errors'][t] = dict(collections.Counter(r['err_code'] for r in rows if not r['valid']).most_common())
# controls and judge agreement
S['controls'] = {k: {'must': must_score(v), 'looks': v.get('looks')} for k, v in CTRL.items()}
agree = []
for k, r2 in REP.items():
    r1 = J.get(k)
    if not r1: continue
    a = [c1['v'] == c2['v'] for c1, c2 in zip(r1['checks'], r2['checks'])]
    agree.append({'key': k, 'item_agree': sum(a) / len(a), 'must1': must_score(r1), 'must2': must_score(r2), 'looks1': r1.get('looks'), 'looks2': r2.get('looks')})
S['repeat'] = {'n': len(agree), 'checklist_item_agreement': round(st.mean([x['item_agree'] for x in agree]), 3) if agree else None,
               'must_score_mean_abs_diff': round(st.mean([abs(x['must1'] - x['must2']) for x in agree if x['must1'] is not None and x['must2'] is not None]), 3) if agree else None,
               'looks_exact': round(st.mean([x['looks1'] == x['looks2'] for x in agree]), 3) if agree else None,
               'looks_within1': round(st.mean([abs((x['looks1'] or 0) - (x['looks2'] or 0)) <= 1 for x in agree]), 3) if agree else None, 'rows': agree}
json.dump(S, open(f'{H}/results/summary.json', 'w'), indent=1)
cols = ['n', 'valid', 'runs', 'works', 'add_and_see_of_tabled', 'must_met', 'all_musts', 'looks_valid_mean', 's_app_median', 'tok_s_median', 'load_median', 'judged', 'unjudged_valid']
print('| config | ' + ' | '.join(cols) + ' |')
for t in tags: print(f'| {t} | ' + ' | '.join(str(S['headline'][t][c]) for c in cols) + ' |')

# blind pair test (model screen vs reference screen, both orders)
P = {}
for kf in glob.glob(f'{H}/judge/pairs/*_key.json'):
    tag = os.path.basename(kf)[:-9]; key = json.load(open(kf))
    res = {}
    for o in (1, 2):
        rf = f'{H}/judge/pairs/res_{tag}_order{o}.json'
        if os.path.exists(rf):
            for r in json.load(open(rf)): res[r['pid']] = r
    if not res: continue
    win = collections.Counter(); per_item = collections.defaultdict(list)
    for pid, r in res.items():
        who = key[pid].get(r['better'], 'tie') if r['better'] in ('A', 'B') else 'tie'
        win[who] += 1; per_item[pid.split('-', 1)[1]].append(who)
    consistent = sum(1 for v in per_item.values() if len(v) == 2 and v[0] == v[1])
    P[tag] = {'judgements': len(res), 'model': win['model'], 'reference': win['reference'], 'tie': win['tie'],
              'items': len(per_item), 'model_wins_both_orders': sum(1 for v in per_item.values() if v == ['model', 'model']),
              'reference_wins_both_orders': sum(1 for v in per_item.values() if v == ['reference', 'reference']), 'order_consistent': consistent}
S['pairs'] = P
json.dump(S, open(f'{H}/results/summary.json', 'w'), indent=1)
print('pairs', P)
