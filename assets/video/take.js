// Single-take gameplay recording: the real game (menu -> New game -> intro cinematic -> wake up -> play) stepped at 30 fps with the game's own camera,
// the survivor driven by key presses and a "mouse" (yaw). Every frame the WebGL canvas is saved; the real HUD is rasterised every other frame as a transparent PNG.
//   const m = await import('/@fs/<abs>/assets/video/take.js?t=' + Date.now()); const T = m.install(window.game); await T.run(35000);   // repeat until it returns 'done'
import { make } from './hudcap.js';
export function install(g, opt = {}) {
  const W = opt.W || 1920, H = opt.H || 1080, HUD_EVERY = opt.hudEvery || 2;
  const T = window.take = { f: opt.f || 0, phase: opt.phase || 'menu', t0: opt.f || 0, ev: opt.ev || [], log: [], W, H };
  g.filmResize(W, H); g.ctl.cx = innerWidth / 2; g.ctl.cy = innerHeight / 2;
  const cv = document.getElementById('c'), hud = make(W, H, { hudOnly: true }), P = () => g.player, gh = (x, z) => g.world.heightAt(x, z), pad = (n) => String(n).padStart(5, '0');
  const post = async (name, url) => { const b = await (await fetch(url)).blob(); await fetch('http://localhost:5190/' + name, { method: 'POST', body: b }); };
  // sound events the game fires (footsteps, crate, chop, craft...) are logged against the frame they happen on
  for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(g.audio))) {
    if (typeof g.audio[k] !== 'function' || ['constructor', 'init', 'resume', 'setVolume', 'setMuted', 'update', 'noise', 'tone', '_pan', 'crackle'].includes(k)) continue;
    g.audio[k] = (...a) => { T.ev.push([k, T.f, ...a.filter((x) => typeof x === 'number')]); };
  }
  const fall = g.fx.fallTree.bind(g.fx); g.fx.fallTree = (...a) => { T.ev.push(['fallTree', T.f]); return fall(...a); };
  const place = g.structures.placeCampfire.bind(g.structures); g.structures.placeCampfire = (...a) => { T.ev.push(['placeCampfire', T.f]); return place(...a); };
  const css = document.createElement('style'); css.textContent = '#capture{display:none !important}'; document.head.appendChild(css);

  // ------------------------------------------------------------------ helpers for the player "brain"
  const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
  const objs = () => Object.values(g.world.items);
  const dist = (o) => Math.hypot(o.x - P().pos.x, o.z - P().pos.z);
  let stuck = 0, detour = 0, lastPos = null, side = 1;
  // steer toward (x, z) like a player: turn the view, hold W, sidestep when something blocks the way. Returns the distance left.
  const goto = (x, z, stop) => {
    const p = P().pos, dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (lastPos && Math.hypot(p.x - lastPos.x, p.z - lastPos.z) < 0.012 && d > stop + 0.3) stuck++; else stuck = Math.max(0, stuck - 1); lastPos = { x: p.x, z: p.z };
    if (stuck > 12) { detour = 28; side = -side; stuck = 0; }
    let want = Math.atan2(dx, dz); if (detour > 0) { want += side * 1.0; detour--; }
    P().yaw += angDiff(P().yaw, want) * 0.11; P().heading = P().yaw;
    return { d, keys: d > stop ? ['KeyW'] : [] };
  };
  const faceTo = (x, z) => { const p = P().pos, want = Math.atan2(x - p.x, z - p.z); P().yaw += angDiff(P().yaw, want) * 0.2; P().heading = P().yaw; };
  const slotOf = (id) => g.inv.slots.findIndex((s) => s && s.id === id);
  const clear = (a, b, c, d, ignore) => { const L2 = (c - a) ** 2 + (d - b) ** 2; for (const o of objs()) { if (o === ignore || !['tree', 'rock', 'palm'].includes(o.kind)) continue; let t = ((o.x - a) * (c - a) + (o.z - b) * (d - b)) / L2; if (t < 0 || t > 1) continue; if (Math.hypot(o.x - (a + (c - a) * t), o.z - (b + (d - b) * t)) < 1.2) return false; } return true; };
  const pickNear = (kinds, min, max, ignoreFn) => { const p = P().pos; let best = null; for (const o of objs()) { if (!kinds.includes(o.kind) || (ignoreFn && ignoreFn(o))) continue; const d = dist(o); if (d < min || d > max) continue; if (!clear(p.x, p.z, o.x, o.z, o)) continue; if (!best || d < best.d) best = { o, d }; } return best && best.o; };

  // ------------------------------------------------------------------ the script (phase machine); each phase returns {down, hit} for this frame
  const hold = { n: 0 };
  let tgt = null, picks = 0;
  const S = {
    menu() { if (T.f - T.t0 === 75) { g.ui.on.newGame(); T.phase = 'intro'; } return {}; },
    intro() { if (g.G.state === 'play') { T.phase = 'wake'; T.t0 = T.f; } return {}; },
    wake() { if (T.f - T.t0 > 150) { T.phase = 'tocrate'; tgt = pickNear(['crate'], 0, 80, (o) => o.data.opened || o.data.loot !== 'supplies'); T.t0 = T.f; } return {}; },
    tocrate() { if (!tgt) tgt = pickNear(['crate'], 0, 120, (o) => o.data.opened || o.data.loot !== 'supplies'); const r = goto(tgt.x - 0.0, tgt.z, 1.6); if (r.d <= 1.7) { T.phase = 'crate'; hold.n = 0; } return { down: r.keys }; },
    crate() { faceTo(tgt.x, tgt.z); hold.n++; const done = slotOf('stone_axe') >= 0 || hold.n > 260; if (done && hold.n > 60) { if (slotOf('stone_axe') < 0) { tgt = pickNear(['crate'], 0, 120, (o) => o.data.opened); T.phase = 'tocrate'; return {}; } T.phase = 'equip'; T.t0 = T.f; return {}; } return { down: hold.n > 8 ? ['KeyE'] : [], hit: hold.n === 9 ? ['KeyE'] : [] }; },
    equip() { const i = slotOf('stone_axe'); if (T.f - T.t0 === 20 && i >= 0) return { hit: ['Digit' + (i + 1)] }; if (T.f - T.t0 > 60) { T.phase = 'totree'; tgt = pickNear(['tree'], 6, 40, (o) => Math.hypot(o.x - g.world.crash.x, o.z - g.world.crash.z) < 9); T.t0 = T.f; } return {}; },
    totree() { if (!tgt) tgt = pickNear(['tree'], 3, 60); const r = goto(tgt.x, tgt.z, 1.5); if (r.d <= 1.7) { T.phase = 'chop'; hold.n = 0; } return { down: r.keys }; },
    chop() { faceTo(tgt.x, tgt.z); hold.n++; const gone = !g.world.items[tgt.id]; if ((gone && hold.n > 30) || hold.n > 420) { T.phase = 'gather'; picks = 0; tgt = null; hold.n = 0; T.t0 = T.f; return {}; } return { down: hold.n > 6 ? ['KeyE'] : [], hit: hold.n === 7 ? ['KeyE'] : [] }; },
    gather() {
      const needS = Math.max(0, 4 - g.inv.count('stick')), needT = Math.max(0, 3 - g.inv.count('stone'));
      if (!needS && !needT) { T.phase = 'craft'; T.t0 = T.f; return {}; }
      if (!tgt || !g.world.items[tgt.id]) { const kinds = needS ? ['stick'] : ['stone']; tgt = pickNear(kinds, 0, 60) || pickNear(['stick', 'stone'], 0, 80); if (!tgt) { T.phase = 'craft'; T.t0 = T.f; return {}; } hold.n = 0; }
      const r = goto(tgt.x, tgt.z, 1.25); if (r.d > 1.35) return { down: r.keys };
      faceTo(tgt.x, tgt.z); hold.n++; if (hold.n > 90) tgt = null; return { down: hold.n > 5 ? ['KeyE'] : [], hit: hold.n === 6 ? ['KeyE'] : [] };
    },
    craft() { const t = T.f - T.t0; if (t === 15) return { hit: ['KeyC'] }; if (t === 95) { const r = g.ui.recipes().find((q) => q.id === 'campfire'); for (const [id, n] of Object.entries(r.needs)) { const have = g.inv.count(id); if (have < n) g.gameplay.give(id, n - have); } g.ui.on.craft(r); } if (t === 150) return { hit: ['KeyC'] }; if (t > 175) { T.phase = 'fire'; T.t0 = T.f; } return {}; },
    fire() { const t = T.f - T.t0; if (t > 150) T.phase = 'done'; return {}; },
    done() { return {}; },
  };
  T.stepOne = async () => {
    g.G.paused = false; try { g.ui.showPause(false); } catch (e) { }
    const a = (S[T.phase] || S.done)() || {};
    g.filmTick(1 / 30, a.down || [], a.hit || [], null);
    const f = T.f; const url = cv.toDataURL('image/jpeg', 0.93);                            // right after the render, while the WebGL buffer is still valid
    await post('T_' + pad(f), url);
    if (f % HUD_EVERY === 0) await post('H_' + pad(f), await hud());
    T.f++;
  };
  T.run = async (budgetMs = 35000) => { const t0 = performance.now(); while (T.phase !== 'done' || T.f - T.t0 < 0) { if (performance.now() - t0 > budgetMs) return { f: T.f, phase: T.phase }; await T.stepOne(); } return 'done'; };
  return T;
}
