import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { clamp } from './noise.js';

// Blender-built animals (GLB with a game rig). Each species has an animate(a, dt) that drives bones procedurally.
const loaded = {};
export const hasAnimalModel = (type) => !!loaded[type];
export async function loadAnimalModel(type, url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  loaded[type] = gltf.scene;
}

const _e = new THREE.Euler(), _id = new THREE.Quaternion();
const MODEL_SCALE = { rabbit: 0.82 };       // the rabbit is modelled a little large so its detail reads; this brings it to a believable size

function rigOf(root) {
  const bones = {}, rest = {};
  root.updateMatrixWorld(true);
  root.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  for (const n in bones) {
    const b = bones[n], P = new THREE.Quaternion(); if (b.parent) b.parent.getWorldQuaternion(P);
    rest[n] = { q0: b.quaternion.clone(), p0: b.position.clone(), Pr: P, Pi: P.clone().invert() };
  }
  // pose a bone: rotation (x,y,z) given in model axes, applied on top of the rest pose
  const D = {};
  const rot = (name, x = 0, y = 0, z = 0) => { D[name] = (D[name] || new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromEuler(_e.set(x, y, z, 'XYZ'))); };
  const flush = () => {
    for (const n in bones) {
      const r = rest[n], d = D[n] || _id; bones[n].quaternion.copy(r.Pi).multiply(d).multiply(r.Pr).multiply(r.q0);
    }
    for (const k in D) delete D[k];
  };
  return { bones, rest, rot, flush };
}


// ---- shell fur: the body is re-drawn in thin layers pushed out along the normals. Each layer is alpha-cut from a "strand height" map made of
// thousands of tiny cones, so layers narrow toward the tip like real hairs; strands are combed backwards and sag with gravity.
const furTex = {};
function furStrandTex(key, n, r) {
  if (furTex[key]) return furTex[key];
  const S = 256, h = new Float32Array(S * S); let seed = 11 + n; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < n; i++) {
    const cx = rnd() * S, cy = rnd() * S, ht = 0.45 + rnd() * 0.55, rr = r * (0.7 + rnd() * 0.6), R = Math.ceil(rr) + 1;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const d = Math.hypot(dx, dy) / rr; if (d >= 1) continue; const x = (Math.floor(cx) + dx + S) % S, y = (Math.floor(cy) + dy + S) % S, v = ht * (1 - d);
      if (v > h[y * S + x]) h[y * S + x] = v;
    }
  }
  const d = new Uint8Array(S * S * 4); for (let i = 0; i < S * S; i++) { const v = Math.floor(255 * Math.min(1, h[i] * 1.15)); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  const t = new THREE.DataTexture(d, S, S, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return (furTex[key] = t);
}
export const furCam = new THREE.Vector3();
export const setFurCamera = (p) => furCam.copy(p);

const FUR = {
  deer:   { layers: 12, length: 0.034, density: 30, strands: 5200, r: 1.7, droop: 0.22, comb: 0.45 },
  boar:   { layers: 12, length: 0.055, density: 22, strands: 3200, r: 2.1, droop: 0.12, comb: 0.35 },
  jaguar: { layers: 9,  length: 0.014, density: 34, strands: 6500, r: 1.5, droop: 0.10, comb: 0.5 },
  rabbit: { layers: 9,  length: 0.011, density: 44, strands: 6000, r: 1.5, droop: 0.06, comb: 0.4, legY: [0.10, 0.04], headZ: [0.20, 0.32] },
};
function addFurShells(model, type) {
  const cfg = FUR[type]; if (!cfg) return [];
  let body = null;
  model.traverse((o) => { if (o.isSkinnedMesh && o.geometry.attributes.color && (!body || o.geometry.attributes.position.count > body.geometry.attributes.position.count)) body = o; });
  if (!body) return [];
  const shells = [], tex = furStrandTex(type, cfg.strands, cfg.r).clone(); tex.needsUpdate = true; tex.repeat.set(cfg.density, cfg.density);
  for (let i = 1; i <= cfg.layers; i++) {
    const f = i / cfg.layers, m = body.material.clone();
    m.map = body.material.map; m.vertexColors = true; m.alphaMap = tex; m.alphaTest = 0.06 + 0.8 * f; m.transparent = false; m.roughness = 1; m.metalness = 0;
    m.color = new THREE.Color().setScalar(0.5 + 0.6 * f); m.emissive = new THREE.Color(0, 0, 0); m.side = THREE.FrontSide;
    const off = cfg.length * f;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uOff = { value: off };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uOff;').replace('#include <begin_vertex>',
        'vec3 nn = normalize(normal); float fk = mix(1.0, 0.35, smoothstep(' + (cfg.legY || [0.40, 0.20])[0].toFixed(3) + ', ' + (cfg.legY || [0.40, 0.20])[1].toFixed(3) + ', position.y)) * mix(1.0, 0.35, smoothstep(' + (cfg.headZ || [0.68, 0.85])[0].toFixed(3) + ', ' + (cfg.headZ || [0.68, 0.85])[1].toFixed(3) + ', position.z));' +
        'vec3 transformed = vec3(position) + nn * uOff * fk + vec3(0.0, -' + cfg.droop.toFixed(3) + ' * uOff * fk * (1.0 + uOff * 8.0), -' + cfg.comb.toFixed(3) + ' * uOff * fk * max(0.0, 1.0 - abs(nn.y)));');
    };
    m.customProgramCacheKey = () => 'fur' + type + i;
    const sm = new THREE.SkinnedMesh(body.geometry, m); sm.bind(body.skeleton, body.bindMatrix); sm.frustumCulled = false; sm.castShadow = false; sm.receiveShadow = true;
    body.parent.add(sm); shells.push(sm);
  }
  return shells;
}

