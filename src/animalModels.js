import * as THREE from 'three';
import { mulberry32, Noise, clamp } from './noise.js';
import { hasAnimalModel, buildAnimalGLB } from './animalGLB.js';

// Fur textures are painted once per species on a canvas: base coat + hair strokes (+ markings).
const texCache = {};
function furTextures(type, base, belly, spots) {
  if (texCache[type]) return texCache[type];
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), r = mulberry32(type.length * 31 + 7);
  const b = document.createElement('canvas'); b.width = b.height = S; const y = b.getContext('2d');
  x.fillStyle = '#b9b9b9'; x.fillRect(0, 0, S, S); y.fillStyle = '#808080'; y.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) { const px = r() * S, py = r() * S, l = 4 + r() * 9, a = (r() - 0.5) * 0.7 + Math.PI / 2, v = r() > 0.5 ? 255 : 40; const dx = Math.cos(a) * l, dy = Math.sin(a) * l; x.strokeStyle = `rgba(${v},${v},${v},0.13)`; x.lineWidth = 1; for (const ox of [-S, 0, S]) { x.beginPath(); x.moveTo(px + ox, py); x.lineTo(px + ox + dx, py + dy); x.stroke(); } y.strokeStyle = `rgba(${v},${v},${v},0.3)`; y.beginPath(); y.moveTo(px, py); y.lineTo(px + dx, py + dy); y.stroke(); }
  if (spots) for (let i = 0; i < 70; i++) { const px = r() * S, py = r() * S, rad = 5 + r() * 7; for (const ox of [-S, 0, S]) { x.strokeStyle = 'rgba(25,14,6,0.8)'; x.lineWidth = 2.6; x.beginPath(); x.ellipse(px + ox, py, rad, rad * 0.8, r() * 3, 0.5, 5.6); x.stroke(); x.fillStyle = 'rgba(25,14,6,0.45)'; x.beginPath(); x.arc(px + ox, py, rad * 0.25, 0, 7); x.fill(); } }
  const map = new THREE.CanvasTexture(c); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.colorSpace = THREE.SRGBColorSpace; map.repeat.set(2, 2); map.anisotropy = 4;
  const bump = new THREE.CanvasTexture(b); bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(2, 2);
  return (texCache[type] = { map, bump });
}

const SPEC = {
  rabbit: { s: 1, base: 0xa08a6e, belly: 0xe8dcc6, legH: 0.18, bodyL: 0.3, bodyH: 0.2, bodyW: 0.17, neck: 0.1, head: [0.07, 0.065, 0.1], ear: 'long', tail: 'puff', hoof: 0x3a2c22 },
  deer: { s: 1, base: 0xa5733f, belly: 0xe6d6b8, legH: 0.62, bodyL: 0.62, bodyH: 0.27, bodyW: 0.2, neck: 0.4, head: [0.085, 0.095, 0.17], ear: 'leaf', tail: 'short', hoof: 0x1d1612, antlers: true },
  boar: { s: 1, base: 0x5e4a3c, belly: 0x7a6553, legH: 0.29, bodyL: 0.5, bodyH: 0.27, bodyW: 0.22, neck: 0.12, head: [0.125, 0.115, 0.3], ear: 'tri', tail: 'tuft', hoof: 0x181210, tusks: true },
  jaguar: { s: 1, base: 0xc8913a, belly: 0xefe2c4, legH: 0.34, bodyL: 0.62, bodyH: 0.21, bodyW: 0.2, neck: 0.15, head: [0.135, 0.115, 0.2], ear: 'round', tail: 'long', hoof: 0x2a1d10, spots: true },
};

