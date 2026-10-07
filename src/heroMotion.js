import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Motion-capture locomotion for the survivor.
// 1) bakeMotion() (dev tool, run once) retargets the Idle / Walk / Run clips of a Mixamo-rigged soldier (three.js example asset) onto the
//    survivor's skeleton and returns a small JSON of per-bone local rotations, one entry per animation frame.
// 2) Motion (runtime) loads that JSON and, every frame, blends the three clips by movement speed with a shared gait phase, so the feet stay
//    planted and walk <-> run transitions are smooth.

// [source bone, target bone, mode, source child, target child]. 'delta' copies the world-space rotation change; 'aim' points the target
// bone at the same world direction as the source (needed for the arms: the soldier rests in a T-pose, the survivor in an A-pose).
const PAIRS = [
  ['Hips', 'pelvis', 'delta'], ['Spine', 'spine_01', 'delta'], ['Spine1', 'spine_02', 'delta'], ['Spine2', 'spine_03', 'delta'], ['Neck', 'neck_01', 'delta'], ['Head', 'head', 'delta'],
  ['LeftUpLeg', 'thigh_l', 'delta'], ['LeftLeg', 'calf_l', 'delta'], ['LeftFoot', 'foot_l', 'delta'], ['LeftToeBase', 'ball_l', 'delta'],
  ['RightUpLeg', 'thigh_r', 'delta'], ['RightLeg', 'calf_r', 'delta'], ['RightFoot', 'foot_r', 'delta'], ['RightToeBase', 'ball_r', 'delta'],
  ['LeftShoulder', 'clavicle_l', 'aim', 'LeftArm', 'upperarm_l'], ['LeftArm', 'upperarm_l', 'aim', 'LeftForeArm', 'lowerarm_l'], ['LeftForeArm', 'lowerarm_l', 'aim', 'LeftHand', 'hand_l'], ['LeftHand', 'hand_l', 'aim', 'LeftHandMiddle1', 'middle_01_l'],
  ['RightShoulder', 'clavicle_r', 'aim', 'RightArm', 'upperarm_r'], ['RightArm', 'upperarm_r', 'aim', 'RightForeArm', 'lowerarm_r'], ['RightForeArm', 'lowerarm_r', 'aim', 'RightHand', 'hand_r'], ['RightHand', 'hand_r', 'aim', 'RightHandMiddle1', 'middle_01_r'],
];
export const MOTION_BONES = PAIRS.map((p) => p[1]);
const CLIPS = { idle: 'Idle', walk: 'Walk', run: 'Run' };
const FPS = 30;

const r4 = (v) => Math.round(v * 10000) / 10000;
// natural ground speeds (m/s) measured in the game: the planted foot's backward speed with each clip played at 1x on the survivor
const CALIBRATED = { idle: 0, walk: 1.56, run: 4.2 };

