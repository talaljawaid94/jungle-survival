import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mulberry32, Noise, clamp } from './noise.js';
import { hasHeroModel, createModelRig } from './heroModel.js';

// ===================================================================== textures
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function ctex(c, srgb = true, repeat = true) { const t = new THREE.CanvasTexture(c); if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }

function weaveBump(seed, kind) {            // twill / canvas / felt / leather-grain bump maps
  const S = 128, c = cv(S, S), x = c.getContext('2d'), r = mulberry32(seed);
  x.fillStyle = '#808080'; x.fillRect(0, 0, S, S);
  if (kind === 'twill') for (let i = -S; i < S * 2; i += 3) { x.strokeStyle = `rgba(${r() > 0.5 ? 255 : 30},${r() > 0.5 ? 255 : 30},${r() > 0.5 ? 255 : 30},0.28)`; x.lineWidth = 1.2; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + S, S); x.stroke(); }
  if (kind === 'canvas') for (let i = 0; i < S; i += 2) { x.fillStyle = `rgba(255,255,255,${0.1 + r() * 0.14})`; x.fillRect(i, 0, 1, S); x.fillStyle = `rgba(0,0,0,${0.1 + r() * 0.12})`; x.fillRect(0, i, S, 1); }
  if (kind === 'felt' || kind === 'leather') for (let i = 0; i < 2600; i++) { const v = (r() * 255) | 0; x.fillStyle = `rgba(${v},${v},${v},${kind === 'felt' ? 0.22 : 0.3})`; x.fillRect(r() * S, r() * S, kind === 'felt' ? 2 : 3, kind === 'felt' ? 2 : 3); }
  if (kind === 'leather') for (let i = 0; i < 40; i++) { x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 1; x.beginPath(); x.moveTo(r() * S, r() * S); x.lineTo(r() * S, r() * S); x.stroke(); }
  return ctex(c, false);
}

function eyeTexture() {
  const W = 512, H = 256, c = cv(W, H), x = c.getContext('2d');
  x.fillStyle = '#d8d0c2'; x.fillRect(0, 0, W, H);
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(180,120,110,0.28)'); g.addColorStop(0.18, 'rgba(0,0,0,0)'); g.addColorStop(0.82, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(180,120,110,0.2)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const cx = W * 0.25, cy = H * 0.5;                    // front of a SphereGeometry is u = 0.25
  const rad = (r, col0, col1) => { const q = x.createRadialGradient(cx, cy, 0, cx, cy, r); q.addColorStop(0, col0); q.addColorStop(1, col1); x.fillStyle = q; x.beginPath(); x.ellipse(cx, cy, r, r, 0, 0, 7); x.fill(); };
  rad(46, '#3b2410', '#7a4a1e');                         // iris base
  for (let i = 0; i < 70; i++) { const a = Math.random() * 6.28, r1 = 14 + Math.random() * 6, r2 = 34 + Math.random() * 10; x.strokeStyle = `rgba(${Math.random() > 0.5 ? '170,110,50' : '40,22,8'},0.45)`; x.lineWidth = 1; x.beginPath(); x.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); x.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); x.stroke(); }
  x.strokeStyle = 'rgba(15,8,3,0.9)'; x.lineWidth = 3.5; x.beginPath(); x.arc(cx, cy, 45, 0, 7); x.stroke();
  x.fillStyle = '#050403'; x.beginPath(); x.arc(cx, cy, 17, 0, 7); x.fill();
  return ctex(c, true, false);
}

// Face + skin colour map, evaluated per pixel from the same 3D feature positions that shape the head.
const HEAD = { rx: 0.092, ry: 0.104, rz: 0.102 };
function faceTexture() {
  const W = 1024, H = 512, c = cv(W, H), x = c.getContext('2d'), img = x.createImageData(W, H), N = new Noise(77), r = mulberry32(5);
  const base = [0.80, 0.56, 0.42], lip = [0.62, 0.30, 0.28], brow = [0.17, 0.11, 0.07];
  const d2 = (p, q, s) => ((p[0] - q[0]) / s[0]) ** 2 + ((p[1] - q[1]) / s[1]) ** 2 + ((p[2] - q[2]) / s[2]) ** 2;
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const u = px / W, v = py / H, phi = u * Math.PI * 2, th = v * Math.PI;
    const sx = -Math.cos(phi) * Math.sin(th), sy = Math.cos(th), sz = Math.sin(phi) * Math.sin(th);
    const taper = 1 - 0.17 * Math.pow(Math.max(0, -sy), 1.6);
    const P = [sx * HEAD.rx * taper, sy * HEAD.ry, sz * HEAD.rz];
    let cr = base[0], cg = base[1], cb = base[2];
    const n = N.fbm(px * 0.05, py * 0.05, 3) * 0.05 + N.noise2(px * 0.6, py * 0.6) * 0.02;
    cr += n; cg += n * 0.8; cb += n * 0.7;
    if (P[2] > 0) {
      const mix = (t, col, a) => { cr += (col[0] - cr) * a * t; cg += (col[1] - cg) * a * t; cb += (col[2] - cb) * a * t; };
      const ax = Math.abs(P[0]), sgn = Math.sign(P[0]) || 1;
      mix(Math.exp(-d2([ax, P[1], P[2]], [0.055, -0.015, 0.075], [0.026, 0.026, 0.05])), [0.86, 0.45, 0.38], 0.32);        // cheeks
      mix(Math.exp(-d2([ax, P[1], P[2]], [0.033, 0.016, 0.082], [0.02, 0.016, 0.03])), [0.45, 0.28, 0.24], 0.45);            // eye sockets
      mix(Math.exp(-d2([ax, P[1], P[2]], [0.033, 0.034, 0.085], [0.024, 0.008, 0.03])), [0.38, 0.23, 0.17], 0.4);              // lid crease
      mix(Math.exp(-d2([ax, P[1] - ax * 0.1, P[2]], [0.036, 0.037, 0.088], [0.03, 0.0065, 0.03])) * 1.2, brow, 0.97);
      mix(Math.exp(-d2([ax, P[1], P[2]], [0.034, 0.03, 0.087], [0.019, 0.0035, 0.03])), [0.12, 0.07, 0.05], 0.85);               // upper lash line
      mix(Math.exp(-d2([ax, P[1], P[2]], [0.034, 0.004, 0.087], [0.017, 0.003, 0.03])), [0.28, 0.17, 0.14], 0.55);               // lower lid line                    // brows
      mix(Math.exp(-d2([P[0], P[1], P[2]], [0, -0.052, 0.093], [0.027, 0.0068, 0.03])), lip, 0.9);                              // upper lip
      mix(Math.exp(-d2([P[0], P[1], P[2]], [0, -0.062, 0.091], [0.023, 0.0072, 0.03])), [0.58, 0.27, 0.25], 0.9);              // lower lip
      mix(Math.exp(-d2([P[0], P[1], P[2]], [0, -0.0575, 0.094], [0.029, 0.0012, 0.03])), [0.18, 0.06, 0.06], 0.95);           // mouth line
      mix(Math.exp(-d2([ax, P[1], P[2]], [0.009, -0.026, 0.1], [0.006, 0.005, 0.03])), [0.22, 0.1, 0.08], 0.9);               // nostrils
      mix(Math.exp(-d2([ax, P[1], P[2]], [0.03, -0.05, 0.082], [0.008, 0.02, 0.03])), [0.55, 0.35, 0.28], 0.25);              // nasolabial
      mix(Math.exp(-d2([ax, P[1], P[2]], [0.034, 0.0, 0.084], [0.024, 0.011, 0.03])), [0.5, 0.34, 0.32], 0.34);              // under-eye shadow
      mix(Math.exp(-d2([P[0], P[1], P[2]], [0, -0.004, 0.098], [0.02, 0.034, 0.03])), [0.9, 0.48, 0.38], 0.28);               // sunburnt nose
      mix(Math.exp(-d2([ax, P[1], P[2]], [0.058, 0.0, 0.07], [0.03, 0.03, 0.04])), [0.88, 0.5, 0.4], 0.2);                     // sunburnt cheeks
      mix(Math.exp(-d2([P[0], P[1], P[2]], [0, 0.07, 0.085], [0.05, 0.02, 0.04])), [0.86, 0.5, 0.4], 0.16);                   // forehead
      const dn = N.fbm(px * 0.035 + 9, py * 0.035, 3); if (dn > 0.2) mix(1, [0.5, 0.36, 0.26], clamp((dn - 0.2) * 1.1, 0, 0.3));  // grime / sweat smudges
      const seg = (a, b) => { const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2], t = clamp(((P[0] - a[0]) * abx + (P[1] - a[1]) * aby + (P[2] - a[2]) * abz) / (abx * abx + aby * aby + abz * abz), 0, 1); return Math.hypot(P[0] - a[0] - abx * t, P[1] - a[1] - aby * t, P[2] - a[2] - abz * t); };
      const sc = seg([0.066, 0.004, 0.066], [0.047, -0.03, 0.084]); mix(Math.exp(-((sc / 0.0016) ** 2)), [0.62, 0.14, 0.12], 0.85);   // cheek scratch
      const sc2 = seg([-0.05, 0.05, 0.088], [-0.03, 0.044, 0.094]); mix(Math.exp(-((sc2 / 0.0014) ** 2)), [0.5, 0.1, 0.09], 0.8);       // brow cut
      // stubble on lower face
      const jaw = Math.exp(-d2([P[0], P[1], P[2]], [0, -0.07, 0.07], [0.07, 0.04, 0.06])) + Math.exp(-d2([P[0], P[1], P[2]], [0, -0.04, 0.09], [0.035, 0.012, 0.04])) * 0.7;
      if (jaw > 0.18 && r() < jaw * 0.55) { cr *= 0.82; cg *= 0.8; cb *= 0.82; }
    }
    if (sy < -0.55) { const k = Math.min(1, (-sy - 0.55) / 0.4); cr *= 1 - k * 0.2; cg *= 1 - k * 0.2; cb *= 1 - k * 0.2; }
    const i = (py * W + px) * 4; img.data[i] = clamp(cr, 0, 1) * 255; img.data[i + 1] = clamp(cg, 0, 1) * 255; img.data[i + 2] = clamp(cb, 0, 1) * 255; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return ctex(c, true, false);
}

