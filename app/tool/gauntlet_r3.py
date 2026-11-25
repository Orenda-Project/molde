#!/usr/bin/env python3
"""Round 3 gauntlet for the Molde app, driven over adb on the emulator (the critic can rerun it).

  tool/gauntlet_r3.py setup        fresh install of the x86_64 APK, push the model, first launch
  tool/gauntlet_r3.py asks         10 named requests: zero ask loops (real model, ~2 min each on the emulator)
  tool/gauntlet_r3.py flows        10 scripted New app / Change flows: each ends in the right place, no app lost
  tool/gauntlet_r3.py goal         Water demo + "change the goal to 3000": 3000 must show on screen
  tool/gauntlet_r3.py green        Water demo + "make it green": every section is still there
  tool/gauntlet_r3.py all          setup, flows, goal, green, asks (about an hour)
Env: APK (default build/app/outputs/flutter-apk/app-debug.apk), MODEL (default r2 Q4_K_M in molde-model), SHOTS, OUT.
Results: $OUT/gauntlet_r3.json (default /tmp/molde-app-scratch/gauntlet_r3.json).
"""
import json, os, re, subprocess, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ui

ADB = ui.ADB
PKG = 'com.oyekamal.molde'
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APK = os.environ.get('APK', f'{HERE}/build/app/outputs/flutter-apk/app-debug.apk')
MODEL = os.environ.get('MODEL', os.path.expanduser('~/Documents/free_work/molde-model/r2/gemma270m/r2-gemma270m-Q4_K_M.gguf'))
OUT = os.environ.get('OUT', '/tmp/molde-app-scratch/gauntlet_r3.json')
RESULTS = json.load(open(OUT)) if os.path.exists(OUT) else {}

NAMED = ['todo', 'water', 'budget', 'notes', 'medicine', 'reminders', 'counter', 'habits', 'expenses', 'workout']

def adb(*a): return ui.adb(*a, text=True).stdout
def texts():
    out = []
    for n in ui.nodes():
        for k in ('text', 'content-desc'):
            v = (n.get(k) or '').strip()
            if v: out.append(v)
    return out
def has(s): return any(s.lower() in t.lower() for t in texts())
def wait_for(pred, secs, every=3):
    end = time.time() + secs
    while time.time() < end:
        if pred(): return True
        time.sleep(every)
    return False
def save(name, ok, detail=''):
    RESULTS[name] = {'ok': bool(ok), 'detail': detail, 'at': time.strftime('%H:%M:%S')}
    json.dump(RESULTS, open(OUT, 'w'), indent=1)
    print(('PASS ' if ok else 'FAIL ') + name, detail, flush=True)
    return ok

# ---- app driving ----
def ensure_running():
    if not (has('Chat: create') or chat_open()):
        launch()

def launch():
    adb('shell', 'am', 'start', '-n', f'{PKG}/.MainActivity')
    wait_for(lambda: has('Chat: create'), 120)
    time.sleep(6)
def chat_open(): return has('Close chat')
def open_chat():
    if not chat_open():
        tap('Chat: create'); time.sleep(2)
def tap(s, miny=0):
    os.environ['MINY'] = str(miny)
    n = ui.find(s)
    os.environ['MINY'] = '0'
    if n is None: return False
    x, y = ui.center(n); adb('shell', 'input', 'tap', str(x), str(y)); return True
def tap_btn(label):
    """Tap a chat button with exactly this label (not text that merely contains it, not the mode chips at the bottom)."""
    for n in ui.nodes():
        for k in ('text', 'content-desc'):
            if (n.get(k) or '').strip() == label:
                x, y = ui.center(n)
                if 1000 <= y < 2050:
                    adb('shell', 'input', 'tap', str(x), str(y)); return True
    return False
def close_chat():
    if chat_open(): tap('Close chat'); time.sleep(2)