// ---------------------------------------------------------------------------------------------------------------------- bake (dev tool)
export async function bakeMotion(soldierUrl, heroUrl) {
  const [sg, hg] = await Promise.all([new GLTFLoader().loadAsync(soldierUrl), new GLTFLoader().loadAsync(heroUrl)]);
  const S = sg.scene, T = hg.scene; S.updateMatrixWorld(true); T.updateMatrixWorld(true);
  const sNode = (n) => S.getObjectByName('mixamorig' + n) || S.getObjectByName('mixamorig:' + n);
  const tNode = (n) => T.getObjectByName(n);
  const wq = (o) => o.getWorldQuaternion(new THREE.Quaternion()), wp = (o) => o.getWorldPosition(new THREE.Vector3());
  // the soldier faces -Z and the survivor +Z: turn every source reading 180 degrees about the vertical axis
  const FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  const wqS = (o) => wq(o).premultiply(FLIP), wpS = (o) => { const v = wp(o); v.x = -v.x; v.z = -v.z; return v; };

  // rest data
  const mapped = {}, order = [];
  T.traverse((o) => { if (o.isBone) order.push(o); });
  for (const [sn, tn, mode, sc, tc] of PAIRS) {
    const s = sNode(sn), t = tNode(tn); if (!s || !t) { console.warn('bake: missing', sn, tn); continue; }
    mapped[tn] = { s, t, mode, sc: sc && sNode(sc), tc: tc && tNode(tc), sRestQ: wqS(s), tRestQ: wq(t), sRestDir: null, tRestDir: null };
    const m = mapped[tn];
    if (mode === 'aim' && m.sc && m.tc) { m.sRestDir = wpS(m.sc).sub(wpS(s)).normalize(); m.tRestDir = wp(m.tc).sub(wp(t)).normalize(); }
  }
  const restLocal = new Map(order.map((b) => [b, b.quaternion.clone()]));
  const parentRestW = new Map(); for (const b of order) parentRestW.set(b, b.parent ? wq(b.parent) : new THREE.Quaternion());
  const hipsS = sNode('Hips'), hipsT = tNode('pelvis'), hipsRestS = wpS(hipsS), hipsRestT = wp(hipsT), scale = hipsRestT.y / hipsRestS.y;
  const tPelvisRestLocal = hipsT.position.clone(), pelvisPr = wq(hipsT.parent).invert();

  const out = { fps: FPS, bones: MOTION_BONES.filter((b) => mapped[b]), scale: r4(scale), clips: {} };
  const mixer = new THREE.AnimationMixer(S);
  for (const [key, cname] of Object.entries(CLIPS)) {
    const clip = sg.animations.find((a) => a.name === cname); const N = Math.round(clip.duration * FPS), act = mixer.clipAction(clip); act.play();
    const q = out.bones.map(() => new Array(N * 4)), hips = new Array(N * 3), footL = [], footY = [];
    for (let f = 0; f < N; f++) {
      mixer.setTime(f / FPS); S.updateMatrixWorld(true);
      const Wt = new Map();
      for (const b of order) {
        const pW = b.parent && Wt.has(b.parent) ? Wt.get(b.parent) : parentRestW.get(b), m = mapped[b.name]; let W;
        if (!m) W = pW.clone().multiply(restLocal.get(b));
        else {
          const sAnim = wqS(m.s), delta = sAnim.clone().multiply(m.sRestQ.clone().invert());
          if (m.mode === 'aim' && m.sRestDir) {
            const dirS = wpS(m.sc).sub(wpS(m.s)).normalize();
            const swing = new THREE.Quaternion().setFromUnitVectors(m.tRestDir, dirS);
            // twist of the source about its own bone direction (forearm and hand roll)
            const ax = dirS, v = new THREE.Vector3(delta.x, delta.y, delta.z), pr = ax.clone().multiplyScalar(v.dot(ax));
            const twist = new THREE.Quaternion(pr.x, pr.y, pr.z, delta.w); if (twist.lengthSq() < 1e-8) twist.identity(); twist.normalize();
            W = twist.multiply(swing).multiply(m.tRestQ);
          } else W = delta.multiply(m.tRestQ);
        }
        Wt.set(b, W);
        if (m) { const local = pW.clone().invert().multiply(W); if (local.w < 0) { local.x *= -1; local.y *= -1; local.z *= -1; local.w *= -1; } const i = out.bones.indexOf(b.name); q[i][f * 4] = r4(local.x); q[i][f * 4 + 1] = r4(local.y); q[i][f * 4 + 2] = r4(local.z); q[i][f * 4 + 3] = r4(local.w); }
      }
      const hp = wpS(hipsS).sub(hipsRestS).multiplyScalar(scale); hips[f * 3] = hp.x; hips[f * 3 + 1] = hp.y; hips[f * 3 + 2] = hp.z;
      { const fl = wpS(sNode('LeftFoot')).sub(wpS(hipsS)); footL.push(fl.z * scale); footY.push(fl.y * scale); }
    }
    // in-place hips: take out the cycle's mean horizontal offset so the body does not drift
    let mx = 0, mz = 0; for (let f = 0; f < N; f++) { mx += hips[f * 3]; mz += hips[f * 3 + 2]; } mx /= N; mz /= N;
    const hipsLocal = new Array(N * 3);
    for (let f = 0; f < N; f++) { const d = new THREE.Vector3(hips[f * 3] - mx, hips[f * 3 + 1], hips[f * 3 + 2] - mz).applyQuaternion(pelvisPr); hipsLocal[f * 3] = r4(d.x); hipsLocal[f * 3 + 1] = r4(d.y); hipsLocal[f * 3 + 2] = r4(d.z); }
    const range = Math.max(...footL) - Math.min(...footL), lead = footL.indexOf(Math.max(...footL));
    // natural ground speed of the clip: how fast the planted foot travels back relative to the hips while it is on the ground
    const ymin = Math.min(...footY); let sum = 0, cnt = 0;
    for (let f = 0; f < N; f++) { const g = (f + 1) % N; if (footY[f] < ymin + 0.035 && footY[g] < ymin + 0.035) { sum += -(footL[g] - footL[f]) * FPS; cnt++; } }
    const stanceSpeed = cnt > 2 ? sum / cnt : 2 * range / clip.duration;
    out.clips[key] = { n: N, dur: r4(clip.duration), lead: r4(lead / N), speed: CALIBRATED[key] !== undefined ? CALIBRATED[key] : r4(stanceSpeed), q: q.map((a) => a.map((v) => (v === undefined ? 0 : v))), hips: hipsLocal };
    mixer.stopAllAction();
  }
  out.pelvisRest = [r4(tPelvisRestLocal.x), r4(tPelvisRestLocal.y), r4(tPelvisRestLocal.z)];
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------- runtime
const _a = new THREE.Quaternion(), _b = new THREE.Quaternion(), _c = new THREE.Quaternion();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Motion {
  constructor(data) {
    this.d = data; this.bones = data.bones; this.u = 0; this.ui = Math.random();            // gait phase (walk and run share it) and idle phase
    this.pose = {}; for (const b of this.bones) this.pose[b] = new THREE.Quaternion();
    this.hips = new THREE.Vector3(); this.wIdle = 1; this.wWalk = 0; this.wRun = 0; this.rate = 0;
  }
  // speed: ground speed in m/s. Returns nothing; read .pose / .hips afterwards.
  update(dt, speed, stepScale = 1) {
    const d = this.d.clips, w = d.walk.speed, r = d.run.speed;
    // blend weights by speed: idle -> walk -> run
    const idleTo = clamp((speed - 0.15) / 0.9, 0, 1), walkTo = clamp((speed - w * 1.0) / (r * 0.75 - w), 0, 1);
    const moveW = idleTo * idleTo * (3 - 2 * idleTo), runW = walkTo * walkTo * (3 - 2 * walkTo);
    this.wIdle = 1 - moveW; this.wWalk = moveW * (1 - runW); this.wRun = moveW * runW;
    if (this.force) { this.wIdle = 0; this.wWalk = this.force === 'walk' ? 1 : 0; this.wRun = this.force === 'run' ? 1 : 0; }      // calibration helper
    // advance the shared gait phase so the planted foot matches the ground speed (clamped so extremes do not look frantic)
    const walkRate = clamp(speed / w, 0.5, 1.45) / d.walk.dur, runRate = clamp(speed / r, 0.7, 1.75) / d.run.dur;
    this.rate = (this.wWalk * walkRate + this.wRun * runRate) / Math.max(1e-4, this.wWalk + this.wRun);
    if (this.wWalk + this.wRun > 0.001) this.u = (this.u + dt * this.rate * stepScale) % 1;
    this.ui = (this.ui + dt / d.idle.dur) % 1;
    this._blend();
  }
  _frame(clip, u, bi, out) {
    const N = clip.n, f = u * N, i0 = Math.floor(f) % N, i1 = (i0 + 1) % N, t = f - Math.floor(f), q = clip.q[bi];
    _a.set(q[i0 * 4], q[i0 * 4 + 1], q[i0 * 4 + 2], q[i0 * 4 + 3]); _b.set(q[i1 * 4], q[i1 * 4 + 1], q[i1 * 4 + 2], q[i1 * 4 + 3]); out.copy(_a).slerp(_b, t);
  }
  _blend() {
    const d = this.d.clips, list = [];
    if (this.wIdle > 0.001) list.push([d.idle, this.ui, this.wIdle]);
    if (this.wWalk > 0.001) list.push([d.walk, (this.u + d.walk.lead) % 1, this.wWalk]);      // u = 0 is the left foot's heel strike in every clip
    if (this.wRun > 0.001) list.push([d.run, (this.u + d.run.lead) % 1, this.wRun]);
    this.hips.set(0, 0, 0);
    for (let bi = 0; bi < this.bones.length; bi++) {
      const out = this.pose[this.bones[bi]]; let acc = 0;
      for (const [clip, u, w] of list) {
        this._frame(clip, u, bi, _c); acc += w;
        if (acc === w) out.copy(_c); else { if (out.dot(_c) < 0) { _c.x *= -1; _c.y *= -1; _c.z *= -1; _c.w *= -1; } out.slerp(_c, w / acc); }
      }
    }
    let acc = 0;
    for (const [clip, u, w] of list) {
      const N = clip.n, f = u * N, i0 = Math.floor(f) % N, i1 = (i0 + 1) % N, t = f - Math.floor(f); acc += w;
      const x = clip.hips[i0 * 3] * (1 - t) + clip.hips[i1 * 3] * t, y = clip.hips[i0 * 3 + 1] * (1 - t) + clip.hips[i1 * 3 + 1] * t, z = clip.hips[i0 * 3 + 2] * (1 - t) + clip.hips[i1 * 3 + 2] * t;
      this.hips.x += (x - this.hips.x) * (w / acc); this.hips.y += (y - this.hips.y) * (w / acc); this.hips.z += (z - this.hips.z) * (w / acc);
    }
  }
}

export async function loadMotion(url) { const r = await fetch(url); return new Motion(await r.json()); }
