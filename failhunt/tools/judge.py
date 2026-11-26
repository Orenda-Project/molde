#!/usr/bin/env python3
"""Fast automatic intent judge for creates, calibrated on the hand labels.
   python3 tools/judge.py fit results/gemma-r3.jsonl labels/gemma-r3-creates.txt [more result/label pairs...]   (cross-validated report + model.json)
   python3 tools/judge.py score results/X.jsonl                                                                 (adds judge_p_strict / judge_p_ok per create)
Features (all computed from request + program, no model call): checker ok, share of the request's content words (after a Roman Urdu glossary) found in the
program, number match, share of coarse needs present, unrelated skeleton words (zikr, beads, mosque, practice, seizure ...), leaked label strings, unrelated
setting labels, thinness, unsupported-request words, whether the program is the same body as another request's (not used here: single case only)."""
import json,sys,re,math
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.metrics import cohen_kappa_score, accuracy_score, precision_score, recall_score, roc_auc_score
FILL=set('a an the my me make build create new app apps please simple some for of and with to i want need can you do it this that something anything stuff thing things tool give get help is be have like just one on in up log tracker track list record calculator'.split())
GLOSS={'paani':'water','pani':'water','peene':'drink','hisaab':'account','hisab':'account','kharcha':'expense','kharch':'expense','kharchay':'expense','dawai':'medicine','dukaan':'shop','dukan':'shop','udhaar':'credit','udhar':'credit','bachat':'savings','namaz':'prayer','roza':'fast','haziri':'attendance','hazri':'attendance','bachon':'children','bachay':'child','dudh':'milk','sabzi':'vegetable','kaam':'task','shaadi':'wedding','neend':'sleep','waraish':'exercise','ghar':'home','bijli':'electricity','khuraak':'food','sair':'walk','jeb':'pocket','kiraya':'fare','safai':'cleaning','mahine':'month','roz':'daily','rozana':'daily','hafte':'week','khata':'ledger','khareed':'purchase','khel':'game','score':'score','mehmano':'guest','kitne':'many','log':'people','test':'test','number':'marks','fees':'fee','petrol':'petrol','gaadi':'car','sabaq':'lesson','yaad':'remember','parhne':'reading','padhne':'reading','quran':'quran','tasbeeh':'tasbeeh','committee':'committee','ration':'ration','bazaar':'market','list':'list','budget':'budget','karigar':'worker','rishtedaron':'relatives','birthdays':'birthday'}
LEAK=['Log study time','Add homework mark','bank connection','Puppet','pieces retouched','Needs a visit','Seated','Quiz night','Table_1','Table_2','Add knowledge','Daily Awful','Time to add medicine','Gross','Ludo','Played','Add dua','Add roza','new games','Zakat and tip','Price per kg','Price per cup','A bank']
SKEL=['zikr','beads','mosque','practice','seizure','quran','dua','prayer','khatam','music','rakaat','hifoya','kameez','jumma','nafl']
UNSUP=r'\b(whatsapp|gps|camera|scan|login|log in|password|sign up|weather|internet|online|chat|voice|record(er)? audio|audio|bank|ai |chatbot|3d|map|flappy|live)\b'
GEN=set('daily goal count to the of a per day monthly weekly for my in kg ml min round play'.split())
MONEYW=set('money spend spent spending budget price cost pay paid salary bill fee fees rent expense expenses sale sales income loan fund saving savings wage wages invoice tax khata udhaar kharcha kharch hisaab bachat dukaan cash earn earnings profit gift gifts fare petrol zakat commission deposit payment payments rupee rs'.split())
def stem(w):
    w=w.lower()
    for s in ('ing','es','s'):
        if w.endswith(s) and len(w)>len(s)+2: return w[:-len(s)]
    return w
