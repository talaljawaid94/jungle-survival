import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, Noise } from './noise.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

class Builder {
  constructor(color = false) { this.p = []; this.n = []; this.u = []; this.c = []; this.color = color; }
  tri(pa, pb, pc, na, nb, nc, ua, ub, uc, ca, cb, cc) {
    for (const [p, n, u, c] of [[pa, na, ua, ca], [pb, nb, ub, cb], [pc, nc, uc, cc]]) {
      this.p.push(p.x, p.y, p.z); this.n.push(n.x, n.y, n.z); this.u.push(u[0], u[1]);
      if (this.color) this.c.push(c[0], c[1], c[2]);
    }
  }
  quad(p, n, uv, c) { // p: 4 corners CCW starting at (0,0); n: 4 normals; uv: 4 pairs; c: 4 colours
    this.tri(p[0], p[1], p[2], n[0], n[1], n[2], uv[0], uv[1], uv[2], c && c[0], c && c[1], c && c[2]);
    this.tri(p[0], p[2], p[3], n[0], n[2], n[3], uv[0], uv[2], uv[3], c && c[0], c && c[2], c && c[3]);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    if (this.color) g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    return g;
  }
}

// ------------------------------------------------------------------ leaf-card canopy
// blobs: [{c: Vector3, r: number}]. Each card is a quad with a leaf-spray texture; normals point outward from
// the blob centre so the whole canopy shades like a soft volume instead of a pile of flat quads.
export function canopyGeo({ blobs, cards, size, seed, tone = 1 }) {
  const rnd = mulberry32(seed), B = new Builder(true);
  for (const blob of blobs) for (let i = 0; i < cards; i++) {
    let v; do { v = V3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1); } while (v.lengthSq() > 1);
    const p = blob.c.clone().add(V3(v.x * blob.r, v.y * blob.r * 0.72, v.z * blob.r));
    const out = v.clone().normalize();
    const n = out.clone().multiplyScalar(0.5).add(V3(0, 0.9, 0)).add(V3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.8)).normalize();
    const ref = Math.abs(n.y) > 0.9 ? V3(1, 0, 0) : V3(0, 1, 0);
    let U = V3().crossVectors(n, ref).normalize(), Vv = V3().crossVectors(n, U).normalize();
    const a = rnd() * 6.283, ca = Math.cos(a), sa = Math.sin(a), U2 = U.clone().multiplyScalar(ca).addScaledVector(Vv, sa), V2 = Vv.clone().multiplyScalar(ca).addScaledVector(U, -sa);
    const s = (size[0] + rnd() * (size[1] - size[0])) / 2;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => p.clone().addScaledVector(U2, x * s).addScaledVector(V2, y * s));
    const norms = corners.map((c) => c.clone().sub(blob.c).normalize().multiplyScalar(0.75).add(V3(0, 0.45, 0)).normalize());
    const depth = Math.min(1, v.length()), shade = (0.5 + 0.5 * depth) * (0.88 + rnd() * 0.24) * tone;
    const col = [shade * (0.95 + rnd() * 0.1), shade, shade * 0.92];
    B.quad(corners, norms, [[0, 0], [1, 0], [1, 1], [0, 1]], [col, col, col, col]);
  }
  return B.build();
}

// ------------------------------------------------------------------ trunks
function nonIndexed(g) { const x = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(k)) x.deleteAttribute(k); return x; }

function limb(from, to, r0, r1, seg = 6, uvScale = 1) {
  const d = to.clone().sub(from), len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, 7, seg, true);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d.normalize()));
  g.translate(from.x, from.y, from.z);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * len / 2.5 * uvScale);
  return nonIndexed(g);
}

