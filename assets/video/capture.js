// Browser-side capture director for the game footage film. Import in the page console:
//   const m = await import('/@fs/<abs path>/assets/video/capture.js?t=' + Date.now()); m.install(window.game, {W: 1920, H: 1080});
//   await film.run(35000, {every: 1})   // repeat until it returns 'done'
// Frames are POSTed to assets/video/frame_server.mjs and land in assets/video/game_frames/<shot>_<index>.jpg(.png)
export function install(g, opt = {}) {
  const V3 = g.camera.position.constructor;
  const F = window.film = { W: opt.W || 1920, H: opt.H || 1080, q: 0.95, n: 0, cur: 0, fi: 0, log: [] };
  const pad = (n, k = 4) => String(n).padStart(k, '0');
  F.setSize = (w, h) => { F.W = w; F.H = h; g.filmResize(w, h); g.ctl.cx = innerWidth / 2; g.ctl.cy = innerHeight / 2; };
  F.setSize(F.W, F.H);
  F.save = async (name) => {
    const c = document.getElementById('c'), url = c.toDataURL('image/jpeg', F.q), blob = await (await fetch(url)).blob();
    const r = await fetch('http://localhost:5190/' + name, { method: 'POST', body: blob }); return r.ok;
  };
  const tick = (down, hit, cam) => g.filmTick(1 / 30, down || [], hit || [], cam || null);
  const ease = (t) => t * t * (3 - 2 * t), clamp = (t) => Math.max(0, Math.min(1, t)), lerp = (a, b, t) => a + (b - a) * t;
  const P = () => g.player, W = () => g.world, crash = () => g.world.crash;
  const gh = (x, z) => W().heightAt(x, z);

  // ------------------------------------------------------------------ cameras
  const cams = F.cams = {
    fov(c, f) { if (Math.abs(c.fov - f) > 0.01) { c.fov = f; c.updateProjectionMatrix(); } },
    at(c, px, py, pz, lx, ly, lz, fov) { c.position.set(px, Math.max(py, gh(px, pz) + 0.3), pz); c.lookAt(lx, ly, lz); if (fov) cams.fov(c, fov); },
    ag(c, px, h, pz, lx, lh, lz, fov) { cams.at(c, px, gh(px, pz) + h, pz, lx, gh(lx, lz) + lh, lz, fov); },      // heights above the terrain
    // relative to the player's facing: back (m behind), side (m to the right), h (m above feet), ahead/lookH = look target in front of the player
    rel(c, back, side, h, ahead = 1.5, lookH = 1.15, fov = 44) {
      const p = P().pos, y = P().yaw, fx = Math.sin(y), fz = Math.cos(y), rx = -Math.cos(y), rz = Math.sin(y);
      cams.at(c, p.x - fx * back + rx * side, p.y + h, p.z - fz * back + rz * side, p.x + fx * ahead, p.y + lookH, p.z + fz * ahead, fov);
    },
  };

  const face = (x, z, tx, tz) => { P().teleport(x, gh(x, z), z); const y = Math.atan2(tx - x, tz - z); P().yaw = y; P().heading = y; };
  const give = (id) => { g.gameplay.give(id); return g.inv.slots.findIndex((s) => s && s.id === id); };
  const settle = (frames, cam) => { for (let i = 0; i < frames; i++) tick([], [], cam); };
  const wakeDone = (cam) => settle(170, cam);       // lets the wake-up animation play out unseen
  const ensureCrash = () => { if (!g.intro.crashed) g.intro.finishCrash(); };
  const beginAt = (time) => { ensureCrash(); g.beginPlay(); g.G.time = time; g.ctl.cx = innerWidth / 2; g.ctl.cy = innerHeight / 2; settle(170, null); g.G.time = time; };
  // pick the azimuth around (tx, tz) whose camera position and sight line stay farthest from tree trunks and rocks
  let _occ = null;
  const clearAngle = (tx, tz, dist, prefer = 0) => {
    if (!_occ) _occ = Object.values(g.world.items).filter((o) => o.kind === 'tree' || o.kind === 'rock' || o.kind === 'palm');
    let best = null;
    for (let k = 0; k < 24; k++) {
      const a = k / 24 * Math.PI * 2, cx = tx + Math.cos(a) * dist, cz = tz + Math.sin(a) * dist, dx = cx - tx, dz = cz - tz, L2 = dx * dx + dz * dz; let m = 99;
      for (const o of _occ) { if (Math.abs(o.x - tx) > dist + 3 || Math.abs(o.z - tz) > dist + 3) continue; let t = ((o.x - tx) * dx + (o.z - tz) * dz) / L2; t = Math.max(0, Math.min(1, t)); const d = Math.hypot(o.x - (tx + dx * t), o.z - (tz + dz * t)); if (d < m) m = d; }
      const score = m - 0.6 * Math.abs(((a - prefer + Math.PI * 3) % (Math.PI * 2)) - Math.PI);       // small bias toward the preferred azimuth
      if (!best || score > best.score) best = { a, score, m };
    }
    return best;
  };

  // ------------------------------------------------------------------ shots
  const fireSpot = () => { const c = crash(); return { x: c.x - 11, z: c.z - 15 }; };
  const S = F.shots = [
    { name: 'A', done: () => g.intro.t >= 17.1, setup() { g.startNew(); }, tick() { tick(); } },

    { name: 'B', frames: 100, setup() {          // the survivor stands in the wreckage, golden hour
        beginAt(17.1); const c = crash(), px = c.x - 3.5, pz = c.z + 5.2; face(px, pz, c.x, c.z); P().yaw += 0.12; P().heading = P().yaw;
        settle(5, (cc) => cams.rel(cc, 3.6, 0.9, 1.5, 6, 1.7)); },
      tick(i) { const t = i / 100; tick([], [], (c) => cams.rel(c, 3.7 - 0.6 * t, 1.0 - 0.4 * t, 1.45 - 0.05 * t, 6.0, 1.75 - 0.1 * t, 44)); } },

    { name: 'C', frames: 110, setup() {          // the supply crate (the starter axe is inside)
        beginAt(17.15); const o = g.world.items[2825]; this.o = o; face(o.x - 1.6, o.z, o.x, o.z); P().char.group.visible = true; this.ca = clearAngle(o.x - 0.6, o.z, 3.8, -Math.PI / 2).a; settle(10, null); },
      tick(i) { const o = this.o, t = i / 110, a = this.ca + lerp(-0.18, 0.18, ease(t)); tick(i >= 6 && i < 100 ? ['KeyE'] : [], i === 6 ? ['KeyE'] : [], (c) => cams.ag(c, o.x - 0.6 + Math.cos(a) * 3.6, lerp(1.2, 1.5, t), o.z + Math.sin(a) * 3.6, o.x - 0.6, 0.85, o.z, 38)); } },

    { name: 'D', frames: 95, setup() {          // a sprint through the jungle: find a clear corridor
        beginAt(17.3); g.gameplay.select(give('stone_axe'));  const c = crash(), trees = Object.values(g.world.items).filter((o) => o.kind === 'tree' || o.kind === 'rock'); let best = null;
        for (let a = 0; a < 40; a++) for (const r of [14, 22, 30]) {
          const ang = a / 40 * Math.PI * 2, sx = c.x + Math.cos(ang) * r, sz = c.z + Math.sin(ang) * r;
          for (const hd of [0, 1, 2, 3, 4, 5].map((k) => k * 1.0472)) {
            const dx = Math.sin(hd), dz = Math.cos(hd), ex = sx + dx * 24, ez = sz + dz * 24; if (gh(sx, sz) < 0.5 || gh(ex, ez) < 0.5) continue;
            let m = 99; for (const o of trees) { const t = Math.max(0, Math.min(24, (o.x - sx) * dx + (o.z - sz) * dz)), d = Math.hypot(o.x - (sx + dx * t), o.z - (sz + dz * t)); if (d < m) m = d; if (m < 2.5) break; }
            let wd = 99; for (let q = 0; q <= 1; q += 0.1) wd = Math.min(wd, Math.hypot(sx + dx * 24 * q - c.x, sz + dz * 24 * q - c.z)); if (wd < 14) continue;      // stay clear of the wreck
            let slope = Math.abs(gh(ex, ez) - gh(sx, sz)); if (m > 2.5 && (!best || m - slope * 0.3 > best.m)) best = { sx, sz, hd, m: m - slope * 0.3 };
          }
        }
        this.b = best; face(best.sx, best.sz, best.sx + Math.sin(best.hd), best.sz + Math.cos(best.hd)); settle(8, (cc) => cams.rel(cc, -3, 2.6, 1.0, 0, 1.0)); },
      tick(i) { const t = i / 95; tick(['KeyW', 'ShiftLeft'], [], (c) => cams.rel(c, lerp(-3.8, -2.6, t), lerp(2.2, 3.4, t), lerp(0.7, 1.2, t), 0.5, 1.0, 46)); } },

    { name: 'E', frames: 112, setup() {          // chopping a tree with the axe, golden hour
        beginAt(17.5); const o = g.world.items[426]; this.o = o; g.gameplay.select(give('stone_axe'));
        face(o.x - 1.25, o.z, o.x, o.z); P().char.group.visible = true; const px = o.x - 1.25;
        const A = clearAngle(px, o.z, 3.4, Math.PI / 2), B = clearAngle(px, o.z, 3.4, -Math.PI / 2); this.ca = (A.score >= B.score ? A : B).a; this.sd = 3.4; settle(10, null); },
      tick(i) { const o = this.o, t = i / 112, a = this.ca + lerp(-0.1, 0.1, t); tick(i >= 6 && i < 106 ? ['KeyE'] : [], i === 6 ? ['KeyE'] : [], (c) => cams.ag(c, o.x - 1.25 + Math.cos(a) * this.sd, 1.5, o.z + Math.sin(a) * this.sd, o.x - 1.0, 1.3, o.z, 40)); } },

    { name: 'F', frames: 120, setup() {          // campfire at night, then a close-up of the torch
        beginAt(19.65); const f = fireSpot(); g.structures.placeCampfire(f.x, f.z, 9999); this.f = f; g.gameplay.select(give('torch')); face(f.x + 1.7, f.z + 0.3, f.x, f.z); P().char.group.visible = true; settle(60, (c) => cams.ag(c, f.x - 3.5, 1.0, f.z - 1, f.x + 1.2, 1.2, f.z + 0.3, 40)); },
      tick(i) { const f = this.f, t = i / 120, a = lerp(-0.45, 0.35, ease(t)), k = ease(clamp((i - 52) / 30));
        tick([], [], (c) => {
          const wide = [f.x - Math.cos(a) * 3.6, gh(f.x, f.z) + lerp(0.85, 1.1, t), f.z - Math.sin(a) * 3.6], look = [f.x + 1.0, gh(f.x, f.z) + 1.15, f.z + 0.3];
          const y = P().yaw, dx = Math.sin(y), dz = Math.cos(y), rx = -dz, rz = dx, p = P().pos, close = [p.x + dx * 1.45 - rx * 0.35, p.y + 1.55, p.z + dz * 1.45 - rz * 0.35], tl = [p.x + dx * 0.3 + rx * 0.3, p.y + 1.45, p.z + dz * 0.3 + rz * 0.3];
          c.position.set(lerp(wide[0], close[0], k), lerp(wide[1], close[1], k), lerp(wide[2], close[2], k)); c.lookAt(lerp(look[0], tl[0], k), lerp(look[1], tl[1], k), lerp(look[2], tl[2], k)); cams.fov(c, lerp(40, 28, k)); }); } },

    { name: 'G', frames: 95, setup() {          // the jaguar watches from the dark
        beginAt(19.9); const f = fireSpot(); this.f = f; if (!g.structures.fires.length) g.structures.placeCampfire(f.x, f.z, 9999);
        const ti = give('torch'); g.gameplay.select(ti); face(f.x + 2.3, f.z + 0.5, f.x + 12, f.z + 6); P().char.group.visible = true;
        const dx = Math.sin(P().yaw), dz = Math.cos(P().yaw), jx = P().pos.x + dx * 7.5, jz = P().pos.z + dz * 7.5; const a = g.animals.spawn('jaguar', jx, jz, Math.atan2(P().pos.x - jx, P().pos.z - jz)); this.a = a; this.j = { x: jx, z: jz }; settle(10, (c) => cams.rel(c, 2.4, 0.9, 1.5, 7.5, 0.7)); },
      tick(i) { const t = i / 95, a = this.a, j = this.j, y = P().yaw, dx = Math.sin(y), dz = Math.cos(y), rx = -dz, rz = dx; tick([], [], (c) => {
          a.x = j.x; a.z = j.z; a.state = 'idle'; a.g.position.set(j.x, gh(j.x, j.z), j.z); a.g.rotation.y = Math.atan2(P().pos.x - j.x, P().pos.z - j.z);      // pinned: it would otherwise flee from the torch
          const fw = lerp(-2.8, -1.8, ease(t)), sd = lerp(2.3, 0.4, ease(t)), h = lerp(0.8, 0.55, t);
          c.position.set(j.x + dx * fw + rx * sd, gh(j.x, j.z) + h, j.z + dz * fw + rz * sd); c.lookAt(j.x, gh(j.x, j.z) + lerp(0.55, 0.62, t), j.z); cams.fov(c, lerp(36, 30, t)); }); } },

    { name: 'H', frames: 140, setup() {          // crane up from the camp
        beginAt(19.9); const f = fireSpot(); this.f = f; if (!g.structures.fires.length) g.structures.placeCampfire(f.x, f.z, 9999); face(f.x + 1.7, f.z + 0.3, f.x, f.z); P().char.group.visible = true; settle(20, (c) => cams.ag(c, f.x - 3, 1.3, f.z - 3, f.x, 1.5, f.z, 44)); },
      tick(i) { const f = this.f, t = ease(i / 140); tick([], [], (c) => cams.ag(c, f.x - lerp(4.5, 20, t), lerp(1.4, 15, t), f.z - lerp(4.5, 22, t), f.x, lerp(1.4, 2.5, t), f.z, lerp(44, 50, t))); } },
  ];

  // ------------------------------------------------------------------ runner (resumable; call repeatedly until it returns 'done')
  F.run = async (budgetMs = 35000, o = {}) => {
    const T0 = performance.now(), every = o.every || 1, only = o.only;
    while (F.cur < S.length) {
      const s = S[F.cur];
      if (only && !only.includes(s.name)) { F.cur++; F.fi = 0; continue; }
      if (F.fi === 0) { s.setup && s.setup(); }
      for (;;) {
        if ((s.frames != null && F.fi >= s.frames) || (s.done && F.fi > 0 && s.done())) break;
        if (performance.now() - T0 > budgetMs) return { cur: S[F.cur].name, fi: F.fi, n: F.n };
        s.tick(F.fi);
        if (every === 1 || F.fi % every === 0) await F.save(s.name + '_' + pad(F.fi) + (o.tag ? '_' + o.tag : ''));
        F.fi++; F.n++;
      }
      F.log.push([s.name, F.fi]); F.cur++; F.fi = 0;
    }
    return 'done';
  };
  F.reset = () => { F.cur = 0; F.fi = 0; F.n = 0; F.log = []; };
  return F;
}