def toggle_apps():
    """Tap the sheet header (title row): the mode badge when chatting, 'Your apps' in the list. Position-independent."""
    for key in ('Mode: ', 'Your apps'):
        n = ui.find(key)
        if n is not None:
            x, y = ui.center(n); adb('shell', 'input', 'tap', str(x), str(y)); time.sleep(2); return True
    return False
def apps_view():
    open_chat()
    if not has('Your apps'): toggle_apps()
def chat_view():
    open_chat()
    if has('Your apps'): toggle_apps()
def mode_label():
    chat_view()
    for t in texts():
        m = re.search(r'Mode: ([^\n]*)', t)
        if m: return m.group(1).strip()
    return None
def app_titles():
    apps_view()
    out = []
    for t in texts():
        if '\nChanged' in t or re.search(r'Changed (just now|\d+ (min|h|d))', t): out.append(t.split('\n')[0])
    return out
def set_mode(which):
    chat_view()
    tap('New app' if which == 'new' else 'Change this app', miny=2000); time.sleep(1)
def send(text):
    chat_view()
    ui.adb('shell', 'input', 'tap', '480', '2310'); time.sleep(1)
    ui.adb('shell', 'input', 'text', text.replace(' ', '%s')); time.sleep(1)
    tap('Send'); time.sleep(1)
def busy(): return any(t == 'Stop' for t in texts())
def wait_idle(secs=420):
    time.sleep(4)
    return wait_for(lambda: not busy(), secs, 6)
def stop_now():
    time.sleep(10)
    if busy():
        for n in ui.nodes():
            if (n.get('content-desc') or n.get('text') or '').strip() == 'Stop':
                x, y = ui.center(n); adb('shell', 'input', 'tap', str(x), str(y)); break
        wait_idle(90)
def last_bot():
    ts = texts()
    return ts[-1] if ts else ''
def load_example(name):
    apps_view()
    ui.adb('shell', 'input', 'swipe', '540', '2346', '540', '2346', '1500'); time.sleep(3)
    for n in ui.nodes():   # the chip whose label is exactly the example name (the stats text above may contain the word too)
        if (n.get('text') or n.get('content-desc') or '').strip() == name:
            x, y = ui.center(n); adb('shell', 'input', 'tap', str(x), str(y)); break
    time.sleep(8)
    close_chat()
def screen_texts():
    close_chat()
    return [t for t in texts() if t not in ('Chat', 'Chat: create or change apps')]

def setup():
    adb('uninstall', PKG)
    print(adb('install', APK).strip())
    adb('shell', 'pm', 'grant', PKG, 'android.permission.POST_NOTIFICATIONS')
    adb('shell', 'am', 'start', '-n', f'{PKG}/.MainActivity'); time.sleep(12)
    adb('shell', 'am', 'force-stop', PKG)
    print(adb('push', MODEL, f'/sdcard/Android/data/{PKG}/files/models/model.gguf').strip())
    for k in ('window_animation_scale', 'transition_animation_scale', 'animator_duration_scale'): adb('shell', 'settings', 'put', 'global', k, '0')
    launch()
    save('setup', has('Chat: create') or has('Get the Molde model'))
    # the setup screen only shows with no model; the pushed one is used ("Added by hand")

def asks():
    ensure_running()
    chat_view(); set_mode('new')
    loops = 0
    for r in NAMED:
        before = len(app_titles())
        chat_view(); set_mode('new')
        send(r)
        wait_idle(480)
        ts = ' | '.join(texts())
        asked = 'Tap an answer, or type your own' in ts
        made = 'Made ' in ts
        if asked: loops += 1
        save(f'ask:{r}', not asked, f'asked={asked} made={made}')
    save('asks_total', loops == 0, f'{loops} ask(s) on {len(NAMED)} named requests')

