"""Soundtrack for the bonfire clip (crate -> sprint -> chop -> build the fire -> night) -> assets/video/bonfire_audio.wav
   Every effect is synthesised from the game's own event log (frames at which the axe lands, footsteps, crafting...), so sound and picture line up.
   Timeline (30 fps, 6-frame dissolves): C crate 0 | D sprint 104 | E chop 193 | K build fire 337 | F night 451 | end 571 frames."""
import numpy as np, os
from scipy import signal
from scipy.io import wavfile

SR = 44100; FPS = 30; FRAMES = 571; DUR = FRAMES / FPS; N = int(SR * DUR) + SR; T = np.arange(N) / SR
rng = np.random.default_rng(5)
L = np.zeros(N); R = np.zeros(N)
START = {'C': 0, 'D': 104, 'E': 193, 'K': 337, 'F': 451}
def tf(shot, fi): return (START[shot] + fi) / FPS

def sos(kind, fc): return signal.butter(2, fc, kind, fs=SR, output='sos')
def lp(x, fc, o=2): return signal.sosfilt(signal.butter(o, fc, 'low', fs=SR, output='sos'), x)
def hp(x, fc, o=2): return signal.sosfilt(signal.butter(o, fc, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi, o=2): return signal.sosfilt(signal.butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def nz(n): return rng.standard_normal(n)
def smooth(x, ms): k = max(1, int(SR * ms / 1000)); return np.convolve(x, np.ones(k) / k, mode='same')

def sweep(x, f0, f1, kind='low', block=512):
    """one-pole style time-varying filter: cutoff glides from f0 to f1 (log) across the signal, processed in blocks with carried state"""
    n = len(x); y = np.zeros(n); zi = None
    for s in range(0, n, block):
        f = np.exp(np.log(f0) + (np.log(f1) - np.log(f0)) * (s / max(1, n)))
        so = signal.butter(2, min(f, SR * 0.45), kind, fs=SR, output='sos')
        if zi is None or zi.shape[0] != so.shape[0]: zi = np.zeros((so.shape[0], 2))
        seg, zi = signal.sosfilt(so, x[s:s + block], zi=zi); y[s:s + block] = seg
    return y

def put(t0, sig, pan=0.0, gain=1.0):
    i = int(t0 * SR)
    if i < 0:
        sig = sig[-i:]; i = 0
    j = min(N, i + len(sig))
    if i >= N or j <= i: return
    sig = sig[:j - i]; L[i:j] += sig * gain * np.sqrt(0.5 * (1 - pan)); R[i:j] += sig * gain * np.sqrt(0.5 * (1 + pan))
def ex(n, tau): return np.exp(-np.arange(n) / SR / tau)
def tvec(n): return np.arange(n) / SR

# ----------------------------------------------------------------------------------------------------------------------------- bed
def bed():
    day = np.interp(T, [0, 10.5, 12.5, 19.1], [1, 1, 0.0, 0.0]); night = 1 - day
    wind = lp(nz(N), 420) * (0.55 + 0.45 * lp(nz(N), 0.35) * 14); wind /= np.abs(wind).max()
    put(0, wind * (0.05 + 0.03 * night), 0, 1)
    surf = bp(nz(N), 150, 900) * (0.5 + 0.5 * np.sin(T * 2 * np.pi * 0.09)); surf /= np.abs(surf).max(); put(0, surf * 0.018, 0.4, 1)     # sea far off
    # leaf canopy hush
    hush = bp(nz(N), 2500, 7000) * (0.4 + 0.6 * lp(nz(N), 0.5) * 18); hush /= np.abs(hush).max(); put(0, hush * 0.012 * (0.5 + day), 0, 1)
bed()
def chirp_bird(t0, f0, pan):
    n = int(rng.uniform(0.09, 0.22) * SR); tt = tvec(n); f = f0 * (1 + 0.5 * np.sin(tt * rng.uniform(25, 60))) * np.linspace(1, rng.uniform(0.7, 1.4), n)
    s = np.sin(np.cumsum(f) / SR * 2 * np.pi) * np.sin(np.linspace(0, np.pi, n)) ** 1.5; put(t0, s, pan, rng.uniform(0.012, 0.035))
for k in range(26):
    t0 = rng.uniform(0.2, 12.2)
    for r_ in range(rng.integers(1, 4)): chirp_bird(t0 + r_ * rng.uniform(0.14, 0.26), rng.uniform(2400, 4800), rng.uniform(-0.8, 0.8))
def cricket(t0, pan):
    for q in range(3):
        n = int(0.035 * SR); tt = tvec(n); s = np.sin(2 * np.pi * 4300 * tt) * np.sin(np.linspace(0, np.pi, n)); put(t0 + q * 0.055, s, pan, 0.0075)
for k in range(130):
    tc = rng.uniform(11.2, DUR - 0.2); cricket(tc, rng.uniform(-0.9, 0.9)) if rng.random() < min(1, (tc - 11.2) / 3) else None

# ----------------------------------------------------------------------------------------------------------------------------- crate (C)
def creak(t0, dur, f0, f1, g, pan=0.0):
    n = int(dur * SR); tt = tvec(n); fr = np.linspace(f0, f1, n) * (1 + 0.04 * np.sin(tt * 37) + 0.02 * lp(nz(n), 40) * 8)
    src = signal.sawtooth(np.cumsum(fr) / SR * 2 * np.pi) * (0.6 + 0.4 * np.sin(tt * 53))
    s = bp(src + 0.3 * nz(n), f0 * 1.5, f1 * 6) * np.sin(np.linspace(0, np.pi, n)) ** 0.7; put(t0, s, pan, g)
creak(0.45, 0.9, 300, 520, 0.05, -0.1); creak(1.25, 0.55, 420, 260, 0.04, 0.1)
for d, g_ in ((0.0, 1.0), (0.09, 0.5)):                                     # lid knocks back
    n = int(0.35 * SR); tt = tvec(n); s = (np.sin(2 * np.pi * 110 * tt) * ex(n, 0.06) + 0.6 * np.sin(2 * np.pi * 240 * tt) * ex(n, 0.04) + 0.5 * lp(nz(n), 1800) * ex(n, 0.02)); put(1.52 + d, s, 0, 0.28 * g_)
for q in range(14):                                                           # rummaging through supplies: cloth, tins, straps
    t0 = rng.uniform(1.65, 3.0); n = int(rng.uniform(0.05, 0.16) * SR); s = bp(nz(n), rng.uniform(600, 1500), rng.uniform(2500, 5500)) * np.sin(np.linspace(0, np.pi, n)); put(t0, s, rng.uniform(-0.3, 0.3), rng.uniform(0.02, 0.05))
for q in range(4):
    t0 = rng.uniform(1.8, 2.8); n = int(0.25 * SR); tt = tvec(n); f = rng.uniform(1800, 3200); put(t0, np.sin(2 * np.pi * f * tt) * ex(n, 0.05) * 0.4 + np.sin(2 * np.pi * f * 2.76 * tt) * ex(n, 0.025) * 0.2, rng.uniform(-0.3, 0.3), 0.025)      # tin clinks
tp = tf('C', 63)                                                              # item picked up: a soft two-note "got it"
for k_, f in enumerate((660, 990)):
    n = int(0.35 * SR); tt = tvec(n); put(tp + k_ * 0.08, np.sin(2 * np.pi * f * tt) * ex(n, 0.09) * 0.7 + np.sin(2 * np.pi * f * 2 * tt) * ex(n, 0.05) * 0.2, 0, 0.07)

# ----------------------------------------------------------------------------------------------------------------------------- sprint (D)
STEPS_D = [2, 9, 15, 21, 27, 34, 40, 46, 52, 58, 64, 70, 76, 83, 89]
for k, fi in enumerate(STEPS_D):
    t0 = tf('D', fi); pan = -0.05 + 0.1 * (k % 2); n = int(0.28 * SR); tt = tvec(n)
    body = np.sin(2 * np.pi * rng.uniform(68, 86) * tt * (1 - 0.3 * tt * 8)) * ex(n, 0.045)                       # heel strike on soft ground
    grass = lp(nz(n), rng.uniform(900, 1700)) * ex(n, 0.05); leaf = hp(nz(n), 3500) * ex(n, 0.03) * 0.5 * (1 + (k % 3 == 0))
    put(t0, body * 0.5 + grass * 0.9 + leaf * 0.25, pan, 0.12 + 0.04 * rng.random())
for k in range(5):                                                            # breathing and gear rattle under the run
    t0 = tf('D', 4 + k * 20); n = int(0.3 * SR); put(t0, bp(nz(n), 500, 1800) * np.sin(np.linspace(0, np.pi, n)) ** 2, 0, 0.012); put(t0 + 0.1, bp(nz(int(0.5 * SR)), 2500, 6000) * np.sin(np.linspace(0, np.pi, int(0.5 * SR))) ** 2, 0, 0.006)
for k in range(10):
    t0 = tf('D', rng.uniform(0, 90)); n = int(0.04 * SR); tt = tvec(n); f = rng.uniform(2200, 3600); put(t0, np.sin(2 * np.pi * f * tt) * ex(n, 0.012), rng.uniform(-0.1, 0.1), 0.008)      # buckles
# swoosh of foliage brushed in passing
for k in range(5):
    t0 = tf('D', rng.uniform(15, 80)); n = int(rng.uniform(0.2, 0.4) * SR); put(t0, hp(nz(n), 1800) * np.sin(np.linspace(0, np.pi, n)) ** 2, rng.uniform(-0.6, 0.6), 0.02)

# ----------------------------------------------------------------------------------------------------------------------------- chopping (E)
def chop_hit(t0, size=1.0):
    """axe biting a trunk: air whoosh up to the strike, bright edge tick, splintering crack, hollow trunk modes ringing, thump through the ground"""
    n = int(0.45 * SR); tt = tvec(n)
    sw = int(0.2 * SR); put(t0 - 0.2, sweep(nz(sw), 500, 2000, 'low', 256) * np.linspace(0, 1, sw) ** 2.2, 0, 0.12)
    tick = hp(nz(n), 2500) * ex(n, 0.004) * 1.0
    crack = bp(nz(n), 700, 3500) * ex(n, 0.025) * 0.9
    modes = sum(a * np.sin(2 * np.pi * f * rng.uniform(0.96, 1.04) * tt) * ex(n, d) for f, a, d in ((165, 0.55, 0.16), (232, 0.3, 0.13), (338, 0.22, 0.1), (470, 0.14, 0.07)))
    thud = np.sin(2 * np.pi * 62 * tt * (1 - 0.25 * np.minimum(tt * 20, 1))) * ex(n, 0.09) * 0.8
    put(t0, (tick * 0.5 + crack * 0.7 + modes * 0.9 + thud) * size, rng.uniform(-0.05, 0.05), 0.55)
    for c in range(int(rng.integers(1, 3))):                                    # chips fly off
        tc = t0 + rng.uniform(0.04, 0.16); m = int(0.02 * SR); put(tc, bp(nz(m), 1800, 4500) * ex(m, 0.006), rng.uniform(-0.5, 0.5), 0.06)
for fi in (31, 56, 81, 103): chop_hit(tf('E', fi + 7), 1.0 if fi < 103 else 1.15)
# the tree gives way: fibres splitting, a long groan, rush of branches through leaves, then the trunk hitting the forest floor
tf0 = tf('E', 103 + 8)
for q in range(14):                                                           # rapid splintering
    tt0 = tf0 + q * rng.uniform(0.02, 0.06); n = int(rng.uniform(0.01, 0.04) * SR); put(tt0, bp(nz(n), rng.uniform(800, 3500), rng.uniform(4000, 8000)) * ex(n, 0.01), rng.uniform(-0.3, 0.3), rng.uniform(0.12, 0.3))
creak(tf0 + 0.1, 1.0, 130, 380, 0.14, 0.0)
n = int(1.4 * SR); put(tf0 + 0.35, sweep(nz(n), 600, 3500, 'low', 512) * np.sin(np.linspace(0, np.pi, n)) ** 2 * 0.35 + hp(nz(n), 3500) * np.sin(np.linspace(0, np.pi, n)) ** 3 * 0.12, 0.1, 0.5)      # branches thrash through the canopy
timp = tf0 + 1.35; n = int(2.5 * SR); tt = tvec(n)
put(timp, np.sin(2 * np.pi * 46 * tt * (1 - 0.2 * np.minimum(tt, 1))) * ex(n, 0.5) * 1.1 + lp(nz(n), 220) * ex(n, 0.35) * 0.9 + bp(nz(n), 400, 3000) * ex(n, 0.07) * 0.5, 0, 0.7)
for q in range(18):                                                           # debris and leaves settling
    tq = timp + 0.1 + abs(rng.normal(0, 0.55)); n = int(rng.uniform(0.02, 0.08) * SR); tt2 = tvec(n); put(tq, (np.sin(2 * np.pi * rng.uniform(110, 400) * tt2) * ex(n, 0.02) + lp(nz(n), 2500) * ex(n, 0.03)), rng.uniform(-0.7, 0.7), rng.uniform(0.03, 0.12))
n = int(2.0 * SR); put(timp + 0.05, hp(nz(n), 2500) * ex(n, 0.5) * 0.08, 0, 1)      # leaf shower

# ----------------------------------------------------------------------------------------------------------------------------- building the fire (K) and the fire itself (K, F)
tb = tf('K', 4)
for q in range(7):                                                            # laying sticks and stones
    tq = tb + q * rng.uniform(0.08, 0.16); n = int(0.12 * SR); tt = tvec(n)
    if q % 2: put(tq, (np.sin(2 * np.pi * rng.uniform(300, 520) * tt) * ex(n, 0.025) + 0.4 * bp(nz(n), 1200, 3500) * ex(n, 0.015)), rng.uniform(-0.3, 0.3), 0.14)    # dry stick knock
    else: put(tq, (np.sin(2 * np.pi * rng.uniform(1400, 2300) * tt) * ex(n, 0.015) + 0.5 * lp(nz(n), 3000) * ex(n, 0.02)), rng.uniform(-0.3, 0.3), 0.12)                    # stone click
ti = tf('K', 18)                                                              # ignition: a spark scrape then the flames catch with a soft whump
n = int(0.35 * SR); put(ti - 0.3, sweep(nz(n), 2000, 7000, 'high', 256) * np.linspace(0, 1, n) * 0.5, 0, 0.1)
for q in range(8):
    n = int(0.01 * SR); put(ti - 0.3 + q * 0.035, hp(nz(n), 3000) * ex(n, 0.003), rng.uniform(-0.3, 0.3), 0.07)
n = int(1.1 * SR); tt = tvec(n)
whump = (sweep(nz(n), 3000, 200, 'low', 256) * (1 - np.exp(-tt * 40)) * ex(n, 0.35) + np.sin(2 * np.pi * 55 * tt * (1 - 0.3 * np.minimum(tt * 3, 1))) * (1 - np.exp(-tt * 30)) * ex(n, 0.2))
put(ti, whump, 0, 0.55)

def fire_bed(t_start, t_end, ramp=2.0, level=1.0):
    n0 = int(t_start * SR); n1 = int(min(t_end, DUR + 0.5) * SR); n = n1 - n0; tt = tvec(n)
    rise = np.clip(tt / ramp, 0, 1) ** 1.3 * level
    roar = lp(nz(n), 380) * (0.65 + 0.35 * lp(nz(n), 1.5) * 12) + 0.6 * lp(nz(n), 900) * (0.5 + 0.5 * lp(nz(n), 3) * 10)
    roar /= np.abs(roar).max(); hiss = bp(nz(n), 3500, 9000) * (0.35 + 0.65 * np.abs(lp(nz(n), 6)) * 14); hiss /= np.abs(hiss).max()
    put(t_start, roar * rise * 0.11 + hiss * rise * 0.025, -0.1, 1)
    put(t_start, lp(nz(n), 160) * rise * 0.0, 0, 1)
    # crackle: Poisson pops with clustering, small ticks, occasional heavier snaps with a woody body
    t = t_start + 0.15
    while t < t_end:
        rate = (6 + 20 * float(np.clip((t - t_start) / ramp, 0, 1))) * level; t += rng.exponential(1 / rate)
        big = rng.random() < 0.07; pan = rng.uniform(-0.7, 0.7); k = np.clip((t - t_start) / ramp, 0, 1)
        if big:
            m = int(0.14 * SR); tt2 = tvec(m); s = (hp(nz(m), 1500) * ex(m, 0.005) + bp(nz(m), 350, 1100) * ex(m, 0.03) * 0.8 + np.sin(2 * np.pi * rng.uniform(150, 260) * tt2) * ex(m, 0.03) * 0.5)
            put(t, s, pan, 0.2 * k)
            for q in range(int(rng.integers(1, 5))): m2 = int(0.008 * SR); put(t + 0.03 + q * rng.uniform(0.01, 0.05), bp(nz(m2), 2500, 7000) * ex(m2, 0.002), pan + rng.uniform(-0.1, 0.1), 0.1 * k)
        else:
            m = int(rng.uniform(0.004, 0.02) * SR); put(t, bp(nz(m), rng.uniform(1500, 3500), rng.uniform(5000, 9000)) * ex(m, rng.uniform(0.001, 0.004)), pan, rng.uniform(0.04, 0.16) * k)
fire_bed(ti + 0.05, DUR + 0.3, ramp=2.3, level=1.0)
# torch flame in the last shot: a soft living flutter
tt0 = tf('F', 0)
for q in range(11):
    tq = tt0 + 0.2 + q * rng.uniform(0.3, 0.55); n = int(0.35 * SR); put(tq, sweep(nz(n), 900, 300, 'low', 256) * np.sin(np.linspace(0, np.pi, n)) ** 2, 0.25, 0.04)

# ----------------------------------------------------------------------------------------------------------------------------- score pad (low, so the effects lead)
def pad(freqs, g, t0=0.0, t1=DUR):
    gate = np.interp(T, [t0, t0 + 2.5, t1 - 2.0, t1], [0, 1, 1, 0])
    s = 0
    for f in freqs:
        for d_ in (-0.0035, 0, 0.0035):
            s = s + signal.sawtooth(2 * np.pi * f * (1 + d_) * T + rng.uniform(0, 6)) * 0.12
    s = lp(s, 700) * gate * (0.7 + 0.3 * np.sin(T * 0.8)); put(0, s, 0, g)
pad([110, 165, 220], 0.05, 0.0, 12.0); pad([98, 147, 196, 294], 0.055, 11.0, 19.1)

# ----------------------------------------------------------------------------------------------------------------------------- master
def reverb(x, secs=1.3, mix=0.16):
    n = int(SR * secs); ir = lp(nz(n) * np.exp(-np.arange(n) / (n * 0.3)), 5000); ir /= np.sqrt(np.sum(ir ** 2))
    return x * (1 - mix) + signal.fftconvolve(x, ir)[:N] * mix * 2.0
L = reverb(L); R = reverb(R)
fade = np.interp(T, [0, 0.6, DUR - 1.4, DUR], [0, 1, 1, 0]); L *= fade; R *= fade
rms = np.sqrt(smooth(0.5 * (L ** 2 + R ** 2), 350)) + 1e-6; g = smooth(np.clip((0.07 / rms) ** 0.5, 0.6, 4.0), 250); L *= g; R *= g
L = np.tanh(L * 1.5) / np.tanh(1.5); R = np.tanh(R * 1.5) / np.tanh(1.5)
pk = max(np.abs(L).max(), np.abs(R).max()); L *= 0.88 / pk; R *= 0.88 / pk
n_out = int(DUR * SR); out = np.stack([L[:n_out], R[:n_out]], 1)
wavfile.write(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bonfire_audio.wav'), SR, (out * 32767).astype(np.int16))
print('written', out.shape, 'dur', DUR)
