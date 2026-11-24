#!/usr/bin/env python3
"""Tiny adb + uiautomator driver for the emulator checks.
  ui.py shot NAME            screenshot to $SHOTS/NAME.png (default /tmp/molde-app/shots)
  ui.py tap "text or desc"   tap the first node whose text or content-desc contains the string
  ui.py long "text or desc"  long-press
  ui.py tapxy X Y
  ui.py type "text"          type into the focused field (spaces -> %s)
  ui.py has "text"           exit 0 when a node shows the text
  ui.py wait "text" SECS     wait until a node shows the text
  ui.py dump                 print the visible text and descriptions
"""
import os, subprocess, sys, time, re
import xml.etree.ElementTree as ET
ADB = os.path.expanduser('~/Android/Sdk/platform-tools/adb')
SHOTS = os.environ.get('SHOTS', '/tmp/molde-app/shots')

def adb(*a, **k):
    return subprocess.run([ADB, *a], capture_output=True, **k)

def nodes():
    for _ in range(3):
        adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml')
        r = adb('exec-out', 'cat', '/sdcard/ui.xml')
        try:
            root = ET.fromstring(r.stdout.decode('utf8', 'replace'))
            return list(root.iter('node'))
        except ET.ParseError:
            time.sleep(1)
    return []

def center(n):
    m = re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', n.get('bounds'))
    x1, y1, x2, y2 = map(int, m.groups())
    return (x1 + x2) // 2, (y1 + y2) // 2

def find(s, exact=False):
    miny = int(os.environ.get('MINY', '0'))
    for n in nodes():
        if center(n)[1] < miny: continue
        for k in ('text', 'content-desc'):
            v = n.get(k) or ''
            if (v == s) if exact else (s.lower() in v.lower()):
                return n
    return None

def main():
    c = sys.argv[1]
    if c == 'shot':
        os.makedirs(SHOTS, exist_ok=True)
        data = adb('exec-out', 'screencap', '-p').stdout
        open(f'{SHOTS}/{sys.argv[2]}.png', 'wb').write(data)
    elif c == 'tap':
        n = find(sys.argv[2])
        if n is None: print('not found:', sys.argv[2]); sys.exit(1)
        x, y = center(n); adb('shell', 'input', 'tap', str(x), str(y)); print('tapped', x, y)
    elif c == 'long':
        n = find(sys.argv[2])
        if n is None: print('not found:', sys.argv[2]); sys.exit(1)
        x, y = center(n); adb('shell', 'input', 'swipe', str(x), str(y), str(x), str(y), '1500'); print('long-pressed', x, y)
    elif c == 'tapxy':
        adb('shell', 'input', 'tap', sys.argv[2], sys.argv[3])
    elif c == 'type':
        adb('shell', 'input', 'text', sys.argv[2].replace(' ', '%s'))
    elif c == 'has':
        sys.exit(0 if find(sys.argv[2]) is not None else 1)
    elif c == 'wait':
        end = time.time() + float(sys.argv[3])
        while time.time() < end:
            if find(sys.argv[2]) is not None: print('found'); return
            time.sleep(2)
        print('timeout'); sys.exit(1)
    elif c == 'dump':
        for n in nodes():
            t = (n.get('text') or '').strip(); d = (n.get('content-desc') or '').strip()
            if t or d: print(n.get('bounds'), '|', t[:100], '|', d[:100])
main()
