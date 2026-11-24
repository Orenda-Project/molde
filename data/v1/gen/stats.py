#!/usr/bin/env python3
"""python3 stats.py FILE.jsonl OUTDIR  -> STATS.md and SAMPLES.md in OUTDIR"""
import json, sys, collections, random, statistics, os
f, out = sys.argv[1], sys.argv[2]
rows = [json.loads(l) for l in open(f)]
build = {}
stem='v2' if 'v2' in f else ('A' if 'stageA' in f else 'v1')
bp = os.path.join(os.path.dirname(f), 'out' if stem=='v2' else '', 'build-' + stem + '.json')
if os.path.exists(bp): build = json.load(open(bp))
def tbl(c, title):
    return [f'### {title}', '', '| value | n | share |', '|---|---:|---:|'] + [f'| {k} | {v} | {v*100/len(rows):.1f}% |' for k, v in c.most_common()] + ['']
meth = collections.Counter(r['source'].split(':')[0] for r in rows)
fine = collections.Counter(r['source'] for r in rows)
hand = sum(v for k, v in meth.items() if k.startswith('hand'))
L = ['# Dataset statistics', '', f'file: `{os.path.basename(f)}`  pairs: **{len(rows)}**', '']
L += tbl(collections.Counter(r['task'] for r in rows), 'By task')
L += tbl(meth, 'By method (family)')
L += tbl(fine, 'By method (detailed)')
L += tbl(collections.Counter(r['meta'].get('style', '?') for r in rows), 'By request style')
oos = collections.Counter(r['meta'].get('oos') for r in rows if r['meta'].get('oos'))
L += ['### Out-of-scope kinds', ''] + [f'- {k}: {v}' for k, v in oos.most_common()] + ['']
ops = collections.Counter(r['meta'].get('op', '').split(':')[0] or r['source'].split(':')[-1] for r in rows if r['task'] == 'edit')
L += ['### Edit operations', ''] + [f'- {k}: {v}' for k, v in ops.most_common()] + ['']
dom = collections.Counter(r['meta'].get('domain', '?') for r in rows)
L += [f'### Domains: {len(dom)} distinct', '', 'Top 25: ' + ', '.join(f'{k} ({v})' for k, v in dom.most_common(25)), '', 'Smallest: ' + ', '.join(f'{k} ({v})' for k, v in dom.most_common()[-15:]), '']
tk = sorted(r['meta']['tokens'] for r in rows)
q = lambda p: tk[int((len(tk) - 1) * p)]
L += ['### Program tokens (planned tokenizer, target program)', '', f'mean {statistics.mean(tk):.1f}, median {q(.5)}, p10 {q(.1)}, p90 {q(.9)}, p99 {q(.99)}, max {tk[-1]}', '']
rl = sorted(len(r['request'].split()) for r in rows)
L += ['### Request length (words)', '', f'mean {statistics.mean(rl):.1f}, median {rl[len(rl)//2]}, p10 {rl[int(len(rl)*.1)]}, p90 {rl[int(len(rl)*.9)]}, max {rl[-1]}', '']
std = sum(1 for r in rows if any(w in r['program'] for w in ['\nquick ', '\nform ', '\nlist ', '\nlog ', '\ngoal ', '\nstat ', '\ndaybars ']))
cust = sum(1 for r in rows if '\ndraw' in r['program'] or '\ngrid' in r['program'] or '\nbox' in r['program'] or '\ntimer' in r['program'])
L += ['### Program kind', '', f'- programs using std shortcuts (form/list/quick/goal/stat/daybars...): {std} ({std*100/len(rows):.0f}%)', f'- programs with custom level-1 pieces (draw/grid/box/timer): {cust} ({cust*100/len(rows):.0f}%)', f'- hand-written pairs (all hand-* methods): {hand} ({hand*100/len(rows):.1f}%)', '']
progs=collections.Counter(r['program'] for r in rows)
L += ['### Programs', '', f'- distinct target programs: {len(progs)}; most repeated program appears {progs.most_common(1)[0][1]} times; mean requests per program {len(rows)/len(progs):.2f}', '']
fam2=collections.Counter()
for r in rows:
    src=r['source']
    fam2['templated wording' if src.startswith('v1:template') or src.startswith('v1:edit-template') or src.startswith('v1:oos') else 'haiku real wording' if src.startswith('real') else 'sonnet hand2' if src.startswith('hand2') else 'v1 hand' if src.startswith('v1:hand') else 'v1 mutate (corpus wording + clause)']+=1
L += ['### Wording origin', '', '| origin | n | share |', '|---|---:|---:|'] + [f'| {k} | {v} | {v*100/len(rows):.1f}% |' for k,v in fam2.most_common()] + ['']
ask=sum(1 for r in rows if r['meta'].get('style') in ('ask','hurried','fuller') and r['program'].startswith('ask '))
L += ['### Shares', '', f"- edits: {sum(1 for r in rows if r['task']=='edit')*100/len(rows):.1f}%  ask: {ask*100/len(rows):.1f}%  out-of-scope: {sum(1 for r in rows if r['meta'].get('oos'))*100/len(rows):.1f}%", '']
if build:
    L += ['### Build funnel', '', '```json', json.dumps({'candidates': build.get('candidates'), 'final': build.get('final'), 'drops': build.get('drops')}, indent=1), '```', '']
open(os.path.join(out, 'STATS.md'), 'w').write('\n'.join(L) + '\n')
random.seed(11)
NS = 40 if stem=='v2' else 30
S = ['# %d random pairs' % NS, '']
for i, r in enumerate(random.sample(rows, NS), 1):
    S += [f'## {i}. {r["task"]} | {r["source"]} | {r["meta"].get("style")} | {r["meta"].get("domain")} | {r["meta"]["tokens"]} tokens', '', f'**Request:** {r["request"]}', '']
    if r['task'] == 'edit': S += ['Program before:', '```', r['program_before'].rstrip(), '```', '']
    S += ['Target program:', '```', r['program'].rstrip(), '```', '']
open(os.path.join(out, 'SAMPLES.md'), 'w').write('\n'.join(S) + '\n')
print(len(rows), 'stats written')