function skinBump() {
  const S = 256, c = cv(S, S), x = c.getContext('2d'), r = mulberry32(3);
  x.fillStyle = '#808080'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 5000; i++) { const v = (r() * 255) | 0; x.fillStyle = `rgba(${v},${v},${v},0.35)`; x.fillRect(r() * S, r() * S, 1.5, 1.5); }
  return ctex(c, false);
}


// periodic (wraps around u) fbm so lathe seams stay invisible
function tnoise(N, px, py, S, f, oct = 3) { const a = px / S * Math.PI * 2, R = f * S / (Math.PI * 2); return N.fbm(Math.cos(a) * R + 40, Math.sin(a) * R + py * f, oct); }

// worn, dirty cloth colour map: mottled fibre, hem grime, sweat stains, wear patches. v=0 (canvas bottom) is the hem / cuff.
function clothTex(seed, hex, o = {}) {
  const S = 256, c = cv(S, S), x = c.getContext('2d'), img = x.createImageData(S, S), N = new Noise(seed), N2 = new Noise(seed + 9), r = mulberry32(seed);
  const b = new THREE.Color(hex), br = b.r * 255, bg = b.g * 255, bb = b.b * 255, dirt = o.dirt ?? 0.5, hem = o.hem ?? 0.6, soil = o.soil || [100, 84, 60];
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const t = 1 - py / S;
    let n = tnoise(N, px, py, S, 0.018, 4) * 30 + tnoise(N2, px, py, S, 0.22, 2) * 9 + (r() - 0.5) * 9;
    const g = Math.exp(-t * 4.2) * hem + Math.max(0, tnoise(N2, px + 70, py, S, 0.03, 3) - 0.1) * dirt * 1.6;
    const sweat = o.sweat ? Math.max(0, tnoise(N, px + 120, py + 40, S, 0.045, 2) - 0.18) * o.sweat : 0;
    const k = clamp(g, 0, 0.85) * 0.62;
    const R = br + n, G = bg + n * 0.95, B = bb + n * 0.85;
    const i = (py * S + px) * 4;
    img.data[i] = clamp((R + (soil[0] - R) * k) * (1 - sweat * 0.35), 0, 255); img.data[i + 1] = clamp((G + (soil[1] - G) * k) * (1 - sweat * 0.35), 0, 255); img.data[i + 2] = clamp((B + (soil[2] - B) * k) * (1 - sweat * 0.3), 0, 255); img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  if (o.weave) for (let i = -S; i < S * 2; i += o.weave === 'denim' ? 2 : 3) { x.strokeStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},0.022)`; x.lineWidth = 1; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + S, S); x.stroke(); }
  for (let i = 0; i < (o.tears || 0); i++) { const px = r() * S, py = S * (0.55 + r() * 0.4); x.fillStyle = 'rgba(20,14,8,0.5)'; x.beginPath(); x.ellipse(px, py, 3 + r() * 5, 1 + r() * 2, r() * 3, 0, 7); x.fill(); }
  for (let i = 0; i < (o.creases || 0); i++) { const py = r() * S, px = r() * S; x.strokeStyle = `rgba(0,0,0,${0.06 + r() * 0.06})`; x.lineWidth = 1.5; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 20 + r() * 20, py + (r() - 0.5) * 10, px + 40 + r() * 30, py + (r() - 0.5) * 16); x.stroke(); }
  const t = ctex(c, true, true); return t;
}

// forearm / hand skin: freckles, sun, scratches, dirt, a bruise
function armTex(seed) {
  const S = 256, c = cv(S, S), x = c.getContext('2d'), img = x.createImageData(S, S), N = new Noise(seed), r = mulberry32(seed);
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const n = tnoise(N, px, py, S, 0.03, 4) * 0.08 + (r() - 0.5) * 0.03, t = 1 - py / S, red = Math.max(0, tnoise(N, px + 60, py, S, 0.02, 2)) * 0.12;
    const i = (py * S + px) * 4; img.data[i] = clamp(0.78 + n + red, 0, 1) * 255; img.data[i + 1] = clamp(0.55 + n * 0.85 - red * 0.5, 0, 1) * 255; img.data[i + 2] = clamp(0.4 + n * 0.7 - red * 0.6, 0, 1) * 255; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(120,70,40,${0.1 + r() * 0.14})`; x.beginPath(); x.arc(r() * S, r() * S, 0.8 + r() * 1.4, 0, 7); x.fill(); }
  for (let i = 0; i < 90; i++) { const px = r() * S, py = r() * S; x.strokeStyle = `rgba(40,24,14,${0.04 + r() * 0.05})`; x.lineWidth = 1; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 6, py + 10 + r() * 22); x.stroke(); }
  for (let i = 0; i < 4; i++) { const px = r() * S, py = S * (0.2 + r() * 0.6); x.strokeStyle = 'rgba(150,40,34,0.55)'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 12 + r() * 14, py + (r() - 0.5) * 10); x.stroke(); x.strokeStyle = 'rgba(90,24,20,0.35)'; x.lineWidth = 0.8; x.stroke(); }
  const bx = S * 0.7, by = S * 0.42; const q = x.createRadialGradient(bx, by, 0, bx, by, 26); q.addColorStop(0, 'rgba(96,60,92,0.5)'); q.addColorStop(1, 'rgba(96,60,92,0)'); x.fillStyle = q; x.fillRect(bx - 30, by - 30, 60, 60);
  const gd = x.createLinearGradient(0, S, 0, S * 0.7); gd.addColorStop(0, 'rgba(60,44,30,0.4)'); gd.addColorStop(1, 'rgba(60,44,30,0)'); x.fillStyle = gd; x.fillRect(0, S * 0.7, S, S * 0.3);
  return ctex(c, true, true);
}

// hair: fine strands running crown -> ends, dark roots, warm highlights
function hairTex() {
  const S = 256, c = cv(S, S), x = c.getContext('2d'), r = mulberry32(21);
  x.fillStyle = '#241509'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 1800; i++) { const px = r() * S, py = r() * S, l = 14 + r() * 30, v = r(); x.strokeStyle = v > 0.82 ? `rgba(120,86,48,${0.2 + r() * 0.25})` : v > 0.4 ? `rgba(60,38,20,${0.3 + r() * 0.3})` : `rgba(8,4,2,${0.3 + r() * 0.3})`; x.lineWidth = 0.7 + r() * 0.8; x.beginPath(); x.moveTo(px, py); x.bezierCurveTo(px + (r() - 0.5) * 3, py + l * 0.3, px + (r() - 0.5) * 5, py + l * 0.7, px + (r() - 0.5) * 6, py + l); x.stroke(); }
  return ctex(c, true, true);
}

