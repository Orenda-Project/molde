# joins the shots from side.mjs: per demo and mode, the old screens (left column) next to the new (right)
import sys, glob, os
from PIL import Image, ImageDraw
d = sys.argv[1]
for f in sorted(glob.glob(os.path.join(d, '*-old-0.png'))):
    base = os.path.basename(f)[:-len('-old-0.png')]
    cols = [[Image.open(p) for p in sorted(glob.glob(os.path.join(d, f'{base}-{t}-*.png')))] for t in ('old', 'new')]
    H = max(sum(i.height for i in c) for c in cols) + 40
    out = Image.new('RGB', (412 * 2 + 24, H), (128, 128, 128))
    dr = ImageDraw.Draw(out)
    for x, (label, c) in zip((0, 436), (('before', cols[0]), ('demo15', cols[1]))):
        dr.text((x + 8, 12), label, fill=(0, 0, 0))
        y = 40
        for im in c: out.paste(im, (x, y)); y += im.height
    out.save(os.path.join(d, '..', base + '.png'), optimize=True)
