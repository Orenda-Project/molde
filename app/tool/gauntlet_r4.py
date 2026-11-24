#!/usr/bin/env python3
"""Round 4 gauntlet (0.4.0), driven over adb on the emulator. Reuses the helpers of gauntlet_r3.py.

  tool/gauntlet_r4.py setup     fresh install, model pushed (same as r3)
  tool/gauntlet_r4.py direct    Water demo: make it green / dark mode / bigger text / change the title: "Done: ...", instant, sections kept
  tool/gauntlet_r4.py mode      Change mode: "sleep tracker" asks the two-button question; "add ..." / "change ..." never do
  tool/gauntlet_r4.py create    create "savings", then "change the title to My Spending" right after; mode is "Changing <new app>"
  tool/gauntlet_r4.py critic    the critic's model cases on the Savings demo: goal 5000, add a note field, make it green, remove the streak
                                (each reply must be honest: Done / I couldn't ... / I changed something, but not what you asked; never a false "Changed")
  tool/gauntlet_r4.py flows     the ten New app / Change flows of round 3, with the round 4 mode rule (after a create: Changing <new app>)
  tool/gauntlet_r4.py asks      the ten named requests (no ask loops)
  tool/gauntlet_r4.py all
Results: $OUT (default /tmp/molde-app-scratch/gauntlet_r4.json).
"""
import json, os, re, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('OUT', '/tmp/molde-app-scratch/gauntlet_r4.json')
import gauntlet_r3 as g
from gauntlet_r3 import ui, texts, has, tap, tap_btn, send, wait_idle, stop_now, save, apps_view, chat_view, close_chat, set_mode, mode_label, app_titles, load_example, screen_texts, ensure_running

def reply_after(before_count_marker=None):
    ts = texts()
    bot = [t for t in ts if t.startswith(('Done', 'Changed', "I couldn't", 'I changed something', 'I did not', 'Stopped', 'That took too long', 'It already', 'That sounds like a new app', 'Made '))]
    return bot[-1] if bot else ''

def sections(ts): return set(re.sub(r'\d[\d,.]*', '#', t) for t in ts if len(t) > 3)

def brightness():
    from PIL import Image
    import io
    data = ui.adb('exec-out', 'screencap', '-p').stdout
    im = Image.open(io.BytesIO(data)).convert('L').resize((90, 200))
    px = list(im.getdata()); return sum(px) / len(px)

def setup(): g.setup()

def direct():
    ensure_running(); load_example('water')
    before = sections(screen_texts())
    for req, want in [('make it green', 'Done: green'), ('dark mode', 'Done: dark mode'), ('bigger text', 'Done: bigger text'), ('change the title to My Spending', 'Done: title is now My Spending')]:
        chat_view(); set_mode('change'); t0 = time.time(); send(req); time.sleep(4)
        r = reply_after()
        fast = not g.busy()
        close_chat(); time.sleep(2)
        extra = ''
        if 'dark' in req: b = brightness(); extra = f' brightness={b:.0f}'; fast = fast and b < 90
        if 'title' in req: fast = fast and has('My Spending')
        save(f'direct: "{req}"', r == want and fast, f'reply={r!r} instant={not g.busy()} {time.time()-t0:.0f}s{extra}')
    after = sections(screen_texts())
    lost = sorted(b for b in before if b not in after and 'Water' not in b and len(b) > 3)
    save('direct: every section is still there after green/dark/bigger/title', not lost, f'lost={lost[:6]}')

def mode():
    ensure_running(); chat_view(); set_mode('change')
    for req, expect_q in [('sleep tracker', True), ('kharcha', True), ('gym log', True), ('add a sleep field', False), ('change the colour of the glass', False), ('remove the chart', False)]:
        before = sum('That sounds like a new app' in t for t in texts())
        send(req); time.sleep(5)
        after = sum('That sounds like a new app' in t for t in texts())
        asked = after > before or (has('Change ') and has('New app') and any('sounds like a new app' in t for t in texts()[-12:]))
        stop_now()
        save(f'mode: "{req}" {"asks the two-button question" if expect_q else "is a change (no question)"}', asked == expect_q, f'asked={asked}')
        chat_view(); set_mode('change')