export function trunkGeo({ H, r0, r1, bend = 0.4, seed, branches = [] }) {
  const rnd = mulberry32(seed), noise = new Noise(seed), parts = [];
  const g = new THREE.CylinderGeometry(r1, r0, H, 10, 12, true); g.translate(0, H / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), t = y / H, x = p.getX(i), z = p.getZ(i), ang = Math.atan2(z, x);
    const wob = 1 + noise.noise2(ang * 2.4, y * 0.6) * 0.09 + (t < 0.12 ? (0.12 - t) * 1.6 : 0);   // bark ridges + root flare
    p.setXYZ(i, x * wob + Math.sin(t * Math.PI) * bend, y, z * wob + Math.sin(t * 2.1) * bend * 0.4);
  }
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * H / 3);
  g.computeVertexNormals(); parts.push(nonIndexed(g));
  for (let i = 0; i < 5; i++) {   // buttress roots
    const a = (i / 5) * 6.283 + rnd(); const from = V3(Math.cos(a) * r0 * 0.6, 1.0, Math.sin(a) * r0 * 0.6), to = V3(Math.cos(a) * (r0 + 0.55), -0.12, Math.sin(a) * (r0 + 0.55));
    parts.push(limb(to, from, 0.34, 0.1, 2));
  }
  for (const b of branches) parts.push(limb(b.from, b.to, b.r0, b.r1, 3));
  return mergeGeometries(parts, false);
}

export function jungleTree(seed, kind = 'tall') {
  const rnd = mulberry32(seed);
  const H = kind === 'fruit' ? 6.5 : kind === 'tall' ? 12 + rnd() * 3 : 8.5 + rnd() * 2;
  const blobs = [], branches = [];
  const nBlobs = kind === 'fruit' ? 4 : 5;
  for (let i = 0; i < nBlobs; i++) {
    const a = rnd() * 6.283, rad = i === 0 ? 0 : (kind === 'fruit' ? 1.5 : 2.5) * (0.55 + rnd() * 0.6), y = H - 0.5 + rnd() * 2.2 + (i === 0 ? 1.2 : 0);
    const r = (kind === 'fruit' ? 2.3 : 3.4) + rnd() * 1.0;
    blobs.push({ c: V3(Math.cos(a) * rad, y, Math.sin(a) * rad), r });
    if (i > 0) branches.push({ from: V3(0, H * (0.62 + rnd() * 0.2), 0), to: V3(Math.cos(a) * rad * 0.8, y - 0.8, Math.sin(a) * rad * 0.8), r0: 0.2, r1: 0.07 });
  }
  const trunk = trunkGeo({ H, r0: kind === 'fruit' ? 0.4 : 0.52, r1: 0.2, seed, branches, bend: 0.35 });
  const foliage = canopyGeo({ blobs, cards: kind === 'fruit' ? 30 : 40, size: kind === 'fruit' ? [2.2, 3.4] : [2.8, 4.4], seed: seed + 5 });
  let extra = null;
  if (kind === 'fruit') {
    const parts = [];
    for (let i = 0; i < 10; i++) {
      const f = new THREE.IcosahedronGeometry(0.2, 1); const a = rnd() * 6.283, rad = 0.9 + rnd() * 1.7;
      f.translate(Math.cos(a) * rad, H - 1.7 - rnd() * 0.9, Math.sin(a) * rad);
      const n = f.attributes.position.count, c = new Float32Array(n * 3), col = new THREE.Color(rnd() > 0.5 ? 0xe8b020 : 0xd9892a);
      for (let k = 0; k < n; k++) { c[k * 3] = col.r; c[k * 3 + 1] = col.g; c[k * 3 + 2] = col.b; }
      f.setAttribute('color', new THREE.BufferAttribute(c, 3)); f.deleteAttribute('uv'); parts.push(f.index ? f.toNonIndexed() : f);
    }
    extra = mergeGeometries(parts, false);
  }
  return { trunk, foliage, extra };
}

// ------------------------------------------------------------------ fronds (palms, ferns, broad leaves)
function strip({ angle, L, W, lift, droop, segs = 6, widthFn, origin = V3(), tilt = 0 }) {
  const B = new THREE.BufferGeometry(), pos = [], uv = [], idx = [];
  const dir = V3(Math.cos(angle), 0, Math.sin(angle)), side = V3(-Math.sin(angle), 0, Math.cos(angle));
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, d = t * L, y = lift * t - droop * t * t * L, w = W * widthFn(t) / 2;
    const c = origin.clone().addScaledVector(dir, d * Math.cos(tilt)).add(V3(0, y + d * Math.sin(tilt) * 0.3, 0));
    const tw = Math.sin(t * 4 + angle) * w * 0.12;
    for (const s of [-1, 1]) { const q = c.clone().addScaledVector(side, s * w); q.y += tw * s; pos.push(q.x, q.y, q.z); uv.push(s < 0 ? 0 : 1, t); }
    if (i < segs) { const a = i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  }
  B.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); B.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); B.setIndex(idx);
  B.computeVertexNormals(); return B;
}

