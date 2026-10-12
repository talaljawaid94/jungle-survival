// Dev helper for posing the survivor in the browser: const m = await import('/@fs/<abs>/assets/video/dbg.js?t=' + Date.now()); m.setup();
export function setup(time = 11) {
  const g = window.game; g.startNew(); if (!g.intro.crashed) g.intro.finishCrash(); g.beginPlay();
  const tick = (n, cam, down = [], hit = []) => { for (let i = 0; i < n; i++) g.filmTick(1 / 30, down, hit, cam || null); };
  const gh = (x, z) => g.world.heightAt(x, z), c = g.world.crash, x = c.x - 11, z = c.z - 15;
  g.G.time = time; tick(170); g.G.time = time;
  g.player.teleport(x, gh(x, z), z); g.player.yaw = 0.6; g.player.heading = 0.6;
  for (const id of ['torch', 'stone_axe']) g.gameplay.give(id);
  const D = window.D = { g, tick, gh };
  D.sel = (id) => g.gameplay.select(g.inv.slots.findIndex((s) => s && s.id === id));
  // camera relative to the player: side (+ = his right), fwd (+ = in front), height, look-at height
  D.cam = (side, fwd, h, look = 1.1, fov = 34, lside = 0.2) => { const p = g.player.pos, y = g.player.heading, fx = Math.sin(y), fz = Math.cos(y), rx = -fz, rz = fx; return (cm) => { cm.position.set(p.x + rx * side + fx * fwd, p.y + h, p.z + rz * side + fz * fwd); cm.lookAt(p.x + rx * lside + fx * 0.15, p.y + look, p.z + rz * lside + fz * 0.15); cm.fov = fov; cm.updateProjectionMatrix(); }; };
  D.shot = (n, cm) => { tick(n, cm); tick(2, cm); };
  [...document.body.children].forEach((e) => { if (e.tagName !== 'CANVAS' && e.id !== 'c') e.style.display = 'none'; });
  g.player.char.group.visible = true; D.sel('torch'); D.shot(60, D.cam(1.6, 1.2, 1.3));
  return 'ready';
}
