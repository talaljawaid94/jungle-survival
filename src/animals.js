import * as THREE from 'three';
import { mulberry32 } from './noise.js';
import { buildAnimal } from './animalModels.js';

const SPECIES = {
  rabbit: { name: 'Rabbit', hp: 10, walk: 0.7, run: 7.5, size: 0.38, color: 0x8b7560, meat: 1, flee: 12, count: 14 },
  deer:   { name: 'Deer',   hp: 55, walk: 1.0, run: 10,  size: 1.0,  color: 0xa6764a, meat: 3, flee: 22, count: 12, antlers: true },
  boar:   { name: 'Boar',   hp: 75, walk: 0.9, run: 7.5, size: 0.8,  color: 0x4b3b31, meat: 3, flee: 0,  count: 9, dmg: 9, tusks: true },
  jaguar: { name: 'Jaguar', hp: 110, walk: 1.7, run: 9.5, size: 0.95, color: 0xc7943a, meat: 4, flee: 0, count: 4, dmg: 9, atk: 1.9, predator: true, spots: true },
};
export class Animals {
  constructor(scene, world, audio) {
    this.scene = scene; this.world = world; this.audio = audio; this.list = []; this.threat = 0;
    this.populate(); this.buildBirds(mulberry32(556));
  }
  reset() { for (const a of [...this.list]) this.remove(a); this.populate(); }
  populate() {
    const world = this.world, rnd = mulberry32(555);
    for (const type in SPECIES) {
      let n = 0, tries = 0;
      while (n < SPECIES[type].count && tries < 800) {
        tries++;
        const x = (rnd() - 0.5) * 500, z = (rnd() - 0.5) * 500, h = world.heightAt(x, z);
        if (h < 3 || h > 26 || world.slopeAt(x, z) > 0.45 || world.nearLake(x, z, 3)) continue;
        if (Math.hypot(x - world.crash.x, z - world.crash.z) < 70) continue;
        this.spawn(type, x, z, rnd() * 6.28); n++;
      }
    }
  }
  spawn(type, x, z, heading) {
    const m = buildAnimal(type), sp = SPECIES[type];
    const a = { type, sp, m, g: m.g, x, z, y: this.world.heightAt(x, z), heading, state: 'idle', timer: 1 + Math.random() * 3, hp: sp.hp, speed: 0, phase: Math.random() * 6, dead: false, deadT: 0, corpseT: 0, atkCd: 0, provoked: false, butchered: false, growled: false };
    a.g.position.set(x, a.y, z); a.g.rotation.y = heading; this.scene.add(a.g); this.list.push(a);
    return a;
  }