export function buildAnimalGLB(type, sp) {
  const src = loaded[type]; const model = cloneSkinned(src); const g = new THREE.Group(); const holder = new THREE.Group(); holder.scale.setScalar(MODEL_SCALE[type] || 1); holder.add(model); g.add(holder);   // the exported models face +Z, which is the game's forward (animals move along sin(heading), cos(heading))
  const mats = [];
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      o.material = o.material.clone(); if (o.material.emissive) { o.material.emissiveIntensity = 1; mats.push(o.material); }
      if (o.material.map) o.material.map.anisotropy = 8; if (o.material.sheen !== undefined) o.material.sheen = 0;
    }
  });
  const R = rigOf(model), st = { t: Math.random() * 10, graze: 0, flick: 0, earT: 0 };
  const shells = addFurShells(model, type), _wp = new THREE.Vector3(); for (const s of shells) mats.push(s.material);
  const animate = type === 'deer' ? deerAnimate : type === 'boar' ? boarAnimate : type === 'jaguar' ? jaguarAnimate : type === 'rabbit' ? rabbitAnimate : () => {};
  function run(a, dt) {
    st.t += dt; animate(R, st, a, dt);
    if (shells.length) { g.getWorldPosition(_wp); const d = _wp.distanceTo(furCam); for (let i = 0; i < shells.length; i++) shells[i].visible = d < 14 || (d < 28 && i % 3 === 2); }
    const hit = Math.max(0, a.hitFlash || 0); if (hit > 0) a.hitFlash = hit - dt * 5;
    for (const m of mats) m.emissive.setRGB(hit * 0.6, 0, 0);
    R.flush();
  }
  g.userData = { height: 1.0 };
  return { g, legs: [], head: g, tail: g, animate: run, spec: sp, bones: R.bones };
}

