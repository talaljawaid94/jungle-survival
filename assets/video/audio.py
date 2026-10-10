"""Procedural soundtrack for the Jungle Survival launch film (30 s, stereo 44.1 kHz) -> assets/video/film_audio.wav.
Every sound is synthesised: rotor thump, turbine whine, engine sputter + alarm, crash, fire, night insects, jaguar growl, pad, title hit."""
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100; DUR = 30.0; N = int(SR * DUR); T = np.arange(N) / SR
rng = np.random.default_rng(7)
L = np.zeros(N, dtype=np.float64); R = np.zeros(N, dtype=np.float64)


def lp(x, fc, order=2): return signal.sosfilt(signal.butter(order, fc, 'low', fs=SR, output='sos'), x)
def hp(x, fc, order=2): return signal.sosfilt(signal.butter(order, fc, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi, order=2): return signal.sosfilt(signal.butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)
def noise(n=N): return rng.standard_normal(n)
def env(points, n=N):
    """piecewise-linear envelope from [(t, v), ...] seconds"""
    ts = [p[0] for p in points]; vs = [p[1] for p in points]; return np.interp(T[:n], ts, vs)
def smooth(x, ms=8):
    k = max(1, int(SR * ms / 1000)); return np.convolve(x, np.ones(k) / k, mode='same')
def add(sig, pan=0.0, gain=1.0):
    """pan: scalar or per-sample array in [-1, 1]"""
    global L, R
    p = np.asarray(pan); l = np.sqrt(0.5 * (1 - p)); r = np.sqrt(0.5 * (1 + p)); L += sig * gain * l; R += sig * gain * r


# ------------------------------------------------------------------------------------------------ helicopter (0 - 13.7 s)
def rotor_pulses(rate_hz, depth=1.0, t0=0.0, t1=DUR, jitter=0.0):
    """blade-slap train: a short band-limited thump at each blade pass; rate_hz may be an array (varying rpm)"""
    rate = np.broadcast_to(np.asarray(rate_hz, dtype=np.float64), (N,)).copy()
    phase = np.cumsum(rate) / SR; out = np.zeros(N)
    idx = np.where(np.diff(np.floor(phase)) > 0)[0]
    for i in idx:
        t = T[i]
        if t < t0 or t > t1: continue
        L_ = int(0.09 * SR); tt = np.arange(L_) / SR; j = 1.0 + jitter * rng.standard_normal()
        burst = np.sin(2 * np.pi * (62 + 18 * j) * tt) * np.exp(-tt * 38) + 0.55 * np.sin(2 * np.pi * 118 * tt) * np.exp(-tt * 55) + 0.35 * noise(L_) * np.exp(-tt * 70)
        end = min(N, i + L_); out[i:end] += burst[:end - i] * depth
    return out


heli_gate = env([(0, 0.0), (0.6, 1.0), (13.7, 1.0), (13.75, 0.0)])
approach = env([(0, 0.35), (3.1, 1.0), (6.0, 0.55), (10.0, 0.7), (13.6, 1.0)])             # fly-by swell, then the close chase
rate = np.interp(T, [0, 8.0, 10.0, 13.7], [11.0, 11.0, 9.0, 6.5]) + 0.25 * np.sin(2 * np.pi * 0.7 * T)
thump = lp(rotor_pulses(rate, 1.0, 0.0, 13.75, 0.06), 420) * heli_gate * approach
turb_f = np.interp(T, [0, 7.9, 8.4, 9.5, 11.5, 13.7], [2300, 2300, 2050, 1500, 800, 220]) * (1 + 0.012 * np.sin(2 * np.pi * 6.0 * T))
turb_ph = np.cumsum(turb_f) / SR * 2 * np.pi
turb = (0.8 * np.sin(turb_ph) + 0.35 * np.sin(2.01 * turb_ph)) * env([(0, 0.05), (3.1, 0.12), (7.8, 0.1), (13.0, 0.05), (13.7, 0.0)])
air = lp(noise(), 900) * env([(0, 0.25), (3.1, 0.4), (10, 0.5), (13.7, 0.9), (13.75, 0.0)])                      # rotor wash / wind
sea = lp(noise(), 600) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.11 * T + 1.0)) * env([(0, 0.5), (6, 0.45), (9.5, 0.08), (10.0, 0.0)])
pan_fly = np.clip(np.interp(T, [0, 1.8, 3.1, 4.4, 6.0], [-0.55, -0.4, 0.0, 0.5, 0.35]), -1, 1)
add(thump * 0.9, pan_fly); add(turb, pan_fly, 0.5); add(air * 0.16, 0.0); add(sea * 0.2, 0.0)
# engine failure: coughs, a bad start-up whine, alarm
for tc, dur_, amp in ((8.25, 0.35, 1.0), (8.85, 0.28, 0.8), (9.30, 0.4, 0.9), (9.75, 0.22, 0.6), (10.15, 0.5, 0.7)):
    e = np.clip(1 - np.abs(T - (tc + dur_ / 2)) / (dur_ / 2), 0, 1) ** 1.5
    add(bp(noise(), 90, 900) * e * amp * 0.9, 0.0); add(lp(noise(), 200) * e * amp * 1.2, 0.0)