def create():
    ensure_running(); chat_view(); set_mode('new'); n0 = len(app_titles())
    chat_view(); send('savings'); wait_idle(480)
    ok = has('Made ')
    save('create: savings is made', ok, reply_after()[:200])
    m = mode_label() or ''
    save('create: after a create the mode is Changing <new app>', m.startswith('Changing'), m)
    send('change the title to My Spending'); time.sleep(5)
    r = reply_after(); close_chat(); time.sleep(2)
    save('create: "change the title to My Spending" right after a create', r == 'Done: title is now My Spending' and has('My Spending'), r)
    save('create: no app lost', len(app_titles()) == n0 + 1, str(app_titles()))

def critic():
    ensure_running(); load_example('savings')
    for req in ['set goal to 5000', 'add a note field', 'make it green', 'remove the streak']:
        before = sorted(screen_texts()); chat_view(); set_mode('change')
        send(req); wait_idle(420); r = reply_after(); close_chat(); time.sleep(3)
        after = sorted(screen_texts())
        changed = before != after
        honest = (r.startswith(('Done', 'Changed')) and changed) or r.startswith("I couldn't") or r.startswith('I changed something, but not what you asked') or r.startswith('That took too long') or r.startswith('I did not') or r.startswith('It already')
        save(f'critic: "{req}" reply is honest', honest and 'already does that' not in r, f'reply={r[:140]!r} screen_changed={changed}')

def flows():
    ensure_running(); load_example('water'); time.sleep(2)
    n0 = len(app_titles())
    chat_view()
    save('F1 mode label shows Changing Water', (mode_label() or '').startswith('Changing Water'), str(mode_label()))
    send('make me a budget app'); time.sleep(3)
    save('F2 new-app wording in Change mode asks with two buttons', has('Change Water') and has('New app') and not g.busy(), '')
    tap_btn('Change Water'); stop_now()
    save('F3 "Change Water" keeps Change mode, no app lost', (mode_label() or '').startswith('Changing Water') and len(app_titles()) == n0, str(mode_label()))
    chat_view(); send('a habit tracker'); time.sleep(3); tap_btn('New app'); stop_now()
    save('F4 "New app" button switches to New app mode, Water kept', mode_label() == 'New app' and len(app_titles()) == n0, str(mode_label()))
    chat_view(); set_mode('new'); send('todo'); done = wait_idle(480) and has('Made ')
    t = app_titles()
    save('F5 after a create the mode is Changing <new app>; both apps exist', done and (mode_label() or '').startswith('Changing') and len(t) == n0 + 1, f'mode={mode_label()} apps={t}')
    chat_view(); set_mode('new')
    save('F6 choosing New app again works', mode_label() == 'New app', str(mode_label()))
    apps_view(); tap('Water', miny=1000); time.sleep(8)
    save('F7 switching to Water: Changing Water', (mode_label() or '').startswith('Changing Water'), str(mode_label()))
    apps_view(); tap('New app', miny=1000); time.sleep(2); chat_view()
    save('F8 New app tile -> New app mode', mode_label() == 'New app', str(mode_label()))
    chat_view(); set_mode('change')
    before = sum('That sounds like a new app' in t for t in texts())
    send('change the goal to 3000'); time.sleep(6)
    save('F9 a change request does not trigger the new-app question', sum('That sounds like a new app' in t for t in texts()) <= before, '')
    stop_now()
    titles = app_titles()
    save('F10 no app lost after all flows', len(titles) == n0 + 1 and any('Water' in x for x in titles), str(titles))

def asks(): g.asks()

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'all'
    for step in {'all': ['setup', 'direct', 'mode', 'flows', 'create', 'critic', 'asks']}.get(cmd, [cmd]):
        globals()[step]()
    bad = [k for k, v in g.RESULTS.items() if not v['ok']]
    print('FAILED:' if bad else 'ALL PASS', bad)
