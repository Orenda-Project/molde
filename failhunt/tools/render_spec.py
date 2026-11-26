#!/usr/bin/env python3
"""Fills {{EX:class}} markers of DATA_SPEC_r5.template.md with the validated example pairs from spec/*.jsonl."""
import json,re,sys,difflib
ex={}
for f in ('spec/creates.jsonl','spec/edits.jsonl','spec/long_edits.jsonl'):
    try:
        for l in open(f):
            r=json.loads(l); ex.setdefault(r['class'],[]).append(r)
            if r['kind']=='create_plan': ex.setdefault('plan_line',[]).append(r)
    except FileNotFoundError: pass
def block(r):
    if r['kind']=='create_plan':
        return f"Request: `{r['request']}`\n\n```\n{r['plan']}\n{r['program'].rstrip()}\n```\n"
    if r['kind']=='create':
        return f"Request: `{r['request']}`\n\n```\n{r['program'].rstrip()}\n```\n"
    b=r['before'].splitlines(); a=r['program'].splitlines()
    d=[l for l in difflib.unified_diff(b,a,lineterm='',n=0) if not l.startswith(('---','+++','@@'))]
    if not d: d=['(no change: the program comes back exactly as it was)']
    shown='\n'.join(d[:14])+('\n... (%d more changed lines)'%(len(d)-14) if len(d)>14 else '')
    return f"Edit request: `{r['request']}` on a {len(b)}-line program (`{b[0]}` ...)\n\nChange (`-` old line, `+` new line):\n```\n{shown}\n```\n"
t=open('DATA_SPEC_r5.template.md').read()
def rep(m):
    c=m.group(1); xs=ex.get(c,[])
    if not xs: return f'(no example for {c})'
    return '\n'.join(f"**Example {i+1}** ({r['id']})\n\n"+block(r) for i,r in enumerate(xs[:int(m.group(2) or 3)]))
import subprocess
def patchblock():
    out=[]
    for r in ex.get('add_option',[])[:1]+ex.get('rename_button',[])[:1]+ex.get('long_edit_copy',[])[:1]+ex.get('remove_one',[])[:1]:
        sys.path.insert(0,'tools'); import to_patch as T
        ops=T.to_patch(r['before'],r['program']); assert T.apply(r['before'],ops).rstrip('\n').split('\n')==r['program'].rstrip('\n').split('\n')
        n=len(r['before'].rstrip('\n').split('\n'))
        out.append(f"Edit request: `{r['request']}` on a {n}-line program\n\nPatch the model would write instead of {len(r['program'].rstrip().splitlines())} lines:\n```\n{T.fmt(ops)}\n```\n")
    return '\n'.join(out)
t=t.replace('{{EX_PATCH}}',patchblock())
t=re.sub(r'\{\{EX:([a-z_]+)(?::(\d+))?\}\}',rep,t)
open('DATA_SPEC_r5.md','w').write(t); print('written',len(t))
