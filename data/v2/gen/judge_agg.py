import json,glob,os
res={}
acc={}
for f in sorted(glob.glob('judge/out-*.jsonl')):
    n=os.path.basename(f)[4:-6]
    rows=[json.loads(l) for l in open(f) if l.strip()]
    y=sum(r['verdict']=='yes' for r in rows);p=sum(r['verdict']=='partly' for r in rows);no=sum(r['verdict']=='no' for r in rows);u=sum(bool(r.get('unfaithful')) for r in rows)
    k=n.split('.')[0]; a=acc.setdefault(k,[0,0,0,0,0]); a[0]+=len(rows);a[1]+=y;a[2]+=p;a[3]+=no;a[4]+=u
for k,a in acc.items(): res[k]={'n':a[0],'yes':a[1],'partly':a[2],'no':a[3],'unfaithful':a[4],'yes_rate':round(a[1]/max(1,a[0]),3)}
json.dump(res,open('work/judge_result.json','w'),indent=1)
for k,v in res.items(): print(k,v)
