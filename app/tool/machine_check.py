#!/usr/bin/env python3
"""Scripted machine check of the main screens at 360x640 and 412x915 dp on the emulator (uiautomator + logcat):
  overflow      a node outside the screen, or a Flutter 'RenderFlex overflowed' line in logcat
  small text    a single-line text node shorter than 14 dp (a font under about 12 sp)
  small target  a clickable node narrower or shorter than 44 dp
Screens: the open app, the chat sheet with messages, the app list, Settings, the developer menu.
  tool/machine_check.py            both sizes; writes $OUT (default /tmp/molde-app-scratch/machine_check.json); exit 1 on any failure
Restores the emulator's screen size at the end.
"""
import json, os, re, subprocess, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('OUT', '/tmp/molde-app-scratch/machine_gauntlet_tmp.json')
import gauntlet_r3 as g
from gauntlet_r3 import ui
OUT = os.environ.get('MC_OUT', '/tmp/molde-app-scratch/machine_check.json')
SIZES = {'360x640': ('720x1280', '320'), '412x915': (None, None)}   # wm size, density; the default emulator screen is 412x915 dp

def screen_dp():
    out = ui.adb('shell', 'wm', 'size').stdout.decode()
    m = re.findall(r'(\d+)x(\d+)', out); w, h = map(int, m[-1])
    d = int(re.findall(r'(\d+)', ui.adb('shell', 'wm', 'density').stdout.decode())[-1])
    return w, h, d / 160.0

def clip_lines(nodes, h):
    """y values where something is cut by an overlay: the chat sheet's top edge and the list viewport under its header."""
    ys = []
    for n in nodes:
        d = (n.get('content-desc') or '')
        m = re.match(r'\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]', n.get('bounds') or '')
        if m and (d.startswith('Mode: ') or d == 'Close chat' or d == 'Your apps'):
            y1, y2 = int(m.group(2)), int(m.group(4)); ys += [y1 - 90, y2 + 25]
    return ys

def check_screen(name):
    w, h, sc = screen_dp()
    issues = []
    nodes = ui.nodes(); cuts = clip_lines(nodes, h)
    for n in nodes:
        m = re.match(r'\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]', n.get('bounds') or '')
        if not m: continue
        x1, y1, x2, y2 = map(int, m.groups()); bw, bh = (x2 - x1) / sc, (y2 - y1) / sc
        if x2 <= x1 or y2 <= y1: continue
        label = ((n.get('text') or n.get('content-desc') or '').strip().split('\n')[0])[:40]
        if n.get('package') != 'com.oyekamal.molde': continue
        if x1 < -2 or y1 < -2 or x2 > w + 2 or y2 > h + 2:
            issues.append({'kind': 'overflow', 'node': label, 'bounds': n.get('bounds')})
        if (n.get('text') or '').strip() and '\n' not in (n.get('text') or '') and bh < 14 and not n.get('text', '').isspace():
            issues.append({'kind': 'small text', 'node': label, 'height_dp': round(bh, 1)})
        clipped = any(y1 < c < y2 for c in cuts) or y2 >= h - 4 or y1 <= 4   # cut by the sheet, the list viewport or the screen edge: its real size is larger
        if n.get('clickable') == 'true' and (bw < 44 or bh < 44) and (bw > 0 and bh > 0) and not clipped:
            issues.append({'kind': 'small target', 'node': label, 'size_dp': f'{bw:.0f}x{bh:.0f}'})
    return {'screen': name, 'issues': issues}

def overflow_log():
    log = ui.adb('logcat', '-d').stdout.decode(errors='replace')
    return [l.strip()[:160] for l in log.splitlines() if 'RenderFlex overflowed' in l or 'overflowed by' in l]

def run_size(label):
    wm, dens = SIZES[label]
    if wm: ui.adb('shell', 'wm', 'size', wm); ui.adb('shell', 'wm', 'density', dens); time.sleep(8)
    ui.adb('logcat', '-c')
    res = []
    g.ensure_running(); g.load_example('water'); time.sleep(3)
    res.append(check_screen('the open app'))
    g.chat_view(); g.set_mode('change')
    for r in ['sleep tracker', 'kharcha']:   # two questions: buttons, bubbles, disabled buttons
        g.chat_view()
        for n in ui.nodes():
            if 'EditText' in (n.get('class') or ''):
                x, y = ui.center(n); g.adb('shell', 'input', 'tap', str(x), str(y)); break
        time.sleep(1); g.adb('shell', 'input', 'text', r.replace(' ', '%s')); time.sleep(1)
        n = ui.find('Send')
        if n is not None: x, y = ui.center(n); g.adb('shell', 'input', 'tap', str(x), str(y))
        time.sleep(4)
    res.append(check_screen('the chat sheet'))
    g.apps_view(); time.sleep(1); res.append(check_screen('the app list'))
    g.chat_view()
    n = None
    for c in ui.nodes():
        if (c.get('content-desc') or '') == 'Settings' and ui.center(c)[1] > screen_dp()[1] * 0.3: n = c
    if n is not None:
        x, y = ui.center(n); g.adb('shell', 'input', 'tap', str(x), str(y)); time.sleep(3)
        res.append(check_screen('Settings')); g.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK'); time.sleep(2)
    else: res.append({'screen': 'Settings', 'issues': [{'kind': 'not reached'}]})
    g.apps_view()
    w, h, sc = screen_dp(); g.adb('shell', 'input', 'swipe', str(w // 2), str(h - 50), str(w // 2), str(h - 50), '1500'); time.sleep(3)
    res.append(check_screen('the developer menu')); g.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK'); time.sleep(1)
    return {'size': label, 'screens': res, 'logcat_overflow': overflow_log()}

if __name__ == '__main__':
    labels = sys.argv[1:] or list(SIZES)
    out = []
    try:
        for lb in labels: out.append(run_size(lb))
    finally:
        ui.adb('shell', 'wm', 'size', 'reset'); ui.adb('shell', 'wm', 'density', 'reset')
    json.dump(out, open(OUT, 'w'), indent=1)
    bad = 0
    for r in out:
        n = sum(len(s['issues']) for s in r['screens']) + len(r['logcat_overflow']); bad += n
        print(f"{r['size']}: {n} issue(s)")
        for s in r['screens']:
            kinds = {}
            for i in s['issues']: kinds[i['kind']] = kinds.get(i['kind'], 0) + 1
            print('  ', s['screen'], kinds or 'ok')
        for l in r['logcat_overflow'][:3]: print('   logcat:', l)
    sys.exit(1 if bad else 0)