export function buildAnimal(type) {
  if (hasAnimalModel(type)) return buildAnimalGLB(type, SPEC[type]);
  const sp = SPEC[type], rnd = mulberry32(type.charCodeAt(0) * 17), g = new THREE.Group();
  const fur = furTextures(type, sp.base, sp.belly, sp.spots);
  const furMat = new THREE.MeshStandardMaterial({ map: fur.map, bumpMap: fur.bump, bumpScale: 1.3, vertexColors: true, roughness: 0.9, color: new THREE.Color(1.55, 1.5, 1.45) });
  const darkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(sp.base).multiplyScalar(0.8), roughness: 0.95, map: fur.map, bumpMap: fur.bump });
  const hoofMat = new THREE.MeshStandardMaterial({ color: sp.hoof, roughness: 0.6 });
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x0b0806, roughness: 0.1, clearcoat: 1 });
  const base = new THREE.Color(sp.base), belly = new THREE.Color(sp.belly);
  const tinted = (geo, cBack = base, cBelly = belly, k = 1) => {                   // back-to-belly colour gradient by height
    const p = geo.attributes.position, c = new Float32Array(p.count * 3); geo.computeBoundingBox(); const y0 = geo.boundingBox.min.y, y1 = geo.boundingBox.max.y, col = new THREE.Color();
    for (let i = 0; i < p.count; i++) { const t = clamp((p.getY(i) - y0) / (y1 - y0), 0, 1); col.copy(cBelly).lerp(cBack, THREE.MathUtils.smoothstep(t, 0.15, 0.55)).multiplyScalar(k * (0.92 + Math.random() * 0.12)); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo;
  };
  const M = (geo, mat = furMat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
  const ell = (rx, ry, rz, ws = 28, hs = 20) => { const s = new THREE.SphereGeometry(1, ws, hs); s.scale(rx, ry, rz); return tinted(s); };

  const { legH, bodyL, bodyH, bodyW } = sp, bodyY = legH * 0.99 + bodyH * 0.38;
  const torso = new THREE.Group(); torso.position.y = bodyY; g.add(torso);
  const heavy = type === 'boar' || type === 'jaguar';
  torso.add(M(ell(bodyW * 0.98, bodyH * 0.98, bodyL * 1.0)));
  torso.add(M(ell(bodyW * 1.0, bodyH * 1.02, bodyL * 0.34), furMat, 0, type === 'boar' ? -bodyH * 0.03 : 0.0, bodyL * 0.46));                    // haunches
  torso.add(M(ell(bodyW * 1.0, bodyH * 1.06, bodyL * 0.34), furMat, 0, bodyH * (type === 'boar' ? 0.16 : 0.1), -bodyL * 0.46));          // chest / shoulders
  if (sp.mane) { const mane = M(ell(bodyW * 0.7, bodyH * 0.45, bodyL * 0.55), darkMat, 0, bodyH * 0.78, -bodyL * 0.1); torso.add(mane); }

  // ---- eye / face detail helpers
  const IRIS = { rabbit: 0x5a3216, deer: 0x3a2010, boar: 0x3a2412, jaguar: 0xd9a020 };
  const mk = (c, r = 0.7, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const whiteMat = mk(0xf3ead8, 1), pinkMat = mk(type === 'deer' ? 0xd9b9a2 : 0xcf8f86, 0.9), noseMat = new THREE.MeshPhysicalMaterial({ color: type === 'jaguar' ? 0x2a1614 : 0x141010, roughness: 0.25, clearcoat: 0.8 }), blackMat = mk(0x050403, 0.5), whiskMat = mk(0xf4efe4, 0.6), bone = mk(0xe8e2cc, 0.4);
  const buildEye = (s) => {
    const r = Math.max(0.013, sp.head[0] * 0.2), eg = new THREE.Group(); eg.position.set(s * sp.head[0] * 0.8, sp.head[1] * 0.3, -sp.head[2] * 0.5); eg.rotation.y = s * 2.0;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), new THREE.MeshPhysicalMaterial({ color: IRIS[type], roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 })); eg.add(ball);
    const pup = new THREE.Mesh(new THREE.SphereGeometry(r * 0.52, 14, 10), blackMat); pup.scale.set(type === 'deer' || type === 'boar' ? 1.35 : 1, type === 'deer' || type === 'boar' ? 0.7 : 1, 0.35); pup.position.z = r * 0.86; eg.add(pup);
    const hi = new THREE.Mesh(new THREE.SphereGeometry(r * 0.17, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); hi.position.set(r * 0.28, r * 0.3, r * 0.98); eg.add(hi);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(r * 1.16, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), darkMat); lid.rotation.x = 0.25; eg.add(lid);
    const lid2 = new THREE.Mesh(new THREE.SphereGeometry(r * 1.14, 18, 8, 0, Math.PI * 2, Math.PI * 0.72, Math.PI * 0.28), darkMat); eg.add(lid2);
    if (type === 'deer') { const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.3, r * 0.14, 6, 18), whiteMat); ring.position.z = -r * 0.1; eg.add(ring); }
    if (type === 'jaguar') { const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.25, r * 0.2, 6, 18), blackMat); ring.position.z = -r * 0.05; eg.add(ring); }
    return eg;
  };
  // neck + head
  const neck = new THREE.Group(); neck.position.set(0, bodyH * 0.3, -bodyL * 0.78); torso.add(neck);
  const up = type === 'deer' ? 0.95 : type === 'rabbit' ? 0.35 : type === 'boar' ? 0.1 : 0.2;
  neck.rotation.x = -(0.2 + up * 0.55);
  neck.add(M(tinted(new THREE.CylinderGeometry(sp.head[0] * (heavy ? 1.0 : 0.8), bodyW * (heavy ? 1.0 : 0.7), sp.neck, 16, 1).translate(0, sp.neck / 2, 0), base, base, 0.97), furMat));
  const head = new THREE.Group(); head.position.y = sp.neck; neck.add(head); head.rotation.x = 0.2 + up * 0.5;
  const [hx, hy, hz] = sp.head;
  head.add(M(ell(hx, hy, hz * 0.55), furMat, 0, 0.0, -hz * 0.28));
  const snout = M(tinted(new THREE.CylinderGeometry(hx * 0.46, hx * 0.72, hz * 0.62, 14).rotateX(Math.PI / 2), base, base, 0.95), furMat, 0, -hy * 0.18, -hz * 0.78); head.add(snout);
  head.add(M(new THREE.SphereGeometry(hx * 0.3, 12, 10), darkMat, 0, -hy * 0.1, -hz * 1.1));
  for (const s of [-1, 1]) {
    head.add(buildEye(s));
    let ear;
    if (sp.ear === 'long') ear = M(new THREE.ConeGeometry(0.018, 0.2, 8).translate(0, 0.1, 0), furMat, s * hx * 0.45, hy * 0.7, -hz * 0.05);
    else if (sp.ear === 'leaf') ear = M(new THREE.ConeGeometry(0.04, 0.17, 8).translate(0, 0.085, 0), furMat, s * hx * 0.8, hy * 0.55, -hz * 0.05);
    else if (sp.ear === 'tri') ear = M(new THREE.ConeGeometry(0.045, 0.1, 6).translate(0, 0.05, 0), darkMat, s * hx * 0.7, hy * 0.7, -hz * 0.1);
    else ear = M(new THREE.SphereGeometry(0.035, 10, 8), furMat, s * hx * 0.7, hy * 0.72, -hz * 0.05);
    ear.rotation.z = -s * (sp.ear === 'long' ? 0.25 : 0.7); ear.rotation.x = 0.2; ear.userData.s = s; head.add(ear);
    if (sp.tusks) { const t = M(new THREE.ConeGeometry(0.014, 0.1, 6).translate(0, 0.05, 0), new THREE.MeshStandardMaterial({ color: 0xe8e2cc, roughness: 0.4 }), s * hx * 0.5, -hy * 0.25, -hz * 1.0); t.rotation.set(-0.6, 0, -s * 0.5); head.add(t); }
    if (sp.antlers) {
      const pts = [[0, 0, 0], [s * 0.05, 0.16, 0.03], [s * 0.08, 0.32, 0.0], [s * 0.05, 0.46, -0.06]].map((p) => new THREE.Vector3(...p)), curve = new THREE.CatmullRomCurve3(pts);
      const main = M(new THREE.TubeGeometry(curve, 10, 0.014, 6), new THREE.MeshStandardMaterial({ color: 0x7a5d3a, roughness: 0.8 }), s * hx * 0.5, hy * 0.85, hz * 0.0); head.add(main);
      for (const t of [0.4, 0.65, 0.88]) { const p0 = curve.getPoint(t), tine = M(new THREE.CylinderGeometry(0.005, 0.011, 0.14, 5).translate(0, 0.07, 0), new THREE.MeshStandardMaterial({ color: 0x7a5d3a, roughness: 0.8 }), s * hx * 0.5 + p0.x, hy * 0.85 + p0.y, p0.z); tine.rotation.set(-0.3, 0, -s * 0.9); head.add(tine); }
    }
  }

  // legs: shoulder/hip -> knee/hock -> hoof (digitigrade hind legs)
  const legs = [];
  const L1 = legH * 0.5, L2 = legH * 0.52;
  for (const [sx, sz, front] of [[-1, -1, true], [1, -1, true], [-1, 1, false], [1, 1, false]]) {
    const top = new THREE.Group(); top.position.set(sx * bodyW * 0.72, bodyY - bodyH * 0.35, sz * bodyL * 0.52); g.add(top);
    const w = type === 'rabbit' ? 0.035 : type === 'deer' ? 0.04 : type === 'jaguar' ? 0.06 : 0.055, mm = type === 'deer' ? 1.3 : type === 'rabbit' ? (front ? 1.2 : 2.4) : (front ? 1.35 : 1.9);
    top.add(M(tinted(new THREE.CylinderGeometry(w * 1.25, w, L1, 12).translate(0, -L1 / 2, 0), base, base, 0.97), furMat));
    top.add(M(ell(w * mm, L1 * 0.5, w * mm * 1.1, 12, 8), furMat, 0, -L1 * 0.22, front ? 0 : w * 0.3));
    const knee = new THREE.Group(); knee.position.y = -L1; top.add(knee);
    knee.add(M(new THREE.SphereGeometry(w * 1.0, 10, 8), furMat));
    knee.add(M(tinted(new THREE.CylinderGeometry(w, w * 0.72, L2, 12).translate(0, -L2 / 2, 0), base, base, 0.9), furMat));
    const foot = new THREE.Group(); foot.position.y = -L2; knee.add(foot);
    if (type === 'jaguar') {
      foot.add(M(ell(w * 1.25, w * 0.8, w * 1.7, 12, 8), furMat, 0, -0.005, -w * 0.5));
      for (let i = -1; i <= 1; i++) { foot.add(M(new THREE.SphereGeometry(w * 0.42, 8, 6), furMat, i * w * 0.7, -0.012, -w * 1.9)); const cl = M(new THREE.ConeGeometry(w * 0.14, w * 0.8, 5).translate(0, -w * 0.4, 0), bone, i * w * 0.7, -0.01, -w * 2.2); cl.rotation.x = -1.6; foot.add(cl); }
    } else if (type === 'rabbit' && !front) {
      foot.add(M(ell(w * 0.9, w * 0.6, w * 3.2, 10, 8), furMat, 0, -0.01, -w * 1.4)); foot.add(M(new THREE.SphereGeometry(w * 0.7, 8, 6), furMat, 0, 0.0, 0));
    } else if (type === 'rabbit') foot.add(M(ell(w * 0.9, w * 0.55, w * 1.5, 10, 8), furMat, 0, -0.008, -w * 0.5));
    else for (const hs of [-1, 1]) foot.add(M(new THREE.CylinderGeometry(w * 0.4, w * 0.62, 0.055, 8, 1, false, hs > 0 ? 0 : Math.PI, Math.PI * 1.1), hoofMat, hs * w * 0.36, -0.01, 0));
    legs.push({ top, knee, front, rest: front ? 0.0 : 0.0 });
    if (!front) { top.rotation.x = 0.0; }
  }

  // tail
  const tail = new THREE.Group(); tail.position.set(0, bodyH * 0.35, bodyL * 0.88); torso.add(tail);
  if (sp.tail === 'long') { tail.add(M(tinted(new THREE.CylinderGeometry(0.03, 0.045, 0.62, 10).translate(0, 0.31, 0), base, base, 1), furMat)); tail.rotation.x = 0.9; }
  else if (sp.tail === 'puff') tail.add(M(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf2ece0, roughness: 1 }), 0, 0.02, 0.02));
  else if (sp.tail === 'short') { tail.add(M(new THREE.ConeGeometry(0.04, 0.14, 8).translate(0, 0.07, 0), furMat)); tail.rotation.x = 0.7; }
  else { tail.add(M(new THREE.CylinderGeometry(0.01, 0.016, 0.22, 6).translate(0, 0.11, 0), darkMat)); tail.rotation.x = 0.6; }

  // ---- face detail: nostrils, mouth, jaw, brow, inner ears, whiskers, cheeks, markings
  const [fx, fy, fz] = sp.head;
  for (const s of [-1, 1]) {
    const nos = M(new THREE.SphereGeometry(fx * 0.075, 8, 6), blackMat, s * fx * 0.15, -fy * 0.08, -fz * 1.1 - fx * 0.22); nos.scale.set(1, 0.7, 0.5); head.add(nos);
    const mouth = M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, -fy * 0.36, -fz * 1.04), new THREE.Vector3(s * fx * 0.3, -fy * 0.42, -fz * 0.86), new THREE.Vector3(s * fx * 0.5, -fy * 0.32, -fz * 0.64)]), 8, 0.0035, 5), blackMat); head.add(mouth);
    const brow = M(ell(fx * 0.22, fy * 0.08, fz * 0.16, 12, 8), furMat, s * fx * 0.72, fy * 0.5, -fz * 0.5); brow.rotation.z = -s * 0.3; head.add(brow);
    const cheek = M(ell(fx * (type === 'rabbit' ? 0.55 : 0.4), fy * (type === 'rabbit' ? 0.5 : 0.4), fz * 0.32, 14, 10), furMat, s * fx * 0.74, -fy * 0.28, -fz * 0.5); head.add(cheek);
    if (type !== 'deer') for (let i = 0; i < 3; i++) {
      const wl = type === 'rabbit' ? 0.13 : 0.1, w = M(new THREE.CylinderGeometry(0.0012, 0.0005, wl, 4).translate(0, wl / 2, 0), whiskMat, s * fx * 0.34, -fy * (0.14 + i * 0.05), -fz * 0.98);
      w.rotation.set(-0.2 + i * 0.22, 0, -s * (1.25 + i * 0.12)); w.castShadow = false; head.add(w);
    }
    const earM = head.children.find((c) => c.userData.s === s);
    if (earM) {
      if (sp.ear !== 'round') { const ih = sp.ear === 'long' ? 0.17 : sp.ear === 'leaf' ? 0.14 : 0.08; earM.add(M(new THREE.ConeGeometry(sp.ear === 'long' ? 0.012 : 0.03, ih, 8).translate(0, ih / 2, 0), pinkMat, 0, 0.005, -0.006)); }
      else earM.add(M(new THREE.SphereGeometry(0.022, 8, 6), blackMat, 0, 0, -0.016));
    }
  }
  const chin = M(ell(fx * 0.55, fy * 0.3, fz * 0.38, 14, 10), whiteMat.clone(), 0, -fy * 0.46, -fz * 0.66); chin.material.color.set(type === 'boar' ? 0x7a6652 : type === 'deer' ? 0xf0e6d0 : 0xe8dcc6); head.add(chin);
  if (type === 'jaguar' || type === 'deer' || type === 'rabbit') { const nz = M(new THREE.SphereGeometry(fx * 0.3, 14, 10), noseMat, 0, -fy * 0.08, -fz * 1.12); nz.scale.set(1.1, 0.7, 0.7); head.add(nz); }
  if (type === 'boar') {
    head.add(M(new THREE.CylinderGeometry(fx * 0.62, fx * 0.7, 0.05, 18).rotateX(Math.PI / 2), mk(0x7d5f55, 0.6), 0, -fy * 0.1, -fz * 1.17));
    for (const s of [-1, 1]) { head.add(M(new THREE.SphereGeometry(fx * 0.11, 8, 6), blackMat, s * fx * 0.26, -fy * 0.1, -fz * 1.17 - 0.027)); const tf = M(new THREE.ConeGeometry(0.02, 0.07, 5).translate(0, 0.035, 0), darkMat, s * fx * 0.5, fy * 0.9, -fz * 0.05); tf.rotation.z = -s * 0.2; head.add(tf); }
  }
  if (type === 'rabbit') for (const s of [-1, 1]) head.add(M(ell(fx * 0.5, fy * 0.5, fz * 0.3, 10, 8), mk(0xf0e6d4, 1), s * fx * 0.5, -fy * 0.38, -fz * 0.82));

  // body detail: deer rump patch + spots, boar bristle crest, jaguar chest/belly, ringed tail
  if (type === 'deer') {
    torso.add(M(ell(bodyW * 0.55, bodyH * 0.6, bodyL * 0.09), whiteMat, 0, bodyH * 0.12, bodyL * 0.9));
    for (let i = 0; i < 18; i++) { const sx = (Math.random() - 0.5) * 2, sz = (Math.random() - 0.5) * 1.2, ssy = Math.sqrt(Math.max(0, 1 - sx * sx * 0.9)); const d = M(new THREE.CircleGeometry(0.014 + Math.random() * 0.01, 8), whiteMat, sx * bodyW * 0.7, bodyH * 0.95 * ssy + 0.002, sz * bodyL * 0.6); d.rotation.x = -Math.PI / 2 + sx * 0.5; d.castShadow = false; torso.add(d); }
  }
  if (type === 'boar') for (let i = 0; i < 11; i++) { const z = -bodyL * 0.6 + i * bodyL * 0.1, c = M(new THREE.ConeGeometry(0.016, 0.11 - Math.abs(i - 3) * 0.008, 5).translate(0, 0.05, 0), darkMat, 0, bodyH * (1.18 - i * 0.05), z); c.rotation.x = 0.4; torso.add(c); }
  if (type === 'jaguar') {
    torso.add(M(ell(bodyW * 0.7, bodyH * 0.55, bodyL * 0.3), whiteMat, 0, -bodyH * 0.38, -bodyL * 0.2));
    for (let i = 0; i < 5; i++) { const ring = M(new THREE.TorusGeometry(0.036 - i * 0.002, 0.009, 6, 12), blackMat, 0, 0.3 + i * 0.1, 0); ring.rotation.x = Math.PI / 2; tail.add(ring); }
    tail.add(M(new THREE.SphereGeometry(0.04, 10, 8), blackMat, 0, 0.64, 0));
  }
  if (type === 'deer') tail.children.forEach((c) => { c.material = whiteMat; });

  // any fur-material part built from plain primitives gets the coat colour (vertexColors would otherwise render it black)
  g.traverse((o) => { if (o.isMesh && o.material === furMat && !o.geometry.attributes.color) tinted(o.geometry, base, base, 0.95); });
  const scale = sp.s; g.scale.setScalar(scale);
  g.userData = { height: legH + bodyH * 2 };

  // ---- animation
  const st = { t: Math.random() * 10, graze: 0, flick: 0, hop: 0 };
  function animate(a, dt) {
    st.t += dt; const t = st.t, spd = a.speed, run = spd > sp.s * 3.2, moving = spd > 0.15;
    const ph = a.phase * (run ? 1.0 : 1.0);
    const gallop = type === 'rabbit' ? 1 : 0;
    const A = clamp(spd / 1.6, 0, 1) * 0.55 + (run ? 0.35 : 0), B = clamp(spd / 1.6, 0, 1) * 0.7 + (run ? 0.5 : 0);
    // walk: diagonal pairs; run: bounding gait (front pair together, hind pair together)
    legs.forEach((l, i) => {
      const sx = i % 2 === 0 ? 1 : -1, front = l.front, sgn = run ? (front ? 1 : -1 * 0.6) * 1 : (front ? sx : -sx);
      const swing = Math.sin(ph * 2.2 + (run ? (front ? 0 : 1.7) : (i === 0 || i === 3 ? 0 : Math.PI))) * (moving ? A : 0);
      const lift = Math.max(0, Math.cos(ph * 2.2 + (run ? (front ? 0 : 1.7) : (i === 0 || i === 3 ? 0 : Math.PI)))) * (moving ? B : 0);
      l.top.rotation.x = swing + (front ? 0.05 : -0.2); l.knee.rotation.x = front ? -lift * 0.9 : lift * 0.9 + 0.35;
    });
    // body: hop for rabbits, bounce for runners, breathing at rest
    const breathe = Math.sin(t * 2.4) * 0.006;
    torso.position.y = bodyY + (moving ? Math.abs(Math.sin(ph * 2.2)) * (run ? 0.05 : 0.012) : breathe) + (gallop && moving ? Math.max(0, Math.sin(ph * 2.2)) * 0.12 : 0);
    torso.rotation.x = moving && run ? Math.sin(ph * 2.2) * 0.06 : 0; torso.rotation.z = moving ? Math.sin(ph * 1.1) * 0.025 : 0;
    // head / neck: graze when idle, alert when running
    const idle = !moving && a.state === 'idle';
    st.graze += ((idle && Math.sin(t * 0.25 + a.phase) > 0.5 ? 1 : 0) - st.graze) * Math.min(1, dt * 1.6);
    neck.rotation.x = -(0.2 + up * 0.55) * (1 - st.graze * 0.9) + st.graze * 0.35 + (moving ? Math.sin(ph * 2.2) * 0.05 : 0);
    head.rotation.x = (0.2 + up * 0.5) * (1 - st.graze * 0.6) + (a.state === 'chase' && !a.dead ? 0.15 : 0);
    head.rotation.y = idle ? Math.sin(t * 0.5 + a.phase) * 0.35 * (1 - st.graze) : 0;
    // tail + ears
    tail.rotation.z = Math.sin(t * (a.state === 'chase' ? 6 : 2) + a.phase) * (type === 'jaguar' ? 0.35 : 0.2);
    st.flick -= dt; if (st.flick <= 0 && Math.random() < dt * 0.4) st.flick = 0.25;
    head.children.forEach((c) => { if (c.userData.s) c.rotation.x = 0.2 + (st.flick > 0 ? Math.sin(st.flick * 40) * 0.25 : 0); });
    // hit flash
    const hit = Math.max(0, a.hitFlash || 0); if (hit > 0) a.hitFlash = hit - dt * 5;
    furMat.emissive.setRGB(hit * 0.6, 0, 0);
  }
  return { g, legs, head, tail, animate, spec: sp };
}
