"""Post pass for the bonfire clip: C crate -> D sprint -> E chop -> K build the fire -> F night torch, 6-frame dissolves, captions, fades.
   python3 assets/video/post_bonfire.py  ->  assets/video/bonfire_out/b_0001.png ...   (then mux_film.py with bonfire_out and bonfire_audio.wav)"""
import os, glob, re
from PIL import Image
from concurrent.futures import ProcessPoolExecutor
import post_game as pg            # reuse the caption renderer (does not run the film post pass: guarded by __main__)

V = os.path.dirname(os.path.abspath(__file__)) + "/"
SRC = V + "game_frames/"; OUT = V + "bonfire_out/"; os.makedirs(OUT, exist_ok=True)
FPS = 30; XF = 6
ORDER = ['C', 'D', 'E', 'K', 'F']
CAPS = [
    ('C', 6, 100, "SEARCH THE WRECKAGE", "Open the supply crate and take what you need"),
    ('D', 4, 90, "MOVE FAST", "Every minute of daylight counts"),
    ('E', 6, 140, "CHOP WOOD", "An axe turns the trees into fuel and shelter"),
    ('K', 24, 112, "BUILD A BONFIRE", "Stack it, light it, keep it burning"),
    ('F', 6, 114, "STAY WARM. STAY ALIVE.", "Fire is light, warmth and safety"),
]
def files(s): return sorted(glob.glob(SRC + s + "_[0-9][0-9][0-9][0-9]_bf.png"))
SHOTS = {s: files(s) for s in ORDER}
START = {}; t = 0
for s in ORDER:
    START[s] = t; t += len(SHOTS[s]) - (XF if s != ORDER[-1] else 0)
TOTAL = START['F'] + len(SHOTS['F'])

def frame_for(gi):
    layers = [(s, gi - START[s]) for s in ORDER if 0 <= gi - START[s] < len(SHOTS[s])]
    if len(layers) == 2:
        (s0, l0), (s1, l1) = layers; k = (gi - START[s1] + 0.5) / XF
        im = Image.blend(Image.open(SHOTS[s0][l0]).convert('RGB'), Image.open(SHOTS[s1][l1]).convert('RGB'), max(0.0, min(1.0, k)))
    else:
        s, li = layers[-1]; im = Image.open(SHOTS[s][li]).convert('RGB')
    im = im.convert('RGBA'); w, h = im.size
    for (s, li) in layers:
        for (cs_, f0, f1, ti, su) in CAPS:
            if cs_ != s or not (f0 <= li <= f1): continue
            a = min(1.0, (li - f0) / 8.0, (f1 - li) / 8.0); lay = pg.caption_layer(w, h, ti, su, a)
            if lay is not None: im = Image.alpha_composite(im, lay)
    fade = 1.0
    if gi < 12: fade = gi / 12.0
    if gi > TOTAL - 22: fade = min(fade, max(0.0, (TOTAL - 1 - gi) / 21.0))
    if fade < 1.0: im = Image.blend(Image.new('RGBA', im.size, (0, 0, 0, 255)), im, fade)
    return im.convert('RGB')

def work(gi):
    p = OUT + "b_%04d.png" % (gi + 1)
    if os.path.exists(p) and not os.environ.get("REDO"): return gi
    frame_for(gi).save(p, compress_level=3); return gi

if __name__ == '__main__':
    print("total frames", TOTAL, {s: (START[s], len(SHOTS[s])) for s in ORDER}, flush=True)
    with ProcessPoolExecutor(max_workers=6) as ex:
        for i, _ in enumerate(ex.map(work, range(TOTAL), chunksize=8)):
            if i % 100 == 0: print(i, flush=True)
    print("POST_DONE", TOTAL)
