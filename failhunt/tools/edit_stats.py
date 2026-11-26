#!/usr/bin/env python3
"""Edit statistics from chain results. python3 tools/edit_stats.py results/gemma-r3.jsonl"""
import json,sys,collections,statistics as st
rows=[json.loads(l) for l in open(sys.argv[1]) if l.strip()]
ch=[r for r in rows if r['type']=='chain']
ok=[c for c in ch if not c.get('seed_failed')]
print('chains',len(ch),'seed failed',len(ch)-len(ok),'long',sum(1 for c in ok if c.get('long')))
def did(s):
    if s['k']=='renamefield': return bool(s.get('did_raw')) and s.get('applied')
    return s.get('did_final')
steps=[(c,s) for c in ok for s in c['steps'] if not s.get('na')]
na=collections.Counter(s['k'] for c in ok for s in c['steps'] if s.get('na'))
print('steps run',len(steps),'n/a',sum(na.values()))
def model(s): return str(s.get('route'))=='model'
by=collections.defaultdict(lambda:collections.Counter())
for c,s in steps:
    k=s['k']; b=by[k]; b['n']+=1
    if s['k']=='vague': 
        b['changed']+=1 if s.get('applied') else 0; continue
    if s['k']=='refuse':
        b['unchanged']+=1 if not s.get('applied') else 0; continue
    b['did']+=1 if did(s) else 0
    b['did_raw']+=1 if (s.get('did_raw') or (k=='renamefield' and s.get('did_raw'))) else 0
    b['direct']+=1 if not model(s) else 0
    b['noop']+=1 if (model(s) and s['diff_raw'].get('noop')) else 0
    b['blocked']+=1 if str(s.get('outcome','')).startswith('blocked') else 0
    b['blocked_but_right']+=1 if (str(s.get('outcome','')).startswith('blocked') and s.get('did_raw')) else 0
    b['checker_fail']+=1 if s.get('outcome')=='failed_checker' else 0
    b['refused_data']+=1 if s.get('outcome')=='refused_data' else 0
    b['lost']+=1 if (model(s) and s['diff_raw'].get('lost') and s.get('applied')) else 0
print(f"{'kind':12}{'n':>4}{'did':>5}{'raw':>5}{'direct':>7}{'noop':>5}{'blk':>4}{'blk+ok':>7}{'chk':>4}{'refd':>5}{'lostapp':>8}  na")
for k,b in sorted(by.items()):
    print(f"{k:12}{b['n']:4}{b['did']:5}{b['did_raw']:5}{b['direct']:7}{b['noop']:5}{b['blocked']:4}{b['blocked_but_right']:7}{b['checker_fail']:4}{b['refused_data']:5}{b['lost']:8}  {na.get(k,0)}")
ms=[s for c,s in steps if model(s)]
oc=collections.Counter(s['outcome'] for s in ms)
print('model-path steps',len(ms),dict(oc.most_common()))
print('model steps unrequested-change rate: applied with kept<0.9:', sum(1 for s in ms if s.get('applied') and s['diff_raw']['kept_ratio']<0.9))
for grp,name in ((False,'short chains'),(True,'long chains')):
    sub=[(c,s) for c,s in steps if bool(c.get('long'))==grp and s['k'] not in('vague','refuse')]
    sm=[s for c,s in sub if model(s)]
    print(name,'steps',len(sub),'did',sum(1 for c,s in sub if did(s)),'| model-path',len(sm),'did',sum(1 for s in sm if did(s)),'noop',sum(1 for s in sm if s['diff_raw'].get('noop')),'blocked',sum(1 for s in sm if str(s['outcome']).startswith('blocked')),'chk',sum(1 for s in sm if s['outcome']=='failed_checker'))
print('model seconds median',st.median([s['seconds'] for s in ms if s.get('seconds') is not None]),'p90',sorted([s['seconds'] for s in ms if s.get('seconds') is not None])[int(0.9*len(ms))],'median tokens',st.median([s['tokens'] for s in ms if s.get('tokens')]))
nl=[s for s in ms if s.get('intercepted_newapp')]; print('intercepted as new-app:',[(s['request'],s['k']) for s in nl])
hang=[s for s in ms if 'hang' in json.dumps((s.get('gen') or {}).get('errors') or '')]
print('native hangs',len(hang),[(s['request']) for s in hang])
# model-path correct rate excluding noop on kinds with a definite target
defk=[s for s in ms if s['k'] not in ('vague','refuse')]
print('model-path definite-kind steps',len(defk),'did',sum(1 for s in defk if did(s)),f"{100*sum(1 for s in defk if did(s))/len(defk):.1f}%",'did_raw',sum(1 for s in defk if s.get('did_raw')))