// ===================================================================== materials
const M = {};
function initMaterials() {
  if (M.ready) return; M.ready = true;
  const twill = weaveBump(1, 'twill'), canvasB = weaveBump(2, 'canvas'), felt = weaveBump(3, 'felt'), leather = weaveBump(4, 'leather');
  [twill, canvasB, felt, leather].forEach((t) => t.repeat.set(3, 3));
  const std = (o) => new THREE.MeshStandardMaterial(o);
  M.skin = new THREE.MeshPhysicalMaterial({ map: faceTexture(), bumpMap: skinBump(), bumpScale: 0.25, roughness: 0.52, sheen: 0.6, sheenColor: new THREE.Color(0.9, 0.55, 0.45), sheenRoughness: 0.5, clearcoat: 0.08, clearcoatRoughness: 0.5 });
  M.skinArm = new THREE.MeshPhysicalMaterial({ map: armTex(31), bumpMap: skinBump(), bumpScale: 0.25, roughness: 0.55, sheen: 0.5, sheenColor: new THREE.Color(0.9, 0.55, 0.45) });
  M.skinPlain = new THREE.MeshPhysicalMaterial({ color: 0xc58b68, bumpMap: skinBump(), bumpScale: 0.2, roughness: 0.55, sheen: 0.5, sheenColor: new THREE.Color(0.9, 0.55, 0.45) });
  M.shirt = new THREE.MeshPhysicalMaterial({ map: clothTex(41, '#a8a487', { dirt: 0.7, hem: 0.55, sweat: 1.4, weave: 'canvas', creases: 14, tears: 3 }), color: 0xffffff, roughness: 0.92, bumpMap: canvasB, bumpScale: 0.6, sheen: 0.25, sheenColor: new THREE.Color(1, 0.95, 0.85), sheenRoughness: 0.8 });
  M.shirtDark = new THREE.MeshPhysicalMaterial({ map: clothTex(42, '#9a9679', { dirt: 0.9, hem: 0.9, weave: 'canvas' }), color: 0xffffff, roughness: 0.92, bumpMap: canvasB, bumpScale: 0.6 });
  M.vest = new THREE.MeshPhysicalMaterial({ map: clothTex(43, '#58633a', { dirt: 0.9, hem: 0.7, soil: [84, 72, 48], weave: 'canvas', creases: 10, tears: 2 }), color: 0xffffff, roughness: 0.88, bumpMap: canvasB, bumpScale: 1.0, sheen: 0.4, sheenColor: new THREE.Color(0.6, 0.7, 0.4), side: THREE.DoubleSide });
  M.vestDark = std({ map: clothTex(44, '#4a5733', { dirt: 0.8, hem: 0.5, weave: 'canvas' }), color: 0xffffff, roughness: 0.9, bumpMap: canvasB, bumpScale: 1.0 });
  M.pants = new THREE.MeshPhysicalMaterial({ map: clothTex(45, '#34414a', { dirt: 1.0, hem: 1.0, soil: [104, 92, 72], weave: 'denim', creases: 26, tears: 4 }), color: 0xffffff, roughness: 0.86, bumpMap: twill, bumpScale: 1.2, sheen: 0.35, sheenColor: new THREE.Color(0.4, 0.6, 0.7) });
  M.boot = std({ map: clothTex(48, '#7a4e2e', { dirt: 0.9, hem: 0.7, soil: [110, 88, 62], creases: 18 }), color: 0xffffff, roughness: 0.62, bumpMap: leather, bumpScale: 1.2 });
  M.bootCuff = std({ color: 0x5f3a1c, roughness: 0.6, bumpMap: leather, bumpScale: 1.2 });
  M.sole = std({ color: 0x1a110c, roughness: 0.95 });
  M.leather = std({ map: clothTex(49, '#7a4c2c', { dirt: 0.5, hem: 0.15, creases: 10 }), color: 0xffffff, roughness: 0.55, bumpMap: leather, bumpScale: 1.0 });
  M.gold = new THREE.MeshStandardMaterial({ color: 0x8c7648, roughness: 0.5, metalness: 0.75 });
  M.metal = new THREE.MeshStandardMaterial({ color: 0x9aa0a4, roughness: 0.35, metalness: 0.9 });
  M.hat = new THREE.MeshPhysicalMaterial({ map: clothTex(46, '#85704f', { dirt: 1.0, hem: 0.2, sweat: 2.0, soil: [64, 48, 30], creases: 6 }), color: 0xffffff, roughness: 0.95, bumpMap: felt, bumpScale: 1.4, sheen: 0.35, sheenColor: new THREE.Color(0.9, 0.8, 0.6), sheenRoughness: 0.9, side: THREE.DoubleSide });
  M.hair = new THREE.MeshPhysicalMaterial({ map: hairTex(), color: 0xffffff, roughness: 0.55, bumpMap: hairTex(), bumpScale: 1.6, sheen: 1, sheenColor: new THREE.Color(0.5, 0.35, 0.2), sheenRoughness: 0.35 });
  M.pack = std({ map: clothTex(47, '#75613c', { dirt: 0.9, hem: 0.5, creases: 12 }), color: 0xffffff, roughness: 0.9, bumpMap: canvasB, bumpScale: 1.0 });
  M.roll = std({ map: clothTex(50, '#475033', { dirt: 0.8, hem: 0.3 }), color: 0xffffff, roughness: 0.92, bumpMap: canvasB, bumpScale: 1.0 });
  M.rope = std({ color: 0xb9a374, roughness: 0.95 });
  M.white = new THREE.MeshPhysicalMaterial({ color: 0xf2efe6, roughness: 0.4 });
  M.eye = new THREE.MeshPhysicalMaterial({ map: eyeTexture(), roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 });
  M.dark = std({ color: 0x120c0a, roughness: 0.5 });
  M.patch = std({ color: 0x9c8a4c, roughness: 0.7 });
  M.bandage = std({ color: 0xe9e3d3, roughness: 0.9 });
  M.blood = std({ color: 0x6a1a14, roughness: 0.7 });
}

// ===================================================================== geometry helpers
const V2 = (a) => a.map((p) => new THREE.Vector2(p[0], p[1]));
const lathe = (pts, seg = 28, ps = 0, pl = Math.PI * 2) => new THREE.LatheGeometry(V2(pts), seg, ps, pl);
const rbox = (w, h, d, r = 0.01, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.0005, h / 2 - 0.0005, d / 2 - 0.0005));
function mesh(geo, mat, x = 0, y = 0, z = 0, cast = true) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; return m; }
const grp = (x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); return g; };

// limb profile builder: radius table along a length, y runs from -len (bottom) to 0 (top)
function limbGeo(len, rTop, rBot, bulge = 0, bulgeAt = 0.4, seg = 20) {
  const pts = [[0.0001, -len]]; const N = 10;
  for (let i = 0; i <= N; i++) {
    const t = i / N, y = -len + t * len;                               // bottom -> top
    const r = rBot + (rTop - rBot) * t + bulge * Math.exp(-Math.pow((t - (1 - bulgeAt)) / 0.22, 2));
    const cap = i === 0 ? 0.55 : i === N ? 0.7 : 1; pts.push([r * cap, y]);
  }
  pts.push([0.0001, 0]); return lathe(pts, seg);
}

function jitterVerts(geo, amt, seed) {
  const p = geo.attributes.position, n = new Noise(seed), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = n.noise2(v.x * 40, v.y * 40 + v.z * 25) * amt; v.multiplyScalar(1 + k); p.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals(); return geo;
}

// ===================================================================== head
function buildHead() {
  const g = grp();
  const sg = new THREE.SphereGeometry(1, 72, 54), p = sg.attributes.position, nrm = new THREE.Vector3(), v = new THREE.Vector3();
  const feats = [
    // [x, y, z, rx, ry, rz, amp, mirror]
    [0.0, -0.012, 0.100, 0.011, 0.016, 0.028, 0.017, 0],         // nose tip
    [0.0, 0.02, 0.097, 0.009, 0.034, 0.03, 0.010, 0],             // nose bridge
    [0.015, -0.02, 0.092, 0.009, 0.011, 0.02, 0.008, 1],          // nostril wings
    [0.034, 0.04, 0.09, 0.032, 0.014, 0.028, 0.016, 1],           // brow ridge
    [0.0, 0.04, 0.094, 0.015, 0.015, 0.02, 0.005, 0],             // glabella
    [0.034, 0.016, 0.086, 0.021, 0.017, 0.028, -0.015, 1],         // eye sockets
    [0.056, -0.012, 0.074, 0.026, 0.026, 0.045, 0.008, 1],         // cheekbones
    [0.0, -0.052, 0.094, 0.026, 0.0078, 0.03, 0.008, 0],           // upper lip
    [0.0, -0.062, 0.092, 0.023, 0.009, 0.03, 0.009, 0],           // lower lip
    [0.0, -0.0575, 0.094, 0.029, 0.0016, 0.03, -0.007, 0],        // mouth line
    [0.0, -0.086, 0.076, 0.026, 0.02, 0.04, 0.017, 0],            // chin
    [0.064, -0.054, 0.012, 0.028, 0.044, 0.05, 0.013, 1],           // jaw angle
    [0.0, 0.07, 0.084, 0.05, 0.03, 0.04, 0.005, 0],               // forehead
  ];
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); nrm.copy(v);
    const taper = 1 - 0.17 * Math.pow(Math.max(0, -v.y), 1.6);
    const bx = v.x * HEAD.rx * taper, by = v.y * HEAD.ry, bz = v.z * HEAD.rz * (v.z > 0 ? 1 - 0.1 * Math.max(0, -v.y) : 1);
    let d = 0;
    for (const f of feats) for (const m of f[7] ? [1, -1] : [1]) {
      const dx = (bx - f[0] * m) / f[3], dy = (by - f[1]) / f[4], dz = (bz - f[2]) / f[5], q = dx * dx + dy * dy + dz * dz;
      if (q < 9) d += f[6] * Math.exp(-q);
    }
    const len = Math.hypot(bx / HEAD.rx, by / HEAD.ry, bz / HEAD.rz) || 1;
    p.setXYZ(i, bx + (bx / HEAD.rx / len) * d * 0.9, by + (by / HEAD.ry / len) * d, bz + (bz / HEAD.rz / len) * d);
  }
  sg.computeVertexNormals();
  g.add(mesh(sg, M.skin, 0, 0, 0));
  // ears
  for (const s of [-1, 1]) {
    const eg = new THREE.SphereGeometry(1, 20, 16); const ep = eg.attributes.position;
    for (let i = 0; i < ep.count; i++) { v.fromBufferAttribute(ep, i); const dent = Math.exp(-((v.y * 0.7) ** 2 + (v.z * 0.7) ** 2) * 2.2) * (v.x * s > 0 ? 0.5 : 0); ep.setXYZ(i, (v.x - s * dent * 0.5) * 0.007, v.y * 0.026, v.z * 0.018); }
    eg.computeVertexNormals(); const e = mesh(eg, M.skinPlain, s * 0.079, -0.002, -0.005); e.rotation.y = -s * 0.25; g.add(e);
  }
  // eyes + lids
  const lids = [];
  for (const s of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.0125, 28, 20), M.eye, s * 0.0335, 0.018, 0.0825, false); eye.rotation.y = 0; g.add(eye);
    const mk = (up) => {
      const lg = new THREE.SphereGeometry(0.0128, 22, 14, 0, Math.PI * 2, up ? 0 : Math.PI * 0.62, up ? Math.PI * 0.46 : Math.PI * 0.38);
      const lid = mesh(lg, M.skinPlain, 0, 0, 0, false); const pivot = grp(s * 0.0335, 0.018, 0.0825); pivot.add(lid); g.add(pivot); return pivot;
    };
    const up = mk(true), low = mk(false); up.rotation.x = 0.62; lids.push({ up, low, s });
  }
  // hair: clumpy cap + sideburns
  const hg = new THREE.SphereGeometry(1, 56, 44, 0, Math.PI * 2, 0, Math.PI * 0.76), hp = hg.attributes.position, hn = new Noise(12);
  for (let i = 0; i < hp.count; i++) {
    v.fromBufferAttribute(hp, i); const k = 1 + hn.noise2(v.x * 9, v.z * 9 + v.y * 5) * 0.06 + hn.noise2(v.x * 26, v.y * 26) * 0.02;
    let sc = 1; if (v.z > 0.05) sc = 1 - 0.2 * THREE.MathUtils.smoothstep(0.62 - v.y, 0.0, 0.25) * THREE.MathUtils.smoothstep(v.z, 0.05, 0.4);   // hairline: tuck the front edge into the skull
    if (v.y < 0.35 && Math.abs(v.x) < 0.8 && v.z > 0.05) sc *= 0.82;
    if (v.z > -0.15 && v.y < 0.42 && Math.abs(v.x) < 0.86) sc *= 0.78;          // keep the face clear: the longer cap only reaches down the back and over the ears
    if (v.z < -0.1 && v.y < -0.2) sc *= 1 - 0.1 * THREE.MathUtils.smoothstep(-v.y, 0.2, 0.7);   // tapered nape
    hp.setXYZ(i, v.x * (HEAD.rx + 0.007) * k * sc, v.y * (HEAD.ry + 0.006) * k + 0.004, v.z * (HEAD.rz + 0.008) * k * sc - 0.004);
  }
  hg.computeVertexNormals(); g.add(mesh(hg, M.hair, 0, 0.002, -0.004));
  for (const s of [-1, 1]) g.add(mesh(rbox(0.004, 0.034, 0.02, 0.002), M.hair, s * 0.0745, 0.002, 0.012));
  return { g, lids };
}

