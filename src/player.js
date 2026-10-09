import * as THREE from 'three';
import { createCharacter } from './hero.js';
import { R } from './world.js';
import { clamp } from './noise.js';

const TOOL_MODEL = { knife: 'knife', stone_axe: 'stone_axe', spear: 'spear', torch: 'torch', flare: 'flare', bottle_empty: 'bottle', water_clean: 'bottle', water_dirty: 'bottle' };

export class Player {
  constructor(scene) {
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.heading = 0; this.yaw = 0; this.pitch = 0.28;
    this.camDist = 5.4; this.char = createCharacter(); scene.add(this.char.group);
    this.onGround = true; this.swimming = false; this.sprinting = false; this.moving = false; this.speed = 0;
    this.gathering = false; this.act = null; this.sleeping = false; this.dead = false; this.wakeT = 0; this.surface = 'grass';
    this.torchLit = false; this.flareT = 0; this.warn = 0; this.camPos = new THREE.Vector3(); this.swimTick = 0;
    this.torchPhase = 0; this.sens = 1; this.invertY = false; this.baseFov = 62;
    this.flareLight = new THREE.PointLight(0xff3a2a, 0, 70, 1.1); this.flareLight.position.y = 2.4; this.char.group.add(this.flareLight);
  }
  teleport(x, y, z) { this.pos.set(x, y, z); this.vel.set(0, 0, 0); }
  startWake() { this.wakeT = 4.2; this.sleeping = true; }
  setEquipped(id) { this.char.setTool(id ? TOOL_MODEL[id] || null : null); this.equippedId = id; }