  buildBirds(rnd) {
    this.birds = [];
    const wingM = new THREE.MeshBasicMaterial({ color: 0x1b1b1b, side: THREE.DoubleSide });
    for (let i = 0; i < 16; i++) {
      const g = new THREE.Group();
      const wl = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.5), wingM), wr = wl.clone();
      wl.geometry.translate(-0.7, 0, 0); wr.geometry = wl.geometry.clone().translate(1.4, 0, 0);
      g.add(wl, wr); g.userData = { wl, wr, r: 40 + rnd() * 90, a: rnd() * 6.28, h: 30 + rnd() * 40, sp: 0.06 + rnd() * 0.05, cx: (rnd() - 0.5) * 300, cz: (rnd() - 0.5) * 300, ph: rnd() * 6 };
      this.scene.add(g); this.birds.push(g);
    }
  }

  damage(a, amount, fromX, fromZ) {
    if (a.dead) return;
    a.hp -= amount; a.provoked = true; a.hitFlash = 1;
    const dx = a.x - fromX, dz = a.z - fromZ, d = Math.hypot(dx, dz) || 1;
    a.x += (dx / d) * 0.6; a.z += (dz / d) * 0.6;
    if (a.type === 'boar' || a.type === 'rabbit' || a.type === 'deer') this.audio.squeal();
    if (a.hp <= 0) { a.dead = true; a.state = 'dead'; a.speed = 0; }
    else if (!a.sp.predator && a.type !== 'boar') { a.state = 'flee'; a.timer = 5; a.wounded = true; }
  }
  hit(px, pz, heading, reach, dmg) {
    let best = null, bd = 99;
    const fx = Math.sin(heading), fz = Math.cos(heading);
    for (const a of this.list) {
      if (a.dead) continue;
      const dx = a.x - px, dz = a.z - pz, d = Math.hypot(dx, dz);
      if (d > reach + a.sp.size * 0.5) continue;
      if ((dx * fx + dz * fz) / (d || 1) < 0.45 && d > 0.9) continue;
      if (d < bd) { bd = d; best = a; }
    }
    if (best) { this.damage(best, dmg, px, pz); return best; }
    return null;
  }
  nearestCorpse(x, z, r) {
    let best = null, bd = r;
    for (const a of this.list) if (a.dead && !a.butchered) { const d = Math.hypot(a.x - x, a.z - z); if (d < bd) { bd = d; best = a; } }
    return best;
  }
  remove(a) { this.scene.remove(a.g); this.list.splice(this.list.indexOf(a), 1); }

  update(dt, player, sky, firesNear, onPlayerHit) {
    const w = this.world, px = player.pos.x, pz = player.pos.z;
    const nightK = sky.night, safeFire = firesNear(px, pz, 11);
    let threat = 0;
    for (const a of [...this.list]) {
      const dx = px - a.x, dz = pz - a.z, d = Math.hypot(dx, dz);
      if (a.dead) {
        a.deadT = Math.min(a.deadT + dt * 2.5, 1); a.corpseT += dt;
        a.g.rotation.z = a.deadT * 1.45; a.g.position.y = a.y + a.deadT * a.sp.size * 0.15;
        if ((a.hitFlash || 0) > 0) a.m.animate(a, dt);              // let the red hit flash fade on the body
        if (a.corpseT > 240) this.remove(a);
        continue;
      }
      a.atkCd -= dt; a.timer -= dt;
      let targetSpeed = 0, wantHeading = a.heading;
      const sp = a.sp;
      if (sp.predator) {
        const aggroR = 14 + 18 * nightK, scared = safeFire || player.torchLit || a.hp < sp.hp * 0.3;
        if (scared && d < 30) { a.state = 'flee'; a.timer = 2; }
        else if (d < aggroR && !scared) { if (a.state !== 'chase' && !a.growled) { this.audio.growl(); a.growled = true; } a.state = 'chase'; }
        else if (a.state === 'chase' && d > aggroR * 1.8) { a.state = 'idle'; a.growled = false; }
        if (a.state === 'chase') threat = Math.max(threat, 1 - Math.min(d / 25, 1));
      } else if (a.type === 'boar') {
        if (a.provoked && d < 35 && a.hp > sp.hp * 0.25) a.state = 'chase';
        else if (a.state === 'chase' && d > 45) { a.state = 'idle'; a.provoked = false; }
        if (a.state === 'chase') threat = Math.max(threat, 0.6 * (1 - Math.min(d / 25, 1)));
      } else if (d < sp.flee * (player.sprinting ? 1.2 : 1) * (a.wounded ? 0.3 : 1) && a.state !== 'flee') { a.state = 'flee'; a.timer = 4 + Math.random() * 3; }

      if (a.state === 'chase') {
        wantHeading = Math.atan2(dx, dz); targetSpeed = sp.run;
        if (d < 1.9 * sp.size + 0.7) {
          targetSpeed = 0;
          if (a.atkCd <= 0) { a.atkCd = sp.atk || 1.3; onPlayerHit(sp.dmg * (0.8 + Math.random() * 0.4), a); }
        }
      } else if (a.state === 'flee') {
        wantHeading = Math.atan2(-dx, -dz) + Math.sin(a.phase * 0.3) * 0.4; targetSpeed = sp.run * (a.wounded ? 0.35 + 0.65 * Math.max(0, a.hp) / sp.hp : 1);       // wounded animals slow down and tire
        if (a.timer <= 0 && (d > 30 || a.wounded)) { a.state = 'idle'; a.timer = 2; if (a.wounded) a.timer = 4; }
      } else if (a.state === 'walk') {
        targetSpeed = sp.walk; if (a.timer <= 0) { a.state = 'idle'; a.timer = 2 + Math.random() * 5; }
      } else {
        if (a.timer <= 0) { a.state = 'walk'; a.timer = 3 + Math.random() * 5; wantHeading = Math.random() * 6.28; a.wander = wantHeading; }
      }
      if (a.state === 'walk' && a.wander !== undefined) wantHeading = a.wander;

      // steer
      let dh = wantHeading - a.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      a.heading += dh * Math.min(1, dt * (a.state === 'idle' ? 2 : 6));
      a.speed += (targetSpeed - a.speed) * Math.min(1, dt * 5);
      const nx = a.x + Math.sin(a.heading) * a.speed * dt, nz = a.z + Math.cos(a.heading) * a.speed * dt, nh = w.heightAt(nx, nz);
      if (nh < 0.6 || nh > 34 || w.slopeAt(nx, nz) > 0.75) { a.heading += 1.6 + Math.random(); a.wander = a.heading; a.speed *= 0.3; }
      else { a.x = nx; a.z = nz; const p = { x: a.x, z: a.z }; if (w.pushOut(p, 0.4)) { a.x = p.x; a.z = p.z; a.heading += 0.8; a.wander = a.heading; } }
      a.y += (w.heightAt(a.x, a.z) - a.y) * Math.min(1, dt * 12);
      a.phase += dt * (a.speed * 1.5 / Math.max(sp.size, 0.45) + 0.2);
      a.m.animate(a, dt);
      a.g.position.set(a.x, a.y, a.z); a.g.rotation.y = a.heading;
      a.g.visible = d < 170;
    }
    this.threat += (threat - this.threat) * Math.min(1, dt * 3);

    // birds circle overhead during the day
    const vis = sky.daylight > 0.3;
    for (const b of this.birds) {
      const u = b.userData; b.visible = vis; if (!vis) continue;
      u.a += dt * u.sp; u.ph += dt * 9;
      b.position.set(px + u.cx * 0.3 + Math.cos(u.a) * u.r, u.h + Math.sin(u.ph * 0.15) * 2, pz + u.cz * 0.3 + Math.sin(u.a) * u.r);
      b.rotation.y = -u.a;
      u.wl.rotation.z = Math.sin(u.ph) * 0.6; u.wr.rotation.z = -Math.sin(u.ph) * 0.6;
    }
  }

  serialize() { return this.list.filter((a) => !a.dead).map((a) => ({ type: a.type, x: a.x, z: a.z, hp: a.hp })); }
  loadState(arr) {
    for (const a of [...this.list]) this.remove(a);
    for (const s of arr || []) { const a = this.spawn(s.type, s.x, s.z, Math.random() * 6.28); a.hp = s.hp; }
  }
}

export { SPECIES };