// ===================================================================== hat
function buildHat() {
  const g = grp();
  const crownPts = [[0.0001, 0.108], [0.05, 0.11], [0.094, 0.104], [0.108, 0.086], [0.112, 0.05], [0.116, 0.01], [0.12, 0]];
  const cg = lathe(crownPts, 40); const cp = cg.attributes.position;
  for (let i = 0; i < cp.count; i++) { const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i); const dent = y > 0.085 ? 0.022 * Math.exp(-(x * x) / 0.0018) * Math.min(1, (y - 0.085) / 0.03) : 0; const pinch = y > 0.04 ? Math.exp(-(z * z) / 0.004) * 0.006 * (z > 0 ? 1 : 0.4) : 0; cp.setXYZ(i, x * (1 - pinch * 6), y - dent, z); }
  cg.computeVertexNormals(); g.add(mesh(cg, M.hat, 0, 0, 0));
  const R = 0.232, bpts = [[0.108, 0.004], [0.14, 0.001], [0.19, -0.002], [0.24, 0.002], [R, 0.014], [R, 0.008], [0.24, -0.004], [0.19, -0.006], [0.14, -0.004], [0.108, -0.002]];
  const bg = lathe(bpts.concat([[0.108, 0.004]]), 64), bp = bg.attributes.position;
  for (let i = 0; i < bp.count; i++) { const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i), rr = Math.hypot(x, z) / R; bp.setY(i, y + 0.07 * Math.pow(Math.abs(x) / R, 2) * rr - 0.026 * Math.pow(Math.max(0, z) / R, 2) * rr + 0.012 * Math.pow(Math.max(0, -z) / R, 2) * rr); }
  bg.computeVertexNormals(); { const bm = mesh(bg, M.hat, 0, 0, 0); bm.scale.set(0.84, 1, 0.84); g.add(bm); }
  g.add(mesh(lathe([[0.1, 0.0], [0.116, 0.0], [0.116, 0.036], [0.1, 0.036]], 40), M.leather, 0, 0.014, 0));
  return g;
}

// ===================================================================== boots
function buildBoot(s) {
  const g = grp();
  g.add(mesh(lathe([[0.0001, 0.0], [0.058, 0.0], [0.066, 0.12], [0.07, 0.22], [0.074, 0.27], [0.0001, 0.27]], 24), M.boot, 0, 0.065, 0));
  g.add(mesh(lathe([[0.071, 0.0], [0.085, 0.0], [0.088, 0.045], [0.08, 0.06], [0.071, 0.05]], 24), M.bootCuff, 0, 0.29, 0));
  const foot = mesh(rbox(0.1, 0.07, 0.25, 0.03), M.boot, 0, 0.045, 0.07); g.add(foot);
  const toe = mesh(new THREE.SphereGeometry(0.052, 18, 12), M.boot, 0, 0.042, 0.178); toe.scale.set(0.98, 0.74, 1.1); g.add(toe);
  g.add(mesh(rbox(0.105, 0.022, 0.29, 0.01), M.sole, 0, 0.012, 0.075));
  g.add(mesh(rbox(0.09, 0.03, 0.06, 0.008), M.sole, 0, 0.016, -0.06));
  for (let i = 0; i < 5; i++) { const y = 0.1 + i * 0.045, lace = mesh(rbox(0.065, 0.007, 0.008, 0.003, 2), M.rope, 0, y, 0.069 - i * 0.003, false); lace.rotation.z = i % 2 ? 0.28 : -0.28; g.add(lace); }
  const tongue = mesh(rbox(0.04, 0.2, 0.012, 0.005), M.bootCuff, 0, 0.19, 0.066); tongue.rotation.x = -0.04; g.add(tongue);
  return g;
}

// ===================================================================== hands
function buildHand(s) {
  const g = grp(); const hand = grp(); g.add(hand);
  const palm = mesh(new THREE.SphereGeometry(1, 20, 14), M.skinArm, 0, -0.054, 0); palm.scale.set(0.041, 0.05, 0.0175); hand.add(palm);
  const heel = mesh(new THREE.SphereGeometry(1, 14, 10), M.skinArm, -0.014 * s, -0.026, 0.006); heel.scale.set(0.03, 0.034, 0.016); hand.add(heel);
  const nailM = new THREE.MeshPhysicalMaterial({ color: 0xd9b5a4, roughness: 0.3, clearcoat: 0.6 });
  const fingers = [];
  const L = [0.052, 0.058, 0.054, 0.042], X = [-0.028, -0.009, 0.01, 0.028];
  for (let i = 0; i < 4; i++) {
    const f1 = grp(X[i] * s, -0.098, 0), f2 = grp(0, -L[i] * 0.55, 0), a = new THREE.CapsuleGeometry(0.0105, L[i] * 0.5, 4, 8), b = new THREE.CapsuleGeometry(0.0095, L[i] * 0.45, 4, 8);
    f1.add(mesh(a, M.skinArm, 0, -L[i] * 0.3, 0, false)); f2.add(mesh(b, M.skinArm, 0, -L[i] * 0.25, 0, false)); const nl = mesh(new THREE.SphereGeometry(0.0072, 8, 6), nailM, 0, -L[i] * 0.47, 0.0075, false); nl.scale.set(1, 1.35, 0.4); f2.add(nl); f1.add(f2); hand.add(f1); fingers.push({ f1, f2 });
  }
  const t1 = grp(-0.04 * s, -0.04, 0.008), t2 = grp(0, -0.035, 0); t1.add(mesh(new THREE.CapsuleGeometry(0.0125, 0.03, 4, 8), M.skinArm, 0, -0.02, 0, false)); t2.add(mesh(new THREE.CapsuleGeometry(0.0108, 0.026, 4, 8), M.skinArm, 0, -0.018, 0, false)); t2.add(mesh(new THREE.SphereGeometry(0.0074, 8, 6), nailM, 0, -0.03, 0.007, false)).scale.set(1, 1.3, 0.4); t1.add(t2); t1.rotation.z = 0.5 * s; hand.add(t1);
  const hold = grp(0, -0.075, 0.012); hand.add(hold);
  return { g, hand, fingers, thumb: { t1, t2 }, hold };
}

// ===================================================================== tools (held in the right hand)
function buildTools() {
  const T = {};
  const tool = (name, fn) => { const g = grp(); g.visible = false; fn(g); T[name] = g; };
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.85, bumpMap: weaveBump(9, 'felt'), bumpScale: 1.5 }), stone = new THREE.MeshStandardMaterial({ color: 0x84847c, roughness: 0.95 });
  tool('knife', (g) => { g.add(mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.11, 10), M.leather, 0, -0.01, 0)); g.add(mesh(rbox(0.1, 0.012, 0.028, 0.004), M.gold, 0, 0.05, 0)); const b = mesh(new THREE.BoxGeometry(0.005, 0.17, 0.034), M.metal, 0, 0.14, 0); g.add(b); const tip = mesh(new THREE.ConeGeometry(0.017, 0.04, 4), M.metal, 0, 0.245, 0); tip.scale.set(0.3, 1, 1); g.add(tip); });
  tool('stone_axe', (g) => { g.add(mesh(new THREE.CylinderGeometry(0.017, 0.021, 0.7, 10), wood, 0, 0.14, 0)); const h = mesh(rbox(0.07, 0.15, 0.2, 0.025), stone, 0, 0.42, 0.06); h.rotation.z = 0.08; g.add(h); for (let i = 0; i < 4; i++) g.add(mesh(new THREE.TorusGeometry(0.022, 0.004, 5, 14), M.rope, 0, 0.375 + i * 0.01, 0, false)); });
  tool('spear', (g) => { g.add(mesh(new THREE.CylinderGeometry(0.016, 0.02, 2.0, 10), wood, 0, 0.45, 0)); g.add(mesh(new THREE.ConeGeometry(0.036, 0.22, 6), stone, 0, 1.55, 0)); for (let i = 0; i < 4; i++) g.add(mesh(new THREE.TorusGeometry(0.02, 0.004, 5, 14), M.rope, 0, 1.44 + i * 0.012, 0, false)); });
  tool('torch', (g) => {
    g.add(mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.52, 10), wood, 0, 0.1, 0)); g.add(mesh(new THREE.CylinderGeometry(0.036, 0.026, 0.1, 10), new THREE.MeshStandardMaterial({ color: 0x1b1008, roughness: 1 }), 0, 0.4, 0));
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 10), new THREE.MeshBasicMaterial({ color: 0xff9a2a })); fl.position.y = 0.52; g.add(fl); g.userData.flame = fl;
    const l = new THREE.PointLight(0xff9a40, 0, 30, 1.25); l.position.y = 0.55; g.add(l); g.userData.light = l;
  });
  tool('flare', (g) => { g.add(mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.3, 10), new THREE.MeshStandardMaterial({ color: 0xc01818, roughness: 0.5 }), 0, 0.05, 0)); const fl = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), new THREE.MeshBasicMaterial({ color: 0xff3a3a })); fl.position.y = 0.24; g.add(fl); g.userData.flame = fl; const l = new THREE.PointLight(0xff3030, 0, 55, 1.2); l.position.y = 0.3; g.add(l); g.userData.light = l; });
  tool('bottle', (g) => { g.add(mesh(new THREE.CylinderGeometry(0.036, 0.038, 0.2, 14), new THREE.MeshPhysicalMaterial({ color: 0x4aa8d8, roughness: 0.1, transmission: 0.5, transparent: true, opacity: 0.8 }), 0, 0.05, 0)); g.add(mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 10), M.metal, 0, 0.165, 0)); });
  return T;
}

