#!/usr/bin/env python3
"""Five model edits on a short app (made by the model from "reminders", under 20 lines) on the emulator.
Records seconds from Send to the answer, the answer, and whether the screen changed. Run after gauntlet_r4.py setup.
  tool/edits5.py            results: $OUT (default /tmp/molde-app-scratch/edits5.json)
"""
import json, os, re, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('OUT', '/tmp/molde-app-scratch/edits5_tmp.json')
import gauntlet_r3 as g
from gauntlet_r3 import ui, texts, has, send, wait_idle, chat_view, close_chat, set_mode, screen_texts, ensure_running
OUT = os.environ.get('EDITS_OUT', '/tmp/molde-app-scratch/edits5.json')
EDITS = ['add a note field', 'add a chart of the last 7 days', 'put the form at the top', 'remove the list at the bottom', 'rename the Add button to Save']
PREFIX = ('Done', 'Changed', "I couldn't", 'I changed something', 'I did not', 'I stopped because', 'That sounds like a new app', 'Made ', 'This change')

def answer():
    bot = [t for t in texts() if t.startswith(PREFIX)]
    return bot[-1] if bot else ''

ensure_running(); chat_view(); set_mode('new')
t0 = time.time(); send('reminders'); wait_idle(900)
res = {'create': {'seconds': round(time.time() - t0), 'reply': answer()[:160]}, 'edits': []}
close_chat(); time.sleep(2)
lines_hint = None
for req in EDITS:
    before = sorted(screen_texts()); chat_view(); set_mode('change')
    t = time.time(); send(req); wait_idle(900); secs = round(time.time() - t)
    r = answer(); close_chat(); time.sleep(3)
    after = sorted(screen_texts())
    row = {'request': req, 'seconds': secs, 'reply': r[:200], 'screen_changed': before != after, 'load': open('/proc/loadavg').read().split()[0]}
    res['edits'].append(row); print(json.dumps(row), flush=True)
    json.dump(res, open(OUT, 'w'), indent=1)
print('done')
