import * as THREE from 'three';
import { Emitter } from './particles.js';
import { glowTexture } from './textures.js';

// Short-lived world feedback: chips, leaves, dust, ripples, falling trees, camera shake, night fireflies.
export class Effects {
  constructor(scene, world, audio) {
    this.scene = scene; this.world = world; this.audio = audio; this.shakeAmt = 0; this.falling = []; this.ripples = []; this.t = 0;
    const mk = (o) => { const e = new Emitter(scene, { rate: 0, ...o }); e.active = false; return e; };
    this.chip = mk({ count: 90, life: 0.9, speed: 3.2, spread: 0.5, size: 0.16, grow: -0.05, alpha: 1, color: 0x8a6240, gravity: -11, drift: new THREE.Vector3(0, 0, 0) });
    this.leaf = mk({ count: 90, life: 1.8, speed: 1.4, spread: 1.4, size: 0.2, grow: 0, alpha: 0.95, color: 0x5d9a3a, gravity: -2.2, drift: new THREE.Vector3(0.2, 0, 0.1) });
    this.dust = mk({ count: 120, life: 1.5, speed: 1.1, spread: 1.2, size: 0.8, grow: 2.4, alpha: 0.4, color: 0xb8a888, gravity: -0.6, drift: new THREE.Vector3(0.3, 0, 0.1) });
    this.splash = mk({ count: 90, life: 0.8, speed: 2.8, spread: 0.6, size: 0.14, grow: -0.04, alpha: 0.9, color: 0xe8f4ff, gravity: -9, drift: new THREE.Vector3(0, 0, 0) });
    this.spark = mk({ count: 60, life: 0.9, speed: 3, spread: 0.5, size: 0.12, grow: -0.08, alpha: 1, color: 0xffb040, additive: true, gravity: -3, drift: new THREE.Vector3(0, 0, 0) });
    this.blood = mk({ count: 120, life: 0.9, speed: 2.4, spread: 0.5, size: 0.12, grow: -0.04, alpha: 0.95, color: 0x8c1212, gravity: -10, drift: new THREE.Vector3(0, 0, 0) });
    this.emitters = [this.chip, this.leaf, this.dust, this.splash, this.spark, this.blood];

    // pooled ripple rings
    const rg = new THREE.RingGeometry(0.82, 1, 40); rg.rotateX(-Math.PI / 2);
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: true }));
      m.visible = false; m.renderOrder = 3; scene.add(m); this.ripples.push({ m, t: 1, size: 1 });
    }

    // fireflies (visible at night near the player)
    const n = 90, pos = new Float32Array(n * 3), ph = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 60; pos[i * 3 + 1] = 0.6 + Math.random() * 3; pos[i * 3 + 2] = (Math.random() - 0.5) * 60; ph[i] = Math.random() * 6.28; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.ffMat = new THREE.PointsMaterial({ map: glowTexture(), color: 0xd8ff7a, size: 0.16, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    this.fireflies = new THREE.Points(g, this.ffMat); this.fireflies.frustumCulled = false; this.ffPhase = ph; scene.add(this.fireflies);
  }

  shake(a) { this.shakeAmt = Math.min(0.7, Math.max(this.shakeAmt, a)); }
  burst(e, x, y, z, n, spread = 1, speed = 1) { e.position.set(x, y, z); e.spawn(n, spread, speed); }
  chips(x, y, z) { this.burst(this.chip, x, y, z, 14, 0.6, 1); this.burst(this.leaf, x, y + 1.5, z, 3, 1.4, 0.6); }
  leaves(x, y, z, n = 10) { this.burst(this.leaf, x, y, z, n, 2, 0.8); }
  puff(x, y, z, n = 10, spread = 1) { this.burst(this.dust, x, y, z, n, spread, 0.8); }
  impact(x, y, z) { this.burst(this.dust, x, y, z, 6, 0.5, 0.6); this.burst(this.chip, x, y, z, 5, 0.4, 0.8); }
  bloodSplash(x, y, z, n = 16) { this.burst(this.blood, x, y, z, n, 0.7, 1); }
  sparks(x, y, z, n = 20) { this.burst(this.spark, x, y, z, n, 0.6, 1); }
  waterSplash(x, z, n = 14) { this.burst(this.splash, x, 0.05, z, n, 0.6, 1); this.ripple(x, z, 1.8); }
  ripple(x, z, size = 1.2) {
    const r = this.ripples.find((q) => q.t >= 1); if (!r) return;
    r.t = 0; r.size = size; r.m.position.set(x, 0.04, z); r.m.visible = true; r.m.scale.setScalar(0.1);
  }

  fallTree(o, fromX, fromZ) {
    if (!o.meshes || !o.m0) return;
    const group = new THREE.Group(); const base = new THREE.Vector3(); const q = new THREE.Quaternion(), s = new THREE.Vector3();
    o.m0.decompose(base, q, s);
    group.position.copy(base);
    const rel = o.m0.clone(); rel.elements[12] -= base.x; rel.elements[13] -= base.y; rel.elements[14] -= base.z;
    for (const im of o.meshes) {
      const mesh = new THREE.Mesh(im.geometry, im.material); mesh.matrixAutoUpdate = false; mesh.matrix.copy(rel); mesh.castShadow = true; mesh.frustumCulled = false;
      if (im.customDepthMaterial) mesh.customDepthMaterial = im.customDepthMaterial; group.add(mesh);
    }
    this.scene.add(group);
    const away = new THREE.Vector3(o.x - fromX, 0, o.z - fromZ).normalize(); const axis = new THREE.Vector3(away.z, 0, -away.x);
    this.falling.push({ group, axis, away, t: 0, dur: 2.1, o, landed: false, base: base.clone(), h: 11 * (o.scale || 1) });
    this.audio.chop();
  }

  update(dt, camera, env) {
    this.t += dt;
    for (const e of this.emitters) e.update(dt);
    for (const r of this.ripples) if (r.t < 1) { r.t += dt / 1.4; const k = Math.min(1, r.t); r.m.scale.setScalar(0.2 + k * r.size); r.m.material.opacity = (1 - k) * 0.5; if (k >= 1) r.m.visible = false; }
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i]; f.t += dt; const k = Math.min(1, f.t / f.dur);
      const crack = k < 0.15 ? Math.sin(f.t * 60) * 0.012 * (k / 0.15) : 0;      // shudder before it goes
      const ang = k < 0.15 ? crack : Math.pow((k - 0.15) / 0.85, 2.1) * 1.48;
      f.group.quaternion.setFromAxisAngle(f.axis, ang);
      if (!f.landed && ang > 1.3) {
        f.landed = true; this.shake(0.35); this.audio.explosion && this.audio.thump && this.audio.thump();
        const tip = f.base.clone().addScaledVector(f.away, f.h * 0.9); this.puff(tip.x, this.world.heightAt(tip.x, tip.z) + 0.3, tip.z, 22, 3); this.leaves(tip.x, tip.y + 1, tip.z, 30);
      }
      if (f.t > f.dur + 1.4) { f.group.scale.multiplyScalar(0.94); }
      if (f.t > f.dur + 2.4) { this.scene.remove(f.group); this.falling.splice(i, 1); }
    }
    // camera shake
    if (this.shakeAmt > 0.001) {
      camera.position.x += (Math.random() - 0.5) * this.shakeAmt; camera.position.y += (Math.random() - 0.5) * this.shakeAmt; camera.position.z += (Math.random() - 0.5) * this.shakeAmt;
      this.shakeAmt *= Math.pow(0.02, dt);
    }
    // fireflies
    const night = env.night, pc = camera.position;
    this.ffMat.opacity = Math.max(0, night - 0.35) * 1.4 * env.jungle;
    if (this.ffMat.opacity > 0.01) {
      this.fireflies.visible = true; const p = this.fireflies.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const ph = this.ffPhase[i]; let x = p.getX(i) + Math.sin(this.t * 0.6 + ph) * dt * 0.8, z = p.getZ(i) + Math.cos(this.t * 0.5 + ph * 1.3) * dt * 0.8, y = p.getY(i) + Math.sin(this.t * 1.1 + ph) * dt * 0.3;
        if (Math.abs(x - pc.x) > 30) x = pc.x + (Math.random() - 0.5) * 58; if (Math.abs(z - pc.z) > 30) z = pc.z + (Math.random() - 0.5) * 58;
        const gy = this.world.heightAt(x, z); if (y < gy + 0.4 || y > gy + 4) y = gy + 0.8 + Math.random() * 2.5;
        p.setXYZ(i, x, y, z);
      }
      p.needsUpdate = true; this.ffMat.size = 0.16 + 0.07 * Math.sin(this.t * 3);
    } else this.fireflies.visible = false;
  }
}
