#!/usr/bin/env python3
"""Numbers of the controls from results/ctrl-*.jsonl -> printed (redirect to controls/summary.txt)."""
import json,glob,os,collections
def load(p): return [json.loads(l) for l in open(p) if l.strip()] if os.path.exists(p) else []
base={r['id']:r for r in load('results/gemma-r3.jsonl') if r['type']=='create'}
print('== 12 tries per line on the creates that failed the checker (r3, decode_loop with k < 12)')
k=load('results/ctrl-k12-r3.jsonl'); 
if k:
    ok=sum(1 for r in k if r['ok']); n=len(k); fails=sum(1 for r in base.values() if not r['ok'])
    print(f'  finished {n} of {fails} failed creates: {ok} now pass the checker ({100*ok/n:.0f}%); median seconds {sorted(r["seconds"] for r in k if r.get("seconds"))[n//2]:.1f}')
    still=[r['id'] for r in k if not r['ok']]; print('  still failing:',still[:20])
print('== raw asks: allowAsk true for every request (the no-ask rule off)')
a=load('results/ctrl-ask-r3.jsonl')
if a:
    n=len(a); asked=sum(1 for r in a if r.get('asked')); print(f'  {n} creates: asked instead of building {asked} ({100*asked/n:.1f}%); with the rule 0 of 407')
print('== three sampled creates per request (temperature 0.7, seeds 1 to 3), r3')
S=[load(f'results/ctrl-s{i}-r3.jsonl') for i in (1,2,3)]
if all(S) and min(len(s) for s in S)>=300:
    m=min(len(s) for s in S); ids=[r['id'] for r in S[0][:m]]
    d={i:{r['id']:r for r in s} for i,s in enumerate(S)}
    greedy=sum(1 for i in ids if base[i]['ok']); pass_each=[sum(1 for i in ids if d[j].get(i,{}).get('ok')) for j in range(3)]
    any3=sum(1 for i in ids if any(d[j].get(i,{}).get('ok') for j in range(3)))
    anyg=sum(1 for i in ids if base[i]['ok'] or any(d[j].get(i,{}).get('ok') for j in range(3)))
    print(f'  {m} requests: greedy pass {greedy}; sampled pass per seed {pass_each}; pass@3 sampled {any3}; greedy-or-3-samples {anyg} ({100*anyg/m:.1f}%)')
    rescued=sum(1 for i in ids if not base[i]['ok'] and any(d[j].get(i,{}).get("ok") for j in range(3)))
    print(f'  greedy failed but a sample passes: {rescued} of {sum(1 for i in ids if not base[i]["ok"])}')
print('== the 126 edit steps that came back unchanged, replayed')
g=load('results/ctrl-noop-greedy.jsonl'); 
if g:
    print(f'  greedy replay: {len(g)} steps, unchanged again {sum(1 for r in g if r.get("noop"))}, right {sum(1 for r in g if r.get("did_final"))}')
for i in (1,2,3):
    s=load(f'results/ctrl-noop-s{i}.jsonl')
    if s: print(f'  sample seed {i}: {len(s)} steps, unchanged {sum(1 for r in s if r.get("noop"))}, right {sum(1 for r in s if r.get("did_final"))}, applied wrong or blocked {sum(1 for r in s if not r.get("noop") and not r.get("did_final"))}')
s=[load(f'results/ctrl-noop-s{i}.jsonl') for i in (1,2,3)]
if all(s) and len(s[0])>=100:
    ids=[r['id'] for r in s[0]]; d=[{r['id']:r for r in x} for x in s]
    best=sum(1 for i in ids if any(dd.get(i,{}).get('did_final') for dd in d)); print(f'  right in at least one of the 3 samples: {best} of {len(ids)}')