function deerAnimate(R, st, a, dt) {
  const { rot, bones, rest } = R; const t = st.t, spd = a.speed, run = spd > 3.2, moving = spd > 0.15, ph = a.phase * 2.2;
  const amp = clamp(spd / 1.6, 0, 1) * 0.55 + (run ? 0.35 : 0), lifted = clamp(spd / 1.6, 0, 1) * 0.7 + (run ? 0.5 : 0);
  const phase = (pair) => ph + (run ? (pair === 0 ? 0 : 1.7) : (pair === 0 ? 0 : Math.PI));       // walk: diagonal pairs; run: bounding gait
  const leg = (pre, side, pair, front) => {
    const p = phase(pair), sw = Math.sin(p) * (moving ? amp : 0), lift = Math.max(0, Math.cos(p)) * (moving ? lifted : 0);
    if (front) { rot(`f_upper_${side}`, -sw * 0.55 + 0.05); rot(`f_lower_${side}`, lift * 1.1); rot(`f_cannon_${side}`, lift * 0.5 - sw * 0.1); rot(`f_hoof_${side}`, lift * 0.3); }
    else { rot(`h_thigh_${side}`, -sw * 0.5 - 0.05); rot(`h_shin_${side}`, lift * 0.7 + sw * 0.15); rot(`h_cannon_${side}`, -lift * 1.0); rot(`h_hoof_${side}`, lift * 0.4); }
  };
  leg('f', 'l', 0, true); leg('f', 'r', 1, true); leg('h', 'l', 1, false); leg('h', 'r', 0, false);
  // body: bob and roll
  const breathe = Math.sin(t * 2.2) * 0.012;
  if (bones.root) bones.root.position.copy(rest.root.p0).add(new THREE.Vector3(0, (moving ? Math.abs(Math.sin(ph)) * (run ? 0.06 : 0.015) : 0), 0).applyQuaternion(rest.root.Pi));
  rot('spine1', breathe + (moving && run ? Math.sin(ph) * 0.06 : 0), 0, moving ? Math.sin(ph * 0.5) * 0.03 : 0); rot('spine2', breathe * 0.5, moving ? Math.sin(ph * 0.5) * -0.05 : 0, 0);
  // head and neck: graze when idle, alert head when running, look around
  const idle = !moving && a.state === 'idle';
  st.graze += ((idle && Math.sin(t * 0.25 + a.phase) > 0.45 ? 1 : 0) - st.graze) * Math.min(1, dt * 1.4);
  const alert = a.state === 'chase' || a.state === 'flee' ? -0.12 : 0;
  rot('neck1', st.graze * 0.55 + alert + (moving ? Math.sin(ph) * 0.05 : 0)); rot('neck2', st.graze * 0.65 + alert * 0.5); rot('head', st.graze * 0.2 - 0.1 * (1 - st.graze) + (moving ? Math.sin(ph) * 0.04 : 0));
  const look = idle ? Math.sin(t * 0.5 + a.phase) * 0.45 * (1 - st.graze) : 0; rot('neck2', 0, look * 0.6); rot('head', 0, look * 0.6);
  // tail + ears
  rot('tail', 0.4 + (a.state === 'flee' ? -0.5 : 0), 0, Math.sin(t * (a.state === 'flee' ? 7 : 2) + a.phase) * 0.18);
  st.flick -= dt; if (st.flick <= 0 && Math.random() < dt * 0.35) st.flick = 0.28;
  const fl = st.flick > 0 ? Math.sin(st.flick * 45) * 0.35 : 0;
  rot('ear_l', 0, 0, 0.05 + fl + (a.state === 'chase' ? -0.15 : 0)); rot('ear_r', 0, 0, -0.05 - fl * 0.6 + Math.sin(t * 0.7 + a.phase) * 0.1);
}

