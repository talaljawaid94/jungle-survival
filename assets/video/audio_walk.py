"""Soundtrack for the walking sequence (W1 leave the wreck | W3 down to the palms | W2 pick fruit | W4 shake a coconut | W5 beach walk) -> assets/video/walk_audio.wav
   Footsteps, rustles and picks are placed from the game's own event log. Shot order and starts (30 fps, 6-frame dissolves): W1 0, W3 94, W2 188, W4 272, W5 366, end 466."""
import numpy as np, os
from scipy import signal
from scipy.io import wavfile

SR = 44100; FPS = 30; FRAMES = 466; DUR = FRAMES / FPS; N = int(SR * DUR) + SR; T = np.arange(N) / SR
rng = np.random.default_rng(41)
L = np.zeros(N); R = np.zeros(N)
START = {'W1': 0, 'W3': 94, 'W2': 188, 'W4': 272, 'W5': 366}
def tf(s, fi): return (START[s] + fi) / FPS
def lp(x, fc, o=2): return signal.sosfilt(signal.butter(o, fc, 'low', fs=SR, output='sos'), x)
def hp(x, fc, o=2): return signal.sosfilt(signal.butter(o, fc, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi, o=2): return signal.sosfilt(signal.butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def nz(n): return rng.standard_normal(n)
def ex(n, tau): return np.exp(-np.arange(n) / SR / tau)
def tv(n): return np.arange(n) / SR
def smooth(x, ms): k = max(1, int(SR * ms / 1000)); return np.convolve(x, np.ones(k) / k, mode='same')
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

# ------------------------------------------------------------------------------------------------ bed: forest day, then the sea in the last shot
beach = np.interp(T, [0, 11.5, 12.8, DUR], [0, 0, 1, 1])
wind = lp(nz(N), 380) * (0.55 + 0.45 * lp(nz(N), 0.3) * 14); wind /= np.abs(wind).max(); put(0, wind * 0.05, 0, 1)
hush = bp(nz(N), 2500, 7000) * (0.4 + 0.6 * lp(nz(N), 0.5) * 18); hush /= np.abs(hush).max(); put(0, hush * 0.016 * (1 - 0.5 * beach), 0, 1)
# surf: slow swells, hiss on the wash
swell = 0.5 + 0.5 * np.sin(T * 2 * np.pi / 7.5 - 1.2); wash = (bp(nz(N), 200, 1200) * 0.8 + hp(nz(N), 2500) * 0.25) * (0.15 + 0.85 * swell ** 2); wash /= np.abs(wash).max(); put(0, wash * 0.06 * beach, 0.2, 1)
def bird(t0, f0, pan):
    n = int(rng.uniform(0.09, 0.24) * SR); tt = tv(n); f = f0 * (1 + 0.5 * np.sin(tt * rng.uniform(25, 60))) * np.linspace(1, rng.uniform(0.7, 1.4), n)
    put(t0, np.sin(np.cumsum(f) / SR * 2 * np.pi) * np.sin(np.linspace(0, np.pi, n)) ** 1.5, pan, rng.uniform(0.012, 0.04))
for k in range(34):
    t0 = rng.uniform(0.1, DUR - 0.5)
    for r_ in range(int(rng.integers(1, 4))): bird(t0 + r_ * rng.uniform(0.14, 0.27), rng.uniform(2300, 5000), rng.uniform(-0.9, 0.9))
for k in range(3):                                                                       # a distant toucan
    t0 = rng.uniform(1, DUR - 3); p = rng.uniform(-0.8, 0.8)
    for q in range(3): n = int(0.16 * SR); tt = tv(n); put(t0 + q * 0.22, signal.square(2 * np.pi * np.cumsum(np.linspace(900, 600, n)) / SR) * 0.3 * np.sin(np.linspace(0, np.pi, n)), p, 0.014)
# insects
ins = bp(nz(N), 5200, 6500) * (0.5 + 0.5 * np.sin(T * 2 * np.pi * 28)); ins /= np.abs(ins).max(); put(0, ins * 0.008 * (1 - beach), 0, 1)

# ------------------------------------------------------------------------------------------------ footsteps: a relaxed walk (about 2.3 steps per second)
def step(t0, pan, surface):
    n = int(0.3 * SR); tt = tv(n)
    body = np.sin(2 * np.pi * rng.uniform(62, 78) * tt * (1 - 0.3 * np.minimum(tt * 8, 1))) * ex(n, 0.05)
    if surface == 'sand':                                                                 # dry sand: soft, grainy crunch
        tex = bp(nz(n), 1200, 5200) * ex(n, 0.06) * 0.8 + hp(nz(n), 4500) * ex(n, 0.025) * 0.25; mix = body * 0.22 + tex * 0.95
    else:                                                                                 # forest floor: grass and leaf litter
        tex = lp(nz(n), rng.uniform(900, 1700)) * ex(n, 0.06) * 0.8 + hp(nz(n), 3500) * ex(n, 0.03) * 0.3; mix = body * 0.35 + tex * 0.85
    put(t0, mix, pan, 0.1 + 0.03 * rng.random())
    if rng.random() < 0.5: m = int(0.04 * SR); put(t0 + 0.02, np.sin(2 * np.pi * rng.uniform(2300, 3400) * tv(m)) * ex(m, 0.012), pan, 0.006)        # gear jingle
STEPS = {'W1': [15, 28, 40, 53, 66, 79, 92], 'W3': [13, 26, 39, 52, 65, 78, 91], 'W2': [24], 'W4': [14], 'W5': [13, 26, 39, 52, 65, 78, 91]}
for s_, fl in STEPS.items():
    for k, fi in enumerate(fl): step(tf(s_, fi), -0.05 + 0.1 * (k % 2), 'sand' if s_ == 'W5' else 'grass')
# brushing past ferns and leaves while walking
for s_, fl in (('W1', [20, 55, 85]), ('W3', [30, 70]), ('W5', [25, 80])):
    for fi in fl: n = int(rng.uniform(0.25, 0.45) * SR); put(tf(s_, fi), bp(nz(n), 1500, 6000) * np.sin(np.linspace(0, np.pi, n)) ** 2, rng.uniform(-0.5, 0.5), 0.03)

# ------------------------------------------------------------------------------------------------ picking fruit (W2) and shaking a coconut down (W4)
def rustle(t0, dur, g, pan=0.0):
    n = int(dur * SR); e = np.sin(np.linspace(0, np.pi, n)) ** 1.5 * (0.6 + 0.4 * lp(nz(n), 25) * 6); put(t0, bp(nz(n), 1500, 6500) * e, pan, g)
rustle(tf('W2', 33) - 0.1, 0.55, 0.08, 0.2); n = int(0.03 * SR); put(tf('W2', 33) + 0.35, bp(nz(n), 1500, 4000) * ex(n, 0.008), 0.2, 0.2)     # leaves shake, the stem snaps
for k_, f in enumerate((660, 990)):
    n = int(0.35 * SR); tt = tv(n); put(tf('W2', 33) + 0.6 + k_ * 0.08, np.sin(2 * np.pi * f * tt) * ex(n, 0.09) * 0.7 + np.sin(2 * np.pi * f * 2 * tt) * ex(n, 0.05) * 0.2, 0, 0.07)       # item collected
t4 = tf('W4', 50)
for q in range(3): rustle(t4 - 0.1 + q * 0.38, 0.6, 0.07, 0.1)                           # the palm shakes
n = int(0.5 * SR); put(t4 + 0.5, sweep(nz(n), 3000, 500, 'low', 256) * np.sin(np.linspace(0, np.pi, n)) ** 2 * 0.12, 0.1, 1)       # fronds
tc = t4 + 1.1                                                                             # the coconut drops: whoosh, heavy dull thud, two small bounces
n = int(0.3 * SR); put(tc - 0.3, sweep(nz(n), 600, 2200, 'low', 256) * np.linspace(0, 1, n) * 0.08, 0.1, 1)
for k_, (dly, amp, f) in enumerate(((0.0, 1.0, 90), (0.22, 0.4, 120), (0.38, 0.18, 150))):
    n = int(0.25 * SR); tt = tv(n); put(tc + dly, (np.sin(2 * np.pi * f * tt * (1 - 0.2 * np.minimum(tt * 10, 1))) * ex(n, 0.05) + 0.5 * lp(nz(n), 900) * ex(n, 0.03)), 0.05, 0.28 * amp)
put(tc + 0.65, np.sin(2 * np.pi * 660 * tv(int(0.3 * SR))) * ex(int(0.3 * SR), 0.09) * 0.5, 0, 0.06); put(tc + 0.73, np.sin(2 * np.pi * 990 * tv(int(0.3 * SR))) * ex(int(0.3 * SR), 0.09) * 0.5, 0, 0.06)

# ------------------------------------------------------------------------------------------------ light score pad
def pad(freqs, g, t0, t1):
    gate = np.interp(T, [t0, t0 + 1.5, t1 - 1.5, t1], [0, 1, 1, 0]); s = 0
    for f in freqs:
        for d_ in (-0.0035, 0, 0.0035): s = s + signal.sawtooth(2 * np.pi * f * (1 + d_) * T + rng.uniform(0, 6)) * 0.12
    put(0, lp(s, 800) * gate * (0.7 + 0.3 * np.sin(T * 0.7)), 0, g)
pad([131, 196, 262, 330], 0.05, 0.0, DUR)

# ------------------------------------------------------------------------------------------------ master
def reverb(x, secs=1.2, mix=0.14):
    n = int(SR * secs); ir = lp(nz(n) * np.exp(-np.arange(n) / (n * 0.3)), 5500); ir /= np.sqrt(np.sum(ir ** 2))
    return x * (1 - mix) + signal.fftconvolve(x, ir)[:N] * mix * 2.0
L = reverb(L); R = reverb(R)
fade = np.interp(T, [0, 0.3, DUR - 1.2, DUR], [0, 1, 1, 0]); L *= fade; R *= fade
rms = np.sqrt(smooth(0.5 * (L ** 2 + R ** 2), 350)) + 1e-6; g = smooth(np.clip((0.065 / rms) ** 0.5, 0.6, 4.0), 250); L *= g; R *= g
L = np.tanh(L * 1.5) / np.tanh(1.5); R = np.tanh(R * 1.5) / np.tanh(1.5)
pk = max(np.abs(L).max(), np.abs(R).max()); L *= 0.85 / pk; R *= 0.85 / pk
n_out = int(DUR * SR); out = np.stack([L[:n_out], R[:n_out]], 1)
wavfile.write(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'walk_audio.wav'), SR, (out * 32767).astype(np.int16))
print('written', out.shape, 'dur', DUR)