alarm_on = ((T > 9.0) & (T < 13.7)); beep = (np.sin(2 * np.pi * 1180 * T) + 0.4 * np.sin(2 * np.pi * 2360 * T)) * (((T * 2.4) % 1.0) < 0.38) * alarm_on
add(smooth(beep, 1.5) * 0.045, 0.1)
# impact (13.75 s): sub boom, tearing metal, debris, then a ringing silence
ti = 13.75; dt = np.clip(T - ti, 0, None); on = (T >= ti)
boom = (np.sin(2 * np.pi * (48 - 14 * np.clip(dt / 1.2, 0, 1)) * dt) * np.exp(-dt * 2.4)) * on
crunch = (hp(noise(), 300) * np.exp(-dt * 7) + bp(noise(), 600, 3500) * np.exp(-dt * 14)) * on
debris = bp(noise(), 1500, 6000) * np.exp(-dt * 3.2) * on * (rng.random(N) < 0.012) * 4.0
add(boom * 1.6, 0.0); add(crunch * 0.9, 0.0); add(smooth(debris, 3) * 0.6, np.sin(T * 17) * 0.6)
ring = np.sin(2 * np.pi * 3150 * T) * np.exp(-dt * 1.6) * on * 0.03; add(ring, -0.2); add(ring * 0.9, 0.0)


# ------------------------------------------------------------------------------------------------ fire (13.8 - 30 s)
fire_gate = env([(13.7, 0.0), (13.85, 1.0), (27.5, 1.0), (29.2, 0.5), (30, 0.0)])
roar = lp(noise(), 380) * (0.6 + 0.4 * lp(noise(), 6) * 6) * 0.5
crackle = np.zeros(N)
for i in np.where(rng.random(N) < 40.0 / SR)[0]:
    L_ = int(rng.uniform(0.002, 0.012) * SR)
    if i + L_ < N: crackle[i:i + L_] += noise(L_) * np.exp(-np.arange(L_) / (L_ * 0.25)) * rng.uniform(0.3, 1.3)
crackle = hp(crackle, 1200)
pan_fire = 0.3 * np.sin(2 * np.pi * 0.07 * T)
add(roar * fire_gate * 0.22, pan_fire); add(crackle * fire_gate * 0.5, pan_fire)
for tc, f0_, f1_, a in ((15.4, 330, 210, 0.07), (17.9, 280, 170, 0.06), (19.3, 380, 250, 0.05)):        # metal creaks
    d = T - tc; g = ((d > 0) & (d < 1.4)) * np.sin(np.pi * np.clip(d / 1.4, 0, 1)) ** 1.5
    ph = np.cumsum(np.interp(d, [0, 1.4], [f0_, f1_]) * (1 + 0.04 * np.sin(2 * np.pi * 9 * T))) / SR * 2 * np.pi
    add(bp(np.sign(np.sin(ph)) * 0.5 + 0.5 * np.sin(ph), 180, 1400) * g * a, 0.35)


# ------------------------------------------------------------------------------------------------ night insects (19.5 - 26 s) + jaguar
ins_gate = env([(19.0, 0.0), (21.0, 1.0), (25.2, 1.0), (27.4, 0.0)])
ins = np.zeros(N)
for k in range(6):
    f = rng.uniform(4300, 5600); trill = rng.uniform(22, 38); drift = rng.uniform(0, 6.28)
    burst = np.clip(np.sin(2 * np.pi * rng.uniform(0.3, 0.6) * T + drift), 0, None) ** 0.6
    ins += np.sin(2 * np.pi * f * T) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * trill * T))) * burst
