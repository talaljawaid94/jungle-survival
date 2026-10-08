import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Motion } from './heroMotion.js';

// Survivor model built in Blender (MPFB2 base + custom gear), exported as GLB with a 53-bone game rig.
// The procedural hero in hero.js still computes every pose (walk, run, swim, gather, attack...); this module
// copies those joint rotations onto the GLB skeleton so the animation system is shared.

let loaded = null;
export const hasHeroModel = () => !!loaded;

let motionData = null;
export async function loadHeroMotion(url) { motionData = await (await fetch(url)).json(); }

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
    // the fist: fingers run along the hand's +Y, the handle lies across the palm (hand X axis, index side +X), the palm faces -Z.
    // tools are modelled with the grip at their origin and the working end along +Y, so +Y is turned to point out of the index/thumb side of the fist.
    // measured from the rig's knuckles so it follows this hand's real orientation: handle axis A runs pinky -> index knuckle, F is the finger direction,
    // the palm normal is perpendicular to both and points to the side the fingers curl towards (hand -Z here).
    const hp = (n) => bones[n] ? hand.worldToLocal(bones[n].getWorldPosition(new THREE.Vector3())) : null, ik = hp('index_01_r'), pk = hp('pinky_01_r'), mk = hp('middle_01_r');
    if (ik && pk && mk) {
      const A = ik.clone().sub(pk).normalize(), F = mk.clone().normalize();
      let N = F.clone().cross(A).normalize(); if (N.z > 0) N.negate();               // palm side
      const Fo = A.clone().cross(N).normalize(), Bk = N.clone().negate();            // Fo: finger direction made exactly perpendicular, Bk: back of the hand
      const X = A.clone().cross(Bk).normalize();
      hold.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, A, Bk));
      hold.position.copy(ik.clone().add(pk).multiplyScalar(0.5)).addScaledVector(N, 0.024).addScaledVector(Fo, -0.012); hold.userData.palmN = N; hold.userData.knuckle = hold.position.clone();
    } else { hold.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2); hold.position.set(0.004, 0.094, -0.028); }
    hand.add(hold);
    for (const k in tools) hold.add(tools[k]);
  }

  // finger bones: closing the hand rotates each joint about its local Z. Curl amounts are 0 (rest) .. 1 (fist).
  const FING = {}, FY = new THREE.Vector3(0, 1, 0), FZ = new THREE.Vector3(0, 0, 1), FQ = new THREE.Quaternion();
  for (const side of ['l', 'r']) FING[side] = ['index', 'middle', 'ring', 'pinky'].map((f) => ({ k: f === 'pinky' ? 1.15 : f === 'ring' ? 1.05 : 1.0, j: [1, 2, 3].map((n) => bones[`${f}_0${n}_${side}`]).filter(Boolean).map((b) => ({ b, q0: b.quaternion.clone() })) }));
  const THUMB = { r: ['thumb_01_r', 'thumb_02_r', 'thumb_03_r'].map((n) => bones[n]).filter(Boolean).map((b) => ({ b, q0: b.quaternion.clone() })), l: ['thumb_01_l', 'thumb_02_l', 'thumb_03_l'].map((n) => bones[n]).filter(Boolean).map((b) => ({ b, q0: b.quaternion.clone() })) };
  const ANG = [0.9, 1.25, 0.95];
  const curl = (side, c) => {
    for (const f of FING[side]) f.j.forEach((x, i) => { x.b.quaternion.copy(x.q0).multiply(FQ.setFromAxisAngle(FZ, (side === 'l' ? -1 : 1) * c * f.k * ANG[i])); });
    THUMB[side].forEach((x, i) => { if (x.qf) x.b.quaternion.copy(x.q0).slerp(x.qf, Math.min(1, c * 1.05)); else x.b.quaternion.copy(x.q0).multiply(FQ.setFromAxisAngle(FZ, (side === 'l' ? -1 : 1) * c * [0.25, 0.5, 0.5][i])); });
  };
  // fit the grip point: close the fist once and put the handle in the middle of the cavity the fingers form
  if (hand && hold.userData.palmN) {
    curl('r', 1); root.updateMatrixWorld(true);
    const c = new THREE.Vector3(); let n = 0;
    for (const f of ['index', 'middle', 'ring', 'pinky']) for (const j of [2, 3]) { const b = bones[`${f}_0${j}_r`]; if (b) { c.add(hand.worldToLocal(b.getWorldPosition(new THREE.Vector3()))); n++; } }
    if (n) { c.divideScalar(n); hold.position.copy(c).addScaledVector(hold.userData.palmN, -0.004).add(hold.position.clone().sub(c).multiplyScalar(0.0)); const mid = hold.userData.knuckle; hold.position.lerp(mid, 0.45); }
    curl('r', 0); root.updateMatrixWorld(true);
  }
  // thumb wrap: with the fingers closed, search the thumb's joint angles that bring its pad down onto the first two fingers (on the outside of the fist,
  // away from the handle), so the thumb pins the handle from the other side. Solved per hand at startup, so it follows this rig's bone axes.
  const solveThumb = (side) => {
    const J = THUMB[side]; if (J.length < 3 || !bones[`index_02_${side}`] || !bones[`middle_02_${side}`]) return;
    curl(side, 1); J.forEach((x) => x.b.quaternion.copy(x.q0)); root.updateMatrixWorld(true);
    const W = (n) => bones[n].getWorldPosition(new THREE.Vector3()), cen = new THREE.Vector3(); let n = 0;
    for (const f of ['index', 'middle', 'ring', 'pinky']) for (const j of [2, 3]) { cen.add(W(`${f}_0${j}_${side}`)); n++; }
    cen.divideScalar(n).lerp(W(`index_01_${side}`).add(W(`pinky_01_${side}`)).multiplyScalar(0.5), 0.45);       // middle of the cavity the fingers form
    const M = W(`index_02_${side}`).add(W(`middle_02_${side}`)).multiplyScalar(0.5), T = M.clone().add(M.clone().sub(cen).normalize().multiplyScalar(0.017));
    const AX = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)], P = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], q = new THREE.Quaternion(), t = new THREE.Quaternion(), p3 = new THREE.Vector3(), p2 = new THREE.Vector3();
    const apply = () => { J.forEach((x, i) => { q.identity(); for (let a = 0; a < 3; a++) q.multiply(t.setFromAxisAngle(AX[a], P[i][a])); x.b.quaternion.copy(x.q0).multiply(q); }); J[0].b.updateMatrixWorld(true); };
    const cost = () => { J[2].b.getWorldPosition(p3); J[1].b.getWorldPosition(p2); const tip = p3.clone().add(p3.clone().sub(p2).normalize().multiplyScalar(0.026)); let r = 0; for (const row of P) for (const v of row) r += v * v; return tip.distanceToSquared(T) + 0.0006 * r; };
    for (let pass = 0; pass < 6; pass++) for (let i = 0; i < 3; i++) for (let a = 0; a < 3; a++) {
      let best = P[i][a], bc = Infinity; for (let v = -1.3; v <= 1.3001; v += 0.1) { P[i][a] = v; apply(); const c = cost(); if (c < bc) { bc = c; best = v; } } P[i][a] = best;
    }
    apply(); J.forEach((x) => { x.qf = x.b.quaternion.clone(); x.b.quaternion.copy(x.q0); }); root.updateMatrixWorld(true);
  };
  solveThumb('r'); solveThumb('l');
  const motion = motionData ? new Motion(motionData) : null;
  const acc = {}, _p = new THREE.Quaternion(), _m = new THREE.Quaternion(), _d = new THREE.Quaternion();
  // mot = { mocapW, procW: {bone: weight}, lift } blends the procedural pose (tools, attacks, crouching...) with the motion-capture pose
  const sync = (J, pelvisY, mot) => {
    for (const k in acc) delete acc[k];
    for (const [jn, bn, w] of MAP) {
      const j = J[jn]; if (!j || !bones[bn]) continue;
      _e.set(j.g.rotation.x, j.g.rotation.y, j.g.rotation.z, 'XYZ'); const q = new THREE.Quaternion().setFromEuler(_e);
      if (w !== 1) q.slerp(_id, 1 - w);
      acc[bn] = acc[bn] ? acc[bn].multiply(q) : q;
    }
    for (const bn in acc) if (R0[bn]) acc[bn].multiply(R0[bn]);
    const mw = mot && motion ? mot.mocapW : 0, names = new Set(Object.keys(acc));
    if (mw > 0.001) for (const bn of motion.bones) names.add(bn);
    for (const bn of names) {
      const r = rest[bn], b = bones[bn]; if (!b) continue;
      if (acc[bn]) _p.copy(r.Pi).multiply(acc[bn]).multiply(r.Pr).multiply(r.q0); else _p.copy(r.q0);
      const pose = mw > 0.001 && motion.pose[bn];
      if (pose) {
        if (bn === 'neck_01' || bn === 'head') { _m.copy(pose).multiply(_d.copy(r.q0).invert().multiply(_p)); b.quaternion.copy(_p).slerp(_m, mw); }   // mocap plus the procedural look-around
        else b.quaternion.copy(_p).slerp(pose, mw * (1 - ((mot.procW && mot.procW[bn]) || 0)));
      } else b.quaternion.copy(_p);
    }
    if (mot) { curl('r', mot.curlR || 0); curl('l', mot.curlL || 0); if (mot.rollR && bones.hand_r) bones.hand_r.quaternion.multiply(_d.setFromAxisAngle(FY, mot.rollR)); }       // wrist roll turns the fist so the tool points the way it is carried
    const pb = bones.pelvis;
    if (pb) {
      _v.set(0, pelvisY - 0.93, 0).applyQuaternion(rest.pelvis.Pi); pb.position.copy(rest.pelvis.p0).add(_v);
      if (mw > 0.001) { const lift = (mot.lift || 0) - (mot.drop || 0); const mp = rest.pelvis.p0.clone().add(motion.hips).add(new THREE.Vector3(0, lift, 0).applyQuaternion(rest.pelvis.Pi)); pb.position.lerp(mp, mw); }
    }
  };
  return { root, bones, sync, hold, motion };
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
