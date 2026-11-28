import json,sys,glob
S={json.loads(l)['id']:json.loads(l)['set'] for l in open('out/s5_cases.jsonl')}
for f in sorted(glob.glob('out/sx-*-ep?.jsonl')):
    rows=[json.loads(l) for l in open(f)]; r={'h2':[], 'ask':[]}
    for x in rows: r[S[x['id']]].append(x)
    fmt=lambda L: f"{sum(1 for x in L if x.get('ok'))}/{len(L)} valid, {sum(1 for x in L if x.get('asked'))} asked"
    print(f.split('/')[-1].ljust(24),'heldout2 creates:',fmt(r['h2']),'| 60 short asks:',fmt(r['ask']))
