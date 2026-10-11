"""Post pass for the in-game film: shot assembly with dissolves, game-style captions, logo end card, fades.
   python3 assets/video/post_game.py  ->  assets/video/game_out/g_0001.png ...   (then mux_film.py with that folder)"""
import os, glob, re, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from concurrent.futures import ProcessPoolExecutor

V = os.path.dirname(os.path.abspath(__file__)) + "/"
SRC = V + "game_frames/"; OUT = V + "game_out/"; os.makedirs(OUT, exist_ok=True)
LOGO = os.path.abspath(V + "../../src/assets/logo.png")
FPS = 30; XF = 6                                   # dissolve length in frames
ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
GOLD = (242, 193, 78); WHITE = (255, 255, 255)
FONT = "/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf"

def shot_files(s):
    fs = sorted(f for f in glob.glob(SRC + s + "_*") if re.search(r'/' + s + r'_\d{4}\.(jpg\.)?png$', f))
    return fs

SHOTS = {s: shot_files(s) for s in ORDER}
# global timeline: (shot, local index) per output frame, with XF-frame overlaps between shots
START = {}; t = 0
for s in ORDER:
    START[s] = t; t += len(SHOTS[s]) - (XF if s != ORDER[-1] else 0)
TOTAL = START['H'] + len(SHOTS['H'])

# captions: (shot, from local frame, to local frame, title, subtitle)
CAPS = [
    ('A', 40, 150, "FLIGHT 7", "Over the Pacific"),
    ('A', 190, 340, "MAYDAY. MAYDAY.", "Engine failure · losing altitude"),
    ('B', 6, 98, "DAY 1", "You survived the crash."),
    ('C', 4, 108, "SEARCH THE WRECKAGE", "Supplies are scattered around the site"),
    ('D', 4, 93, "EXPLORE THE ISLAND", "Dense jungle, hidden dangers"),
    ('E', 4, 110, "CRAFT. CHOP. BUILD.", "Turn the land into shelter and tools"),
    ('F', 6, 118, "BEFORE THE NIGHT", "Build a fire. Stay warm. Stay alive."),
    ('G', 6, 93, "SOMETHING IS WATCHING", "Night belongs to the island"),
]

_fonts = {}
def font(sz):
    if sz not in _fonts: _fonts[sz] = ImageFont.truetype(FONT, sz)
    return _fonts[sz]

def caption_layer(w, h, title, sub, a):
    """lower-left game-UI caption: gold accent bar, white title, soft subtitle, drop shadow"""
    if a <= 0: return None
    lay = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    x, y = 96, h - 230; ft, fs = font(56), font(30)
    tw = d.textlength(title, font=ft); sw = d.textlength(sub, font=fs)
    pad = 26; box = (x - pad - 18, y - 16, x + max(tw, sw) + pad + 6, y + 56 + 14 + 40 + 14)
    d.rounded_rectangle(box, 22, fill=(8, 36, 44, int(170 * a)), outline=(*GOLD, int(255 * a)), width=3)
    d.rounded_rectangle((x - 22, y + 2, x - 14, y + 56 + 14 + 40 - 4), 4, fill=(*GOLD, int(255 * a)))
    d.text((x + 2, y + 3), title, font=ft, fill=(0, 0, 0, int(140 * a))); d.text((x, y), title, font=ft, fill=(*WHITE, int(255 * a)))
    d.text((x, y + 70), sub, font=fs, fill=(*GOLD, int(255 * a)))
    return lay

def frame_for(gi):
    """gi: 0-based global output frame"""
    layers = []
    for s in ORDER:
        li = gi - START[s]
        if 0 <= li < len(SHOTS[s]): layers.append((s, li))
    # at most two overlapping shots (outgoing first)
    if len(layers) == 2:
        (s0, l0), (s1, l1) = layers; k = (gi - START[s1] + 0.5) / XF
        im = Image.blend(Image.open(SHOTS[s0][l0]).convert('RGB'), Image.open(SHOTS[s1][l1]).convert('RGB'), max(0.0, min(1.0, k)))
        cs = [(s0, l0), (s1, l1)]
    else:
        s, li = layers[-1]; im = Image.open(SHOTS[s][li]).convert('RGB'); cs = [(s, li)]
    im = im.convert('RGBA'); w, h = im.size
    for (s, li) in cs:
        for (cs_, f0, f1, ti, su) in CAPS:
            if cs_ != s or not (f0 <= li <= f1): continue
            a = min(1.0, (li - f0) / 8.0, (f1 - li) / 8.0); lay = caption_layer(w, h, ti, su, a)
            if lay is not None: im = Image.alpha_composite(im, lay)
    # end card over the last 4.3 s of shot H
    hl = gi - START['H']; n = len(SHOTS['H']); endf = int(4.3 * FPS)
    if hl >= n - endf:
        k = (hl - (n - endf)) / endf; dim = min(1.0, k / 0.35) * 0.72
        im = Image.alpha_composite(im, Image.new('RGBA', (w, h), (0, 0, 0, int(255 * dim))))
        logo = Image.open(LOGO).convert('RGBA'); lw = 760; logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
        la = max(0.0, min(1.0, (k - 0.12) / 0.3)); r, g, b, al = logo.split(); logo.putalpha(al.point(lambda v: int(v * la)))
        lay = Image.new('RGBA', (w, h), (0, 0, 0, 0)); lay.paste(logo, ((w - lw) // 2, int(h * 0.5 - logo.height * 0.58)), logo); im = Image.alpha_composite(im, lay)
        d = ImageDraw.Draw(lay := Image.new('RGBA', (w, h), (0, 0, 0, 0)))
        ta = max(0.0, min(1.0, (k - 0.3) / 0.25)); tag = "FIND WATER.  BUILD FIRE.  SURVIVE THE NIGHT."; ft = font(46); tw = d.textlength(tag, font=ft)
        d.text(((w - tw) / 2 + 2, int(h * 0.80) + 2), tag, font=ft, fill=(0, 0, 0, int(150 * ta))); d.text(((w - tw) / 2, int(h * 0.80)), tag, font=ft, fill=(*GOLD, int(255 * ta)))
        sa = max(0.0, min(1.0, (k - 0.45) / 0.25)); sub = "A BROWSER SURVIVAL GAME  ·  CAPTURED IN-ENGINE"; fs = font(26); sw = d.textlength(sub, font=fs)
        d.text(((w - sw) / 2, int(h * 0.80) + 70), sub, font=fs, fill=(210, 224, 230, int(230 * sa)))
        im = Image.alpha_composite(im, lay)
    # global fades
    fade = 1.0
    if gi < 14: fade = gi / 14.0
    if gi > TOTAL - 20: fade = min(fade, max(0.0, (TOTAL - 1 - gi) / 19.0))
    if fade < 1.0: im = Image.blend(Image.new('RGBA', im.size, (0, 0, 0, 255)), im, fade)
    return im.convert('RGB')

def work(gi):
    p = OUT + "g_%04d.png" % (gi + 1)
    if os.path.exists(p): return gi
    frame_for(gi).save(p, compress_level=3); return gi

if __name__ == '__main__':
    print("total frames", TOTAL, {s: (START[s], len(SHOTS[s])) for s in ORDER}, flush=True)
    with ProcessPoolExecutor(max_workers=6) as ex:
        for i, _ in enumerate(ex.map(work, range(TOTAL), chunksize=8)):
            if i % 100 == 0: print(i, flush=True)
    print("POST_DONE", TOTAL)
