#!/usr/bin/env python3
import json, collections, statistics, random, re, os
rows=[json.loads(l) for l in open('v3.jsonl')]
build=json.load(open('out/build-v3.json'))
sim=json.load(open('heldout_similarity.json'))
N=len(rows)
src=collections.Counter()
for r in rows:
    s=r['source']; src[s.split(':')[0]+(':'+s.split(':')[1] if s.startswith('v3:') else '')]+=1
def tag(r):
    m=re.match(r'^hand3:(\w+)',r['source']); return m.group(1) if m else None
cnt=collections.Counter(tag(r) for r in rows if tag(r))
area={'c':'calculators (c1-c4)','d':'developer and team tools (d1-d3)','t':'type-mistake apps (t1-t2)','r':'rich creates (r1-r8)'}
by=collections.Counter()
for t,n in cnt.items(): by[area[t[0]]]+=n
named=sum(1 for r in rows if r['source']=='v3:named-ask-build')
short=[r for r in rows if r['source']=='v3:short-named']
mt=[r for r in rows if r['source']=='v3:multi-turn']
cm=[r for r in rows if r['source']=='v3:change-mode-new-app']
le=[r for r in rows if r['source'].startswith('v3:long-edit')]
se=[r for r in rows if r['source'].startswith('v3:small-edit')]
ops=collections.Counter(r['source'].split(':')[-1] for r in le); sops=collections.Counter(r['source'].split(':')[-1] for r in se)
asks=[r for r in rows if r['program'].startswith('ask ') and r['task']=='create']
# short named requests: 1-3 words
def wc(r): return len(r['request'].split())
sh3=[r for r in rows if r['task']=='create' and wc(r)<=3 and '\nQuestion:' not in r['request']]
sh3_build=[r for r in sh3 if not r['program'].startswith('ask ')]
# look stats of new rich programs (hand3 + named builds)
rich=[r for r in rows if r['source'].startswith('hand3:') or r['source']=='v3:named-ask-build']
def has(p,pat): return re.search(pat,p,re.M) is not None
L=sorted(len(r['program'].strip().split('\n')) for r in rich)
lk={'topbar':sum(has(r['program'],r'^topbar ') for r in rich),'chart_or_state':sum(has(r['program'],r'^\s*(goalbars|daybars|bars|trend|heat|daygrid|weekdots|share|plot)|^state |^\s*draw|^draw') for r in rich),'always_open_form':sum(has(r['program'],r'^form ') for r in rich),'dark':sum(has(r['program'],r'^app "[^"]*" \w+ \w+ dark') for r in rich),'accent_word':sum(has(r['program'],r'^app "[^"]*" \w+ (red|orange|yellow|green|teal|blue|purple|pink|grey)\b') for r in rich)}
v2rows=[r for r in rows if r['source'].startswith('v2:')]
V2L=sorted(len(r['program'].strip().split('\n')) for r in v2rows if not r['program'].startswith('ask '))
keep=[r['meta']['keep_others'] for r in le]
tk=sorted(r['meta']['tokens'] for r in rows)
j=build['info']['judge']
jt=sum(v['n'] for v in j.values()); jok=sum(v['target_ok'] for v in j.values()); jreq=sum(v['request_ok'] for v in j.values())
md=['# Dataset v3.0 statistics','',f'file: `v3.jsonl` pairs: **{N}**  language commit `{rows[0]["meta"]["language_commit"]}` (round 13: accent themes, dark word, topbar/statcard/section/goalbars/daygrid/weekdots)','',
'Freeze: v3.0 was frozen at 02:2x on 2026-11-25 from what was verified; v3.1 continues toward the full spec.','',
'## Counts per v3-SPEC row','',
'| row | target | v3.0 delivered | note |','|---|---|---:|---|',
f'| 1 relabel asks that name a thing as builds | all | {named} | v2 asks relabeled and given a build target (hand-written program, request kept); {build["info"]["v2_asks_relabeled_to_builds"]} v2 rows were relabeled, {named} survived the held-out similarity and judge filters; {len(asks)} unnamed asks remain |',
f'| 1 multi-turn `Request/Question/Answer` -> build | 400 | {len(mt)} | request field = original + `\\nQuestion: ..\\nAnswer: ..` (the app format); `user_text` has the exact user message |',
f'| 1 1-3 word named requests that build | at least 90% | {len(sh3_build)} of {len(sh3)} ({len(sh3_build)*100/max(1,len(sh3)):.0f}%) build | includes {len(short)} new short-name pairs |',
f'| 2 rich creates, demo style | 3,000 | {len(rich)} | hand-written by Sonnet for their own request (no templates); look stats below |',
f'| 3 requests list 3-6 needs, checked by a judge | all | {len(rich)} with needs in `meta.needs` | judge: target meets checklist {jok}/{jt} ({jok*100/jt:.0f}%), request mentions the needs {jreq}/{jt} ({jreq*100/jt:.0f}%); {build["info"]["judge_dropped"]} flagged programs dropped |',
f'| 4 calculators / converters | 800 | {cnt.get("c1",0)+cnt.get("c2",0)+cnt.get("c3",0)+cnt.get("c4",0)} | hand-written (c1-c4) |',
f'| 4 type-mistake apps | 300 | {cnt.get("t1",0)+cnt.get("t2",0)} | hand-written (t1-t2) |',
f'| 5 developer / team tools | 600 | {cnt.get("d1",0)+cnt.get("d2",0)+cnt.get("d3",0)} | hand-written (d1-d3) |',
f'| 6 long edits (25-90 lines) | 1,500 (at least 300 per kind) | {len(le)} | per kind: '+', '.join(f'{k} {v}' for k,v in sorted(ops.items()))+f' |',
f'| 6 small edits on short programs (colour word, title, setting with `set`) | (freeze priority 2) | {len(se)} | '+', '.join(f'{k} {v}' for k,v in sorted(sops.items()))+' |',
f'| 7 new app typed in change mode -> `ask "New app or change X?"` | 300 | {len(cm)} | |','',
'## What is incomplete (v3.0)','',
f'- Rich creates: {len(rich)} of 3,000; calculators {cnt.get("c1",0)+cnt.get("c2",0)+cnt.get("c3",0)+cnt.get("c4",0)} of 800; developer tools {cnt.get("d1",0)+cnt.get("d2",0)+cnt.get("d3",0)} of 600; type-mistake apps {cnt.get("t1",0)+cnt.get("t2",0)} of 300.',
'- Small-edit and long-edit programs are mechanical edits of real programs (the same operation on many bases); only the request wording is written by Haiku. Setting edits (176 small, some long) are fewer than 300 on short programs.',
'- Long base programs: the L2 writer padded about 50 programs with generic appended blocks to reach the line target (affects edit bases only).',
'- The 140 eval references, the 60 ask-test requests, the 40 change-test cases, `heldout_ids.txt` and `v2/heldout2.jsonl` are excluded; see `heldout_similarity.json`.','',
'## By source','','| source | n | share |','|---|---:|---:|']+[f'| {k} | {v} | {v*100/N:.1f}% |' for k,v in src.most_common()]+['',
'## Rich creates: look (new hand-written programs)','',
f'- median lines {statistics.median(L)} (v2 programs: median {statistics.median(V2L)}); topbar {lk["topbar"]*100/len(rich):.0f}%; chart or state UI {lk["chart_or_state"]*100/len(rich):.0f}%; always-open top-level form {lk["always_open_form"]*100/len(rich):.0f}%; accent colour word {lk["accent_word"]*100/len(rich):.0f}%; dark {lk["dark"]*100/len(rich):.0f}%',
f'- long edits: mean share of unchanged lines kept {statistics.mean(keep):.3f}, minimum {min(keep):.3f} (target at least 0.95)','',
f'## Tokens (planned tokenizer, target program)','',f'median {statistics.median(tk)}, p90 {tk[int(len(tk)*.9)]}, p99 {tk[int(len(tk)*.99)]}, max {tk[-1]}. Limit 500 for creates and small edits; 900 for long programs (`meta.long`), both before and after.','',
'## Held-out similarity check','',f'Every request was compared with {sim["held_requests_compared"]} held-out requests (heldout_ids, heldout2, 140 eval-novel, 60 ask-test, 40 change-test; token Jaccard, and an identical-content-key test) and dropped at similarity >= {sim["threshold"]}.',
'',f'- histogram of max similarity: {sim["histogram_max_similarity"]}',f'- dropped by set: {sim["dropped_by_set"]}','',
'## Judge sample files','',*[f'- {k}: {v["n"]} judged, program meets checklist {v["target_ok"]}, request matches checklist {v["request_ok"]}' for k,v in j.items()],'',
'## Build funnel','','```json',json.dumps({'candidates':build['candidates'],'final':build['final'],'drops':build['drops']},indent=1),'```','']
open('STATS.md','w').write('\n'.join(md)+'\n')
random.seed(21)
S=['# 40 random pairs','']
for i,r in enumerate(random.sample(rows,40),1):
    S+=[f'## {i}. {r["task"]} | {r["source"]} | {r["meta"].get("style")}','',f'**Request:** {r["request"]}','']
    if r['task']=='edit': S+=['Program before:','```',r['program_before'].rstrip()[:1500],'```','']
    S+=['Target program:','```',r['program'].rstrip(),'```','']
open('SAMPLES.md','w').write('\n'.join(S)+'\n')
print('ok',N)
