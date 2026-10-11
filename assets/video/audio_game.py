"""Procedural soundtrack for the in-game launch film (45.1 s) -> assets/video/game_audio.wav.  Timeline from post_game.py:
   A intro 0-20.5 (engine fails 5.2, impact 13.8) | B wreck 20.5 | C crate 23.7 | D run 27.1 | E chop 30.1 | F fire 33.6 | G jaguar 37.4 | H title 40.4 (logo ~41.3)"""
import numpy as np, os
from scipy import signal
from scipy.io import wavfile

SR = 44100; DUR = 45.1; N = int(SR * DUR); T = np.arange(N) / SR
rng = np.random.default_rng(11)
L = np.zeros(N); R = np.zeros(N)

def lp(x, fc, o=2): return signal.sosfilt(signal.butter(o, fc, 'low', fs=SR, output='sos'), x)
def hp(x, fc, o=2): return signal.sosfilt(signal.butter(o, fc, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi, o=2): return signal.sosfilt(signal.butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def noise(n=N): return rng.standard_normal(n)
def env(pts): return np.interp(T, [p[0] for p in pts], [p[1] for p in pts])
def smooth(x, ms=8): k = max(1, int(SR * ms / 1000)); return np.convolve(x, np.ones(k) / k, mode='same')
def add(sig, pan=0.0, gain=1.0):
    p = np.asarray(pan); global L, R; L += sig * gain * np.sqrt(0.5 * (1 - p)); R += sig * gain * np.sqrt(0.5 * (1 + p))
def burst(t0, sig, pan=0.0, gain=1.0):
    i = int(t0 * SR); j = min(N, i + len(sig))
    if i < N: add_slice(i, j, sig[:j - i], pan, gain)
def add_slice(i, j, sig, pan, gain):
    global L, R; L[i:j] += sig * gain * np.sqrt(0.5 * (1 - pan)); R[i:j] += sig * gain * np.sqrt(0.5 * (1 + pan))

# ------------------------------------------------------------------------------------------------ helicopter (0 - 13.8)
def rotor_pulses(rate, depth=1.0, t0=0.0, t1=DUR, jitter=0.0):
    ph = np.cumsum(rate) / SR; out = np.zeros(N)
    for i in np.where(np.diff(np.floor(ph)) > 0)[0]:
        if T[i] < t0 or T[i] > t1: continue
        Ln = int(0.09 * SR); tt = np.arange(Ln) / SR; j = 1.0 + jitter * rng.standard_normal()
        b = np.sin(2 * np.pi * (62 + 18 * j) * tt) * np.exp(-tt * 38) + 0.55 * np.sin(2 * np.pi * 118 * tt) * np.exp(-tt * 55) + 0.35 * noise(Ln) * np.exp(-tt * 70)
        e = min(N, i + Ln); out[i:e] += b[:e - i] * depth
    return out
gate = env([(0, 0.0), (0.6, 1.0), (13.7, 1.0), (13.8, 0.0)])
appr = env([(0, 0.35), (2.6, 1.0), (4.6, 0.6), (8.4, 0.7), (13.6, 1.0)])
rate = np.interp(T, [0, 5.2, 8.0, 13.7], [11.0, 11.0, 9.0, 6.5]) + 0.25 * np.sin(2 * np.pi * 0.7 * T)
thump = lp(rotor_pulses(rate, 1.0, 0.0, 13.8, 0.06), 420) * gate * appr
tf = np.interp(T, [0, 5.2, 5.7, 7.0, 10.0, 13.7], [2300, 2300, 2050, 1500, 800, 220]) * (1 + 0.012 * np.sin(2 * np.pi * 6.0 * T))
tp = np.cumsum(tf) / SR * 2 * np.pi
turb = (0.8 * np.sin(tp) + 0.35 * np.sin(2.01 * tp)) * env([(0, 0.05), (2.6, 0.12), (5.0, 0.1), (11.0, 0.05), (13.7, 0.0)])
air = lp(noise(), 900) * env([(0, 0.25), (2.6, 0.4), (8, 0.5), (13.7, 0.9), (13.8, 0.0)])
pan_fly = np.clip(np.interp(T, [0, 1.4, 2.6, 4.0, 6.0], [-0.55, -0.3, 0.0, 0.5, 0.2]), -1, 1)
add(thump * 0.9, pan_fly); add(turb, pan_fly, 0.5); add(air * 0.16, 0.0)
for tc, d_, a in ((5.3, 0.35, 1.0), (5.9, 0.28, 0.8), (6.4, 0.4, 0.9), (6.9, 0.22, 0.6), (7.4, 0.5, 0.7)):
    e = np.clip(1 - np.abs(T - (tc + d_ / 2)) / (d_ / 2), 0, 1) ** 1.5
    add(bp(noise(), 90, 900) * e * a * 0.9, 0.0); add(lp(noise(), 200) * e * a * 1.2, 0.0)
alarm = ((T > 5.6) & (T < 13.7)); beep = (np.sin(2 * np.pi * 1180 * T) + 0.4 * np.sin(2 * np.pi * 2360 * T)) * (((T * 2.4) % 1.0) < 0.38) * alarm
add(smooth(beep, 1.5) * 0.045, 0.1)
ti = 13.8; dt = np.clip(T - ti, 0, None); on = T >= ti
boom = np.sin(2 * np.pi * (48 - 14 * np.clip(dt / 1.2, 0, 1)) * dt) * np.exp(-dt * 1.9) * on
crunch = (hp(noise(), 300) * np.exp(-dt * 6) + bp(noise(), 600, 3500) * np.exp(-dt * 11)) * on
debris = bp(noise(), 1500, 6000) * np.exp(-dt * 2.4) * on * (rng.random(N) < 0.012) * 4.0
add(boom * 1.7, 0.0); add(crunch * 0.9, 0.0); add(smooth(debris, 3) * 0.6, np.sin(T * 17) * 0.6)
ring = np.sin(2 * np.pi * 3150 * T) * np.exp(-dt * 1.4) * on * 0.03; add(ring, -0.2); add(ring * 0.9, 0.0)

# ------------------------------------------------------------------------------------------------ ambience and fire (14 - 45)
roar_g = env([(13.8, 0.0), (14.4, 1.0), (23, 0.8), (33.0, 0.3), (34.0, 1.0), (41.0, 0.8), (45.1, 0.2)])
roar = lp(noise(), 380) * (0.6 + 0.4 * lp(noise(), 6) * 6) * 0.5
crack = np.zeros(N)
for i in np.where(rng.random(N) < 38.0 / SR)[0]:
    Ln = int(rng.uniform(0.002, 0.012) * SR)
    if i + Ln < N: crack[i:i + Ln] += noise(Ln) * np.exp(-np.arange(Ln) / (Ln * 0.25)) * rng.uniform(0.3, 1.3)
crack = hp(crack, 1200)
add(roar * roar_g * 0.2, 0.2 * np.sin(2 * np.pi * 0.07 * T)); add(crack * roar_g * 0.45, 0.2 * np.sin(2 * np.pi * 0.07 * T))
wind = lp(noise(), 500) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.09 * T)) * env([(18, 0.0), (21, 1.0), (33, 1.0), (34.5, 0.2), (45, 0.1)])
add(wind * 0.1, 0.0)
def chirp(t0, f0=3200, f1=2200, dur=0.18, pan=0.0, g=0.05):
    tt = np.arange(int(dur * SR)) / SR; f = np.linspace(f0, f1, len(tt)); s = np.sin(np.cumsum(f) / SR * 2 * np.pi) * np.sin(np.pi * tt / dur) ** 2
    burst(t0, s, pan, g)
