"""Soundtrack for the single-take gameplay recording, on the take's own frame timeline (30 fps, 3793 frames) -> assets/video/take_audio.wav
   Gameplay sounds are placed from the events the game fired while it was played (steps, pickups, axe strikes, the tree falling, crafting, the fire);
   the intro uses the helicopter bed from game_audio.wav and the slow-motion blast from blast_audio.wav, both already aligned to the same impact frame (496)."""
import numpy as np, os
from scipy import signal
from scipy.io import wavfile

V = os.path.dirname(os.path.abspath(__file__)) + "/"
SR = 44100; FPS = 30; FRAMES = 3793; DUR = FRAMES / FPS; N = int(SR * DUR) + SR; T = np.arange(N) / SR
rng = np.random.default_rng(77)
L = np.zeros(N); R = np.zeros(N)
def lp(x, fc, o=2): return signal.sosfilt(signal.butter(o, fc, 'low', fs=SR, output='sos'), x)
def hp(x, fc, o=2): return signal.sosfilt(signal.butter(o, fc, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi, o=2): return signal.sosfilt(signal.butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def nz(n): return rng.standard_normal(n)
def ex(n, tau): return np.exp(-np.arange(n) / SR / tau)
def tv(n): return np.arange(n) / SR
def smooth(x, ms): k = max(1, int(SR * ms / 1000)); return np.convolve(x, np.ones(k) / k, mode='same')
def tf(f): return f / FPS
def put(t0, sig, pan=0.0, gain=1.0):
    i = int(t0 * SR)
    if i < 0: sig = sig[-i:]; i = 0
    j = min(N, i + len(sig))
    if i >= N or j <= i: return
    sig = sig[:j - i]; L[i:j] += sig * gain * np.sqrt(0.5 * (1 - pan)); R[i:j] += sig * gain * np.sqrt(0.5 * (1 + pan))
def sweep(x, f0, f1, kind='low', block=512):
    n = len(x); y = np.zeros(n); zi = None
    for s in range(0, n, block):
        f = np.exp(np.log(f0) + (np.log(f1) - np.log(f0)) * (s / max(1, n))); so = signal.butter(2, min(f, SR * 0.45), kind, fs=SR, output='sos')
        if zi is None: zi = np.zeros((so.shape[0], 2))
        seg, zi = signal.sosfilt(so, x[s:s + block], zi=zi); y[s:s + block] = seg
    return y

# ------------------------------------------------------------------------------------------------ events from the take
STEPS = [1026, 1038, 1049, 1060, 1072, 1083, 1101, 1228, 1239, 1250, 1262, 1273, 1284, 1296, 1724, 1736, 1748, 1759, 1770, 1781, 1793, 1804, 1815, 1827, 1838, 1849, 1861, 1872, 1883, 1895, 1906, 1917,
         2109, 2121, 2788, 2800, 2812, 2823, 2834, 2846, 2857, 2868, 2880, 2891, 2902, 2914, 2925, 2936, 3409, 3420, 3432, 3443, 3458]
PICKUPS = [1156, 1940, 2031, 2140, 2959, 3464]
CHOPS = [1328, 1353, 1378, 1400]                                          # swing starts; the strike lands 0.24 s later
FALL, LAND = 1400, 1459                                                   # the tree starts to go, and the trunk hits the ground
CRATE = (1108, 1156)                                                      # lid creaks open, supplies come out
CLICK = 1177; CRAFT = 3560; PANEL = (3470, 3560)

# ------------------------------------------------------------------------------------------------ ambience: afternoon forest -> dusk -> night
day = np.interp(T, [0, tf(2300), tf(2900)], [1, 1, 0]); night = 1 - day
wind = lp(nz(N), 380) * (0.55 + 0.45 * lp(nz(N), 0.3) * 14); wind /= np.abs(wind).max(); put(0, wind * 0.045, 0, 1)
hush = bp(nz(N), 2500, 7000) * (0.4 + 0.6 * lp(nz(N), 0.5) * 18); hush /= np.abs(hush).max(); put(0, hush * 0.014 * (0.4 + 0.6 * day), 0, 1)
def bird(t0, f0, pan):
    n = int(rng.uniform(0.09, 0.24) * SR); tt = tv(n); f = f0 * (1 + 0.5 * np.sin(tt * rng.uniform(25, 60))) * np.linspace(1, rng.uniform(0.7, 1.4), n)
    put(t0, np.sin(np.cumsum(f) / SR * 2 * np.pi) * np.sin(np.linspace(0, np.pi, n)) ** 1.5, pan, rng.uniform(0.012, 0.04))
for k in range(150):
    t0 = rng.uniform(tf(930), tf(3000))
    if rng.random() < float(np.interp(t0, [0, tf(2300), tf(2900)], [1, 1, 0.05])):
        for r_ in range(int(rng.integers(1, 4))): bird(t0 + r_ * rng.uniform(0.14, 0.27), rng.uniform(2300, 5000), rng.uniform(-0.9, 0.9))
def cricket(t0, pan):
    for q in range(3): n = int(0.035 * SR); tt = tv(n); put(t0 + q * 0.055, np.sin(2 * np.pi * 4300 * tt) * np.sin(np.linspace(0, np.pi, n)), pan, 0.0075)
for k in range(700):
    tc = rng.uniform(tf(2500), DUR - 0.2)
    if rng.random() < float(np.interp(tc, [tf(2500), tf(3100)], [0.1, 1.0])): cricket(tc, rng.uniform(-0.9, 0.9))
ins = bp(nz(N), 5200, 6500) * (0.5 + 0.5 * np.sin(T * 2 * np.pi * 28)); ins /= np.abs(ins).max(); put(0, ins * 0.008 * day, 0, 1)

# ------------------------------------------------------------------------------------------------ footsteps (the game's jog on grass and leaf litter)
for k, f in enumerate(STEPS):
    t0 = tf(f); pan = -0.05 + 0.1 * (k % 2); n = int(0.3 * SR); tt = tv(n)
    body = np.sin(2 * np.pi * rng.uniform(66, 84) * tt * (1 - 0.3 * np.minimum(tt * 8, 1))) * ex(n, 0.05)
    tex = lp(nz(n), rng.uniform(900, 1800)) * ex(n, 0.055) * 0.85 + hp(nz(n), 3500) * ex(n, 0.03) * 0.3
    put(t0, body * 0.4 + tex * 0.9, pan, 0.12 + 0.04 * rng.random())
    if rng.random() < 0.5: m = int(0.04 * SR); put(t0 + 0.02, np.sin(2 * np.pi * rng.uniform(2300, 3400) * tv(m)) * ex(m, 0.012), pan, 0.006)

# ------------------------------------------------------------------------------------------------ supply crate
def creak(t0, dur, f0, f1, g, pan=0.0):
    n = int(dur * SR); tt = tv(n); fr = np.linspace(f0, f1, n) * (1 + 0.04 * np.sin(tt * 37) + 0.02 * lp(nz(n), 40) * 8)
    src = signal.sawtooth(np.cumsum(fr) / SR * 2 * np.pi) * (0.6 + 0.4 * np.sin(tt * 53)); s = bp(src + 0.3 * nz(n), f0 * 1.5, f1 * 6) * np.sin(np.linspace(0, np.pi, n)) ** 0.7; put(t0, s, pan, g)
c0 = tf(CRATE[0]); creak(c0, 0.8, 300, 520, 0.05, -0.1); creak(c0 + 0.7, 0.55, 420, 260, 0.04, 0.1)
for d, g_ in ((0.0, 1.0), (0.09, 0.5)):
    n = int(0.35 * SR); tt = tv(n); put(tf(CRATE[1]) - 0.45 + d, np.sin(2 * np.pi * 110 * tt) * ex(n, 0.06) + 0.6 * np.sin(2 * np.pi * 240 * tt) * ex(n, 0.04) + 0.5 * lp(nz(n), 1800) * ex(n, 0.02), 0, 0.28 * g_)
for q in range(10):
    t0 = rng.uniform(tf(CRATE[1]) - 0.3, tf(CRATE[1]) + 0.9); n = int(rng.uniform(0.05, 0.16) * SR); put(t0, bp(nz(n), rng.uniform(600, 1500), rng.uniform(2500, 5500)) * np.sin(np.linspace(0, np.pi, n)), rng.uniform(-0.3, 0.3), rng.uniform(0.02, 0.05))
def chime(t0, g=0.07):
    for k_, f in enumerate((660, 990)): n = int(0.35 * SR); tt = tv(n); put(t0 + k_ * 0.08, np.sin(2 * np.pi * f * tt) * ex(n, 0.09) * 0.7 + np.sin(2 * np.pi * f * 2 * tt) * ex(n, 0.05) * 0.2, 0, g)
for f in PICKUPS: chime(tf(f))
n = int(0.04 * SR); put(tf(CLICK), np.sin(2 * np.pi * 520 * tv(n)) * ex(n, 0.01), 0, 0.05)

# ------------------------------------------------------------------------------------------------ chopping the tree
def chop_hit(t0):
    n = int(0.45 * SR); tt = tv(n); sw = int(0.2 * SR); put(t0 - 0.2, sweep(nz(sw), 500, 2000, 'low', 256) * np.linspace(0, 1, sw) ** 2.2, 0, 0.12)
    tick = hp(nz(n), 2500) * ex(n, 0.004); crack = bp(nz(n), 700, 3500) * ex(n, 0.025) * 0.9
    modes = sum(a * np.sin(2 * np.pi * f * rng.uniform(0.96, 1.04) * tt) * ex(n, d) for f, a, d in ((165, 0.55, 0.16), (232, 0.3, 0.13), (338, 0.22, 0.1), (470, 0.14, 0.07)))
    thud = np.sin(2 * np.pi * 62 * tt * (1 - 0.25 * np.minimum(tt * 20, 1))) * ex(n, 0.09) * 0.8
    put(t0, tick * 0.5 + crack * 0.7 + modes * 0.9 + thud, 0, 0.55)
    for c in range(int(rng.integers(1, 3))): m = int(0.02 * SR); put(t0 + rng.uniform(0.04, 0.16), bp(nz(m), 1800, 4500) * ex(m, 0.006), rng.uniform(-0.5, 0.5), 0.06)
for f in CHOPS: chop_hit(tf(f + 7))
tf0 = tf(FALL + 7)
for q in range(14): n = int(rng.uniform(0.01, 0.04) * SR); put(tf0 + q * rng.uniform(0.02, 0.06), bp(nz(n), rng.uniform(800, 3500), rng.uniform(4000, 8000)) * ex(n, 0.01), rng.uniform(-0.3, 0.3), rng.uniform(0.12, 0.3))
creak(tf0 + 0.1, 1.2, 130, 380, 0.14, 0.0)
n = int((tf(LAND) - tf0) * SR); put(tf0 + 0.3, sweep(nz(n), 600, 3500, 'low', 512) * np.sin(np.linspace(0, np.pi, n)) ** 2 * 0.35 + hp(nz(n), 3500) * np.sin(np.linspace(0, np.pi, n)) ** 3 * 0.12, 0.1, 0.5)
timp = tf(LAND) - 0.05; n = int(2.5 * SR); tt = tv(n)
put(timp, np.sin(2 * np.pi * 46 * tt * (1 - 0.2 * np.minimum(tt, 1))) * ex(n, 0.5) * 1.1 + lp(nz(n), 220) * ex(n, 0.35) * 0.9 + bp(nz(n), 400, 3000) * ex(n, 0.07) * 0.5, 0, 0.7)
for q in range(18): tq = timp + 0.1 + abs(rng.normal(0, 0.55)); n = int(rng.uniform(0.02, 0.08) * SR); tt2 = tv(n); put(tq, np.sin(2 * np.pi * rng.uniform(110, 400) * tt2) * ex(n, 0.02) + lp(nz(n), 2500) * ex(n, 0.03), rng.uniform(-0.7, 0.7), rng.uniform(0.03, 0.12))
n = int(2.0 * SR); put(timp + 0.05, hp(nz(n), 2500) * ex(n, 0.5) * 0.08, 0, 1)

# ------------------------------------------------------------------------------------------------ crafting menu, building the campfire, the fire
tp = tf(PANEL[0])
for q, fr in enumerate((0, 10, 25)): n = int(0.05 * SR); put(tp + fr / FPS, np.sin(2 * np.pi * (700 + 120 * q) * tv(n)) * ex(n, 0.012), 0, 0.04)
ti = tf(CRAFT)
for q in range(7):
    tq = ti - 0.7 + q * rng.uniform(0.07, 0.15); n = int(0.12 * SR); tt = tv(n)
    put(tq, (np.sin(2 * np.pi * rng.uniform(300, 520) * tt) * ex(n, 0.025) + 0.4 * bp(nz(n), 1200, 3500) * ex(n, 0.015)) if q % 2 else (np.sin(2 * np.pi * rng.uniform(1400, 2300) * tt) * ex(n, 0.015) + 0.5 * lp(nz(n), 3000) * ex(n, 0.02)), rng.uniform(-0.3, 0.3), 0.13)
n = int(0.3 * SR); put(ti - 0.3, sweep(nz(n), 2000, 7000, 'high', 256) * np.linspace(0, 1, n) * 0.5, 0, 0.1)
n = int(1.1 * SR); tt = tv(n); put(ti, sweep(nz(n), 3000, 200, 'low', 256) * (1 - np.exp(-tt * 40)) * ex(n, 0.35) + np.sin(2 * np.pi * 55 * tt * (1 - 0.3 * np.minimum(tt * 3, 1))) * (1 - np.exp(-tt * 30)) * ex(n, 0.2), 0, 0.55)
t_start = ti + 0.05; n = int((DUR + 0.3 - t_start) * SR); tt = tv(n); rise = np.clip(tt / 2.3, 0, 1) ** 1.3
roar = lp(nz(n), 380) * (0.65 + 0.35 * lp(nz(n), 1.5) * 12) + 0.6 * lp(nz(n), 900) * (0.5 + 0.5 * lp(nz(n), 3) * 10); roar /= np.abs(roar).max()
hiss = bp(nz(n), 3500, 9000) * (0.35 + 0.65 * np.abs(lp(nz(n), 6)) * 14); hiss /= np.abs(hiss).max(); put(t_start, roar * rise * 0.11 + hiss * rise * 0.025, -0.1, 1)
t = t_start + 0.15
while t < DUR:
    k = np.clip((t - t_start) / 2.3, 0, 1); t += rng.exponential(1 / (6 + 20 * k)); big = rng.random() < 0.07; pan = rng.uniform(-0.7, 0.7)
    if big:
        m = int(0.14 * SR); tt2 = tv(m); put(t, hp(nz(m), 1500) * ex(m, 0.005) + bp(nz(m), 350, 1100) * ex(m, 0.03) * 0.8 + np.sin(2 * np.pi * rng.uniform(150, 260) * tt2) * ex(m, 0.03) * 0.5, pan, 0.2 * k)
        for q in range(int(rng.integers(1, 5))): m2 = int(0.008 * SR); put(t + 0.03 + q * rng.uniform(0.01, 0.05), bp(nz(m2), 2500, 7000) * ex(m2, 0.002), pan, 0.1 * k)
    else: m = int(rng.uniform(0.004, 0.02) * SR); put(t, bp(nz(m), rng.uniform(1500, 3500), rng.uniform(5000, 9000)) * ex(m, rng.uniform(0.001, 0.004)), pan, rng.uniform(0.04, 0.16) * k)

# ------------------------------------------------------------------------------------------------ gentle score under the gameplay
def pad(freqs, g, t0, t1):
    gate = np.interp(T, [t0, t0 + 3, t1 - 3, t1], [0, 1, 1, 0]); s = 0
    for f in freqs:
        for d_ in (-0.0035, 0, 0.0035): s = s + signal.sawtooth(2 * np.pi * f * (1 + d_) * T + rng.uniform(0, 6)) * 0.12
    put(0, lp(s, 800) * gate * (0.7 + 0.3 * np.sin(T * 0.7)), 0, g)
pad([131, 196, 262, 330], 0.05, tf(960), tf(3000)); pad([98, 147, 196, 294], 0.055, tf(2900), DUR)

# ------------------------------------------------------------------------------------------------ gameplay mix: light reverb, level it, then lay the intro under/over it
def reverb(x, secs=1.2, mix=0.14):
    n = int(SR * secs); ir = lp(nz(n) * np.exp(-np.arange(n) / (n * 0.3)), 5500); ir /= np.sqrt(np.sum(ir ** 2)); return x * (1 - mix) + signal.fftconvolve(x, ir)[:N] * mix * 2.0
L = reverb(L); R = reverb(R)
rms = np.sqrt(smooth(0.5 * (L ** 2 + R ** 2), 350)) + 1e-6; g = smooth(np.clip((0.065 / rms) ** 0.5, 0.6, 4.0), 250); L *= g; R *= g
L = np.tanh(L * 1.5) / np.tanh(1.5); R = np.tanh(R * 1.5) / np.tanh(1.5); pk = max(np.abs(L).max(), np.abs(R).max()); L *= 0.8 / pk; R *= 0.8 / pk
SRW, a = wavfile.read(V + 'game_audio.wav'); a = a.astype(np.float32) / 32768
SRB, b = wavfile.read(V + 'blast_audio.wav'); b = b.astype(np.float32) / 32768
def lay(src, f0, f1, srcoff_f, xf=6):
    i0 = int(f0 / FPS * SR); n = min(int((f1 - f0) / FPS * SR), len(src) - int(srcoff_f / FPS * SR)); s = src[int(srcoff_f / FPS * SR):int(srcoff_f / FPS * SR) + n]; w = np.ones(n)
    k = int(xf / FPS * SR); w[:k] = np.linspace(0, 1, k); w[-k:] = np.linspace(1, 0, k)
    L[i0:i0 + n] = L[i0:i0 + n] * (1 - w) + s[:, 0] * w; R[i0:i0 + n] = R[i0:i0 + n] * (1 - w) + s[:, 1] * w
L[:int(tf(75) * SR)] *= 0.0; R[:int(tf(75) * SR)] *= 0.0                       # menu: just the room tone below
L[:int(tf(75) * SR)] += lp(nz(int(tf(75) * SR)), 400) * 0.01; R[:int(tf(75) * SR)] += lp(nz(int(tf(75) * SR)), 400) * 0.01
lay(a, 75, 415, 0, xf=10)                                                       # helicopter bed (intro starts at frame 75)
lay(b, 415, 700, 10, xf=6)                                                      # approach to the impact (frame 496), the slow-motion blast and its aftermath
fd = np.interp(T, [0, 0.2, DUR - 2.0, DUR], [0, 1, 1, 0]); L *= fd; R *= fd
out = np.stack([L[:int(DUR * SR)], R[:int(DUR * SR)]], 1)
wavfile.write(V + 'take_audio.wav', SR, (np.clip(out, -1, 1) * 32767).astype(np.int16)); print('written', out.shape, DUR)