  update(dt, ctl, world, stats, audio, locked) {
    const char = this.char;
    // ---- look
    if (!locked) { this.yaw -= ctl.mouseDX * 0.0022 * this.sens; this.pitch = clamp(this.pitch + ctl.mouseDY * 0.0022 * this.sens * (this.invertY ? -1 : 1), -0.45, 1.25); }

    const ableToMove = !locked && !this.dead && !this.sleeping && !this.gathering;
    const ax = ableToMove && ctl.axis && ctl.axis.m > 0.12 ? ctl.axis : null;
    const fw = ax ? ax.y : ableToMove ? (ctl.down('KeyW') ? 1 : 0) - (ctl.down('KeyS') ? 1 : 0) : 0;
    const st = ax ? ax.x : ableToMove ? (ctl.down('KeyD') ? 1 : 0) - (ctl.down('KeyA') ? 1 : 0) : 0;
    const f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)), r = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const mv = f.multiplyScalar(fw).add(r.multiplyScalar(st));
    this.moving = mv.lengthSq() > 0.01; if (this.moving) mv.normalize();

    const ground = world.heightAt(this.pos.x, this.pos.z);
    this.swimming = ground < -0.75;
    const wading = ground < -0.05 && !this.swimming;
    this.sprinting = ableToMove && this.moving && ctl.down('ShiftLeft') && stats.energy > 4 && !this.swimming;
    let target = this.swimming ? 2.3 : this.sprinting ? 7.2 : 3.9;
    if (wading) target *= 0.72;
    if (stats.energy < 8) target *= 0.8; if (stats.sick > 0) target *= 0.88; if (stats.health < 20) target *= 0.85;
    const slope = world.slopeAt(this.pos.x, this.pos.z); if (slope > 0.55 && !this.swimming) target *= 0.8;

    const dv = mv.multiplyScalar(this.moving ? target * (ax ? 0.55 + 0.45 * Math.min(1, (ax.m - 0.12) / 0.6) : 1) : 0);
    const k = Math.min(1, dt * (this.moving ? 9 : 10));
    this.vel.x += (dv.x - this.vel.x) * k; this.vel.z += (dv.z - this.vel.z) * k;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    // while working on something, step up to a proper arm's length from it (the walk animation plays while closing in)
    this._approach = 0;
    if (this.act && this.gathering) {
      const off = { crate: 0.95, chop: 1.2, butcher: 0.85, pick: 0.8 }[this.act.kind] || 0.8, dx = this.act.x - this.pos.x, dz = this.act.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d > off + 0.04) { const step = Math.min(d - off, 2.0 * dt); this.pos.x += (dx / d) * step; this.pos.z += (dz / d) * step; this._approach = step / dt; }
    }
    world.pushOut(this.pos, 0.42);

    // island boundary (open sea)
    const dist = Math.hypot(this.pos.x, this.pos.z), lim = R * 1.04;
    this.warn = dist > R * 0.96 ? 1 : 0;
    if (dist > lim) { this.pos.x *= lim / dist; this.pos.z *= lim / dist; }

    // ---- vertical
    const g2 = world.heightAt(this.pos.x, this.pos.z);
    if (g2 < -0.75) {
      this.swimming = true; this.onGround = false; this.vel.y = 0;
      const bob = -0.42 + Math.sin(performance.now() * 0.002) * 0.04;
      this.pos.y += (bob - this.pos.y) * Math.min(1, dt * 6);
    } else {
      this.swimming = false;
      if (ableToMove && ctl.hit('Space') && this.onGround && stats.energy > 3) { this.vel.y = 7.0; this.onGround = false; stats.energy -= 1.5; }
      this.vel.y -= 22 * dt; this.pos.y += this.vel.y * dt;
      if (this.pos.y <= g2) { this.pos.y = g2; this.vel.y = 0; this.onGround = true; } else if (this.pos.y > g2 + 0.12) this.onGround = false;
    }

    // ---- facing
    const hv = Math.hypot(this.vel.x, this.vel.z); this.speed = hv;
    if (this.act && this.gathering) { const th = Math.atan2(this.act.x - this.pos.x, this.act.z - this.pos.z); let d = th - this.heading; d = Math.atan2(Math.sin(d), Math.cos(d)); this.heading += d * Math.min(1, dt * 9); }       // face what you are working on
    if (hv > 0.4 && !this.gathering) { const th = Math.atan2(this.vel.x, this.vel.z); let d = th - this.heading; d = Math.atan2(Math.sin(d), Math.cos(d)); this.heading += d * Math.min(1, dt * 12); }
    this.surface = world.surfaceAt(this.pos.x, this.pos.z);

    // ---- character
    this.torchLit = this.equippedId === 'torch' || this.flareT > 0;
    if (this.flareT > 0) this.flareT -= dt;
    const tools = char.tools;
    for (const n of ['torch', 'flare']) {
      const tl = tools[n]; if (!tl || !tl.userData.light) continue;
      const on = n === 'torch' ? this.equippedId === 'torch' : false;
      tl.userData.light.intensity = on ? (n === 'torch' ? 8 : 12) * (0.85 + Math.random() * 0.3) : 0;
      if (tl.userData.flame) { tl.userData.flame.visible = on || n === 'torch' ? on : false; if (on) tl.userData.flame.scale.setScalar(0.9 + Math.random() * 0.3); }
    }
    this.flareLight.intensity = this.flareT > 0 ? 14 * (0.85 + Math.random() * 0.3) : 0;
    char.group.position.copy(this.pos); char.group.rotation.y = this.heading;
    // terrain slope along the facing direction, and where the head should look relative to the body
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const footSlope = Math.atan2(world.heightAt(this.pos.x + fx * 0.7, this.pos.z + fz * 0.7) - world.heightAt(this.pos.x - fx * 0.7, this.pos.z - fz * 0.7), 1.4);
    let yd = this.yaw - this.heading; yd = Math.atan2(Math.sin(yd), Math.cos(yd));
    char.update(dt, {
      groundAt: (x, z) => world.heightAt(x, z), act: this.act, speed: Math.max(hv, this._approach || 0), sprint: this.sprinting, swim: this.swimming, air: !this.onGround && !this.swimming, dead: this.dead,
      gathering: this.gathering, sleeping: this.sleeping && this.wakeT <= 0 ? true : (this.wakeT > 1.4), tired: stats.energy < 18,
      hurt: stats.health < 30, slope: this.swimming ? 0 : footSlope, yawDiff: yd, pitchLook: (this.pitch - 0.3) * 0.75,
      onStep: () => { audio.step(this.surface); if (this.fx && this.surface === 'water') this.fx.ripple(this.pos.x, this.pos.z, 1.1); },
    });
    if (this.swimming && hv > 0.4) { this.swimTick -= dt; if (this.swimTick <= 0) { audio.swim(); this.swimTick = 0.9; if (this.fx) this.fx.ripple(this.pos.x, this.pos.z, 2.2); } }
    const inWater = this.surface === 'water';
    if (inWater && !this.wasWater && hv > 1.2 && this.fx) { this.fx.waterSplash(this.pos.x, this.pos.z, this.sprinting ? 26 : 14); audio.noise(0.4, 1500, 'bandpass', 0.16, 0.6); }
    this.wasWater = inWater;

    if (this.wakeT > 0) { this.wakeT -= dt; if (this.wakeT <= 1.4) this.sleeping = false; }
  }

  updateCamera(camera, world, dt) {
    const wake = this.wakeT > 0 ? this.wakeT / 4.2 : 0;
    const dist = this.camDist * (1 - wake * 0.55) * (this.sprinting ? 1.06 : 1);
    const pitch = this.pitch - wake * 0.9;
    const tx = this.pos.x, ty = this.pos.y + (this.swimming ? 0.9 : 1.55) - wake * 1.1, tz = this.pos.z;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cx = tx - Math.sin(this.yaw) * dist * cp, cz = tz - Math.cos(this.yaw) * dist * cp;
    let cy = ty + sp * dist + 0.2;
    const gh = Math.max(world.heightAt(cx, cz), 0.05);
    if (cy < gh + 0.6) cy = gh + 0.6;
    const want = new THREE.Vector3(cx, cy, cz);
    this.camPos.lerp(want, 1 - Math.exp(-dt * 22)); if (this.camPos.lengthSq() === 0) this.camPos.copy(want);
    camera.position.copy(this.camPos);
    camera.lookAt(tx, ty + 0.15, tz);
    const wantFov = this.baseFov + (this.sprinting ? 6 : 0); camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 5); camera.updateProjectionMatrix();
  }
}