for tb in (21.2, 21.45, 21.7, 22.6, 22.8, 24.4, 24.6, 25.8, 26.3, 26.5, 28.3, 28.5, 28.9, 31.2, 31.4):          # a few daytime birds
    chirp(tb, rng.uniform(2800, 4200), rng.uniform(1800, 3200), rng.uniform(0.1, 0.25), rng.uniform(-0.8, 0.8))

# ------------------------------------------------------------------------------------------------ crate (24.2 - 25.9), footsteps, axe
def creak(t0, dur, f0, f1, g):
    tt = np.arange(int(dur * SR)) / SR; f = np.linspace(f0, f1, len(tt)); ph = np.cumsum(f * (1 + 0.05 * np.sin(2 * np.pi * 14 * tt))) / SR * 2 * np.pi
    s = bp(np.sign(np.sin(ph)) * 0.5 + 0.5 * np.sin(ph), 150, 1600) * np.sin(np.pi * tt / dur) ** 1.3; burst(t0, s, 0.1, g)
creak(24.35, 1.0, 190, 330, 0.09); creak(25.0, 0.8, 260, 150, 0.07)
def thud(t0, f=95, dur=0.18, g=0.5, pan=0.0, snap=0.6):
    tt = np.arange(int(dur * SR)) / SR; s = np.sin(2 * np.pi * f * tt) * np.exp(-tt * 28) + snap * lp(noise(len(tt)), 900) * np.exp(-tt * 45) + 0.3 * hp(noise(len(tt)), 2500) * np.exp(-tt * 90); burst(t0, s, pan, g)
thud(25.95, 140, 0.12, 0.35); thud(26.05, 600, 0.05, 0.15, 0.2, 0.2)
step_t = 27.35; k = 0
while step_t < 30.1:
    thud(step_t, 70 + rng.uniform(-8, 8), 0.14, 0.38, 0.35 if k % 2 else -0.35, 0.9); burst(step_t + 0.02, hp(noise(int(0.12 * SR)), 1800) * np.exp(-np.arange(int(0.12 * SR)) / (0.03 * SR)), 0.0, 0.05); step_t += 0.285; k += 1
for tc, g_ in ((31.35, 1.0), (32.15, 1.0), (32.95, 1.0)):                                  # axe into trunk
    thud(tc, 150, 0.22, 0.55 * g_, 0.0, 1.0); burst(tc, bp(noise(int(0.25 * SR)), 300, 2200) * np.exp(-np.arange(int(0.25 * SR)) / (0.06 * SR)), 0.0, 0.25)
