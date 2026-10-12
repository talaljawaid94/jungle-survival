"""Assemble the 'start -> intro -> crash -> walking' video from rendered footage and the three soundtracks.
   python3 assets/video/compose_walk.py <scratch_dir>   ->   <scratch_dir>/vw/c_0001.png ... and <scratch_dir>/vw.wav   (then mux_film.py)"""
import sys, os, numpy as np
from PIL import Image
from scipy.io import wavfile
import post_game as pg

V = os.path.dirname(os.path.abspath(__file__)) + "/"; os.chdir(V)
sp = sys.argv[1]; out_dir = sp + '/vw'; os.makedirs(out_dir, exist_ok=True)
X = 6; FPS = 30; SR = 44100
P = lambda path: Image.open(path).convert('RGB')
def blend_list(a, b): return [Image.blend(a[-X + j], b[j], (j + .5) / X) for j in range(X)]

# 1. start + intro: the real title logo over the first seconds of the intro flight
intro = [P('game_out/g_%04d.png' % i) for i in range(1, 151)]
logo = Image.open('../../src/assets/logo.png').convert('RGBA'); lw = 820; logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
for i in range(48):
    a = min(1, max(0, (i - 4) / 10), max(0, (46 - i) / 10)); im = intro[i].convert('RGBA'); im = Image.alpha_composite(im, Image.new('RGBA', im.size, (0, 0, 0, int(110 * a))))
    l = logo.copy(); r, g, b, al = l.split(); l.putalpha(al.point(lambda v: int(v * a))); lay = Image.new('RGBA', im.size, (0, 0, 0, 0)); lay.paste(l, ((im.width - lw) // 2, int(im.height * 0.5 - l.height * 0.5)), l); intro[i] = Image.alpha_composite(im, lay).convert('RGB')
# 2. crash and blast
blast = [P('game_out/g_%04d.png' % i) for i in range(350, 530)]
# 3. walking sequence: five shots, captions, 6-frame dissolves
WALK = [('W1', 100, "AFTER THE CRASH", "On foot. Find food, water and shelter."), ('W3', 100, "EXPLORE THE ISLAND", "Dense jungle, hidden dangers"),
        ('W2', 90, "FORAGE", "Pick fruit and berries as you go"), ('W4', 100, "SHAKE A PALM", "Coconuts mean food and fresh water"), ('W5', 100, "FOLLOW THE COAST", "Find a way to signal for rescue")]
shots = []
for nm, n, t, s in WALK:
    fr = [P('game_frames/%s_%04d_wk.png' % (nm, i)) for i in range(n)]
    for i in range(n):
        a = min(1.0, max(0.0, (i - 6) / 8.0), max(0.0, (n - 8 - i) / 8.0))
        if a > 0: fr[i] = Image.alpha_composite(fr[i].convert('RGBA'), pg.caption_layer(*fr[i].size, t, s, a)).convert('RGB')
    shots.append(fr)
walk = list(shots[0])
for fr in shots[1:]:
    walk = walk[:-X] + blend_list(walk, fr) + fr[X:]
assert len(walk) == 466, len(walk)

frames = intro[:-X] + blend_list(intro, blast) + blast[X:-X] + blend_list(blast, walk) + walk[X:]
n = len(frames); print('frames', n, n / FPS)
for i, im in enumerate(frames):
    f = min(1, i / 8, (n - 1 - i) / 12)
    if f < 1: im = Image.blend(Image.new('RGB', im.size), im, f)
    im.save('%s/c_%04d.png' % (out_dir, i + 1), compress_level=1)

# audio: intro (game_audio 0-5 s), blast (blast_audio from frame 10), walking (walk_audio), joined with equal-power dissolves
def seg(wav, off_f, n_f):
    sr, w = wavfile.read(wav); w = w.astype(np.float32) / 32768; R = SR / FPS; return w[int(off_f * R):int((off_f + n_f) * R)]
parts = [seg('game_audio.wav', 0, 150), seg('blast_audio.wav', 10, 180), seg('walk_audio.wav', 0, 466)]
xf = int(X * SR / FPS); out = parts[0]
for p in parts[1:]:
    t = np.linspace(0, np.pi / 2, xf)[:, None]; out = np.concatenate([out[:-xf], out[-xf:] * np.cos(t) + p[:xf] * np.sin(t), p[xf:]])
out = out[:int(n * SR / FPS)]
if len(out) < int(n * SR / FPS): out = np.pad(out, ((0, int(n * SR / FPS) - len(out)), (0, 0)))
fo = int(1.2 * SR); out[-fo:] *= np.linspace(1, 0, fo)[:, None]; pk = np.abs(out).max()
if pk > 0.9: out *= 0.9 / pk
wavfile.write(sp + '/vw.wav', SR, (out * 32767).astype(np.int16)); print('audio', len(out) / SR)
