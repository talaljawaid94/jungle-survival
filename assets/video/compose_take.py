"""Cut the single take into the final video: kept segments of the recording (global frame ranges) joined with short dissolves, audio sliced from take_audio.wav.
   python3 assets/video/compose_take.py <scratch_dir>  ->  <scratch_dir>/vt/c_0001.png ... + <scratch_dir>/vt.wav   (then mux_film.py)"""
import sys, os, numpy as np
from PIL import Image
from scipy.io import wavfile
V = os.path.dirname(os.path.abspath(__file__)) + "/"; os.chdir(V)
sp = sys.argv[1]; out_dir = sp + '/vt'; os.makedirs(out_dir, exist_ok=True)
X = 6; FPS = 30; SR = 44100
SEGS = [(25, 215), (415, 695), (940, 1215), (1230, 1470), (1730, 1960), (2780, 2970), (3440, 3793)]       # [start, end) in take frames
P = lambda i: Image.open('take_out/t_%05d.png' % (i + 1)).convert('RGB')
frames, parts = [], []
sr, A = wavfile.read('take_audio.wav'); A = A.astype(np.float32) / 32768
def aud(a, b): return A[int(a / FPS * SR):int(b / FPS * SR)]
xf = int(X / FPS * SR)
for k, (a, b) in enumerate(SEGS):
    if k == 0:
        frames += [P(i) for i in range(a, b - X)]; parts.append(aud(a, b - X)); tail_end = b
    else:
        pb = SEGS[k - 1][1]                                                # dissolve from the previous segment's continuing frames into this segment's first frames
        for j in range(X): frames.append(Image.blend(P(pb - X + j + X) if False else P(pb + j) if pb + j < 3793 else P(3792), P(a + j), (j + .5) / X))
        s0, s1 = aud(pb, pb + X), aud(a, a + X); m_ = min(len(s0), len(s1)); t_ = np.linspace(0, np.pi / 2, m_)[:, None]; n_aud_blend = s0[:m_] * np.cos(t_) + s1[:m_] * np.sin(t_)
        parts.append(n_aud_blend); end = b - (X if k < len(SEGS) - 1 else 0)
        frames += [P(i) for i in range(a + X, end)]; parts.append(aud(a + X, end))
n = len(frames); print('frames', n, round(n / FPS, 1), 's')
for i, im in enumerate(frames):
    f = min(1, i / 8, (n - 1 - i) / 20)
    if f < 1: im = Image.blend(Image.new('RGB', im.size), im, f)
    im.save('%s/c_%04d.png' % (out_dir, i + 1), compress_level=1)
out = np.concatenate(parts); out = out[:int(n / FPS * SR)]
if len(out) < int(n / FPS * SR): out = np.pad(out, ((0, int(n / FPS * SR) - len(out)), (0, 0)))
fo = int(1.2 * SR); out[-fo:] *= np.linspace(1, 0, fo)[:, None]; pk = np.abs(out).max()
if pk > 0.92: out *= 0.92 / pk
wavfile.write(sp + '/vt.wav', SR, (out * 32767).astype(np.int16)); print('audio', round(len(out) / SR, 1))
