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
    n=len(r['before'].rstrip().splitlines())
    if r['kind']=='edit_ask':
        return f"Edit request: `{r['request']}` on a {n}-line program (`{r['before'].splitlines()[0]}` ...)\n\nThe model's whole answer is this one ask line:\n```\n{r['answer']}\n```\nWhat the app does: {r['app_effect']}. Nothing is replaced.\n"
    ans=r.get('answer') or ''
    req=r['request'].replace('\n','  /  ')
    return f"Edit request: `{req}` on a {n}-line program (`{r['before'].splitlines()[0]}` ...)\n\nThe model's answer (patch operations on the numbered lines; the app applies them, the whole program is derived):\n```\n{ans}\n```\n"

t=open('DATA_SPEC_r5.template.md').read()
def rep(m):
    c=m.group(1); xs=ex.get(c,[])
    if not xs: return f'(no example for {c})'
    return '\n'.join(f"**Example {i+1}** ({r['id']})\n\n"+block(r) for i,r in enumerate(xs[:int(m.group(2) or 3)]))
import subprocess
def patchblock():
    out=[]
    for c in ('add_option','rename_button','long_edit_copy','remove_one'):
        for x in ex.get(c,[])[:1]:
            out.append(block(x))
    return '\n'.join(out)
t=t.replace('{{EX_PATCH}}',patchblock())
t=re.sub(r'\{\{EX:([a-z_]+)(?::(\d+))?\}\}',rep,t)
open('DATA_SPEC_r5.md','w').write(t); print('written',len(t))
