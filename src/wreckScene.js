import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// The crash site: a broken Blender helicopter (body on its side, tail boom and rotor blades thrown clear, torn door, seat), a scorched burn
// patch, a gouge torn through the ground, scattered metal shards and a few snapped saplings. Everything is draped over the real terrain height.
let wreckModel = null;
export const hasWreckModel = () => !!wreckModel;
export async function loadWreckModel(url) { wreckModel = (await new GLTFLoader().loadAsync(url)).scene; }

function noiseTex(draw, S = 256) { const c = document.createElement('canvas'); c.width = c.height = S; draw(c.getContext('2d'), S); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const rnd = (() => { let s = 91; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();

function groundPatch(world, cx, cz, yaw, w, l, tex, y0, seg = 28, order = 2) {
  const g = new THREE.PlaneGeometry(w, l, seg, seg), p = g.attributes.position, ca = Math.cos(yaw), sa = Math.sin(yaw);
  for (let i = 0; i < p.count; i++) {
    const lx = p.getX(i), lz = -p.getY(i), wx = cx + lx * ca + lz * sa, wz = cz - lx * sa + lz * ca;
    p.setXYZ(i, wx, world.heightAt(wx, wz) + 0.06 + y0, wz);
  }
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.renderOrder = order; mesh.frustumCulled = false; return mesh;
}

export function buildWreckScene(scene, world, c, dir, deferred = false) {
  const root = new THREE.Group(); root.name = 'wreckScene'; const yaw = Math.atan2(dir.x, dir.z);
  // --- burn patch under the body and a gouge running back along the approach path
  // charred ground: ragged edge, black char with grey ash, radial blast streaks and glowing embers in the cracks (separate emissive map)
  const makeBurn = (seed) => {
    const S = 512, cv = document.createElement('canvas'), em = document.createElement('canvas'); cv.width = cv.height = em.width = em.height = S; const x = cv.getContext('2d'), e = em.getContext('2d');
    let sd = seed; const r = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
    const img = x.createImageData(S, S), eim = e.createImageData(S, S), ph = [r() * 6, r() * 6, r() * 6, r() * 6];
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const dx = (px - S / 2) / (S / 2), dy = (py - S / 2) / (S / 2), d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const edge = 0.78 + 0.12 * Math.sin(a * 3 + ph[0]) + 0.08 * Math.sin(a * 7 + ph[1]) + 0.05 * Math.sin(a * 13 + ph[2]);        // ragged outline
      let al = Math.max(0, Math.min(1, (edge - d) / 0.2)); const streak = 0.5 + 0.5 * Math.sin(a * 17 + ph[3] + Math.sin(a * 5) * 2);
      al *= 0.88 + 0.12 * streak;
      const n = (Math.sin(px * 0.21 + py * 0.13) + Math.sin(px * 0.07 - py * 0.19) + Math.sin(px * 0.43 + py * 0.37)) / 3, ash = Math.max(0, n * 0.5 + 0.2) * (1 - d);
      const k = (py * S + px) * 4, v = 14 + ash * 70 + r() * 8;
      img.data[k] = v; img.data[k + 1] = v * 0.95; img.data[k + 2] = v * 0.88; img.data[k + 3] = al * 255;
      const crack = Math.abs(Math.sin(px * 0.11 + Math.sin(py * 0.09) * 2) * Math.sin(py * 0.13 + Math.sin(px * 0.07) * 2)), glow = crack < 0.045 && d < 0.6 && r() > 0.25 ? (1 - crack / 0.045) * (0.4 + r() * 0.6) * (1 - d) : 0;
      eim.data[k] = 255 * glow; eim.data[k + 1] = 90 * glow; eim.data[k + 2] = 10 * glow; eim.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0); e.putImageData(eim, 0, 0);
    const map = new THREE.CanvasTexture(cv), emi = new THREE.CanvasTexture(em); map.colorSpace = THREE.SRGBColorSpace; emi.colorSpace = THREE.SRGBColorSpace; return { map, emi };
  };
  const burnMats = [];
  const burnPatch = (cx, cz, yaw0, size, seed) => {
    const t = makeBurn(seed), g = new THREE.PlaneGeometry(size, size, 36, 36), p = g.attributes.position, ca = Math.cos(yaw0), sa = Math.sin(yaw0);
    for (let i = 0; i < p.count; i++) { const lx = p.getX(i), lz = -p.getY(i), wx = cx + lx * ca + lz * sa, wz = cz - lx * sa + lz * ca; p.setXYZ(i, wx, world.heightAt(wx, wz) + 0.13, wz); }
    g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emi, emissive: new THREE.Color(1, 0.55, 0.2), emissiveIntensity: 1.2, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    burnMats.push(m); const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.renderOrder = 3; mesh.frustumCulled = false; return mesh;
  };
  const gouge = noiseTex((x, S) => {
    x.fillStyle = 'rgba(0,0,0,0)'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 700; i++) { const px = S * (0.3 + rnd() * 0.4) + (rnd() - 0.5) * S * 0.12, py = rnd() * S, r = 3 + rnd() * 14; const a = Math.min(1, (1 - Math.abs(px / S - 0.5) * 3.2)) * (0.15 + 0.3 * rnd()); x.fillStyle = `rgba(${60 + rnd() * 30},${40 + rnd() * 20},${22 + rnd() * 14},${a})`; x.beginPath(); x.ellipse(px, py, r * 0.7, r * 1.6, 0, 0, 7); x.fill(); }
    const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); x.globalCompositeOperation = 'destination-in'; const m = x.createLinearGradient(0, 0, 0, S); m.addColorStop(0, 'rgba(0,0,0,0.0)'); m.addColorStop(0.3, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,1)'); x.fillStyle = m; x.fillRect(0, 0, S, S); x.globalCompositeOperation = 'source-over';
  });
  const back = new THREE.Vector3(-dir.x, 0, -dir.z);
  root.add(burnPatch(c.x, c.z, yaw, 13, 5));                                                                   // main burn under the wreck
  root.add(burnPatch(c.x + back.x * 6 + back.z * 1.5, c.z + back.z * 6 - back.x * 1.5, yaw + 1, 5.5, 17));      // fuel splash along the slide
  root.add(burnPatch(c.x + back.z * 6, c.z - back.x * 6, yaw + 2, 4.5, 29));                                    // under the thrown tail boom
  root.add(burnPatch(c.x - back.z * 5, c.z + back.x * 5, yaw + 3, 4, 41));                                     // scorch near the blades
  root.add(groundPatch(world, c.x + back.x * 11, c.z + back.z * 11, yaw, 4.2, 22, gouge, 0.01, 36));

  // --- the broken helicopter
  const model = wreckModel.clone(true); model.position.set(c.x, 0, c.z); model.rotation.y = yaw + Math.PI;           // wreck is modelled with the nose toward +Z; it slid in nose-first, so it ends up facing back along the path
  model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; if (o.material.name === 'HeliGlass') { o.material.transparent = true; o.material.depthWrite = false; } } });
  root.add(model); model.updateMatrixWorld(true);
  const pos = new THREE.Vector3();
  for (const piece of model.children) {                                                                                  // each piece sits on the real ground under it
    piece.getWorldPosition(pos); piece.position.y += world.heightAt(pos.x, pos.z) - 0; piece.updateMatrixWorld(true);
  }
  model.position.y = 0;
  for (const piece of model.children) {                                                                                  // the torn-off door must not overlap a crate
    if (!/Door/.test(piece.name)) continue;
    piece.getWorldPosition(pos);
    for (const cr of world.crates || []) {
      const dx = pos.x - cr.x, dz = pos.z - cr.z, d = Math.hypot(dx, dz);
      if (d < 2.4) { const k = (2.4 - d) / (d || 1), wp = new THREE.Vector3(pos.x + dx * k, 0, pos.z + dz * k); wp.y = pos.y + world.heightAt(wp.x, wp.z) - world.heightAt(pos.x, pos.z); piece.position.copy(model.worldToLocal(wp)); piece.updateMatrixWorld(true); piece.getWorldPosition(pos); }
    }
    piece.updateMatrixWorld(true);
    let low = 9; const vv = new THREE.Vector3();                                                                       // rest it on the ground: lower it until its lowest point just touches the terrain
    piece.traverse((o) => { if (!o.isMesh) return; const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i += 3) { vv.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); low = Math.min(low, vv.y - world.heightAt(vv.x, vv.z)); } });
    piece.position.y -= low - 0.015; piece.updateMatrixWorld(true);
  }

  // --- shards of metal and glass strewn along the gouge
  // each kind of shard is an irregular torn piece (jagged outline, crumpled), not a neat rectangle
  const mkShard = (seed) => {
    let sd = seed; const r = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296), n = 6 + Math.floor(r() * 3), sh = new THREE.Shape();
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.5, rad = 0.35 + r() * 0.65, x = Math.cos(a) * rad * (0.6 + r() * 0.6), y = Math.sin(a) * rad; i ? sh.lineTo(x, y) : sh.moveTo(x, y); }
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false }); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + Math.sin(p.getX(i) * 5 + seed) * 0.05 * Math.abs(p.getZ(i)) + (p.getX(i) + p.getZ(i)) * 0.08);   // crumple and curl
    g.computeVertexNormals(); return g;
  };
  const shardGeo = [mkShard(3), mkShard(11), mkShard(23), mkShard(37)];
  const mats = [0x8f9396, 0xb0b3b5, 0x6e1212, 0x2a2d30].map((col) => new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, metalness: 0.55, side: THREE.DoubleSide }));
  for (let k = 0; k < mats.length; k++) {
    const im = new THREE.InstancedMesh(shardGeo[k], mats[k], 14), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i < 14; i++) {
      const along = rnd() * 20 - 4, side = (rnd() - 0.5) * 9; p.set(c.x + back.x * along + back.z * side, 0, c.z + back.z * along - back.x * side); p.y = world.heightAt(p.x, p.z) + 0.05;
      e.set((rnd() - 0.5) * 0.5, rnd() * 6.28, (rnd() - 0.5) * 0.5); q.setFromEuler(e); const sz = 0.10 + rnd() * 0.32; s.set(sz, 1, sz * (0.5 + rnd() * 0.8)); m.compose(p, q, s); im.setMatrixAt(i, m);
    }
    im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; root.add(im);
  }
  // --- cargo spilled from the hold: a few bags
  const bagM = new THREE.MeshStandardMaterial({ color: 0x3a4a2a, roughness: 0.95 });
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.45, 4, 8), bagM); const a = rnd() * 6.28, r = 3 + rnd() * 3; b.position.set(c.x + Math.cos(a) * r, world.heightAt(c.x + Math.cos(a) * r, c.z + Math.sin(a) * r) + 0.22, c.z + Math.sin(a) * r); b.rotation.set(1.4, rnd() * 6, rnd()); b.castShadow = true; root.add(b); }
  // --- trees in the blast: those close to the impact are snapped off and flung down as charred logs; further ones get a charred, split stump
  const charM = new THREE.MeshStandardMaterial({ color: 0x1c1612, roughness: 1 }), splM = new THREE.MeshStandardMaterial({ color: 0x8a6a40, roughness: 0.9 });
  const doomed = []; world.itemsNear(c.x, c.z, 11, (o) => { if (o.kind === 'tree') doomed.push(o); });
  for (const o of doomed) {
    const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz) || 1, sc = o.scale || 1;
    const y = world.heightAt(o.x, o.z), s = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * sc, 0.5 * sc, 0.9 + rnd() * 2.4, 9), charM); s.position.set(o.x, y + 0.6, o.z); s.castShadow = true; root.add(s);        // charred stump
    for (let k = 0; k < 4; k++) { const fl = new THREE.Mesh(new THREE.ConeGeometry(0.12 * sc, 0.9 * sc, 5), charM), fa = rnd() * 6.28 + k * 1.57; fl.position.set(o.x + Math.cos(fa) * 0.42 * sc, y + 0.12, o.z + Math.sin(fa) * 0.42 * sc); fl.rotation.set(Math.sin(fa) * 1.1, 0, -Math.cos(fa) * 1.1); root.add(fl); }       // splayed roots
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.28 * sc, 0.8, 7), splM); cap.position.set(o.x, y + 1.5 + rnd(), o.z); cap.rotation.set((rnd() - 0.5) * 0.4, 0, (rnd() - 0.5) * 0.4); root.add(cap);
    if (d < 9) {                                                                                                  // the broken trunk lies outward from the blast
      const len = 3.5 + rnd() * 4.5, log = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * sc, 0.3 * sc, len, 8), charM), a = Math.atan2(dx, dz) + (rnd() - 0.5) * 0.6;
      log.rotation.set(0, 0, Math.PI / 2); const g = new THREE.Group(); g.add(log); log.position.x = len / 2; g.rotation.y = a - Math.PI / 2; g.position.set(o.x, y + 0.3 * sc, o.z); log.castShadow = true; root.add(g);
      const tip = new THREE.Vector3(o.x + Math.sin(a) * len, 0, o.z + Math.cos(a) * len); g.position.y = Math.max(y, world.heightAt(tip.x, tip.z)) + 0.28; g.rotation.z = (world.heightAt(tip.x, tip.z) - y) / len * 0.0;
    }
  }
  scene.add(root); root.visible = false;
  // the felled trees, scorching and wreck all appear in one cheap step, so everything heavy can be built before the crash
  let revealed = false;
  const reveal = () => { if (revealed) return; revealed = true; for (const o of doomed) world.removeItem(o, true); world.blastDamage(c.x, c.z); root.visible = true; };
  // compile every program the crash needs (colour pass and shadow pass) and upload its textures while nothing is on screen
  const warm = (renderer, camera, extra = []) => {
    const objs = [root, ...extra], saved = [];
    for (const r of objs) r.traverse((o) => { saved.push([o, o.visible, o.frustumCulled]); o.frustumCulled = false; });
    for (const r of objs) r.visible = true;
    root.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) for (const k of ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'bumpMap']) if (m[k]) renderer.initTexture(m[k]); });
    const sun = []; scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) sun.push(o); });
    renderer.shadowMap.needsUpdate = true; for (const s of sun) s.shadow.needsUpdate = true;
    renderer.render(scene, camera);
    for (const [o, v, f] of saved) { o.visible = v; o.frustumCulled = f; }
    if (revealed) root.visible = true;
  };
  // body centre for fire and smoke
  const body = model.getObjectByName('WreckBody'); const bc = new THREE.Vector3(); if (body) new THREE.Box3().setFromObject(body).getCenter(bc); else bc.set(c.x, c.y + 1, c.z);
  const top = new THREE.Box3().setFromObject(body || model).max.y;
  const upd = (t) => { for (let i = 0; i < burnMats.length; i++) burnMats[i].emissiveIntensity = 0.9 + 0.5 * Math.sin(t * 2.3 + i * 1.7) * Math.sin(t * 5.1 + i) + 0.3 * Math.random(); };
  if (!deferred) reveal();
  return { update: upd, reveal, warm, root, fire: new THREE.Vector3(bc.x, bc.y + 0.3, bc.z), smoke: new THREE.Vector3(bc.x, top, bc.z), dispose: () => { world.clearBlast(); scene.remove(root); root.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); } };
}