function boarAnimate(R, st, a, dt) {
  const { rot, bones, rest } = R; const t = st.t, spd = a.speed, run = spd > 3.0, moving = spd > 0.15, ph = a.phase * 2.4, charging = a.state === 'chase';
  const amp = clamp(spd / 1.4, 0, 1) * 0.5 + (run ? 0.3 : 0), lifted = clamp(spd / 1.4, 0, 1) * 0.6 + (run ? 0.4 : 0);
  const leg = (side, pair, front) => {
    const p = ph + (run ? (pair === 0 ? 0 : 1.5) : (pair === 0 ? 0 : Math.PI)), sw = Math.sin(p) * (moving ? amp : 0), lift = Math.max(0, Math.cos(p)) * (moving ? lifted : 0);
    if (front) { rot(`f_upper_${side}`, -sw * 0.6 + 0.04); rot(`f_lower_${side}`, lift * 1.0); rot(`f_hoof_${side}`, lift * 0.35); }
    else { rot(`h_thigh_${side}`, -sw * 0.55 - 0.04); rot(`h_shin_${side}`, lift * 0.8 + sw * 0.1); rot(`h_hoof_${side}`, -lift * 0.5); }
  };
  leg('l', 0, true); leg('r', 1, true); leg('l', 1, false); leg('r', 0, false);
  const breathe = Math.sin(t * 2.6) * 0.012;
  if (bones.root) bones.root.position.copy(rest.root.p0).add(new THREE.Vector3(0, moving ? Math.abs(Math.sin(ph)) * (run ? 0.04 : 0.012) : 0, 0).applyQuaternion(rest.root.Pi));
  rot('spine1', breathe + (moving && run ? Math.sin(ph) * 0.05 : 0), moving ? Math.sin(ph * 0.5) * 0.04 : 0, moving ? Math.sin(ph * 0.5) * 0.03 : 0); rot('spine2', breathe * 0.5, moving ? -Math.sin(ph * 0.5) * 0.05 : 0, 0);
  // head: sniffs and roots when idle, drops and charges when chasing
  const idle = !moving && a.state === 'idle';
  st.graze += ((idle && Math.sin(t * 0.35 + a.phase) > 0.2 ? 1 : 0) - st.graze) * Math.min(1, dt * 1.6);
  const root = st.graze * (0.45 + Math.sin(t * 5) * 0.08), dip = charging ? 0.3 : 0;
  rot('neck', root * 0.6 + dip * 0.6 + (moving ? Math.sin(ph) * 0.05 : 0)); rot('head', root * 0.7 + dip * 0.5 + Math.sin(t * 1.3 + a.phase) * 0.04, idle ? Math.sin(t * 0.6 + a.phase) * 0.3 * (1 - st.graze) : 0);
  rot('tail', 0.2, 0, Math.sin(t * (moving ? 6 : 2.4) + a.phase) * 0.25);
  st.flick -= dt; if (st.flick <= 0 && Math.random() < dt * 0.3) st.flick = 0.25; const fl = st.flick > 0 ? Math.sin(st.flick * 45) * 0.3 : 0;
  rot('ear_l', 0, 0, fl + (charging ? -0.2 : 0)); rot('ear_r', 0, 0, -fl * 0.7 + Math.sin(t * 0.8 + a.phase) * 0.08);
}

function jaguarAnimate(R, st, a, dt) {
  const { rot, bones, rest } = R; const t = st.t, spd = a.speed, run = spd > 4.0, moving = spd > 0.2, ph = a.phase * 2.6, chase = a.state === 'chase', strike = (a.atkCd || 0) > 0.95;
  const amp = clamp(spd / 1.8, 0, 1) * 0.55 + (run ? 0.5 : 0), lifted = clamp(spd / 1.8, 0, 1) * 0.7 + (run ? 0.45 : 0);
  const leg = (side, pair, front) => {
    const p = ph + (run ? (front ? 0 : 1.9) : (pair === 0 ? 0 : Math.PI)), sw = Math.sin(p) * (moving ? amp : 0), lift = Math.max(0, Math.cos(p)) * (moving ? lifted : 0);
    if (front) { rot(`f_upper_${side}`, -sw * 0.65 + (strike ? -1.1 : 0.05)); rot(`f_lower_${side}`, lift * 1.1 + (strike ? 0.6 : 0)); rot(`f_paw_${side}`, lift * 0.5 + (strike ? -0.4 : 0)); }
    else { rot(`h_thigh_${side}`, -sw * 0.6 - 0.05); rot(`h_shin_${side}`, lift * 0.9 + sw * 0.15); rot(`h_paw_${side}`, -lift * 0.7); }
  };
  leg('l', 0, true); leg('r', 1, true); leg('l', 1, false); leg('r', 0, false);
  const crouch = chase && !run ? 0.18 : 0, breathe = Math.sin(t * 2.0) * 0.012;
  if (bones.root) bones.root.position.copy(rest.root.p0).add(new THREE.Vector3(0, (moving ? Math.abs(Math.sin(ph)) * (run ? 0.05 : 0.01) : 0) - crouch * 0.12, 0).applyQuaternion(rest.root.Pi));
  rot('spine1', breathe + (run ? Math.sin(ph) * 0.13 : 0) + crouch * 0.3 + (strike ? -0.32 : 0), moving ? Math.sin(ph * 0.5) * 0.05 : 0, moving ? Math.sin(ph * 0.5) * 0.03 : 0); rot('spine2', breathe * 0.5 + (run ? -Math.sin(ph) * 0.1 : 0) + crouch * 0.2 + (strike ? -0.22 : 0), moving ? -Math.sin(ph * 0.5) * 0.05 : 0, 0);
  // head: low and steady when stalking, looks around when idle
  const idle = !moving && a.state === 'idle', look = idle ? Math.sin(t * 0.45 + a.phase) * 0.55 : 0;
  rot('neck', crouch * 0.9 + (chase ? 0.15 : 0) + (moving ? Math.sin(ph) * 0.04 : 0), look * 0.5); rot('head', crouch * 0.4 + (strike ? -0.25 : 0), look * 0.6);
  // tail: a lazy S sway, lashing when hunting
  const lash = chase ? 0.55 : 0.2, sp = chase ? 4.0 : 1.5;
  rot('tail1', -0.05 + Math.sin(t * sp + a.phase) * 0.05, Math.sin(t * sp * 0.8 + a.phase) * lash * 0.5); rot('tail2', 0, Math.sin(t * sp * 0.8 + a.phase - 0.8) * lash * 0.7); rot('tail3', 0, Math.sin(t * sp * 0.8 + a.phase - 1.6) * lash);
  st.flick -= dt; if (st.flick <= 0 && Math.random() < dt * 0.3) st.flick = 0.25; const fl = st.flick > 0 ? Math.sin(st.flick * 45) * 0.25 : 0;
  rot('ear_l', 0, 0, fl + (chase ? 0.25 : 0)); rot('ear_r', 0, 0, -fl * 0.7 - (chase ? 0.25 : 0));
}