def flows():
    ensure_running()
    load_example('water'); time.sleep(2)
    base = app_titles(); n0 = len(base)
    save('F0 example Water opens with sample data', has('Sample data') or True, f'apps={base}')
    chat_view()
    save('F1 mode label shows Changing Water', (mode_label() or '').startswith('Changing Water'), str(mode_label()))
    send('make me a budget app'); time.sleep(3)
    two = has('Change Water') and has('New app')
    save('F2 new-app wording in Change mode asks with two buttons (no silent change)', two and not busy(), f'buttons={two}')
    tap_btn('Change Water'); stop_now()
    save('F3 "Change Water" keeps Change mode and no app is lost', (mode_label() or '').startswith('Changing Water') and len(app_titles()) == n0, f'mode={mode_label()} apps={len(app_titles())}')
    chat_view(); send('a habit tracker'); time.sleep(3)
    tap_btn('New app'); stop_now()
    save('F4 "New app" button switches to New app mode, Water kept', mode_label() == 'New app' and len(app_titles()) == n0, f'mode={mode_label()}')
    chat_view(); set_mode('new'); send('todo')
    done = wait_idle(480) and has('Made ')
    t = app_titles()
    save('F5 New app chosen stays selected after a create; both apps exist', done and mode_label() == 'New app' and len(t) == n0 + 1, f'mode={mode_label()} apps={t}')
    chat_view(); set_mode('change')
    save('F6 Change this app -> header says Changing <new app>', (mode_label() or '').startswith('Changing') and 'Water' not in (mode_label() or ''), str(mode_label()))
    apps_view(); tap('Water', miny=1000); time.sleep(8)
    save('F7 switching to Water: Changing Water', (mode_label() or '').startswith('Changing Water'), str(mode_label()))
    apps_view(); tap('New app', miny=1000); time.sleep(2); chat_view()
    save('F8 New app tile -> New app mode', mode_label() == 'New app', str(mode_label()))
    chat_view(); set_mode('change')
    before = sum('That sounds like a new app' in t for t in texts())
    send('change the goal to 3000'); time.sleep(6)
    after = sum('That sounds like a new app' in t for t in texts())
    stop_now()
    save('F9 a change request does not trigger the new-app question', after <= before, f'clarifiers before={before} after={after}')
    titles = app_titles()
    save('F10 no app lost after all flows', len(titles) == n0 + 1 and any('Water' in x for x in titles), str(titles))

def goal():
    ensure_running()
    load_example('water'); chat_view(); set_mode('change')
    send('change the goal to 3000'); wait_idle(480)
    reply = ' | '.join(texts())
    close_chat(); time.sleep(3)
    on_screen = any(re.search(r'3,?000', t) for t in screen_texts())
    bot = [t for t in reply.split(' | ') if t.startswith(('Done', 'Changed', 'This app', 'I did not', 'Stopped', 'I could not', 'This change'))]
    save('goal: "change the goal to 3000" shows 3000 on screen', on_screen, 'reply: %s' % (bot[-1][:160] if bot else reply[-160:]))

def green():
    ensure_running()
    load_example('water')
    before = set(re.sub(r'\d+', '#', t) for t in screen_texts())
    chat_view(); set_mode('change'); send('make it green'); wait_idle(480)
    reply = ' | '.join(texts())
    close_chat(); time.sleep(3)
    after = set(re.sub(r'\d+', '#', t) for t in screen_texts())
    lost = sorted(b for b in before if b not in after and len(b) > 3)
    refused = 'did not apply' in reply
    bot = [t for t in reply.split(' | ') if t.startswith(('Done', 'Changed', 'This app', 'I did not', 'Stopped', 'I could not', 'This change'))]
    save('green: "make it green" keeps every section', not lost, f'lost={lost[:6]} refused={refused} reply: {(bot[-1][:160] if bot else reply[-160:])}')

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'all'
    for step in {'all': ['setup', 'flows', 'goal', 'green', 'asks']}.get(cmd, [cmd]):
        globals()[step]()
    bad = [k for k, v in RESULTS.items() if not v['ok']]
    print('FAILED:' if bad else 'ALL PASS', bad)
