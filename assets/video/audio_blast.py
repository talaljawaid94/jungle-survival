"""Soundtrack for the crash-and-blast clip (footage frames 340-620 of the intro film, 9.33 s, impact at 2.70 s) -> assets/video/blast_audio.wav
   The impact plays in slow motion (the game slows time to 22% and eases back over ~6 s), so the blast is built as a slowed event:
   a short metal/wood crunch, a fireball whoomph that rises then rolls off, a sub boom, a muffled "underwater" ring, debris and metal groans
   pitched down, and a fire that crackles slowly at first and returns to real time as the picture does."""
import numpy as np, os
from scipy import signal
from scipy.io import wavfile

SR = 44100; DUR = 280 / 30; N = int(SR * (DUR + 1)); T = np.arange(N) / SR
TI = (421 - 340) / 30                                                    # impact: frame 421 of the footage, clip starts at frame 340
rng = np.random.default_rng(23)
L = np.zeros(N); R = np.zeros(N)
def lp(x, fc, o=2): return signal.sosfilt(signal.butter(o, fc, 'low', fs=SR, output='sos'), x)
def hp(x, fc, o=2): return signal.sosfilt(signal.butter(o, fc, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi, o=2): return signal.sosfilt(signal.butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def nz(n): return rng.standard_normal(n)
def ex(n, tau): return np.exp(-np.arange(n) / SR / tau)
def tv(n): return np.arange(n) / SR
def smooth(x, ms): k = max(1, int(SR * ms / 1000)); return np.convolve(x, np.ones(k) / k, mode='same')
def sweep(x, f0, f1, kind='low', block=512):
    n = len(x); y = np.zeros(n); zi = None
    for s in range(0, n, block):
        f = np.exp(np.log(f0) + (np.log(f1) - np.log(f0)) * (s / max(1, n))); so = signal.butter(2, min(f, SR * 0.45), kind, fs=SR, output='sos')
        if zi is None: zi = np.zeros((so.shape[0], 2))
        seg, zi = signal.sosfilt(so, x[s:s + block], zi=zi); y[s:s + block] = seg
    return y
def put(t0, sig, pan=0.0, gain=1.0, bus=None):
    i = int(t0 * SR)
    if i < 0: sig = sig[-i:]; i = 0
    j = min(N, i + len(sig))
    if i >= N or j <= i: return
    sig = sig[:j - i]; a, b = (L, R) if bus is None else bus
    a[i:j] += sig * gain * np.sqrt(0.5 * (1 - pan)); b[i:j] += sig * gain * np.sqrt(0.5 * (1 + pan))

# post-impact material goes on its own bus so the whole aftermath can sit behind a low-pass that opens as time returns to normal
PL = np.zeros(N); PR = np.zeros(N); POST = (PL, PR)

# ------------------------------------------------------------------------------------------------ before the impact: the dying helicopter
pre = (T < TI)
# blade slap: a rotor train that slows and goes ragged as the engine dies
t = 0.0; k = 0
while t < TI - 0.12:
    rate = np.interp(t, [0, TI], [10.5, 5.5]) * (1 + 0.05 * np.sin(t * 7)); dtp = 1 / rate * (1 + rng.normal(0, 0.05 * (t / TI)))
    n = int(0.09 * SR); tt = tv(n); s = lp(nz(n), 700) * ex(n, 0.02) + np.sin(2 * np.pi * 70 * tt) * ex(n, 0.03) * 0.8
    put(t, s, np.sin(t * 5) * 0.15, np.interp(t, [0, 1.5, TI], [0.35, 0.5, 0.3]) * (0.4 if rng.random() < 0.1 * t else 1.0)); t += dtp
# turbine whine falling as the engine starves, with coughs
n = int(TI * SR); tt = tv(n); fr = np.interp(tt, [0, 1.0, TI], [1250, 900, 330]) * (1 + 0.03 * np.sin(tt * 19) + 0.015 * lp(nz(n), 30) * 6)
whine = np.sin(np.cumsum(fr) / SR * 2 * np.pi) + 0.4 * np.sin(np.cumsum(fr * 2.01) / SR * 2 * np.pi)
gate = np.clip(0.55 + 0.45 * np.sign(np.sin(tt * 13 + 2 * np.sin(tt * 3.1))) * (tt / TI > 0.4) + 0.0, 0.1, 1.0) if False else np.ones(n)
cough = 1 - 0.7 * (np.abs(lp(nz(n), 6)) * 10 > 0.9) * (tt > 0.8)
put(0, whine * 0.05 * cough * np.interp(tt, [0, TI - 0.1, TI], [1, 1, 0]), 0, 1)
# wind rush building as it drops
n = int((TI + 0.1) * SR); tt = tv(n); put(0, sweep(nz(n), 400, 2600, 'low', 512) * np.interp(tt, [0, TI], [0.04, 0.22]), 0, 1)
# cockpit alarm: two-tone beeps that stop dead at the impact
for q in np.arange(0.3, TI - 0.2, 0.46):
    n = int(0.16 * SR); tt = tv(n); put(q, np.sin(2 * np.pi * 1180 * tt) * np.sin(np.linspace(0, np.pi, n)) ** 0.5, 0.2, 0.03); put(q + 0.2, np.sin(2 * np.pi * 880 * tt) * np.sin(np.linspace(0, np.pi, n)) ** 0.5, 0.2, 0.03)
# last 0.35 s: it tears through the canopy: dense snapping, scraping metal
for q in range(110):
    tq = TI - 0.4 + (q / 110) ** 0.8 * 0.37; n = int(rng.uniform(0.008, 0.05) * SR); k_ = (q / 110)
    put(tq, bp(nz(n), rng.uniform(600, 2500), rng.uniform(3000, 9000)) * ex(n, 0.01), rng.uniform(-0.6, 0.6), 0.1 + 0.25 * k_)
n = int(0.4 * SR); put(TI - 0.4, sweep(nz(n), 1500, 6000, 'high', 256) * np.linspace(0, 1, n) ** 2 * ex(n, 5), 0, 0.3)          # scrape rising
n = int(0.4 * SR); tt = tv(n); put(TI - 0.4, signal.sawtooth(2 * np.pi * np.cumsum(np.linspace(220, 700, n)) / SR) * np.linspace(0, 1, n) ** 2 * 0.12, 0.1, 1)        # tortured metal

# ------------------------------------------------------------------------------------------------ the impact (slow motion)
dt = np.clip(T - TI, 0, None); on = (T >= TI).astype(float)
# 1. the strike: a short hard crunch (it is the one thing that is still at full speed)
n = int(0.22 * SR); tt = tv(n)
crunch = hp(nz(n), 400) * ex(n, 0.03) * 1.0 + lp(nz(n), 2500) * ex(n, 0.06) * 0.9 + np.sin(2 * np.pi * 140 * tt) * ex(n, 0.05)
put(TI, crunch, 0, 0.9, POST)
# 2. fireball: the pressure wave heard in slow motion: rises over ~0.35 s, then rolls off, its brightness collapsing over ~2.5 s
n = int(4.5 * SR); tt = tv(n)
base = nz(n); fb = sweep(base, 2600, 70, 'low', 512) + 0.6 * sweep(nz(n), 900, 50, 'low', 512)
amp = (1 - np.exp(-tt / 0.12)) * np.exp(-tt / 1.5)
put(TI + 0.02, fb * amp, -0.1, 1.5, POST)
put(TI + 0.05, sweep(nz(n), 1500, 60, 'low', 512) * (1 - np.exp(-tt / 0.3)) * np.exp(-tt / 1.9), 0.15, 1.0, POST)
# 3. sub boom: a slow, huge sine that settles from 58 Hz to 22 Hz, with a harmonic so it carries on small speakers too
n = int(5.5 * SR); tt = tv(n); f = 22 + 38 * np.exp(-tt * 1.1); ph = np.cumsum(f) / SR * 2 * np.pi
sub = (np.sin(ph) + 0.5 * np.sin(2 * ph + 0.3) + 0.22 * np.sin(3 * ph)) * (1 - np.exp(-tt / 0.03)) * np.exp(-tt / 1.5)
put(TI, sub, 0, 2.0, POST)
# 4. rolling rumble that outlasts the blast (the shock bouncing round the valley)
n = int(7.0 * SR); tt = tv(n); rum = lp(nz(n), 190) * (0.6 + 0.4 * lp(nz(n), 2.5) * 8) * np.exp(-tt / 3.2) * (1 - np.exp(-tt / 0.4))
put(TI + 0.1, rum, -0.2, 1.2, POST); put(TI + 0.25, lp(nz(n), 120) * np.exp(-tt / 3.6) * (1 - np.exp(-tt / 0.5)), 0.2, 1.0, POST)
# 5. slow-motion debris: pitched-down wood and metal falling, getting faster as time returns to normal
t = TI + 0.45; ds = 1.0
while t < TI + 5.8:
    speed = np.interp(t - TI, [0, 2.5, 6], [0.25, 0.5, 1.0]); n = int(rng.uniform(0.08, 0.25) / speed * SR); tt = tv(n)
    f0 = rng.uniform(70, 420) * speed ** 0.5; s = np.sin(2 * np.pi * f0 * tt * (1 - 0.3 * np.minimum(tt * 6, 1))) * ex(n, 0.06 / speed) + 0.6 * lp(nz(n), 2200 * speed) * ex(n, 0.05 / speed)
    put(t, s, rng.uniform(-0.9, 0.9), rng.uniform(0.08, 0.35) * np.exp(-(t - TI) * 0.3), POST); t += rng.exponential(0.2 / (0.3 + speed * 1.2))
for q in range(5):                                                                                               # long metal groans, slowed
    tq = TI + 0.7 + q * rng.uniform(0.45, 0.9); n = int(rng.uniform(0.7, 1.5) * SR); tt = tv(n); f0 = rng.uniform(90, 200)
    s = signal.sawtooth(2 * np.pi * np.cumsum(np.linspace(f0, f0 * rng.uniform(0.6, 1.5), n)) / SR) * np.sin(np.linspace(0, np.pi, n)); put(tq, lp(s, 900), rng.uniform(-0.6, 0.6), 0.07, POST)
# 6. the shock's ring in the ears: sets in as the blast fades, sits behind everything
n = int(5.5 * SR); tt = tv(n); put(TI + 0.25, (np.sin(2 * np.pi * 3300 * tt) + 0.3 * np.sin(2 * np.pi * 4100 * tt)) * (1 - np.exp(-tt / 0.15)) * np.exp(-tt / 2.2), 0, 0.022, POST)
# 7. fire: slow dull pops at first, then the real crackle as time returns to normal; a growing roar underneath
n = int(6.3 * SR); tt = tv(n); rate_env = np.interp(tt, [0, 6.3], [0.4, 1.0]); roar = lp(nz(n), 420) * (0.6 + 0.4 * lp(nz(n), 1.5) * 12)
put(TI + 0.6, roar * (1 - np.exp(-tt / 1.5)) * 0.1 * rate_env, -0.1, 1.0, POST)
t = TI + 1.0
while t < DUR + 0.5:
    sp = np.interp(t - TI, [0, 3, 6.3], [0.3, 0.6, 1.0]); t += rng.exponential(1 / (14 * sp)); big = rng.random() < 0.08; pan = rng.uniform(-0.7, 0.7)
    m = int((0.12 if big else rng.uniform(0.006, 0.025)) / sp * SR); tt2 = tv(m)
    s = (bp(nz(m), 300 / sp ** 0.3, 1200) * ex(m, 0.03 / sp) + np.sin(2 * np.pi * rng.uniform(140, 240) * sp * tt2) * ex(m, 0.03 / sp) * 0.5) if big else bp(nz(m), 1500 * sp, 7000 * sp ** 0.5) * ex(m, 0.003 / sp)
    put(t, s, pan, (0.25 if big else rng.uniform(0.05, 0.14)) * np.clip((t - TI - 0.7) / 1.5, 0, 1), POST)

# the aftermath sits behind a low-pass that opens as the picture speeds back up (the "stunned" muffling), a duck on everything else at impact
PL = sweep(PL, 700, 9000, 'low', 1024); PR = sweep(PR, 700, 9000, 'low', 1024)
# pre-impact blend: the post bus starts at the impact so the sweep above only shapes what follows
L += PL; R += PR
duck = 1 - 0.0 * on
# ------------------------------------------------------------------------------------------------ master
def reverb(x, secs=2.2, mix=0.2):
    n = int(SR * secs); ir = lp(nz(n) * np.exp(-np.arange(n) / (n * 0.3)), 4500); ir /= np.sqrt(np.sum(ir ** 2))
    return x * (1 - mix) + signal.fftconvolve(x, ir)[:N] * mix * 2.2
g_ = np.interp(T, [0, TI - 0.05, TI, TI + 2.5, TI + 6.5], [2.3, 2.3, 1.0, 1.0, 3.0]); L *= g_; R *= g_                  # a stronger approach, and the fire stays audible once the blast has passed
L = reverb(L); R = reverb(R)
fade = np.interp(T, [0, 0.35, DUR - 1.0, DUR], [0, 1, 1, 0]); L *= fade; R *= fade
# gentle limiter only (no loudness levelling) so the blast keeps its huge dynamic jump from the quiet-ish approach
pk = max(np.abs(L).max(), np.abs(R).max()); L /= pk; R /= pk
L = np.tanh(L * 1.7) / np.tanh(1.7); R = np.tanh(R * 1.7) / np.tanh(1.7)
n_out = int(DUR * SR); out = np.stack([L[:n_out], R[:n_out]], 1) * 0.92
wavfile.write(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'blast_audio.wav'), SR, (out * 32767).astype(np.int16))
print('written', out.shape, 'dur', DUR, 'impact at', TI)
