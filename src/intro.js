import * as THREE from 'three';
import { createHelicopter } from './helicopter.js';
import { Emitter } from './particles.js';
import { G } from './game.js';
import { hasWreckModel, buildWreckScene } from './wreckScene.js';

const smooth = (t) => t * t * (3 - 2 * t);
const T_FAIL = 5.2, T_CUT2 = 4.6, T_CUT3 = 8.4, T_CRASH = 13.8, T_BLACK = 18.6, T_END = 22.6;
const ALT = 58, DIST = 118, CRUISE = 26;
const _v = new THREE.Vector3(), _e = new THREE.Vector3();

export class Intro {
  constructor(scene, camera, world, audio, ui) {
    this.scene = scene; this.camera = camera; this.world = world; this.audio = audio; this.ui = ui;
    this.heli = createHelicopter(); this.heli.group.visible = false; scene.add(this.heli.group);
    this.t = 0; this.running = false; this.done = false; this.shake = 0; this.crashed = false; this.wreckSmoke = null; this.wreckFire = null;
    this.smoke = new Emitter(scene, { count: 240, rate: 0, life: 4.5, speed: 0.6, spread: 0.5, size: 2.6, grow: 9, alpha: 0.8, color: 0x202020, drift: new THREE.Vector3(0, 0, 0) });
    this.fire = new Emitter(scene, { count: 120, rate: 0, life: 0.7, speed: 1.2, spread: 0.5, size: 0.7, grow: 0.9, alpha: 0.55, color: 0xff7a1a, additive: true, drift: new THREE.Vector3(0, 0, 0) });
    this.blast = new Emitter(scene, { count: 260, rate: 0, life: 2.2, speed: 8, spread: 3, size: 2.2, grow: 7, alpha: 0.9, color: 0xff8a2a, additive: true, gravity: -3, drift: new THREE.Vector3(0, 0, 0) });
    this.blastSmoke = new Emitter(scene, { count: 260, rate: 0, life: 6, speed: 5, spread: 3, size: 3, grow: 12, alpha: 0.6, color: 0x222222, drift: new THREE.Vector3(1, 0, 0.5) });
    this.sparks = new Emitter(scene, { count: 120, rate: 0, life: 0.7, speed: 3, spread: 1.2, size: 0.22, grow: -0.1, alpha: 1, color: 0xffc860, additive: true, gravity: -9, drift: new THREE.Vector3(0, 0, 0) });
    this.leaves = new Emitter(scene, { count: 220, rate: 0, life: 2.2, speed: 4, spread: 2.5, size: 0.7, grow: 0.2, alpha: 0.95, color: 0x4f8a2c, gravity: -3, drift: new THREE.Vector3(0, 0, 0) });
    this.fireball = new Emitter(scene, { count: 90, rate: 0, life: 1.5, speed: 7, spread: 5, size: 5, grow: 15, alpha: 0.95, color: 0xff9a2a, additive: true, gravity: 1.5, drift: new THREE.Vector3(0, 0, 0) });
    this.core = new Emitter(scene, { count: 40, rate: 0, life: 0.55, speed: 4, spread: 2, size: 4, grow: 11, alpha: 1, color: 0xfff0c0, additive: true, drift: new THREE.Vector3(0, 0, 0) });
    this.debris = new Emitter(scene, { count: 150, rate: 0, life: 3.2, speed: 24, spread: 7, size: 0.55, grow: -0.1, alpha: 1, color: 0x2a2a2c, gravity: -17, drift: new THREE.Vector3(0, 0, 0) });
    this.embers = new Emitter(scene, { count: 160, rate: 0, life: 3.8, speed: 13, spread: 5, size: 0.28, grow: -0.05, alpha: 1, color: 0xffb040, additive: true, gravity: -4, drift: new THREE.Vector3(0.6, 0, 0.2) });
    this.dust = new Emitter(scene, { count: 140, rate: 0, life: 3.4, speed: 2.5, spread: 20, size: 4, grow: 9, alpha: 0.5, color: 0x8a7a5e, drift: new THREE.Vector3(0, 0, 0) });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false; scene.add(this.ring);
    this.flash = new THREE.PointLight(0xffb060, 0, 140, 1.4); scene.add(this.flash); this.blastT = -1;
    this.wreckLight = new THREE.PointLight(0xff7a30, 0, 18, 1.5); scene.add(this.wreckLight);       // created up front: adding a light mid-game recompiles every shader and stalls
    this.wreckReady = false;
    const c = world.crash; this.c = new THREE.Vector3(c.x, c.y, c.z);
    // approach from whichever side keeps the whole flight path over jungle rather than open sea
    let best = -1, bd = null;
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a); let sc = 0;
      for (let b = 0; b <= DIST + CRUISE * T_FAIL; b += 8) if (world.heightAt(c.x - dx * b, c.z - dz * b) > 2) sc++; else if (b < 120) sc -= 3;
      if (sc > best) { best = sc; bd = [dx, dz]; }
    }
    this.dir = new THREE.Vector3(bd[0], 0, bd[1]).normalize(); this.right = new THREE.Vector3(this.dir.z, 0, -this.dir.x);
    this.baseYaw = Math.atan2(this.dir.x, this.dir.z); this.look = new THREE.Vector3(); this.shot = 0; this.p = new THREE.Vector3(); this.beepT = 0;
  }
  start() {
    this.t = 0; this.running = true; this.done = false; this.crashed = false; this.heli.group.visible = true; this.shot = 0; this.beepT = 0; this.smoke.active = false; this.fire.active = false;
    this.heli.group.rotation.order = 'YXZ'; this.heli.blur.visible = true; this.heli.tailBlur.visible = true;
    this.audio.heliStart(); this.ui.fade(0, 0); this.ui.title('', 0);
    this.prepareWreck();                                   // under the opening fade-in
    this.ui.showSkip(true);
  }
  skip() { if (this.running && this.t < T_END - 2.4) { this.t = T_END - 2.4; this.finishCrash(); this.ui.showSkip(false); } }

  removeWreckScene() { if (this.wreckScene) { this.wreckScene.dispose(); this.wreckScene = null; } this.wreckReady = false; if (this.wreckLight) this.wreckLight.intensity = 0; }
  finishCrash() {
    if (!this.crashed) { this.crashed = true; this.placeWreck(); this.audio.heliStop(); }
  }

  // everything heavy about the crash site (wreck model, burn textures, shaders, light, emitters) is built hidden before the crash,
  // so the moment of impact only flips things on and does not stall the frame
  prepareWreck() {
    if (this.wreckReady || !hasWreckModel()) return;
    this.removeWreckScene(); this.wreckReady = true;
    const ws = this.wreckScene = buildWreckScene(this.scene, this.world, this.c, this.dir, true);
    if (this.wreckSmoke) { this.wreckSmoke.dispose(this.scene); this.wreckFire.dispose(this.scene); }
    this.wreckSmoke = new Emitter(this.scene, { count: 90, rate: 14, life: 7, speed: 2.4, spread: 0.7, size: 1.4, grow: 6, alpha: 0.5, color: 0x262626, drift: new THREE.Vector3(1.0, 0, 0.3) });
    this.wreckSmoke.position.copy(ws.smoke);
    this.wreckFire = new Emitter(this.scene, { count: 50, rate: 22, life: 0.8, speed: 1.6, spread: 0.5, size: 0.8, grow: 0.4, alpha: 0.8, color: 0xff7a1a, additive: true, drift: new THREE.Vector3(0, 0.8, 0) });
    this.wreckFire.position.copy(ws.fire);
    this.wreckSmoke.active = false; this.wreckFire.active = false;
    this.wreckLight.position.copy(ws.fire).add(new THREE.Vector3(0, 0.5, 0)); this.wreckLight.intensity = 0.001;
    if (this.renderer) { const on = [this.ring, ...[this.fireball, this.core, this.debris, this.embers, this.dust, this.blast, this.blastSmoke].map((e) => e.points)]; this.ring.visible = true; ws.warm(this.renderer, this.camera, on); this.ring.visible = false; }
  }
  placeWreck() {
    this.smoke.active = false; this.fire.active = false;
    if (hasWreckModel()) {
      this.heli.group.visible = false; this.prepareWreck(); this.wreckScene.reveal(); this.wreckSmoke.active = true; this.wreckFire.active = true; this.wreckLight.intensity = 4;
    } else {
      const h = this.heli.group; h.position.copy(this.c).add(new THREE.Vector3(0, 0.1, 0));
      h.rotation.order = 'XYZ'; h.rotation.set(0.32, 0.9, 0.55); this.heli.rotor.rotation.set(0.25, 0.4, -0.18); this.heli.blur.visible = false; this.heli.tailBlur.visible = false;
      this.heli.body.position.y = 0.55; this.heli.group.visible = true;
      const fp = new THREE.Vector3(this.c.x - 0.6, this.c.y + 1.2, this.c.z + 0.2), sp = new THREE.Vector3(this.c.x, this.c.y + 2.2, this.c.z);
      this.wreckSmoke = new Emitter(this.scene, { count: 90, rate: 14, life: 7, speed: 2.4, spread: 0.7, size: 1.4, grow: 6, alpha: 0.5, color: 0x262626, drift: new THREE.Vector3(1.0, 0, 0.3) }); this.wreckSmoke.position.copy(sp);
      this.wreckFire = new Emitter(this.scene, { count: 50, rate: 22, life: 0.8, speed: 1.6, spread: 0.5, size: 0.8, grow: 0.4, alpha: 0.8, color: 0xff7a1a, additive: true, drift: new THREE.Vector3(0, 0.8, 0) }); this.wreckFire.position.copy(fp);
      this.wreckLight.position.copy(fp).add(new THREE.Vector3(0, 0.5, 0)); this.wreckLight.intensity = 4;
    }
  }

  // flight path: level cruise, then a failing, spinning descent that ends at the crash site
  path(t, out) {
    const c = this.c, d = this.dir;
    if (t < T_FAIL) {
      const back = DIST + CRUISE * (T_FAIL - t);
      out.set(c.x - d.x * back, c.y + ALT + Math.sin(t * 0.9) * 0.9, c.z - d.z * back);
    } else {
      const u = Math.min(1, (t - T_FAIL) / (T_CRASH - T_FAIL)), f = u * (1.9 - 0.9 * u), back = DIST * (1 - f), side = Math.sin(u * 4) * 10 * (1 - u);
      out.set(c.x - d.x * back + this.right.x * side, THREE.MathUtils.lerp(c.y + ALT, c.y + 1.2, Math.pow(u, 1.8)), c.z - d.z * back + this.right.z * side);
    }
    return out;
  }
  cut(n, pos, look) { if (this.shot !== n) { this.shot = n; this.camera.position.copy(pos); this.look.copy(look); } }

  update(dt) {
    if (!this.running) return;
    if (this.t >= T_CRASH - 0.1 && this.t < T_CRASH + 2.2) { const u = Math.min(1, Math.max(0, (this.t - T_CRASH + 0.1) / 2.3)); dt *= 0.22 + 0.78 * u * u; }   // impact slow-motion that eases back to real time
    this.t += dt; const t = this.t, cam = this.camera, h = this.heli, W = this.world;
    const failing = t >= T_FAIL, ft = Math.max(0, t - T_FAIL), rpm = t < T_CRASH ? (failing ? Math.max(0.3, 1 - ft * 0.09) : 1) : 0;
    h.rotor.rotation.y += dt * 30 * rpm; h.tailRotor.rotation.x += dt * 40 * (failing ? 0 : 1);
    h.blur.material.opacity = 0.17 * rpm * rpm; h.tailBlur.visible = !failing; h.strobe.visible = Math.sin(t * 7) > 0.2;

    if (t < T_CRASH) {
      const u = failing ? Math.min(1, ft / (T_CRASH - T_FAIL)) : 0, p = this.path(t, this.p);
      p.y = Math.max(p.y, W.heightAt(p.x, p.z) + 3);
      h.group.position.copy(p);
      const spin = 0.2 * ft * ft;
      h.group.rotation.set(0.05 + 0.55 * u + Math.sin(t * 1.3) * 0.02, this.baseYaw + spin, Math.sin(t * 1.1) * 0.05 + (failing ? Math.sin(ft * 1.8) * 0.2 + 0.9 * u * u : 0));
      h.group.updateMatrixWorld(true);
      // engine smoke / fire / sparks follow the aircraft
      _e.set(0, 2.55, -1.5); h.body.localToWorld(_e);
      if (t > T_FAIL - 0.3) { this.smoke.active = true; this.smoke.o.rate = 26 + ft * 9; this.smoke.setColor(ft < 0.6 ? 0x6a6a6a : 0x1a1a1a); this.smoke.position.copy(_e); }
      if (t > T_FAIL + 1.2) { this.fire.active = true; this.fire.o.rate = 40; this.fire.position.copy(_e); }
      if (failing && ft < 3.5 && Math.random() < dt * 14) { this.sparks.position.copy(_e); this.sparks.spawn(10, 1, 1); }
      if (t > T_FAIL - 0.02 && t - dt <= T_FAIL - 0.02) { this.sparks.position.copy(_e); this.sparks.spawn(60, 1.6, 1.4); }
      // clipping the canopy on the way down
      const agl = p.y - W.heightAt(p.x, p.z);
      if (u > 0.55 && agl < 20) { this.leaves.position.copy(p); this.leaves.position.y -= 3; this.leaves.spawn(5, 1.5, 1); this.shake = Math.max(this.shake, 0.5); }
      // sound: louder as it nears, engine sputters and drops after the failure
      const dist = p.distanceTo(cam.position), lvl = THREE.MathUtils.clamp(1.25 - dist / 220, 0.2, 1.0);
      this.audio.heliSet(lvl, failing, THREE.MathUtils.clamp(rpm, 0.45, 1));
      if (failing && this.audio.ready && (this.beepT -= dt) <= 0) { this.beepT = 0.55; this.audio.tone(1500, 0.14, 'square', 0.035); }

      // camera: 1) flyby above the canopy  2) chase behind  3) crash site as it comes in
      const shot = t < T_CUT2 ? 1 : t < T_CUT3 ? 2 : 3;
      const tgt = _v.copy(p), k = 1 - Math.exp(-dt * (shot === 3 ? 5 : 7));
      if (shot === 1) {
        const c1 = this.path(1.8, new THREE.Vector3()).addScaledVector(this.right, 44); c1.y += 9;
        this.cut(1, c1, tgt); cam.fov = 38; cam.position.copy(c1);
      } else if (shot === 2) {
        const c2 = p.clone().addScaledVector(this.dir, -17).addScaledVector(this.right, 5); c2.y += 5.5;
        this.cut(2, c2, tgt); cam.fov = 52; cam.position.lerp(c2, 1 - Math.exp(-dt * 3.5));
      } else {
        const c3 = this.c.clone().addScaledVector(this.right, 26).addScaledVector(this.dir, -16); c3.y = Math.max(W.heightAt(c3.x, c3.z) + 40, this.c.y + 46);
        this.cut(3, c3, tgt); cam.fov = 44; cam.position.copy(c3);
      }
      this.look.lerp(tgt, k); cam.lookAt(this.look);
      if (failing) { const sh = (0.05 + Math.min(0.35, ft * 0.08)) * (shot === 3 ? 0.2 : 1) + this.shake * 0.5; cam.position.x += (Math.random() - 0.5) * sh; cam.position.y += (Math.random() - 0.5) * sh; }
      this.shake = Math.max(0, this.shake - dt * 2);
      cam.updateProjectionMatrix();
      if (t < 1.2) this.ui.fade(1 - t / 1.2, 0); else this.ui.fade(0, 0);
      this.ui.title(t > 0.9 && t < 3.9 ? 'Flight 7 · Over the Pacific' : (t > T_FAIL + 0.4 && t < T_CUT3 - 0.4 ? 'Mayday. Mayday.' : ''), 1);
      this.ui.subtitle(t > T_FAIL + 0.4 && t < T_CUT3 - 0.4 ? 'Engine failure · Losing altitude' : '');
    } else {
      if (!this.crashed) {
        this.crashed = true; this.audio.heliStop(); this.audio.explosion();
        const c = this.c; this.shake = 1.6; this.ui.flash(1);
        for (const e of [this.blast, this.blastSmoke]) { e.position.set(c.x, c.y + 1.2, c.z); }
        this.blast.spawn(220, 1.0, 1.0); this.blastSmoke.spawn(220, 1.0, 0.8);
        for (const e of [this.fireball, this.core, this.debris, this.embers]) e.position.set(c.x, c.y + 1.0, c.z);
        this.fireball.spawn(90, 1, 1); this.core.spawn(40, 1, 1); this.debris.spawn(150, 1, 1); this.embers.spawn(160, 1, 1);
        this.dust.position.set(c.x, c.y + 0.4, c.z); this.dust.spawn(140, 1, 1); this.flash.position.set(c.x, c.y + 6, c.z); this.blastT = 0; this.ring.position.set(c.x, c.y + 0.5, c.z); this.ring.visible = true;
        this.placeWreck();
        this.smoke.active = false; this.fire.active = false;
      }
      const sinceC = t - T_CRASH;
      this.shake = Math.max(0, this.shake - dt);
      const camP = this.c.clone().addScaledVector(this.right, 26).addScaledVector(this.dir, -16); camP.y = Math.max(this.world.heightAt(camP.x, camP.z) + 40, this.c.y + 46) + sinceC * 1.2;
      cam.position.lerp(camP, 1 - Math.exp(-dt * 2)); this.look.lerp(_v.set(this.c.x, this.c.y + 3, this.c.z), 1 - Math.exp(-dt * 3)); cam.lookAt(this.look); cam.fov = 46; cam.updateProjectionMatrix();
      cam.position.x += (Math.random() - 0.5) * this.shake * 0.6; cam.position.y += (Math.random() - 0.5) * this.shake * 0.6;
      if (t > T_CRASH + 3.4 && t < T_BLACK) this.ui.fade(Math.min(1, (t - T_CRASH - 3.4) / (T_BLACK - T_CRASH - 3.4)), 0);
      if (t > T_BLACK - 0.3) this.ui.fade(1, 0);
      this.ui.title(t > T_BLACK + 0.4 && t < T_END - 1.4 ? 'JUNGLE SURVIVAL' : '', 1);
      if (t > T_BLACK + 0.4 && t < T_END - 1.4) this.ui.subtitle('Somewhere in the Pacific. Day 1.');
      else this.ui.subtitle('');
    }
    if (this.blastT >= 0) {
      this.blastT += dt; const bt = this.blastT, k = bt / 1.4;
      this.flash.intensity = bt < 1.8 ? 420 * Math.exp(-bt * 2.6) : 0; this.ring.scale.setScalar(1 + bt * 48); this.ring.material.opacity = Math.max(0, 0.55 * (1 - k)); this.ring.position.y = this.world.heightAt(this.c.x, this.c.z) + 0.6;
      if (bt > 1.5) { this.ring.visible = false; if (bt > 4) this.blastT = -1; }
    }
    for (const e of [this.smoke, this.fire, this.sparks, this.leaves, this.blast, this.blastSmoke, this.fireball, this.core, this.debris, this.embers, this.dust, this.wreckSmoke, this.wreckFire]) if (e) e.update(dt);
    if (this.wreckScene) this.wreckScene.update(this.t + performance.now() / 1000); if (this.wreckLight && this.crashed) this.wreckLight.intensity = 3.5 + Math.random() * 1.5;
    if (t >= T_END) { this.ui.showSkip(false); this.running = false; this.done = true; this.ui.title('', 0); this.ui.subtitle(''); }
  }
}
