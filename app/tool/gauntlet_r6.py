#!/usr/bin/env python3
"""Round 6 gauntlet for Molde 0.6.x on the emulator (1080x2400 at 420 dpi = 412x915 dp), driven over adb.

  gauntlet_r6.py create CASE "request"            New app mode: send, time first line and total, screenshot the built app
  gauntlet_r6.py change CASE "request" [app]      Change mode on the open app (or the named app): send, time, screenshot
  gauntlet_r6.py creates                          the 15 short create cases (C01..C15)
  gauntlet_r6.py shot NAME / dump                 helpers
Env: SHOTS (default ~/Documents/free_work/molde-design/app-r6/shots), OUT (default app/tool/gauntlet_r6_results.json).
Each case records: time to first progress line, total seconds, whether the model asked, the chat reply, the screen text,
memory (dumpsys meminfo TOTAL PSS) at the end. Evidence only: nothing here decides pass/fail except `built`/`asked`.
"""
import json, os, re, subprocess, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('OUT', '/tmp/molde-app-scratch/gauntlet_r3_tmp.json')
import gauntlet_r3 as g
from gauntlet_r3 import ui, adb, texts, has, tap, wait_for
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT6 = os.environ.get('OUT6', os.path.join(HERE, 'tool', 'gauntlet_r6_results.json'))
SHOTS = os.environ.get('SHOTS', os.path.expanduser('~/Documents/free_work/molde-design/app-r6/shots'))
os.environ['SHOTS'] = SHOTS
RES = json.load(open(OUT6)) if os.path.exists(OUT6) else {}

def save(case, rec):
    RES[case] = rec
    json.dump(RES, open(OUT6, 'w'), indent=1)
    print(case, json.dumps({k: v for k, v in rec.items() if k not in ('screen', 'chat')}), flush=True)

def shot(name):
    subprocess.run([sys.executable, os.path.join(HERE, 'tool', 'ui.py'), 'shot', name], env=os.environ)

def mem():
    out = adb('shell', 'dumpsys', 'meminfo', g.PKG)
    m = re.search(r'TOTAL PSS:\s+(\d+)', out) or re.search(r'TOTAL\s+(\d+)', out)
    return int(m.group(1)) // 1024 if m else None

def progress(ts):
    for t in ts:
        m = re.search(r'(Reading your request|Writing line \d+)[^\n]*', t)
        if m: return m.group(0)
    return None

def leave_settings():
    for _ in range(3):
        if has('Available models') or has('Privacy'): adb('shell', 'input', 'keyevent', 'KEYCODE_BACK'); time.sleep(2)

def run(case, request, mode, maxs=900):
    leave_settings(); g.ensure_running(); g.chat_view(); g.set_mode(mode)
    before = set(texts())
    t0 = time.time(); g.send(request)
    first = None; last = None; saw_stop = False
    while time.time() - t0 < maxs:
        ts = texts()
        p = progress(ts)
        if p and 'Writing line' in p and first is None: first = time.time() - t0
        if p: last = p
        busy = any(t == 'Stop' for t in ts)
        saw_stop = saw_stop or busy
        if saw_stop and not busy: break
        if not saw_stop and time.time() - t0 > 25 and not busy: break   # answered at once (exact edit, ask, clarifier)
        time.sleep(2)
    total = time.time() - t0
    ts = texts()
    new = [t for t in ts if t not in before]
    asked = any('Tap an answer, or type your own' in t for t in ts)
    chat = [t for t in new if t not in ('Stop', 'Send')][-6:]
    shot(case + '_chat')
    g.close_chat(); time.sleep(2)
    screen = [t for t in texts() if t not in ('Chat', 'Chat: create or change apps')]
    shot(case)
    rec = {'request': request, 'mode': mode, 'first_line_s': None if first is None else round(first, 1), 'total_s': round(total, 1),
           'last_progress': last, 'asked': asked, 'chat': chat, 'screen': screen[:60], 'lines_on_screen': len(screen), 'pss_mb': mem(),
           'model': os.environ.get('MODEL_TAG', ''), 'at': time.strftime('%H:%M:%S')}
    save(case, rec)
    return rec