for tc in (31.1, 31.9, 32.7): burst(tc, lp(noise(int(0.3 * SR)), 700) * np.sin(np.pi * np.arange(int(0.3 * SR)) / (0.3 * SR)), 0.0, 0.05)      # swing whoosh

# ------------------------------------------------------------------------------------------------ night (33.2 - 40.5): crickets, torch, jaguar
ins_g = env([(32.8, 0.0), (34.0, 1.0), (40.0, 1.0), (42, 0.0)])
ins = np.zeros(N)
for kk in range(6):
    f = rng.uniform(4300, 5600); trill = rng.uniform(22, 38); drift = rng.uniform(0, 6.28)
    b = np.clip(np.sin(2 * np.pi * rng.uniform(0.3, 0.6) * T + drift), 0, None) ** 0.6
    ins += np.sin(2 * np.pi * f * T) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * trill * T))) * b
add(lp(hp(ins, 3500), 7000) * ins_g * 0.035, 0.0)
add(lp(hp(ins * np.roll(np.sin(2 * np.pi * 0.37 * T), 20000), 3500), 7000) * ins_g * 0.02, -0.7)
torch = lp(noise(), 2400) * (0.5 + 0.5 * lp(noise(), 14) * 5) * env([(37.3, 0.0), (37.8, 1.0), (40.4, 0.8), (41.0, 0.0)])
add(bp(torch, 200, 2200) * 0.05, -0.2)
tg = 38.4; d = T - tg; g = ((d > 0) & (d < 2.4)) * (np.sin(np.pi * np.clip(d / 2.4, 0, 1)) ** 1.2)
fg = np.interp(d, [0, 0.4, 1.3, 2.4], [60, 95, 80, 52]); saw = signal.sawtooth(np.cumsum(fg) / SR * 2 * np.pi) * 0.7
growl = lp(saw * (0.55 + 0.45 * np.sin(2 * np.pi * 27 * T)) + 0.5 * bp(noise(), 120, 700), 650) * g
add(growl * 0.6, 0.3); add(bp(noise(), 700, 2400) * g * 0.04, 0.3)
drone = np.sin(2 * np.pi * 55 * T) * env([(36.5, 0.0), (39.5, 0.5), (41.0, 0.0)]); add(drone * 0.05, 0.0)

# ------------------------------------------------------------------------------------------------ score: pad, riser, title hit
def pad(freqs, gate_, det=0.003):
    out = np.zeros(N)
    for f in freqs:
        for dd in (-det, 0.0, det): out += np.sin(2 * np.pi * f * (1 + dd) * T + rng.uniform(0, 6.28)) + 0.3 * np.sin(4 * np.pi * f * (1 + dd) * T)
    return lp(out, 1400) * gate_
add(pad([55.0, 82.4, 110.0], env([(19, 0.0), (24, 0.35), (36, 0.6), (41.4, 1.0), (43.5, 0.7), (45.1, 0.0)]), 0.002) * 0.05, -0.2)
add(pad([220.0, 261.6, 329.6], env([(34, 0.0), (39.5, 0.4), (41.4, 1.0), (44.0, 0.5), (45.1, 0.0)]), 0.004) * 0.018, 0.2)
tr = 41.3; d_ = np.clip(T - tr, 0, None); on_ = T >= tr
riser = bp(noise(), 400, 9000) * (np.clip((T - 39.0) / (tr - 39.0), 0, 1) ** 2.2) * (T < tr); add(riser * 0.18, np.sin(T * 3) * 0.5)
hit = np.sin(2 * np.pi * (38 + 22 * np.exp(-d_ * 5)) * d_) * np.exp(-d_ * 1.3) * on_; shim = hp(noise(), 3000) * np.exp(-d_ * 2.0) * on_
add(hit * 1.3, 0.0); add(shim * 0.12, 0.0)

# ------------------------------------------------------------------------------------------------ master
def reverb(x, secs=1.6, mix=0.2):
    n = int(SR * secs); ir = lp(noise(n) * np.exp(-np.arange(n) / (n * 0.28)), 5000); ir /= np.sqrt(np.sum(ir ** 2))
    return x * (1 - mix) + signal.fftconvolve(x, ir)[:N] * mix * 2.2
L = reverb(L); R = reverb(R)
fade = env([(0, 0.0), (0.7, 1.0), (43.6, 1.0), (45.1, 0.0)]); L *= fade; R *= fade
rms = np.sqrt(smooth(0.5 * (L ** 2 + R ** 2), 400)) + 1e-6; g = smooth(np.clip((0.075 / rms) ** 0.55, 0.6, 5.0), 250); L *= g; R *= g
L = np.tanh(L * 1.6) / np.tanh(1.6); R = np.tanh(R * 1.6) / np.tanh(1.6)
pk = max(np.abs(L).max(), np.abs(R).max()); L *= 0.89 / pk; R *= 0.89 / pk
out = np.stack([L, R], axis=1); wavfile.write(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'game_audio.wav'), SR, (out * 32767).astype(np.int16))
print('audio written', out.shape)