export function palmGeo(seed) {
  const rnd = mulberry32(seed), lean = 0.18 + rnd() * 0.22, H = 8 + rnd() * 2;
  const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(V3(Math.sin(t * 1.3) * lean * 4 * t, t * H, Math.sin(t * 3) * 0.15)); }
  const curve = new THREE.CatmullRomCurve3(pts), tube = new THREE.TubeGeometry(curve, 18, 0.2, 8, false);
  const p = tube.attributes.position, uv = tube.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * H / 2.2);
  const trunk = nonIndexed(tube);
  const top = pts[pts.length - 1], fr = [];
  for (let i = 0; i < 13; i++) {
    const L = 3.6 + rnd() * 1.3, g = strip({ angle: (i / 13) * 6.283 + rnd() * 0.3, L, W: 1.7, lift: 1.0 + rnd() * 1.4, droop: 0.2 + rnd() * 0.12, segs: 7, widthFn: (t) => 0.5 + 0.7 * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.08)), origin: top.clone().add(V3(0, 0.1, 0)) });
    fr.push(nonIndexed(g));
  }
  const foliage = mergeGeometries(fr, false);
  const nuts = []; for (let i = 0; i < 4; i++) { const c = new THREE.IcosahedronGeometry(0.17, 1); c.translate(top.x + Math.cos(i * 1.6) * 0.28, top.y - 0.4, top.z + Math.sin(i * 1.6) * 0.28); c.deleteAttribute('uv'); nuts.push(c.index ? c.toNonIndexed() : c); }
  const extra = mergeGeometries(nuts.map((g) => { const n = g.attributes.position.count, c = new Float32Array(n * 3).fill(0); for (let k = 0; k < n; k++) { c[k * 3] = 0.32; c[k * 3 + 1] = 0.22; c[k * 3 + 2] = 0.1; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; }), false);
  return { trunk, foliage, extra };
}

export function fernGeo(seed) {
  const rnd = mulberry32(seed), parts = [];
  for (let i = 0; i < 8; i++) parts.push(nonIndexed(strip({ angle: (i / 8) * 6.283 + rnd() * 0.4, L: 0.9 + rnd() * 0.7, W: 0.55, lift: 0.5 + rnd() * 0.4, droop: 0.35, segs: 4, widthFn: (t) => 0.55 + 0.6 * Math.sin(Math.PI * Math.min(1, t + 0.05)) })));
  return mergeGeometries(parts, false);
}
export function broadLeafGeo(seed) {
  const rnd = mulberry32(seed), parts = [];
  for (let i = 0; i < 5; i++) parts.push(nonIndexed(strip({ angle: (i / 5) * 6.283 + rnd() * 0.7, L: 1.3 + rnd() * 0.8, W: 1.0, lift: 0.9 + rnd() * 0.7, droop: 0.35, segs: 5, widthFn: (t) => 0.2 + 0.9 * Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.04)) })));
  return mergeGeometries(parts, false);
}

export function bushGeo(seed, berries = false) {
  const rnd = mulberry32(seed), blobs = [{ c: V3(0, 0.55, 0), r: 0.8 }, { c: V3(0.5, 0.45, 0.3), r: 0.55 }, { c: V3(-0.45, 0.45, -0.25), r: 0.55 }];
  const foliage = canopyGeo({ blobs, cards: 16, size: [0.6, 1.0], seed, tone: 1.05 });
  let extra = null;
  if (berries) {
    const parts = [];
    for (let i = 0; i < 12; i++) {
      const f = new THREE.IcosahedronGeometry(0.06, 1), a = rnd() * 6.283, r = 0.35 + rnd() * 0.5; f.translate(Math.cos(a) * r, 0.25 + rnd() * 0.55, Math.sin(a) * r);
      const n = f.attributes.position.count, c = new Float32Array(n * 3), col = new THREE.Color(0xc41e3a); for (let k = 0; k < n; k++) { c[k * 3] = col.r; c[k * 3 + 1] = col.g; c[k * 3 + 2] = col.b; }
      f.setAttribute('color', new THREE.BufferAttribute(c, 3)); f.deleteAttribute('uv'); parts.push(f.index ? f.toNonIndexed() : f);
    }
    extra = mergeGeometries(parts, false);
  }
  return { foliage, extra };
}