CREATES = [
 ('C01', 'monthly household budget'), ('C02', 'salah tracker for five daily prayers'), ('C03', 'drink water reminder log'),
 ('C04', 'gym workout log with sets and reps'), ('C05', 'grocery shopping list'), ('C06', 'study timer for exams'),
 ('C07', 'rickshaw fare split between friends'), ('C08', 'quran reading progress'), ('C09', 'electricity units meter readings'),
 ('C10', 'daily expense tracker for the tea stall'), ('C11', 'baby feeding log'), ('C12', 'cricket match score sheet'),
 ('C13', 'weight loss diary'), ('C14', 'school homework planner for my kids'), ('C15', 'savings goal for a new phone'),
]

# (case, how to get the app, request). 'ex:NAME' = fresh copy of the example app (sample data), 'last:TITLE' = open the app with that title.
CHANGES = [
 ('X01', 'ex:water', 'make it purple'),
 ('X02', 'ex:water', 'add a note field'),
 ('X03', 'ex:water', 'rename the button + 250 ml to Big glass'),
 ('X04', 'ex:water', 'move the last 7 days chart above today'),
 ('X05', 'ex:water', 'remove the Not yet legend'),
 ('X06', 'ex:exercise', 'add a field for notes'),
 ('X07', 'ex:exercise', 'rename Log exercise to Add workout'),
 ('X08', 'ex:exercise', 'add a goal of 4 workouts a week'),
 ('X09', 'last:Phone fund', 'add a chart'),
 ('X10', 'last:Phone fund', 'make it dark mode'),
]

def nums(ts):
    return sorted(set(re.findall(r'\d[\d,\.]*', ' '.join(ts))))

def load_ex(name):
    g.apps_view()
    ui.adb('shell', 'input', 'swipe', '540', '2346', '540', '2346', '1500'); time.sleep(3)
    for _ in range(4):
        hit = None
        for n in ui.nodes():
            if (n.get('text') or n.get('content-desc') or '').strip() == name:
                x, y = ui.center(n)
                if 150 < y < 2380: hit = (x, y)
        if hit: ui.adb('shell', 'input', 'tap', str(hit[0]), str(hit[1])); break
        ui.adb('shell', 'input', 'swipe', '540', '2000', '540', '1100', '600'); time.sleep(3)
    time.sleep(8); g.close_chat()

def open_app(how):
    kind, name = how.split(':', 1)
    if kind == 'ex':
        g.ensure_running(); load_ex(name); time.sleep(3)
    else:
        g.apps_view(); time.sleep(1)
        g.tap(name, miny=1000); time.sleep(6); g.close_chat()

def do_change(case, how, request):
    leave_settings(); open_app(how)
    g.close_chat(); time.sleep(2)
    before = [t for t in texts() if t not in ('Chat', 'Chat: create or change apps')]
    shot(case + '_before')
    rec = run(case, request, 'change')
    after = rec['screen']
    lost = [n for n in nums(before) if n not in nums(after) and len(n) > 1]
    rec['data_numbers_before'] = nums(before)[:40]; rec['numbers_lost'] = lost
    rec['screen_before'] = before[:60]
    save(case, rec)

if __name__ == '__main__':
    c = sys.argv[1]
    if c == 'create': run(sys.argv[2], sys.argv[3], 'new')
    elif c == 'change': run(sys.argv[2], sys.argv[3], 'change')
    elif c == 'creates':
        pre = os.environ.get('PREFIX', 'C')   # C = Qwen run, G = Gemma run
        for case, r in CREATES:
            case = pre + case[1:]
            if case in RES and not os.environ.get('REDO'): continue
            run(case, r, 'new')
    elif c == 'changes':
        for case, how, req in CHANGES:
            if case in RES and not os.environ.get('REDO'): continue
            do_change(case, how, req)
    elif c == 'shot': shot(sys.argv[2])
    elif c == 'dump': ui.main.__call__ if False else print('\n'.join(texts()))
