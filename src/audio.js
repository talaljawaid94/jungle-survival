// Fully synthesised sound: jungle ambience (day / night), water, footsteps, effects. No audio files needed.
const rnd = (a, b) => a + Math.random() * (b - a);

export class AudioEngine {
  constructor() {
    this.ctx = null; this.ready = false; this.muted = false;
    this.nextBird = 2; this.nextCricket = 1; this.nextOwl = 14; this.nextFrog = 3; this.nextBeat = 0; this.nextPop = 0; this.nextMonkey = 25;
    this.heli = null;
  }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : (this.vol ?? 0.85); this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;

    const loopNoise = () => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, Math.random() * 2); return s; };
    // wind
    this.windG = ctx.createGain(); this.windG.gain.value = 0.0;
    const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 480; wf.Q.value = 0.5;
    loopNoise().connect(wf).connect(this.windG).connect(this.master);
    this.windLfo = ctx.createOscillator(); this.windLfo.frequency.value = 0.07; const wl = ctx.createGain(); wl.gain.value = 180; this.windLfo.connect(wl).connect(wf.frequency); this.windLfo.start();
    // waves
    this.waveG = ctx.createGain(); this.waveG.gain.value = 0;
    const wvf = ctx.createBiquadFilter(); wvf.type = 'lowpass'; wvf.frequency.value = 850;
    loopNoise().connect(wvf).connect(this.waveG).connect(this.master);
    this.waveLfo = ctx.createOscillator(); this.waveLfo.frequency.value = 0.12; const wlg = ctx.createGain(); wlg.gain.value = 0.05; this.waveLfo.connect(wlg).connect(this.waveG.gain); this.waveLfo.start();
    // insects (day)
    this.insG = ctx.createGain(); this.insG.gain.value = 0;
    const insf = ctx.createBiquadFilter(); insf.type = 'bandpass'; insf.frequency.value = 5800; insf.Q.value = 9;
    const trem = ctx.createGain(); trem.gain.value = 0.5;
    loopNoise().connect(insf).connect(trem).connect(this.insG).connect(this.master);
    const tl = ctx.createOscillator(); tl.frequency.value = 31; const tlg = ctx.createGain(); tlg.gain.value = 0.5; tl.connect(tlg).connect(trem.gain); tl.start();
    // fire bed
    this.fireG = ctx.createGain(); this.fireG.gain.value = 0;
    const ff = ctx.createBiquadFilter(); ff.type = 'bandpass'; ff.frequency.value = 900; ff.Q.value = 0.4;
    loopNoise().connect(ff).connect(this.fireG).connect(this.master);

    this.ready = true;
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : v, this.ctx.currentTime, 0.05); }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : (this.vol ?? 0.85), this.ctx.currentTime, 0.05); }

  // ---------- primitives
  _pan(v = 0) { const p = this.ctx.createStereoPanner(); p.pan.value = v; p.connect(this.master); return p; }
  noise(dur, freq, type, gain, q = 1, pan = 0, attack = 0.005) {
    const c = this.ctx, t = c.currentTime, s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this._pan(pan)); s.start(t, Math.random() * 2); s.stop(t + dur + 0.05);
  }
  tone(freq, dur, type = 'sine', gain = 0.1, slideTo = null, pan = 0, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this._pan(pan)); o.start(t); o.stop(t + dur + 0.05);
  }

  // ---------- ambience
  chirp(vol) {
    const n = 2 + Math.floor(Math.random() * 4), f0 = rnd(2200, 4400), pan = rnd(-0.85, 0.85), up = Math.random() > 0.4;
    for (let i = 0; i < n; i++) this.tone(f0 * (1 + i * 0.03), 0.09, 'sine', vol, f0 * (up ? 1.5 : 0.7), pan, i * 0.11);
  }
  toucan(vol) { const pan = rnd(-0.8, 0.8); for (let i = 0; i < 3; i++) this.tone(900, 0.16, 'square', vol * 0.25, 600, pan, i * 0.22); }
  cricket(vol) {
    const f = rnd(3900, 4800), pan = rnd(-0.9, 0.9);
    for (let i = 0; i < 4; i++) this.tone(f, 0.035, 'triangle', vol, null, pan, i * 0.075);
  }
  owl(vol) { const pan = rnd(-0.7, 0.7); this.tone(360, 0.45, 'sine', vol, 330, pan, 0); this.tone(300, 0.7, 'sine', vol, 260, pan, 0.6); }
  frog(vol) { const pan = rnd(-0.9, 0.9); for (let i = 0; i < 3; i++) this.tone(140, 0.12, 'sawtooth', vol * 0.5, 95, pan, i * 0.16); }
  monkey(vol) { const pan = rnd(-0.8, 0.8); for (let i = 0; i < 6; i++) this.tone(rnd(700, 1100), 0.09, 'sawtooth', vol * 0.18, 500, pan, i * 0.1); }

  update(dt, c) {
    if (!this.ready) return;
    const t = this.ctx.currentTime, day = c.day, night = c.night, jungle = c.jungle, near = c.water;
    const sm = (p, v, k = 0.6) => p.setTargetAtTime(v, t, k);
    sm(this.windG.gain, 0.025 + 0.03 * (1 - jungle) + 0.02 * c.windy);
    sm(this.waveG.gain, 0.02 + 0.28 * near);
    sm(this.insG.gain, 0.016 * jungle * (day > 0.3 ? 1 : night > 0.5 ? 0.3 : 0.1));
    sm(this.fireG.gain, 0.12 * c.fire, 0.2);

    if ((this.nextBird -= dt) <= 0) {
      if (day > 0.2) { const v = 0.03 + 0.05 * jungle; Math.random() < 0.18 ? this.toucan(v) : this.chirp(v); }
      this.nextBird = rnd(0.5, 3.5) / (0.4 + jungle * 0.8 + day * 0.6);
    }
    if ((this.nextMonkey -= dt) <= 0) { if (day > 0.3 && jungle > 0.4) this.monkey(0.05); this.nextMonkey = rnd(25, 60); }
    if ((this.nextCricket -= dt) <= 0) {
      if (night > 0.25) this.cricket(0.016 + 0.014 * night);
      this.nextCricket = rnd(0.15, 0.7);
    }
    if ((this.nextOwl -= dt) <= 0) { if (night > 0.5) this.owl(0.05); this.nextOwl = rnd(18, 40); }
    if ((this.nextFrog -= dt) <= 0) { if (night > 0.3 && c.lake > 0.1) this.frog(0.07 * c.lake); this.nextFrog = rnd(1.2, 4); }
    if (c.fire > 0.05 && (this.nextPop -= dt) <= 0) { this.noise(0.05, rnd(1500, 4500), 'highpass', 0.12 * c.fire, 0.7, rnd(-0.4, 0.4)); this.nextPop = rnd(0.05, 0.5); }
    if (c.health < 32 && (this.nextBeat -= dt) <= 0) {
      const v = 0.18 * (1 - c.health / 40); this.tone(58, 0.13, 'sine', v, 40); this.tone(50, 0.16, 'sine', v * 0.8, 36, 0, 0.17);
      this.nextBeat = 0.45 + (c.health / 32) * 0.6;
    }
  }

  // ---------- effects
  step(surface) {
    if (!this.ready) return;
    const p = rnd(-0.1, 0.1);
    switch (surface) {
      case 'sand': this.noise(0.12, 2600, 'bandpass', 0.07, 0.7, p); break;
      case 'mud': this.noise(0.14, 420, 'lowpass', 0.16, 1, p); break;
      case 'rock': this.noise(0.05, 2000, 'highpass', 0.1, 1, p); this.tone(180, 0.05, 'triangle', 0.05); break;
      case 'water': this.noise(0.28, 1400, 'bandpass', 0.13, 0.6, p, 0.02); break;
      default: this.noise(0.1, 900, 'lowpass', 0.16, 1, p); this.noise(0.06, 4000, 'highpass', 0.025, 1, p);
    }
  }
  swim() { if (this.ready) this.noise(0.45, 900, 'bandpass', 0.1, 0.5, rnd(-0.2, 0.2), 0.08); }
  pickup() { if (!this.ready) return; this.tone(660, 0.09, 'sine', 0.07); this.tone(990, 0.12, 'sine', 0.06, null, 0, 0.07); }
  rustle() { if (this.ready) { this.noise(0.25, 3200, 'bandpass', 0.07, 0.8); this.noise(0.18, 2500, 'bandpass', 0.05, 0.8, 0, 0.01); } }
  chop() { if (!this.ready) return; this.tone(150, 0.09, 'triangle', 0.18, 90); this.noise(0.08, 1800, 'bandpass', 0.14, 1); }
  eat() { if (!this.ready) return; for (let i = 0; i < 4; i++) setTimeout(() => this.noise(0.07, 1300, 'bandpass', 0.14, 1.2), i * 130); }
  drink() { if (!this.ready) return; for (let i = 0; i < 5; i++) this.tone(rnd(250, 420), 0.1, 'sine', 0.07, rnd(450, 620), 0, i * 0.14); }
  craft() { if (!this.ready) return; for (let i = 0; i < 3; i++) { setTimeout(() => { this.noise(0.08, 900, 'bandpass', 0.15, 1.4); this.tone(210, 0.07, 'triangle', 0.1, 120); }, i * 150); } }
  swing() { if (this.ready) this.noise(0.18, 1400, 'highpass', 0.09, 0.5, 0, 0.06); }
  hit() { if (!this.ready) return; this.noise(0.1, 700, 'lowpass', 0.25, 1); this.tone(110, 0.14, 'sine', 0.2, 60); }
  hurt() { if (!this.ready) return; this.tone(210, 0.2, 'sawtooth', 0.12, 110); this.noise(0.12, 500, 'lowpass', 0.2, 1); }
  growl() {
    if (!this.ready) return; const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(85, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.9);
    f.type = 'lowpass'; f.frequency.value = 380; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.1); g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    const l = c.createOscillator(); l.frequency.value = 26; const lg = c.createGain(); lg.gain.value = 0.1; l.connect(lg).connect(g.gain);
    o.connect(f).connect(g).connect(this._pan(rnd(-0.4, 0.4))); o.start(t); l.start(t); o.stop(t + 1); l.stop(t + 1);
  }
  squeal() { if (this.ready) this.tone(1100, 0.22, 'sawtooth', 0.07, 450); }
  fireStart() { if (this.ready) { this.noise(0.6, 1200, 'bandpass', 0.2, 0.5, 0, 0.1); } }
  sleep() { if (this.ready) { this.tone(196, 1.6, 'sine', 0.05, 220); this.tone(262, 1.6, 'sine', 0.04, 294, 0, 0.3); } }
  click() { if (this.ready) this.tone(520, 0.04, 'square', 0.03); }
  // layered blast: sharp crack, chest-thump boom, rolling fireball roar, debris rain, metal groans, a late echo off the hills and a ringing in the ears
  explosion() {
    if (!this.ready) return; const c = this.ctx, t0 = c.currentTime, m = this.master, vol = this.muted ? 0 : (this.vol ?? 0.85);
    const nz = (start, dur, f0, f1, type, peak, q = 0.7, attack = 0.01, pan = 0) => {
      const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const f = c.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t0 + start); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + start + dur);
      const g = c.createGain(); g.gain.setValueAtTime(0, t0 + start); g.gain.linearRampToValueAtTime(peak, t0 + start + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
      s.connect(f).connect(g).connect(this._pan(pan)); s.start(t0 + start, Math.random() * 2); s.stop(t0 + start + dur + 0.05);
    };
    const tn = (start, dur, f0, f1, type, peak, pan = 0) => {
      const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t0 + start); o.frequency.exponentialRampToValueAtTime(Math.max(18, f1), t0 + start + dur);
      g.gain.setValueAtTime(0, t0 + start); g.gain.linearRampToValueAtTime(peak, t0 + start + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur); o.connect(g).connect(this._pan(pan)); o.start(t0 + start); o.stop(t0 + start + dur + 0.05);
    };
    // duck everything else for a moment, like a real shock
    m.gain.cancelScheduledValues(t0); m.gain.setValueAtTime(vol, t0); m.gain.linearRampToValueAtTime(vol * 0.45, t0 + 0.05); m.gain.setTargetAtTime(vol, t0 + 1.6, 0.9);
    nz(0, 0.18, 9000, 1200, 'highpass', 1.1, 0.5, 0.002);                       // crack
    nz(0, 0.6, 5000, 250, 'lowpass', 1.0, 0.7, 0.004);                          // blast body
    tn(0, 1.8, 78, 20, 'sine', 1.0); tn(0.02, 1.2, 130, 34, 'triangle', 0.45); tn(0, 2.6, 42, 18, 'sine', 0.7);      // boom + sub
    nz(0.1, 3.6, 1800, 80, 'lowpass', 0.5, 0.6, 0.35);                          // fireball roar
    nz(0.5, 2.4, 700, 90, 'bandpass', 0.22, 1.2, 0.5, -0.4); nz(0.7, 2.2, 650, 100, 'bandpass', 0.2, 1.2, 0.5, 0.4);
    for (let i = 0; i < 26; i++) { const st = 0.5 + Math.random() * 3.8, k = 1 - st / 4.6; nz(st, 0.07 + Math.random() * 0.1, 700 + Math.random() * 2600, 200, 'bandpass', 0.16 * k + 0.02, 2.5, 0.003, Math.random() * 2 - 1); }   // debris rain
    for (let i = 0; i < 4; i++) tn(0.7 + i * 0.55 + Math.random() * 0.3, 0.5 + Math.random() * 0.4, 300 + Math.random() * 400, 120 + Math.random() * 80, 'sawtooth', 0.035, Math.random() - 0.5);       // twisting metal
    nz(0.55, 1.6, 1200, 60, 'lowpass', 0.38, 0.7, 0.05); tn(0.5, 1.4, 60, 22, 'sine', 0.4);                    // echo
    tn(0.2, 4.2, 6800, 6500, 'sine', 0.012);                                                                   // ringing
  }
  thump() { if (!this.ready) return; this.tone(62, 0.5, 'sine', 0.5, 28); this.noise(0.5, 380, 'lowpass', 0.35, 1, 0, 0.01); }
  crashScrape() { if (this.ready) { this.noise(1.3, 1800, 'bandpass', 0.35, 0.6, 0, 0.05); this.tone(90, 1.1, 'sawtooth', 0.1, 40); } }

  // ---------- helicopter (intro)
  heliStart() {
    if (!this.ready || this.heli) return;
    const c = this.ctx, t = c.currentTime, out = c.createGain(); out.gain.value = 0; out.connect(this.master);
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520;
    const chop = c.createGain(); chop.gain.value = 0.5; s.connect(f).connect(chop).connect(out); s.start();
    const l = c.createOscillator(); l.type = 'square'; l.frequency.value = 12; const lg = c.createGain(); lg.gain.value = 0.45; l.connect(lg).connect(chop.gain); l.start();
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 52; const of = c.createBiquadFilter(); of.type = 'lowpass'; of.frequency.value = 220; const og = c.createGain(); og.gain.value = 0.6; o.connect(of).connect(og).connect(out); o.start();
    this.heli = { out, l, o, s, f };
    out.gain.setTargetAtTime(0.5, t, 0.8);
  }
  heliSet(level, sputter, pitch = 1) {
    if (!this.heli) return; const t = this.ctx.currentTime;
    const g = sputter ? level * (Math.random() > 0.55 ? 0.15 : 1) : level;
    this.heli.out.gain.setTargetAtTime(g * 0.55, t, 0.04);
    this.heli.l.frequency.setTargetAtTime(12 * pitch, t, 0.2); this.heli.o.frequency.setTargetAtTime(52 * pitch, t, 0.2);
  }
  heliStop() {
    if (!this.heli) return; const t = this.ctx.currentTime, h = this.heli; this.heli = null;
    h.out.gain.setTargetAtTime(0, t, 0.35); setTimeout(() => { try { h.l.stop(); h.o.stop(); h.s.stop(); } catch (e) {} }, 2500);
  }
}
