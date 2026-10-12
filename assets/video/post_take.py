"""Composite the single-take frames: WebGL frame T_xxxxx + the real HUD overlay H_xxxxx (every other frame, held between) -> take_out/t_xxxxx.png
   python3 assets/video/post_take.py [first last]"""
import os, sys, glob
from PIL import Image
from concurrent.futures import ProcessPoolExecutor
V = os.path.dirname(os.path.abspath(__file__)) + "/"; SRC = V + "game_frames/"; OUT = V + "take_out/"; os.makedirs(OUT, exist_ok=True)
def hud_for(f):
    for g in (f, f - 1, f - 2):
        p = SRC + "H_%05d.png" % g
        if g >= 0 and os.path.exists(p): return p
    return None
def work(f):
    p = OUT + "t_%05d.png" % (f + 1)
    if os.path.exists(p) and not os.environ.get("REDO"): return f
    im = Image.open(SRC + "T_%05d.png" % f).convert('RGBA'); h = hud_for(f)
    if h: im = Image.alpha_composite(im, Image.open(h).convert('RGBA').resize(im.size))
    im.convert('RGB').save(p, compress_level=3); return f
if __name__ == '__main__':
    n = len(glob.glob(SRC + "T_*.png")); a = int(sys.argv[1]) if len(sys.argv) > 1 else 0; b = int(sys.argv[2]) if len(sys.argv) > 2 else n
    with ProcessPoolExecutor(max_workers=6) as ex: list(ex.map(work, range(a, b), chunksize=8))
    print('composited', a, b)
