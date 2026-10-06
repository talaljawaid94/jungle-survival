import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Survivor model built in Blender (MPFB2 base + custom gear), exported as GLB with a 53-bone game rig.
// The procedural hero in hero.js still computes every pose (walk, run, swim, gather, attack...); this module
// copies those joint rotations onto the GLB skeleton so the animation system is shared.

let loaded = null;
export const hasHeroModel = () => !!loaded;

export async function loadHeroModel(url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  loaded = gltf.scene;
  return loaded;
}

// joint name in hero.js -> [bone, share of the joint rotation]
const MAP = [
  ['pelvis', 'pelvis', 1],
  ['spine', 'spine_01', 0.34], ['spine', 'spine_02', 0.33], ['spine', 'spine_03', 0.33], ['chest', 'spine_03', 1],
  ['neck', 'neck_01', 1], ['head', 'head', 1],
  ['hipL', 'thigh_l', 1], ['hipR', 'thigh_r', 1], ['kneeL', 'calf_l', 1], ['kneeR', 'calf_r', 1], ['ankleL', 'foot_l', 1], ['ankleR', 'foot_r', 1],
  ['shL', 'upperarm_l', 1], ['shR', 'upperarm_r', 1], ['elL', 'lowerarm_l', 1], ['elR', 'lowerarm_r', 1], ['wrL', 'hand_l', 1], ['wrR', 'hand_r', 1],
];
const ARM_ADDUCT = 0.72;                    // the rig rests in an A-pose; hero.js poses assume arms hanging straight down

const _e = new THREE.Euler(), _id = new THREE.Quaternion(), _v = new THREE.Vector3();

export function createModelRig(tools) {
  const root = loaded; if (!root) return null;
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; fixMaterial(o); } });
  root.updateMatrixWorld(true);
  const bones = {}, rest = {};
  root.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  for (const n in bones) {
    const b = bones[n], P = new THREE.Quaternion(); if (b.parent) b.parent.getWorldQuaternion(P);
    const C = new THREE.Quaternion(); b.getWorldQuaternion(C);
    rest[n] = { q0: b.quaternion.clone(), p0: b.position.clone(), Pr: P, Pi: P.clone().invert(), Cr: C };
  }
  const R0 = { upperarm_l: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -ARM_ADDUCT), upperarm_r: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ARM_ADDUCT) };

  // held tools: a group on the right hand whose frame matches the procedural hand (hanging, fingers down)
  const hand = bones.hand_r, hold = new THREE.Group();
  if (hand) {
    const K = rest.hand_r.Cr.clone().invert().multiply(R0.upperarm_r.clone().invert());       // procedural frame expressed in the hand bone's space
    hold.quaternion.copy(K); hold.position.set(0, -0.075, 0.012).applyQuaternion(K); hand.add(hold);
    for (const k in tools) hold.add(tools[k]);
  }

  const acc = {};
  const sync = (J, pelvisY) => {
    for (const k in acc) delete acc[k];
    for (const [jn, bn, w] of MAP) {
      const j = J[jn]; if (!j || !bones[bn]) continue;
      _e.set(j.g.rotation.x, j.g.rotation.y, j.g.rotation.z, 'XYZ'); const q = new THREE.Quaternion().setFromEuler(_e);
      if (w !== 1) q.slerp(_id, 1 - w);
      acc[bn] = acc[bn] ? acc[bn].multiply(q) : q;
    }
    for (const bn in acc) {
      const r = rest[bn], D = acc[bn]; if (R0[bn]) D.multiply(R0[bn]);
      bones[bn].quaternion.copy(r.Pi).multiply(D).multiply(r.Pr).multiply(r.q0);
    }
    const pb = bones.pelvis; if (pb) { _v.set(0, pelvisY - 0.93, 0).applyQuaternion(rest.pelvis.Pi); pb.position.copy(rest.pelvis.p0).add(_v); }
  };
  return { root, bones, sync, hold };
}

function fixMaterial(m) {
  const mats = Array.isArray(m.material) ? m.material : [m.material];
  for (const mat of mats) {
    if (!mat) continue; const n = (mat.name || '').toLowerCase();
    if (/hair|eyebrow|eyelash/.test(n)) { mat.transparent = false; mat.alphaTest = 0.45; mat.side = THREE.DoubleSide; mat.depthWrite = true; }
    if (/skin/.test(n)) { mat.roughness = 0.62; mat.metalness = 0; }
    if (mat.sheen !== undefined) mat.sheen = 0;
    if (mat.map) mat.map.anisotropy = 8;
    mat.envMapIntensity = 0.9;
  }
}
