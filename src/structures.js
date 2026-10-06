import * as THREE from 'three';
import { Emitter } from './particles.js';

const stoneM = new THREE.MeshStandardMaterial({ color: 0x808078, roughness: 1, flatShading: true });
const logM = new THREE.MeshStandardMaterial({ color: 0x4a301c, roughness: 1 });
const emberM = new THREE.MeshBasicMaterial({ color: 0xff6a1a });

export class Structures {
  constructor(scene, world, audio) {
    this.scene = scene; this.world = world; this.audio = audio; this.fires = []; this.shelters = [];
  }

  placeCampfire(x, z, fuel = 360) {
    const y = this.world.heightAt(x, z), g = new THREE.Group(); g.position.set(x, y, z);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * 6.283, s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17 + Math.random() * 0.05, 0), stoneM);
      s.position.set(Math.cos(a) * 0.5, 0.08, Math.sin(a) * 0.5); s.castShadow = true; g.add(s);
    }
    for (let i = 0; i < 4; i++) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.8, 6), logM); l.position.y = 0.16;
      l.rotation.z = Math.PI / 2 - 0.25; l.rotation.y = (i / 4) * 6.283; l.castShadow = true; g.add(l);
    }
    const embers = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.06, 10), emberM); embers.position.y = 0.1; g.add(embers);
    const light = new THREE.PointLight(0xff8a3a, 0, 30, 1.4); light.position.y = 0.9; g.add(light);
    this.scene.add(g);
    const flame = new Emitter(this.scene, { count: 40, rate: 38, life: 0.7, speed: 1.6, spread: 0.18, size: 0.6, grow: -0.3, alpha: 0.85, color: 0xff8a20, additive: true, drift: new THREE.Vector3(0, 0, 0) });
    const smoke = new Emitter(this.scene, { count: 40, rate: 7, life: 4, speed: 1.4, spread: 0.2, size: 0.5, grow: 2.2, alpha: 0.25, color: 0x6a6a6a });
    flame.position.set(x, y + 0.2, z); smoke.position.set(x, y + 1.0, z);
    const f = { x, z, y, g, light, flame, smoke, fuel, lit: true, embers };
    this.fires.push(f); this.audio.fireStart(); return f;
  }

  placeShelter(x, z, rot) {
    const y = this.world.heightAt(x, z), g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot;
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3d22, roughness: 1 });
    const leaf = new THREE.MeshStandardMaterial({ color: 0x2f6a2a, roughness: 1, side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.2, 6), wood); p.position.set(s * 1.1, 1.0, 0.0); p.rotation.x = 0; p.castShadow = true; g.add(p);
    }
    const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), wood); ridge.rotation.z = Math.PI / 2; ridge.position.set(0, 2.0, 0); g.add(ridge);
    for (const s of [-1, 1]) {
      const roof = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.2, 3, 3), leaf); roof.position.set(0, 1.0, s * 0.8); roof.rotation.x = -s * 0.95 + (s > 0 ? Math.PI : 0); roof.rotation.y = 0; roof.castShadow = true;
      roof.rotation.set(-s * 0.75, 0, 0); roof.position.set(0, 1.05, s * 0.55); g.add(roof);
    }
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 1.0), new THREE.MeshStandardMaterial({ color: 0x4a5a28, roughness: 1 })); bed.position.y = 0.06; g.add(bed);
    this.scene.add(g); const sh = { x, z, y, g, rot }; this.shelters.push(sh); return sh;
  }

  clear() {
    for (const f of this.fires) { this.scene.remove(f.g); f.flame.dispose(this.scene); f.smoke.dispose(this.scene); }
    for (const sh of this.shelters) this.scene.remove(sh.g);
    this.fires = []; this.shelters = [];
  }
  update(dt, t) {
    for (const f of this.fires) {
      f.fuel -= dt;
      if (f.fuel <= 0 && f.lit) { f.lit = false; f.flame.active = false; f.smoke.o.rate = 2; f.embers.material = new THREE.MeshBasicMaterial({ color: 0x331a10 }); }
      f.light.intensity = f.lit ? (7 + Math.sin(t * 17 + f.x) * 1.4 + Math.random() * 1.2) : 0;
      f.flame.update(dt); f.smoke.update(dt);
    }
  }
  firesNear(x, z, r) { return this.fires.some((f) => f.lit && Math.hypot(f.x - x, f.z - z) < r); }
  nearestFire(x, z, r) { let b = null, bd = r; for (const f of this.fires) { const d = Math.hypot(f.x - x, f.z - z); if (d < bd) { bd = d; b = f; } } return b; }
  nearestShelter(x, z, r) { let b = null, bd = r; for (const s of this.shelters) { const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; b = s; } } return b; }
  fireIntensityAt(x, z) { let k = 0; for (const f of this.fires) if (f.lit) k = Math.max(k, 1 - Math.min(Math.hypot(f.x - x, f.z - z) / 14, 1)); return k; }

  serialize() { return { fires: this.fires.map((f) => ({ x: f.x, z: f.z, fuel: f.fuel })), shelters: this.shelters.map((s) => ({ x: s.x, z: s.z, rot: s.rot })) }; }
  load(d) {
    for (const f of d?.fires || []) { const n = this.placeCampfire(f.x, f.z, f.fuel); if (f.fuel <= 0) { n.fuel = -1; } }
    for (const s of d?.shelters || []) this.placeShelter(s.x, s.z, s.rot);
  }
}