// ===================================================================== the hero
export function createCharacter() {
  initMaterials();
  const root = new THREE.Group(), body = grp(); root.add(body);
  const J = {};      // joints for the pose blender
  const joint = (name, g) => { J[name] = { g, tx: 0, ty: 0, tz: 0 }; return g; };

  // ---- pelvis / legs
  const pelvis = joint('pelvis', grp(0, 0.93, 0)); body.add(pelvis);
  pelvis.add(mesh(lathe([[0.0001, -0.11], [0.12, -0.1], [0.152, -0.04], [0.16, 0.03], [0.15, 0.08], [0.0001, 0.08]], 28), M.pants, 0, 0, 0)); pelvis.children[0].scale.z = 0.7;
  const legs = {};
  for (const s of [-1, 1]) {
    const hip = joint(s > 0 ? 'hipL' : 'hipR', grp(s * 0.092, -0.035, 0)); pelvis.add(hip);
    hip.add(mesh(limbGeo(0.44, 0.108, 0.074, 0.014, 0.35), M.pants, 0, 0, 0));
    const knee = joint(s > 0 ? 'kneeL' : 'kneeR', grp(0, -0.43, 0)); hip.add(knee);
    knee.add(mesh(limbGeo(0.42, 0.078, 0.066, 0.02, 0.7), M.pants, 0, 0, 0));
    knee.add(mesh(new THREE.SphereGeometry(0.068, 16, 12), M.pants, 0, 0.0, 0.0, false));
    const patch = mesh(rbox(0.1, 0.1, 0.012, 0.008), M.pants, 0, 0.0, 0.066, false); patch.scale.set(1, 1, 1); knee.add(patch);
    const ankle = joint(s > 0 ? 'ankleL' : 'ankleR', grp(0, -0.42, 0)); knee.add(ankle);
    ankle.add(mesh(lathe([[0.0001, -0.02], [0.075, -0.02], [0.08, 0.04], [0.074, 0.12], [0.0001, 0.12]], 22), M.pants, 0, 0.05, 0)); // trouser bloom over the boot top
    const boot = buildBoot(s); boot.position.y = -0.085; ankle.add(boot); legs[s] = { hip, knee, ankle, boot };
  }

  // ---- torso
  const spine = joint('spine', grp(0, 0.07, 0)); pelvis.add(spine);
  const torsoPts = [[0.0001, -0.02], [0.14, -0.02], [0.148, 0.05], [0.152, 0.12], [0.168, 0.22], [0.188, 0.32], [0.2, 0.4], [0.2, 0.46], [0.16, 0.52], [0.09, 0.56], [0.0001, 0.575]];
  const shirt = mesh(lathe(torsoPts, 36), M.shirt, 0, 0, 0); shirt.scale.z = 0.62; spine.add(shirt);
  const chest = joint('chest', grp(0, 0.2, 0)); spine.add(chest);
  // vest (open front) + trim
  const vest = mesh(lathe([[0.157, 0.02], [0.166, 0.08], [0.188, 0.19], [0.208, 0.29], [0.218, 0.36], [0.214, 0.43], [0.19, 0.5]].map((p) => [p[0], p[1] - 0.02]), 40, 0.34, Math.PI * 2 - 0.68), M.vest, 0, 0.0, 0); vest.scale.z = 0.66; spine.add(vest);
  for (const s of [-1, 1]) {
    spine.add(mesh(rbox(0.078, 0.082, 0.028, 0.012), M.vestDark, s * 0.095, 0.12, 0.128 + 0.012 + 0.0));
    const f1 = mesh(rbox(0.082, 0.032, 0.01, 0.006), M.vest, s * 0.095, 0.162, 0.148 + 0.002); f1.rotation.x = 0.1; spine.add(f1);
    spine.add(mesh(rbox(0.066, 0.06, 0.026, 0.01), M.vestDark, s * 0.1, 0.33, 0.123 + 0.004));
    const f2 = mesh(rbox(0.068, 0.026, 0.009, 0.005), M.vest, s * 0.1, 0.355, 0.141 + 0.004); f2.rotation.x = 0.1; spine.add(f2);
  }
  // collar + placket buttons
  for (const s of [-1, 1]) { const col = mesh(rbox(0.06, 0.024, 0.008, 0.004), M.shirt, s * 0.043, 0.545, 0.064); col.rotation.set(-0.35, s * 0.25, s * 0.5); spine.add(col); }
  for (let i = 0; i < 4; i++) spine.add(mesh(new THREE.SphereGeometry(0.0055, 8, 6), M.gold, 0, 0.12 + i * 0.1, 0.099 + 0.018 - i * 0.005, false));
  // belt, buckle, hip pouches
  const belt = mesh(lathe([[0.15, 0.0], [0.157, 0.0], [0.157, 0.06], [0.15, 0.06]], 36), M.leather, 0, 0.0, 0); belt.scale.z = 0.7; spine.add(belt);
  spine.add(mesh(rbox(0.058, 0.05, 0.012, 0.006), M.gold, 0, 0.03, 0.15 * 0.7 + 0.01)); spine.add(mesh(rbox(0.03, 0.025, 0.014, 0.004), M.leather, 0, 0.03, 0.15 * 0.7 + 0.013, false));
  for (const s of [-1, 1]) { const pouch = mesh(rbox(0.07, 0.11, 0.1, 0.014), M.leather, s * 0.178, -0.05, 0.02); spine.add(pouch); spine.add(mesh(rbox(0.074, 0.04, 0.104, 0.012), M.boot, s * 0.178, 0.0, 0.02)); spine.add(mesh(new THREE.SphereGeometry(0.008, 8, 6), M.gold, s * 0.215, -0.012, 0.02, false)); }
  // crossbody strap (right shoulder -> left hip) following the ribcage
  const strapPts = []; for (let i = 0; i <= 10; i++) { const t = i / 10, y = 0.54 - t * 0.5, x = -0.1 + t * 0.26, rr = 0.2 - (0.52 - y) * 0.06 + 0.003; strapPts.push(new THREE.Vector3(x, y, Math.sqrt(Math.max(0.0001, 1 - (x / (rr + 0.04)) ** 2)) * rr * 0.62 + 0.012)); }
  for (let i = 0; i < 10; i++) { const a = strapPts[i], b = strapPts[i + 1], len = a.distanceTo(b); const seg = mesh(rbox(0.04, len * 1.12, 0.008, 0.003, 2), M.leather, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2 + 0.002, false); seg.rotation.z = Math.atan2(b.x - a.x, b.y - a.y) * -1; seg.rotation.x = -Math.atan2(b.z - a.z, len) * 0.0; spine.add(seg); }
  spine.add(mesh(rbox(0.04, 0.045, 0.012, 0.005), M.gold, strapPts[4].x, strapPts[4].y, strapPts[4].z + 0.006, false));
  // backpack with bedroll, bottle, straps
  const pack = joint('pack', grp(0, 0.28, -0.18)); spine.add(pack);
  pack.add(mesh(rbox(0.3, 0.38, 0.15, 0.04, 4), M.pack, 0, 0, 0)); pack.add(mesh(rbox(0.26, 0.14, 0.04, 0.02), M.leather, 0, 0.1, -0.09));
  pack.add(mesh(rbox(0.05, 0.05, 0.012, 0.004), M.gold, 0, 0.04, -0.113, false));
  const roll = mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.34, 18), M.roll, 0, 0.23, -0.02); roll.rotation.z = Math.PI / 2; pack.add(roll);
  for (const x of [-0.1, 0.1]) pack.add(mesh(new THREE.TorusGeometry(0.06, 0.007, 6, 20), M.leather, x, 0.23, -0.02, false)).rotation.y = Math.PI / 2;
  const bottle = mesh(new THREE.CylinderGeometry(0.04, 0.042, 0.2, 14), new THREE.MeshStandardMaterial({ color: 0x56626a, roughness: 0.45, metalness: 0.6 }), 0.18, -0.06, -0.02); pack.add(bottle);
  for (const s of [-1, 1]) { const st = mesh(rbox(0.04, 0.4, 0.012, 0.004), M.leather, s * 0.1, 0.12, 0.08, false); st.rotation.x = 0.0; spine.add(st); st.position.set(s * 0.1, 0.38, 0.04); st.rotation.x = 0.55; st.scale.set(1, 0.75, 1); }
  // neck + head + hat
  const neck = joint('neck', grp(0, 0.575, 0)); spine.add(neck); neck.add(mesh(lathe([[0.0001, 0], [0.066, 0], [0.058, 0.05], [0.056, 0.1], [0.0001, 0.1]], 20), M.skinPlain, 0, -0.025, 0));
  const head = joint('head', grp(0, 0.118, 0.012)); neck.add(head);
  const { g: headG, lids } = buildHead(); head.add(headG);
  const hat = buildHat(); hat.position.set(0, 0.088, -0.016); hat.rotation.x = -0.13; head.add(hat);

  // ---- arms
  const arms = {};
  for (const s of [-1, 1]) {
    const sh = joint(s > 0 ? 'shL' : 'shR', grp(s * 0.205, 0.5, 0)); chest.add(sh); sh.position.y = 0.3;
    sh.add(mesh(new THREE.SphereGeometry(0.056, 20, 16), M.shirt, 0, 0, 0)); sh.add(mesh(limbGeo(0.3, 0.056, 0.05, 0.005, 0.5), M.skinArm, 0, 0, 0));
    const sleeve = mesh(limbGeo(0.17, 0.064, 0.066, 0.004, 0.5), M.shirt, 0, 0, 0); sh.add(sleeve);
    const cuff = mesh(lathe([[0.065, 0], [0.074, 0], [0.076, 0.045], [0.067, 0.045]], 22), M.shirtDark, 0, -0.175, 0); sh.add(cuff);
    const patch = mesh(rbox(0.012, 0.045, 0.05, 0.004), M.patch, s * 0.07, -0.06, 0, false); sh.add(patch);
    const el = joint(s > 0 ? 'elL' : 'elR', grp(0, -0.295, 0)); sh.add(el);
    el.add(mesh(new THREE.SphereGeometry(0.05, 16, 12), M.skinArm, 0, 0, 0, false)); el.add(mesh(limbGeo(0.26, 0.049, 0.036, 0.008, 0.62), M.skinArm, 0, 0, 0));
    const wr = joint(s > 0 ? 'wrL' : 'wrR', grp(0, -0.26, 0)); el.add(wr);
    const hand = buildHand(s); wr.add(hand.g); arms[s] = { sh, el, wr, hand, bandage: null };
  }
  // survival touches: a bandaged forearm and a scrape (the crash)
  const band = mesh(lathe([[0.04, 0], [0.043, 0], [0.043, 0.09], [0.04, 0.09]], 20), M.bandage, 0, -0.16, 0, false); arms[-1].el.add(band);
  const stain = mesh(new THREE.SphereGeometry(0.016, 8, 6), M.blood, 0.03, -0.12, 0.022, false); stain.scale.set(1, 1.4, 0.4); arms[-1].el.add(stain);

  const tools = buildTools(); for (const k in tools) arms[-1].hand.hold.add(tools[k]);
  for (const k in tools) { tools[k].rotation.x = Math.PI / 2; }

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });

  // ================================================================ animation
  const st = { phase: 0, last: 0, attackT: -1, attackKind: 'swing', deadT: 0, t: 0, blinkT: 2 + Math.random() * 3, blink: 0, tool: null, vy: 0, lastSpeed: 0, mw: 0, rw: 0, uw: 0, lw: 0, dip: 0, lastU: 0, accS: 0, land: 0, wasAir: false, packV: 0, packX: 0, look: 0, lookP: 0, slopeS: 0, gather: 0, lean: 0, lean2: 0, crouch: 0 };
  function setTool(name) { st.tool = name; for (const k in tools) tools[k].visible = k === name; }
  function attack() { if (st.attackT < 0) { st.attackT = 0; st.attackKind = st.tool === 'spear' ? 'thrust' : st.tool === 'knife' ? 'slash' : st.tool === 'stone_axe' ? 'chop' : 'swing'; } return true; }

  const reset = () => { for (const k in J) { const j = J[k]; j.tx = 0; j.ty = 0; j.tz = 0; } };
  const set = (name, x, y, z) => { const j = J[name]; if (!j) return; if (x !== undefined) j.tx = x; if (y !== undefined) j.ty = y; if (z !== undefined) j.tz = z; };
  const add = (name, x = 0, y = 0, z = 0) => { const j = J[name]; if (j) { j.tx += x; j.ty += y; j.tz += z; } };
  const fingersCurl = (arm, c, thumb = c) => { for (const f of arm.hand.fingers) { f.f1.rotation.x = c * 1.15; f.f2.rotation.x = c * 1.35; } arm.hand.thumb.t1.rotation.x = thumb * 0.5; arm.hand.thumb.t2.rotation.x = thumb * 0.8; };

  function update(dt, s) {
    // s: { speed, sprint, swim, air, dead, gathering, sleeping, tired, hurt, slope, yawDiff, pitchLook, onStep }
    st.t += dt; const t = st.t, sp = s.speed;
    const k = (r) => 1 - Math.exp(-dt * r);
    reset(); let bodyX = 0, bodyY = 0, bodyZ = 0, bodyRX = 0, bodyRZ = 0, pelvisY = 0.93;

    // locomotion phase: cycle rate follows speed, stride grows when running
    const run = clamp((sp - 3.2) / 3.4, 0, 1), walk = clamp(sp / 3.9, 0, 1.15);
    const stride = 2.4 + run * 1.9, cyc = sp / stride;      // metres per full cycle (two steps): a natural cadence instead of a scurry
    st.accS += (clamp((sp - st.lastSpeed) / Math.max(dt, 1e-3), -30, 30) - st.accS) * (1 - Math.exp(-dt * 8));
    if (st.wasAir && !s.air && !s.swim) st.land = 1; st.wasAir = !!s.air; st.land = Math.max(0, st.land - dt * 3.2);
    st.phase += dt * cyc * Math.PI * 2;
    const ph = st.phase, step = Math.floor(ph / Math.PI);
    if (!s.swim && !s.air && sp > 0.4 && step !== st.last && s.onStep && st.mw < 0.5) s.onStep(); st.last = step;
    const moving = sp > 0.35 && !s.swim && !s.air;
    const legA = (0.6 + run * 0.45) * clamp(sp / 3.9, 0, 1.4), kneeA = (0.95 + run * 0.8) * clamp(sp / 3.9, 0, 1.2);
    const hurtLimp = s.hurt ? 0.5 : 0;

    // head look & blinking (always)
    st.look += (clamp(s.yawDiff || 0, -1.1, 1.1) - st.look) * k(6); st.lookP += (clamp(s.pitchLook || 0, -0.5, 0.6) - st.lookP) * k(6);
    st.blinkT -= dt; if (st.blinkT <= 0) { st.blink = 1; st.blinkT = 2.5 + Math.random() * 3.5; } st.blink = Math.max(0, st.blink - dt * 7);
    const bl = Math.sin(st.blink * Math.PI);
    for (const L of lids) { L.up.rotation.x = -0.28 + bl * 0.62 + (s.tired ? 0.18 : 0); L.low.rotation.x = -bl * 0.35; }

    if (s.dead) {
      st.deadT = Math.min(st.deadT + dt * 1.1, 1); const e = st.deadT * st.deadT * (3 - 2 * st.deadT);
      bodyRX = -e * 1.52; bodyY = e * 0.2; bodyX = 0; set('head', 0.3 * e, 0.3 * e, 0); set('sh' + 'L', 0.1, 0, -0.5 * e); set('shR', 0.1, 0, 0.5 * e); set('hipL', -0.1, 0, 0.2 * e); set('hipR', 0.2, 0, -0.2 * e); set('kneeL', 0.5 * e); set('kneeR', 0.2 * e);
    } else {
      st.deadT = 0;
      // ------- idle breathing & weight shift
      const br = Math.sin(t * (s.tired ? 3.3 : 1.7)), shift = Math.sin(t * 0.45) * (1 - walk);
      add('chest', br * (s.tired ? 0.035 : 0.014)); add('shL', 0, 0, -br * 0.01); add('shR', 0, 0, br * 0.01); add('pelvis', 0, 0, shift * 0.022); add('spine', 0, 0, -shift * 0.012);
      add('head', 0, Math.sin(t * 0.3) * 0.07 * (1 - walk), 0);
      for (const sd of ['L', 'R']) { add('sh' + sd, 0, 0, sd === 'L' ? -0.07 : 0.07); add('el' + sd, -0.14); }
      if (s.tired) { add('spine', 0.16); add('head', 0.14); add('shL', 0.12); add('shR', 0.12); }
      if (hurtLimp) { add('spine', 0.14, 0, 0.1); add('head', 0.1); add('elL', -0.9); add('shL', -0.5, 0, 0.15); }

      if (s.swim) {
        bodyRX = 1.3; bodyY = 0.18; bodyZ = 0.05; pelvisY = 0.93;
        const w = ph * 0.55; set('shL', -2.9 + Math.cos(w) * 1.5, 0, -0.1 - Math.max(0, Math.sin(w)) * 0.5); set('shR', -2.9 - Math.cos(w) * 1.5, 0, 0.1 + Math.max(0, -Math.sin(w)) * 0.5); set('elL', -0.35 - Math.max(0, Math.sin(w)) * 0.6); set('elR', -0.35 - Math.max(0, -Math.sin(w)) * 0.6);
        set('hipL', Math.sin(w * 2) * 0.35); set('hipR', -Math.sin(w * 2) * 0.35); set('kneeL', 0.2 + Math.max(0, Math.sin(w * 2)) * 0.3); set('kneeR', 0.2 + Math.max(0, -Math.sin(w * 2)) * 0.3);
        set('head', -1.1 + Math.sin(w) * 0.1, Math.sin(w * 0.5) * 0.4, 0);
      } else if (s.air) {
        set('hipL', -0.7, 0, 0.05); set('hipR', 0.25, 0, -0.05); set('kneeL', 1.1); set('kneeR', 0.35); set('shL', -0.9, 0, -0.5); set('shR', -0.9, 0, 0.5); set('spine', 0.1); pelvisY = 0.95;
      } else if (s.sleeping) {
        bodyRX = -1.57; bodyY = 0.16; bodyZ = 0.45; set('shL', 0, 0, -0.1); set('shR', 0, 0, 0.1); set('head', 0, 0.3, 0.1);
      } else if (s.gathering && !(s.act && (s.act.kind === 'crate' || s.act.kind === 'chop'))) {
        st.gather = Math.min(1, st.gather + dt * 3);
        pelvisY = 0.93 - 0.36 * st.gather; set('hipL', -1.35 * st.gather, 0, 0.12); set('hipR', -1.2 * st.gather, 0, -0.12); set('kneeL', 1.75 * st.gather); set('kneeR', 1.6 * st.gather);
        set('spine', 0.55 * st.gather + Math.sin(t * 9) * 0.04); set('head', -0.25 * st.gather); set('shL', -1.2, 0, -0.1); set('shR', -1.2, 0, 0.1); set('elL', -0.5); set('elR', -0.5);
        set('ankleL', 0.3); set('ankleR', 0.3);
        if (s.act && s.act.kind === 'butcher') {                                                                       // kneeling over the carcass: knife hand saws, other hand pins it down
          const u = s.act.t, sawP = Math.sin(u * 9.5), sawQ = Math.sin(u * 9.5 + 1.2), press = 0.5 + 0.5 * Math.sin(u * 4.7);
          set('shR', -1.0 + 0.3 * sawP, 0.12, 0.22); set('elR', -0.7 - 0.5 * sawQ); set('wrR', 0.2 * sawP, 0, 0.1 * sawQ);
          set('shL', -1.0 - 0.1 * press, -0.1, -0.2); set('elL', -0.45 - 0.2 * press); set('wrL', 0.3 * press);
          set('spine', 0.6 + 0.07 * sawP, 0.1 * sawQ, 0); set('head', 0.32 - 0.06 * sawP, 0, 0); add('pelvis', 0, 0.06 * sawP, 0);
        }
      } else {
        st.gather = Math.max(0, st.gather - dt * 4);
        if (moving) {
          const sw = Math.sin(ph), cw = Math.cos(ph);
          const lA = legA * (1 - hurtLimp * 0.35), rA = legA;
          set('hipL', sw * lA - 0.05, 0, 0.02); set('hipR', -sw * rA - 0.05, 0, -0.02);
          set('kneeL', Math.max(0, -Math.cos(ph + 0.7)) * kneeA + 0.06); set('kneeR', Math.max(0, Math.cos(ph + 0.7)) * kneeA + 0.06);
          set('ankleL', -Math.max(0, -Math.cos(ph + 0.7)) * 0.4 * (1 + run) + sw * 0.15); set('ankleR', -Math.max(0, Math.cos(ph + 0.7)) * 0.4 * (1 + run) - sw * 0.15);
          pelvisY = 0.93 - 0.03 * walk - run * 0.03 + Math.abs(cw) * (0.022 + run * 0.03) * (walk > 0.2 ? 1 : 0);
          add('pelvis', 0, sw * (0.1 + run * 0.08), cw * 0.04); add('spine', 0.03 + run * 0.22 + (s.sprint ? 0.04 : 0), -sw * (0.14 + run * 0.1), -cw * 0.03);
          set('shL', -sw * (0.55 + run * 0.7) * 0.95, 0, -0.07); add('elL', -0.12 - Math.max(0, sw) * 0.35 - run * 1.1);
          if (!st.tool) { set('shR', sw * (0.55 + run * 0.7) * 0.95, 0, 0.07); add('elR', -0.12 - Math.max(0, -sw) * 0.35 - run * 1.1); }
          add('head', -run * 0.08 - (0.03 * walk), -sw * 0.05, 0);
          if (hurtLimp) add('pelvis', 0, 0, Math.sin(ph) * 0.12);
        }
        add('spine', clamp(st.accS * 0.011, -0.12, 0.16)); add('head', -clamp(st.accS * 0.006, -0.06, 0.08));        // lean into starts, rock back on stops
        if (st.land > 0.01) { const L = st.land * st.land; add('hipL', -0.55 * L); add('hipR', -0.55 * L); add('kneeL', 1.0 * L); add('kneeR', 1.0 * L); add('ankleL', 0.35 * L); add('ankleR', 0.35 * L); add('spine', 0.22 * L); add('shL', -0.3 * L); add('shR', -0.3 * L); pelvisY -= 0.16 * L; }   // landing squash
      }

      // ------- holding a tool in the right hand
      const holding = st.tool && st.tool !== 'none' && !s.sleeping && !s.swim;
      if (holding && !s.gathering) {
        const pose = { stone_axe: [-0.45, -0.25, 0.22, -1.25], spear: [-0.35, 0.1, 0.25, -1.2], knife: [-0.4, 0, 0.18, -1.15], torch: [-0.7, -0.1, 0.18, -1.45], flare: [-0.7, -0.1, 0.18, -1.45], bottle: [-0.55, 0, 0.15, -1.4] }[st.tool] || [-0.4, 0, 0.15, -1.2];
        set('shR', pose[0] + (moving ? Math.cos(ph) * 0.06 : 0), pose[1], pose[2]); set('elR', pose[3]); set('wrR', -0.1, 0, 0);
        fingersCurl(arms[-1], 0.9, 0.7);
      } else if (!s.gathering) fingersCurl(arms[-1], 0.18 + (moving ? 0.2 : 0)); else fingersCurl(arms[-1], 0.5);
      fingersCurl(arms[1], 0.18 + (moving ? 0.25 + run * 0.4 : 0));

      // ------- standing interaction poses: opening a crate, chopping a tree
      st.dip = 0; const act = s.act, ease = (a0, b0, x) => { const t = clamp((x - a0) / (b0 - a0), 0, 1); return t * t * (3 - 2 * t); };
      if (act && act.kind === 'crate') {
        const u = act.u, reach = ease(0, 0.26, u) * (1 - ease(0.93, 1, u)), grip = ease(0.26, 0.42, u) * (1 - ease(0.5, 0.6, u)), lift = ease(0.5, 0.88, u) * (1 - ease(0.92, 1, u));
        const fumble = Math.sin(u * 52) * grip, tug = Math.sin(u * 30) * grip;
        set('shL', -(0.72 * reach + 0.4 * lift) + 0.05 * fumble, 0.1 * reach, -0.2 * reach); set('shR', -(0.72 * reach + 0.4 * lift) + 0.1 * tug, -0.1 * reach, 0.2 * reach);
        set('elL', -(0.28 * reach + 0.6 * lift)); set('elR', -(0.28 * reach + 0.6 * lift) - 0.15 * Math.abs(tug));
        set('wrL', 0.3 * reach - 0.4 * lift + 0.16 * fumble); set('wrR', 0.3 * reach - 0.4 * lift - 0.16 * fumble);
        add('spine', 0.5 * reach - 0.28 * lift, 0.06 * tug, 0); add('head', 0.16 * reach - 0.14 * lift, 0, 0);
        add('hipL', -0.4 * reach, 0, 0); add('hipR', -0.4 * reach, 0, 0); add('kneeL', 0.5 * reach); add('kneeR', 0.5 * reach); st.dip = 0.1 * reach; pelvisY -= st.dip;
      } else if (act && (act.kind === 'drink' || act.kind === 'eat' || act.kind === 'bandage')) {
        const u = act.u;
        if (act.kind === 'drink') {                                                                                   // raise the bottle, tip it, head back, swallow, lower it
          const up = ease(0, 0.28, u) * (1 - ease(0.8, 1, u)), tilt = ease(0.3, 0.5, u) * (1 - ease(0.72, 0.84, u)), gulp = Math.max(0, Math.sin((u - 0.5) * 22)) * ease(0.5, 0.56, u) * (1 - ease(0.7, 0.76, u));
          const DP = DRINK; set('shR', DP.sh * up + DP.shT * tilt, DP.shY * up, DP.shZ * up); set('elR', ...flexE('R', DP.el * up)); set('wrR', ...flexE('R', DP.wr * up + DP.wrT * tilt, DP.wrY * up));
          set('shL', -0.18 * up, 0, -0.1); set('elL', -0.5 * up);
          add('head', -0.42 * tilt + 0.05 * gulp, 0, 0); add('neck', -0.14 * tilt, 0, 0); add('spine', -0.1 * tilt, 0, 0);
        } else if (act.kind === 'eat') {                                                                              // hand to mouth for a couple of bites
          const up = ease(0, 0.25, u) * (1 - ease(0.82, 1, u)), bite = Math.max(0, Math.sin(u * 30)) * up;
          set('shR', -0.75 * up, 0, 0.2 * up); set('elR', ...flexE('R', -2.3 * up - 0.12 * bite)); set('wrR', ...flexE('R', -0.3 * up));
          add('head', 0.1 * up + 0.07 * bite, 0, 0); add('spine', 0.05 * up, 0, 0);
        } else {                                                                                                      // bandage: the right hand winds across the left forearm
          const up = ease(0, 0.22, u) * (1 - ease(0.85, 1, u)), wind = Math.sin(u * 24) * up;
          set('shL', -0.8 * up, 0, -0.15 * up); set('elL', ...flexE('L', -1.5 * up)); set('shR', -0.9 * up + 0.1 * wind, 0.3 * up, 0.2 * up); set('elR', ...flexE('R', -1.4 * up + 0.2 * wind)); set('wrR', ...flexE('R', 0.2 * wind));
          add('spine', 0.18 * up, 0, 0); add('head', 0.22 * up, 0, 0);
        }
      } else if (act && act.kind === 'chop' && st.attackT < 0) {                                                         // ready stance between swings: feet apart, knees soft, balanced
        set('shL', -0.5, 0.15, -0.2); set('elL', -0.9); add('spine', 0.12, 0.1, 0); add('hipL', -0.12, 0, 0.06); add('hipR', 0.1, 0, -0.06); add('kneeL', 0.18); add('kneeR', 0.14); st.dip = 0.04; pelvisY -= st.dip;
      }
      // ------- attack animations
      if (st.attackT >= 0) {
        const kind = st.attackKind; st.attackT += dt * (kind === 'thrust' ? 3.4 : kind === 'chop' ? 1.9 : 3.0); const a = st.attackT;
        if (a >= 1) st.attackT = -1;
        else {
          const wind = Math.min(1, a / 0.38), hit = a < 0.38 ? 0 : Math.min(1, (a - 0.38) / 0.28), rec = a < 0.66 ? 0 : (a - 0.66) / 0.34;
          const e = (v) => v * v * (3 - 2 * v);
          if (kind === 'chop') {
            const up = e(wind) * (1 - e(hit)), down = e(hit) * (1 - rec);
            set('shR', -3.05 * up + 0.35 * down - 0.3 * rec, -0.15 + up * 0.3, 0.3); set('elR', -0.5 - 0.95 * up + 0.35 * down); set('spine', 0.1 - 0.28 * up + 0.8 * down * (1 - rec), 0.4 * up - 0.6 * down); set('wrR', -0.7 * up + 0.7 * down); add('head', 0.2 * down, 0, 0);
            set('hipL', -0.4 * down - 0.1 * up); set('hipR', 0.3 * down + 0.1 * up); add('kneeL', 0.35 * down + 0.1 * up); add('kneeR', 0.25 * down); st.dip = 0.09 * down; pelvisY -= st.dip;
            set('shL', -1.2 * up - 0.7 * down, -0.1, -0.35); set('elL', -0.9 - 0.5 * down); add('pelvis', 0, 0.2 * up - 0.3 * down, 0);          // off hand follows the haft, hips drive the swing
          } else if (kind === 'thrust') {
            const draw = e(wind) * (1 - e(hit)), stab = e(hit) * (1 - rec);
            set('shR', -0.3 + 0.7 * draw - 1.35 * stab, 0.2, 0.15); set('elR', -1.5 * draw - 0.2 * stab); set('spine', 0.1 + 0.28 * stab, 0.4 * draw - 0.6 * stab); set('hipL', -0.7 * stab); set('hipR', 0.45 * stab); pelvisY -= 0.06 * stab; set('shL', -0.6 * stab, 0, -0.5 * stab);
          } else {
            const up = e(wind) * (1 - e(hit)), down = e(hit) * (1 - rec);
            set('shR', -1.9 * up + 0.4 * down, 0.1, 0.4 * up - 0.5 * down); set('elR', -0.8 - 0.4 * up); set('spine', 0.05 + 0.3 * down, 0.5 * up - 0.7 * down);
          }
        }
      }
      // ------- uneven ground: tilt pelvis/feet to the slope under the player
      st.slopeS += ((s.slope || 0) - st.slopeS) * k(6);
      if (!s.gathering) { add('spine', clamp(st.slopeS * 0.5, -0.3, 0.3)); add('ankleL', clamp(-st.slopeS * 0.5, -0.4, 0.4)); add('ankleR', clamp(-st.slopeS * 0.5, -0.4, 0.4)); pelvisY -= Math.abs(st.slopeS) * 0.04; }
      // ------- head tracks where the camera looks
      add('head', st.lookP - (J.spine.tx) * 0.4, st.look * 0.62, 0); add('neck', 0, st.look * 0.28, 0);
    }

    // secondary motion: backpack lags behind vertical bounce
    const acc = (sp - st.lastSpeed) / Math.max(dt, 1e-3); st.lastSpeed = sp;
    st.packV += (-acc * 0.004 - st.packX * 60 - st.packV * 9) * dt; st.packX += st.packV * dt; st.packX = clamp(st.packX, -0.12, 0.12);
    set('pack', st.packX + (moving ? Math.abs(Math.cos(ph)) * 0.04 : 0));

    // ---- blend joints toward their targets
    const rate = s.dead ? 8 : st.attackT >= 0 ? 26 : 16;
    for (const key in J) { const j = J[key], kk = k(rate); j.g.rotation.x += (j.tx - j.g.rotation.x) * kk; j.g.rotation.y += (j.ty - j.g.rotation.y) * kk; j.g.rotation.z += (j.tz - j.g.rotation.z) * kk; }
    pelvis.position.y += (pelvisY - pelvis.position.y) * k(14);
    body.rotation.x += (bodyRX - body.rotation.x) * k(s.swim ? 6 : 9); body.position.y += (bodyY - body.position.y) * k(9); body.position.z += (bodyZ - body.position.z) * k(9);
    // keep the planted foot visually on the ground
    for (const sdn of [-1, 1]) legs[sdn].boot.rotation.x = 0;
  }

  // swap the procedural body for the Blender model, keeping the pose system: tools move onto its hand, joints drive its bones
  let model = null;
  if (hasHeroModel()) {
    model = createModelRig(tools);
    if (model) { body.add(model.root); pelvis.visible = false; }
  }
  const update2 = update;
  // keep the planted foot on the terrain: on slopes and with the long running stride the leading foot can dip below the ground,
  // so the body is lifted by however far the lowest foot sits under the surface at its own position
  const _fp = new THREE.Vector3(); st.lift = 0;
  // how far the wrist rolls (radians) to carry each tool: knife forward and down, axe up and forward, the long and loose items upright
  // This rig rests in an A-pose and the pose system adducts the shoulder (ARM_ADDUCT) after the elbow bend, which would swing a bent forearm out sideways.
  // flexE(side, x) returns the elbow/wrist Euler that bends the forearm in the sagittal plane regardless of that adduction.
  const _fz = new THREE.Vector3(0, 0, 1), _fq0 = new THREE.Quaternion(), _fq1 = new THREE.Quaternion(), _fe = new THREE.Euler();
  const flexE = (side, x, y = 0) => {
    if (!hasHeroModel()) return [x, y, 0];
    _fq0.setFromAxisAngle(_fz, (side === 'L' ? -1 : 1) * 0.72); _fq1.copy(_fq0).invert().multiply(new THREE.Quaternion().setFromEuler(_fe.set(x, y, 0))).multiply(_fq0); _fe.setFromQuaternion(_fq1, 'XYZ'); return [_fe.x, _fe.y, _fe.z];
  };
  const DRINK = { sh: -1.9, shT: -0.15, shY: 0.8, shZ: 0.6, el: -1.0, wr: 0, wrT: -0.5, wrY: 0 };       // right-arm pose for drinking (shoulder, elbow, wrist)
  const TOOL_ROLL = { knife: -0.35, stone_axe: 0.55, spear: 0.8, torch: 0.8, flare: 0.8, bottle: 0.8 };
  const mot = { mocapW: 0, procW: {}, lift: 0, curlR: 0.25, curlL: 0.25 };
  function updateAll(dt, s) {
    update2(dt, s);
    if (!model) return;
    const m = model.motion;
    if (m) {
      // which parts of the body are driven by motion capture right now: walking, running and idling on the ground use it for the whole body;
      // tools, attacks and the other poses (swim, jump, kneel, sleep, death) hand control back to the procedural pose, blended over ~0.1 s
      const k = 1 - Math.exp(-dt * 10), holding = st.tool && st.tool !== 'none';
      const standAct = s.act && ['crate', 'chop', 'drink', 'eat', 'bandage'].includes(s.act.kind);
      const loco = !s.swim && !s.air && !s.dead && !s.sleeping && (!s.gathering || standAct);
      const attacking = st.attackT >= 0, upper = attacking || standAct, legsProc = (standAct || attacking) ? 0.55 : 0;
      st.mw += ((loco ? 1 : 0) - st.mw) * k; st.rw += ((holding || upper ? 1 : 0) - st.rw) * k; st.uw += ((upper ? 1 : 0) - st.uw) * k; st.lw += (legsProc - st.lw) * k;
      if (st.mw > 0.01) m.update(dt, s.speed || 0);
      const pw = mot.procW; pw.upperarm_r = pw.lowerarm_r = pw.hand_r = st.rw; pw.upperarm_l = pw.lowerarm_l = pw.hand_l = st.uw; pw.spine_01 = pw.spine_02 = pw.spine_03 = st.uw * 0.9; pw.thigh_l = pw.thigh_r = pw.calf_l = pw.calf_r = st.lw; mot.drop = st.dip;
      mot.mocapW = st.mw; mot.lift = st.lift;
      // hands: a fist round the tool, otherwise a soft natural curl; a firmer grip on the crate lid; open hands when pinning a carcass
      const actK = s.act && s.act.kind, gripR = holding ? 1 : actK === 'crate' ? 0.55 : actK === 'butcher' ? 0.2 : 0.25, gripL = actK === 'crate' ? 0.55 : actK === 'butcher' ? 0.1 : 0.25;
      const rollT = holding && !s.swim ? (TOOL_ROLL[st.tool] ?? 0.6) : 0; st.roll = (st.roll || 0) + (rollT - (st.roll || 0)) * k; mot.rollR = st.roll;
      st.cr = (st.cr ?? 0.25) + (gripR - (st.cr ?? 0.25)) * k; st.cl = (st.cl ?? 0.25) + (gripL - (st.cl ?? 0.25)) * k; mot.curlR = st.cr; mot.curlL = st.cl;
      if (st.mw > 0.5 && s.onStep && !s.swim && !s.air && (s.speed || 0) > 0.6) { const u = m.u; if (st.lastU > u) s.onStep(); else if (st.lastU < 0.5 && u >= 0.5) s.onStep(); st.lastU = u; } else st.lastU = m.u;   // footsteps on the mocap heel strikes
    }
    model.sync(J, pelvis.position.y + st.lift, mot);
    const feet = [model.bones.ball_l, model.bones.ball_r];
    if (s.groundAt && !s.air && !s.swim && !s.dead && !s.sleeping && !(s.gathering && !(s.act && (s.act.kind === 'crate' || s.act.kind === 'chop'))) && feet[0] && feet[1]) {
      model.root.updateMatrixWorld(true);
      let clear = 9; for (const b of feet) { b.getWorldPosition(_fp); clear = Math.min(clear, _fp.y - s.groundAt(_fp.x, _fp.z)); }
      const was = st.lift;
      st.lift = clamp(st.lift - (clear - 0.02) * (clear < 0.02 ? 1 : 1 - Math.exp(-dt * 6)), 0, 0.45);      // rise at once when a foot is under the ground, settle back gently
      if (st.lift > was + 0.004) { mot.lift = st.lift; model.sync(J, pelvis.position.y + st.lift, mot); }       // second pass so the lift lands on the same frame
    } else st.lift *= Math.exp(-dt * 8);
  }
    return { motion: model && model.motion, group: root, update: updateAll, setTool, attack, tools, parts: { head, torso: spine }, J };
}