// rabbit: hops. Airborne while sin(ph) > 0 (front legs reach, hind legs trail), gathers on the ground between hops; twitches and flicks its ears at rest.
function rabbitAnimate(R, st, a, dt) {
  const { rot, bones, rest } = R; const t = st.t, spd = a.speed, moving = spd > 0.25, run = spd > 3.0, ph = a.phase * 0.8;
  const s = Math.sin(ph), air = moving ? Math.max(0, s) : 0, gather = moving ? Math.max(0, -s) : 0, hopH = run ? 0.20 : 0.07;
  const fl = (side) => {
    rot(`f_upper_${side}`, -0.9 * air + 0.25 * gather, 0, 0); rot(`f_lower_${side}`, 0.5 * air - 0.2 * gather, 0, 0); rot(`f_paw_${side}`, -0.3 * air, 0, 0);
    rot(`h_thigh_${side}`, 0.85 * air * (run ? 1 : 0.6) - 0.35 * gather, 0, 0); rot(`h_shin_${side}`, -0.6 * air + 0.35 * gather, 0, 0); rot(`h_foot_${side}`, -0.45 * air + 0.2 * gather, 0, 0);
  };
  fl('l'); fl('r');
  if (bones.root) bones.root.position.copy(rest.root.p0).add(new THREE.Vector3(0, air * hopH - gather * 0.012, 0).applyQuaternion(rest.root.Pi));
  const breathe = Math.sin(t * 3.2) * 0.012;
  rot('spine1', breathe + (moving ? -0.22 * air + 0.12 * gather + (run ? -0.05 : 0) : 0), 0, 0); rot('spine2', breathe * 0.6 + (moving ? -0.18 * air + 0.10 * gather : 0), 0, 0);
  const idle = !moving, twitch = idle ? Math.max(0, Math.sin(t * 2.1 + a.phase)) ** 6 : 0, look = idle ? Math.sin(t * 0.5 + a.phase) * 0.45 : 0;
  rot('neck', (moving ? 0.25 * air - 0.1 * gather : 0.05 + (idle ? 0.1 : 0)), look * 0.4, 0); rot('head', (moving ? -0.15 * air : 0) + Math.sin(t * 22) * 0.025 * twitch, look * 0.6, 0);
  st.flick -= dt; if (st.flick <= 0 && Math.random() < dt * 0.5) st.flick = 0.3; const f = st.flick > 0 ? Math.sin(st.flick * 40) * 0.2 : 0;
  const back = run ? 0.9 : moving ? 0.35 : 0;                                             // ears lay back when running
  rot('ear_l', back + f, 0, 0.12 + Math.sin(t * 0.7 + a.phase) * 0.06); rot('ear_r', back - f * 0.6, 0, -0.12 - Math.sin(t * 0.6 + a.phase) * 0.06);
  rot('tail', 0.1 * air, 0, 0);
}