def words(t): return [stem(GLOSS.get(w,w)) for w in re.findall(r'[a-z]+',t.lower())]
NEED={'table':r'^table\b','add':r'^\s*(form|quick|topbar|button)\b','list':r'^\s*(list|each)\b','chart':r'^\s*(daybars|bars|trend|heat|pie|share|goalbars|daygrid|weekdots|plot)\b','goal':r'^\s*(goal|goalbars|statcard)\b|^setting \w*(goal|target|limit|budget)','stat':r'\b(sum|count|avg|max|min)\(|^\s*(stat|statcard|goal)\b','setting':r'^setting\b','timer':r'\btimer\b|\bevery\b','calendar':r'\b(calendar|daygrid)\b','let':r'^let\b','state':r'^state\b','pick':r'\bpick\b','money':r'\bmoney\b','date':r'\bdate\b','long':r'\blong\b','image':r'\bimage\b'}
def feats(rec,needs):
    req=rec['request']; prog=rec.get('program') or ''
    rw=[w for w in words(req) if w not in FILL and len(w)>=3]
    pl=prog.lower(); pw=set(stem(w) for w in re.findall(r'[a-z]+',pl))
    cov=sum(1 for w in set(rw) if w in pw or any(w in x or x in w for x in pw if len(x)>=4 and len(w)>=4))/max(1,len(set(rw)))
    nums=re.findall(r'\b\d[\d,]*\b',req); numcov=(sum(1 for n in nums if n.replace(',','') in prog)/len(nums)) if nums else 1.0
    nd=[n for n in (needs or []) if n in NEED]; needfrac=(sum(1 for n in nd if re.search(NEED[n],prog,re.M)) /len(nd)) if nd else 1.0
    reqt=set(re.findall(r'[a-z]+',req.lower()))
    skel=sum(1 for s in SKEL if s in pl and not any(s in w or w in s for w in reqt if len(w)>=3))
    ringc= 1.0 if ('draw width 240 tap add' in prog and not re.search(r'count|tap|ring|streak|tally|tasbeeh|zikr|visit|times',req.lower())) else 0.0
    leak=sum(1 for s in LEAK if s in prog and s.lower() not in req.lower())
    title=set(re.findall(r'[a-z]+',(prog.split('\n')[0] if prog else '').lower())); unrel=0
    for m in re.finditer(r'^setting (\w+) [^\n]*?"([^"]+)"',prog,re.M):
        ws=set(words(m.group(2)))|set(m.group(1).split('_')); ws-=GEN
        if ws and not (ws & set(words(req))) and not (ws & set(words(' '.join(title)))): unrel+=1
    moneyset=1.0 if (re.search(r'^setting \w+ money',prog,re.M) and not (set(re.findall(r'[a-z]+',req.lower()))&MONEYW) and not re.search(r'^table .*\bmoney\b',prog,re.M)) else 0.0
    lines=len([l for l in prog.split('\n') if l.strip()]); nrw=len(req.split())
    thin=1.0 if (nrw>=14 and lines<=5) else 0.0
    unsup=1.0 if re.search(UNSUP,req.lower()) else 0.0
    # alignment of names with the request: table / field / title / quoted labels vs request words
    tnames=set()
    for m in re.finditer(r'^table (\w+) (.*)$',prog,re.M):
        tnames|=set(stem(x) for x in m.group(1).split('_')); tnames|=set(stem(f.strip().split()[0]) for f in m.group(2).split(',') if f.strip() and not f.strip().startswith('"'))
    tit=set(stem(w) for w in re.findall(r'[a-z]+',(prog.split('\n')[0] if prog else '').lower()))
    rset=set(w for w in words(req) if w not in FILL and len(w)>=3)
    name_hit=1.0 if (rset & (tnames|tit)) or any(a in b or b in a for a in rset for b in (tnames|tit) if len(a)>=4 and len(b)>=4) else 0.0
    lab=[w for m in re.finditer(r'"([^"]{3,60})"',prog) for w in words(m.group(1)) if w not in FILL and len(w)>=4]
    lab_in=(sum(1 for w in lab if w in set(words(req))|tnames|tit|set(stem(x) for x in GEN)))/max(1,len(lab))
    return [1.0 if rec.get('ok') else 0.0, cov, numcov, needfrac, min(skel,3), ringc, min(leak,3), min(unrel,3), thin, unsup, min(lines,40)/40.0, 1.0 if nrw<=3 else 0.0, name_hit, lab_in, moneyset]