// ------------------------------------------------------------------ rocks
export function rockGeo(seed, base = 0x76766f, mossy = true) {
  const noise = new Noise(seed), g = new THREE.IcosahedronGeometry(1, 3), p = g.attributes.position, v = V3();
  const keep = ['position']; for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k);
  const merged = new THREE.BufferGeometry(); merged.setAttribute('position', g.attributes.position.clone());
  // weld by rebuilding an indexed geometry from the non-indexed icosahedron
  const map = new Map(), pos = [], ind = [];
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const key = `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`; let id = map.get(key); if (id === undefined) { id = pos.length / 3; map.set(key, id); pos.push(v.x, v.y, v.z); } ind.push(id); }
  const w = new THREE.BufferGeometry(); w.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); w.setIndex(ind);
  const q = w.attributes.position;
  for (let i = 0; i < q.count; i++) {
    v.fromBufferAttribute(q, i); const r = 1 + noise.fbm(v.x * 1.7, v.z * 1.7 + v.y, 4) * 0.34 + noise.noise2(v.x * 6, v.y * 6 + v.z * 3) * 0.05;
    v.multiplyScalar(r); v.y *= 0.72; q.setXYZ(i, v.x, v.y, v.z);
  }
  w.computeVertexNormals();
  const cols = new Float32Array(q.count * 3), nor = w.attributes.normal, c = new THREE.Color(base), moss = new THREE.Color(0x4a6a2a);
  for (let i = 0; i < q.count; i++) {
    const n = nor.getY(i), k = 0.78 + noise.noise2(q.getX(i) * 4, q.getZ(i) * 4) * 0.22, m = mossy ? THREE.MathUtils.smoothstep(n, 0.55, 0.9) * 0.8 : 0;
    const col = c.clone().multiplyScalar(k).lerp(moss, m); cols[i * 3] = col.r; cols[i * 3 + 1] = col.g; cols[i * 3 + 2] = col.b;
  }
  w.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return w;
}

export function grassGeo() {
  const verts = [], cols = [], norms = [], rnd = mulberry32(5);
  const base = new THREE.Color(0x1f3d10), tip = new THREE.Color(0x86b848);
  for (let i = 0; i < 7; i++) {
    const a = rnd() * 6.28, d = rnd() * 0.2, h = 0.4 + rnd() * 0.55, w = 0.035 + rnd() * 0.03;
    const cx = Math.cos(a) * d, cz = Math.sin(a) * d, lx = (rnd() - 0.5) * 0.4, lz = (rnd() - 0.5) * 0.4, px = -Math.sin(a), pz = Math.cos(a);
    const mx = cx + lx * 0.4, mz = cz + lz * 0.4, my = h * 0.55;
    verts.push(cx - px * w, 0, cz - pz * w, cx + px * w, 0, cz + pz * w, mx - px * w * 0.7, my, mz - pz * w * 0.7,
      cx + px * w, 0, cz + pz * w, mx + px * w * 0.7, my, mz + pz * w * 0.7, mx - px * w * 0.7, my, mz - pz * w * 0.7,
      mx - px * w * 0.7, my, mz - pz * w * 0.7, mx + px * w * 0.7, my, mz + pz * w * 0.7, cx + lx, h, cz + lz);
    const mid = base.clone().lerp(tip, 0.55), k = 0.85 + rnd() * 0.3;
    for (const c of [base, base, mid, base, mid, mid, mid, mid, tip]) cols.push(c.r * k, c.g * k, c.b * k);
    for (let k2 = 0; k2 < 9; k2++) norms.push(0, 1, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  return g;
}