add(lp(hp(ins, 3500), 7000) * ins_gate * 0.035, 0.0)
for k in range(2):
    pan_c = rng.uniform(-0.9, 0.9); add(lp(hp(ins * np.roll(np.sin(2 * np.pi * 0.37 * T), k * 20000), 3500), 7000) * ins_gate * 0.02, pan_c)
tg = 22.4; d = T - tg; g = ((d > 0) & (d < 2.5)) * (np.sin(np.pi * np.clip(d / 2.5, 0, 1)) ** 1.2)
f_g = np.interp(d, [0, 0.4, 1.4, 2.5], [60, 95, 80, 52])
saw = signal.sawtooth(np.cumsum(f_g) / SR * 2 * np.pi) * 0.7
growl = lp(saw * (0.55 + 0.45 * np.sin(2 * np.pi * 27 * T)) + 0.5 * bp(noise(), 120, 700), 650) * g
add(growl * 0.55, 0.18); add(bp(noise(), 700, 2400) * g * 0.04, 0.18)


# ------------------------------------------------------------------------------------------------ score: pad, riser, title hit
def pad(freqs, gate, detune=0.003):
    out = np.zeros(N)
    for f in freqs:
        for dd in (-detune, 0.0, detune):
            out += np.sin(2 * np.pi * f * (1 + dd) * T + rng.uniform(0, 6.28)) + 0.3 * np.sin(2 * np.pi * 2 * f * (1 + dd) * T)
    return lp(out, 1400) * gate
pad_gate = env([(14.0, 0.0), (19.0, 0.25), (24.0, 0.45), (27.1, 1.0), (28.6, 0.7), (30.0, 0.0)])
add(pad([55.0, 82.4, 110.0], pad_gate, 0.002) * 0.05, -0.2); add(pad([220.0, 261.6, 329.6], env([(22.0, 0.0), (25.0, 0.35), (27.1, 1.0), (29.0, 0.5), (30, 0.0)]), 0.004) * 0.018, 0.2)
tr = 27.1; d_ = np.clip(T - tr, 0, None); on_ = (T >= tr)
riser = bp(noise(), 400, 9000) * (np.clip((T - 24.6) / (tr - 24.6), 0, 1) ** 2.2) * (T < tr)
add(riser * 0.18, np.sin(T * 3) * 0.5)
hit = np.sin(2 * np.pi * (38 + 22 * np.exp(-d_ * 5)) * d_) * np.exp(-d_ * 1.3) * on_
shimmer = hp(noise(), 3000) * np.exp(-d_ * 2.0) * on_
add(hit * 1.3, 0.0); add(shimmer * 0.12, 0.0)

# ------------------------------------------------------------------------------------------------ master: reverb, fades, normalise
def reverb(x, secs=1.6, mix=0.22):
    n = int(SR * secs); ir = noise(n) * np.exp(-np.arange(n) / (n * 0.28)); ir = lp(ir, 5000)
    ir /= np.sqrt(np.sum(ir ** 2)); wet = signal.fftconvolve(x, ir)[:N]; return x * (1 - mix) + wet * mix * 2.2
L = reverb(L); R = reverb(R)
fade = env([(0, 0.0), (0.8, 1.0), (29.0, 1.0), (30.0, 0.0)]); L *= fade; R *= fade
# gentle dynamic compression (lifts the quiet fire / night sections), then a soft limiter
rms = np.sqrt(smooth(0.5 * (L ** 2 + R ** 2), 400)) + 1e-6; target = 0.075
g = np.clip((target / rms) ** 0.55, 0.6, 5.0); g = smooth(g, 250); L *= g; R *= g
L = np.tanh(L * 1.6) / np.tanh(1.6); R = np.tanh(R * 1.6) / np.tanh(1.6)
peak = max(np.abs(L).max(), np.abs(R).max()); L *= 0.89 / peak; R *= 0.89 / peak
out = np.stack([L, R], axis=1); wavfile.write(__file__.replace('audio.py', 'film_audio.wav'), SR, (out * 32767).astype(np.int16))
print('audio written', out.shape, 'peak', peak)