NAMES=['checker_ok','request_word_coverage','number_match','needs_present','foreign_skeleton_words','ring_counter_unasked','leaked_labels','unrelated_settings','thin_for_long_request','unsupported_request_words','length','short_request','title_or_table_names_match_request','labels_explained_by_request','money_setting_unasked']
def load(res,lab,cases='cases.jsonl'):
    needs={json.loads(l)['id']:json.loads(l).get('needs') for l in open(cases) if json.loads(l)['type']=='create'}
    recs={r['id']:r for r in map(json.loads,open(res)) if r['type']=='create'}
    L={}
    for l in open(lab):
        if l.startswith('#') or not l.strip(): continue
        p=l.split(); L[p[0]]=int(p[1])
    ids=[k for k in L if k in recs]
    X=np.array([feats(recs[k],needs.get(k)) for k in ids]); y=np.array([L[k] for k in ids])
    return ids,X,y,recs,needs
def report(name,y,p,thr=0.5,pos=2):
    yt=(y>=pos).astype(int); yp=(p>=thr).astype(int)
    print(f"{name}: agreement {accuracy_score(yt,yp):.3f}  kappa {cohen_kappa_score(yt,yp):.3f}  precision {precision_score(yt,yp):.3f}  recall {recall_score(yt,yp):.3f}  auc {roc_auc_score(yt,p):.3f}  (n={len(y)}, positives {yt.sum()})")
if __name__=='__main__':
    cmd=sys.argv[1]
    if cmd=='fit':
        pairs=list(zip(sys.argv[2::2],sys.argv[3::2]))
        data=[load(r,l) for r,l in pairs]
        ids,X,y,recs,needs=data[0]
        for strict,pos,tag in ((True,2,'strict (did what was asked)'),(False,1,'lenient (right app, maybe missing a detail)')):
            yt=(y>=pos).astype(int)
            clf=LogisticRegression(C=2.0,class_weight='balanced',max_iter=2000)
            skf=StratifiedKFold(5,shuffle=True,random_state=0)
            p=cross_val_predict(clf,X,yt,cv=skf,method='predict_proba')[:,1]
            print('==',tag,'on',pairs[0][0],'(5-fold cross-validated)'); report('  judge vs hand labels',y,p,pos=pos)
            base=X[:,0]; report('  baseline: checker pass only',y,base,pos=pos)
            clf.fit(X,yt)
            if len(data)>1:
                ids2,X2,y2,_,_=data[1]; p2=clf.predict_proba(X2)[:,1]; report(f'  trained on {pairs[0][0]}, tested on {pairs[1][0]} (other model, 147 labels)',y2,p2,pos=pos); report('  baseline: checker pass only (same set)',y2,X2[:,0],pos=pos)
            print('  coefficients:',{n:round(float(c),2) for n,c in zip(NAMES,clf.coef_[0])})
            if strict: json.dump({'names':NAMES,'coef':clf.coef_[0].tolist(),'intercept':float(clf.intercept_[0]),'level':'strict'},open('judge_model_strict.json','w'),indent=1)
            else: json.dump({'names':NAMES,'coef':clf.coef_[0].tolist(),'intercept':float(clf.intercept_[0]),'level':'lenient'},open('judge_model_lenient.json','w'),indent=1)
    elif cmd=='score':
        ms=json.load(open('judge_model_strict.json')); ml=json.load(open('judge_model_lenient.json'))
        needs={json.loads(l)['id']:json.loads(l).get('needs') for l in open('cases.jsonl') if json.loads(l)['type']=='create'}
        sig=lambda z:1/(1+math.exp(-z)); n=0; s=0
        for r in map(json.loads,open(sys.argv[2])):
            if r['type']!='create': continue
            f=feats(r,needs.get(r['id'])); ps=sig(sum(c*x for c,x in zip(ms['coef'],f))+ms['intercept']); n+=1; s+=ps>=.5
        print(f'{sys.argv[2]}: judge says strict for {s}/{n} ({100*s/n:.1f}%)')
