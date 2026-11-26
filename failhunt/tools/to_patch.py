#!/usr/bin/env python3
"""Convert full-program edit pairs to patch operations and back. python3 tools/to_patch.py stats|show ...
Ops (line numbers refer to the OLD program, 1-based):
  replace A-B: <new lines>      delete A-B      insert after K: <new lines>      move A-B after K
The patch is what the model would write instead of the whole program; the app applies it."""
import json,sys,difflib,statistics as st
def to_patch(old,new):
    a=old.rstrip('\n').split('\n'); b=new.rstrip('\n').split('\n')
    sm=difflib.SequenceMatcher(None,a,b,autojunk=False); ops=[]
    for tag,i1,i2,j1,j2 in sm.get_opcodes():
        if tag=='equal': continue
        if tag=='replace': ops.append(('replace',i1+1,i2,b[j1:j2]))
        elif tag=='delete': ops.append(('delete',i1+1,i2,[]))
        elif tag=='insert': ops.append(('insert',i1,i1,b[j1:j2]))
    # moves: a delete whose lines equal an insert elsewhere
    out=[]; used=set()
    for k,o in enumerate(ops):
        if o[0]=='delete':
            blk=a[o[1]-1:o[2]]
            for m,p in enumerate(ops):
                if m!=k and m not in used and p[0]=='insert' and p[3]==blk:
                    out.append(('move',o[1],o[2],p[1])); used.add(m); used.add(k); break
    res=[]
    for k,o in enumerate(ops):
        if k in used:
            continue
        res.append(o)
    return out+res
def fmt(ops):
    s=[]
    for o in ops:
        if o[0]=='move': s.append(f'move {o[1]}-{o[2]} after {o[3]}')
        elif o[0]=='delete': s.append(f'delete {o[1]}-{o[2]}' if o[2]>o[1] else f'delete {o[1]}')
        elif o[0]=='insert': s.append(f'insert after {o[1]}:\n'+'\n'.join(o[3]))
        else: s.append(f'replace {o[1]}-{o[2]}:\n'+'\n'.join(o[3]) if o[2]>o[1] else f'replace {o[1]}:\n'+'\n'.join(o[3]))
    return '\n'.join(s)
def apply(old,ops):
    a=old.rstrip('\n').split('\n'); n=len(a)
    # apply from the bottom so earlier line numbers stay valid; moves handled first by extracting
    items=[]
    moved={}
    for o in ops:
        if o[0]=='move': moved[(o[1],o[2])]=o[3]
    keep=[True]*n; ins={}
    for o in ops:
        if o[0]=='replace':
            for i in range(o[1]-1,o[2]): keep[i]=False
            ins.setdefault(o[1]-1,[]).append(('before',o[3]))
        elif o[0]=='delete':
            for i in range(o[1]-1,o[2]): keep[i]=False
        elif o[0]=='insert': ins.setdefault(o[1],[]).append(('after',o[3]))
    for (a1,a2),k in moved.items():
        for i in range(a1-1,a2): keep[i]=False
        ins.setdefault(k,[]).append(('after',a[a1-1:a2]))
    out=[]
    for i in range(n+1):
        for kind,l in ins.get(i-1+1 if False else i,[]):
            pass
    # simple pass: position p means "after old line p" (0 = before first); replace inserts at its start position (before line A -> after A-1)
    pos={}
    for o in ops:
        if o[0]=='replace': pos.setdefault(o[1]-1,[]).extend(o[3])
        elif o[0]=='insert': pos.setdefault(o[1],[]).extend(o[3])
    for (a1,a2),k in moved.items(): pos.setdefault(k,[]).extend(a[a1-1:a2])
    out=list(pos.get(0,[]))
    for i in range(n):
        if keep[i]: out.append(a[i])
        out.extend(pos.get(i+1,[]))
    return '\n'.join(out)+'\n'
if __name__=='__main__':
    if sys.argv[1]=='stats':
        rows=[json.loads(l) for l in open('/home/oye/Documents/free_work/molde-model/data-v31/v3.1.jsonl')]
        ed=[r for r in rows if r['task']=='edit']
        ok=0;nops=[];ratio=[];tokfull=[];tokpatch=[];bad=[]
        for r in ed:
            b=(r.get('before') or r.get('program_before')); a=r['program']
            ops=to_patch(b,a)
            same=apply(b,ops).rstrip('\n').split('\n')==a.rstrip('\n').split('\n')
            ok+=same
            if not same: bad.append(r['id']); continue
            nops.append(len(ops)); p=fmt(ops); tokpatch.append(len(p)/3.5); tokfull.append(len(a)/3.5)
        n=len(ed)
        print('edit pairs',n,'round trip exact',ok,f'({100*ok/n:.1f}%)')
        print('ops per edit: median',st.median(nops),'<=1:',sum(1 for x in nops if x<=1),'<=3:',sum(1 for x in nops if x<=3),'>6:',sum(1 for x in nops if x>6))
        print('tokens (chars/3.5) full program median',round(st.median(tokfull)),'p90',round(sorted(tokfull)[int(.9*len(tokfull))]),'| patch median',round(st.median(tokpatch)),'p90',round(sorted(tokpatch)[int(.9*len(tokpatch))]))
        print('output-size ratio patch/full: median',round(st.median(p/f for p,f in zip(tokpatch,tokfull)),3))
        print('not round-trippable',bad[:5])
    elif sys.argv[1]=='show':
        for l in open(sys.argv[2]):
            r=json.loads(l)
            if r.get('kind')!='edit': continue
            ops=to_patch(r['before'],r['program']); assert apply(r['before'],ops).rstrip('\n').split('\n')==r['program'].rstrip('\n').split('\n'),r['id']
            print('##',r['id'],r['request']); print(fmt(ops)); print()
