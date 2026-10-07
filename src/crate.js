import * as THREE from 'three';

// Detailed supply crates: painted, weathered plank walls with stencils, corner posts, skids, steel brackets with rivets,
// rope handles, a hasp latch, a hollow body with a dark liner and loot inside that matches the crate type.
// The lid is a separate group (userData.lid) so world.openCrate() can swing it off.

const STYLE = {
  supplies: { paint: '#4b5a36', text: '#d9d3b0', label: 'FIELD SUPPLY', sub: 'DO NOT DROP', sym: 'star' },
  medical:  { paint: '#d8d6cc', text: '#b3261e', label: 'MEDICAL', sub: 'KEEP DRY', sym: 'cross' },
  food:     { paint: '#7a5a34', text: '#e6c24a', label: 'RATIONS', sub: 'THIS SIDE UP', sym: 'arrow' },
};

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// colour + bump canvases for a weathered plank wall; label=true stencils the type on it
function plankTex(style, seed, label) {
  const W = 512, H = 336, r = rng(seed), mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const col = mk(), bmp = mk(), g = col.getContext('2d'), b = bmp.getContext('2d');
  const planks = 4, ph = H / planks;
  b.fillStyle = '#808080'; b.fillRect(0, 0, W, H);
  for (let i = 0; i < planks; i++) {
    const y = i * ph, tone = 0.86 + r() * 0.2;
    g.fillStyle = `rgb(${110 * tone | 0},${78 * tone | 0},${46 * tone | 0})`; g.fillRect(0, y, W, ph);                                  // bare wood
    for (let k = 0; k < 46; k++) { const gy = y + r() * ph; g.strokeStyle = `rgba(40,24,10,${0.12 + r() * 0.2})`; g.lineWidth = 0.6 + r() * 1.2; g.beginPath(); g.moveTo(0, gy); g.bezierCurveTo(W * 0.3, gy + (r() - 0.5) * 5, W * 0.6, gy + (r() - 0.5) * 5, W, gy + (r() - 0.5) * 4); g.stroke(); b.strokeStyle = `rgba(0,0,0,0.18)`; b.lineWidth = 1; b.beginPath(); b.moveTo(0, gy); b.lineTo(W, gy + (r() - 0.5) * 4); b.stroke(); }
    if (r() < 0.75) { const kx = 40 + r() * (W - 80), ky = y + ph * (0.3 + r() * 0.4); const kg = g.createRadialGradient(kx, ky, 1, kx, ky, 11); kg.addColorStop(0, 'rgba(30,16,6,0.9)'); kg.addColorStop(1, 'rgba(30,16,6,0)'); g.fillStyle = kg; g.beginPath(); g.ellipse(kx, ky, 12, 7, 0, 0, 7); g.fill(); b.fillStyle = 'rgba(0,0,0,0.35)'; b.beginPath(); b.ellipse(kx, ky, 8, 5, 0, 0, 7); b.fill(); }
    g.fillStyle = style.paint; g.globalAlpha = 0.97; g.fillRect(0, y + 2, W, ph - 3); g.globalAlpha = 1;                                      // paint coat
    g.fillStyle = 'rgba(255,255,255,0.05)'; for (let k = 0; k < 8; k++) g.fillRect(0, y + 4 + r() * (ph - 8), W, 1 + r() * 2);               // brush streaks
    for (let k = 0; k < 12; k++) { const cx = r() * W, cy = y + 2 + r() * (ph - 4), cw = 6 + r() * 26, chh = 2 + r() * 6; g.fillStyle = `rgba(${96 + r() * 30 | 0},${68 + r() * 20 | 0},${40 | 0},${0.7 + r() * 0.3})`; g.fillRect(cx, cy, cw, chh); }   // chipped paint
    g.fillStyle = 'rgba(8,5,2,0.9)'; g.fillRect(0, y, W, 3);                                                                                    // gap between planks
    b.fillStyle = '#101010'; b.fillRect(0, y, W, 4); b.fillStyle = '#9a9a9a'; b.fillRect(0, y + 4, W, 2);
  }
  if (label) {
    g.save(); g.translate(W / 2, H * 0.47); g.fillStyle = style.text; g.globalAlpha = 0.9; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 42px "Arial Narrow", Impact, sans-serif'; g.fillText(style.label, 34, -6);
    g.font = 'bold 18px Arial, sans-serif'; g.fillText(style.sub, 34, 34);
    const sx = -190, sy = -2; g.scale(0.78, 0.78);
    if (style.sym === 'cross') { g.fillRect(sx - 14, sy - 42, 28, 84); g.fillRect(sx - 42, sy - 14, 84, 28); }
    else if (style.sym === 'star') { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 17 : 42; g.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); } g.fill(); }
    else { g.beginPath(); g.moveTo(sx, sy - 44); g.lineTo(sx + 36, sy + 6); g.lineTo(sx + 14, sy + 6); g.lineTo(sx + 14, sy + 44); g.lineTo(sx - 14, sy + 44); g.lineTo(sx - 14, sy + 6); g.lineTo(sx - 36, sy + 6); g.closePath(); g.fill(); }
    g.globalAlpha = 1; g.restore();
    g.fillStyle = style.text; g.globalAlpha = 0.75; g.font = 'bold 18px monospace'; g.textAlign = 'left'; g.fillText('LOT 7-' + (100 + (seed % 800)), 14, H - 14); g.globalAlpha = 1;
    b.fillStyle = 'rgba(255,255,255,0.1)'; b.fillRect(0, 0, 1, 1);
  }
  const img = g.getImageData(0, 0, W, H);                                                                                                         // grime, darker toward the edges and bottom
  for (let i = 0; i < 260; i++) { const x = r() * W, y2 = r() * H, rr = 3 + r() * 9, gr = g.createRadialGradient(x, y2, 0, x, y2, rr); gr.addColorStop(0, `rgba(40,30,18,${0.05 + r() * 0.05})`); gr.addColorStop(1, 'rgba(40,30,18,0)'); g.fillStyle = gr; g.fillRect(x - rr, y2 - rr, rr * 2, rr * 2); }
  for (let i = 0; i < 6; i++) { const x = r() * W; const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(30,20,10,0)'); gr.addColorStop(1, 'rgba(30,20,10,0.35)'); g.fillStyle = gr; g.fillRect(x, 0, 6 + r() * 14, H); }
  for (let i = 0; i < 14; i++) { g.strokeStyle = `rgba(210,200,180,${0.15 + r() * 0.25})`; g.lineWidth = 1; g.beginPath(); const sx0 = r() * W, sy0 = r() * H; g.moveTo(sx0, sy0); g.lineTo(sx0 + (r() - 0.5) * 60, sy0 + (r() - 0.5) * 20); g.stroke(); }   // scratches
  void img;
  const T = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  return { map: T(col, true), bump: T(bmp, false) };
}

const texCache = {};
function mats(loot) {
  if (texCache[loot]) return texCache[loot];
  const st = STYLE[loot] || STYLE.supplies, seed = loot.length * 977 + 13;
  const side = plankTex(st, seed, true), end = plankTex(st, seed + 5, false);
  const mk = (t) => new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 1.6, roughness: 0.88 });
  const o = {
    side: mk(side), end: mk(end), top: mk(end),
    metal: new THREE.MeshStandardMaterial({ color: 0x4b5258, roughness: 0.42, metalness: 0.85 }),
    rust: new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.75, metalness: 0.55 }),
    timber: new THREE.MeshStandardMaterial({ color: 0x4d3620, roughness: 0.92 }),
    liner: new THREE.MeshStandardMaterial({ color: 0x35271a, roughness: 1, side: THREE.BackSide }),
    rope: new THREE.MeshStandardMaterial({ color: 0xb59a68, roughness: 0.95 }),
  };
  texCache[loot] = o; return o;
}

const box = (w, h, d, m, x, y, z, parent, shadow = true) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = shadow; o.receiveShadow = true; parent.add(o); return o; };

function contents(loot, m, g) {
  const mat = (c, rough = 0.6, met = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: met });
  const cyl = (rt, h, c, x, y, z, rz = 0, ry = 0, rough = 0.5, met = 0.4) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rt, h, 14), mat(c, rough, met)); o.position.set(x, y, z); o.rotation.set(0, ry, rz); o.castShadow = true; g.add(o); return o; };
  const lab = (c, ...p) => { const o = cyl(...p); o.material = mat(c, 0.7, 0.1); return o; };
  if (loot === 'food') {
    for (const [x, z, c] of [[-0.3, -0.12, 0xc8402a], [-0.14, 0.14, 0x3f7f3a], [0.0, -0.1, 0xd9a52a], [0.16, 0.12, 0xc8402a], [0.32, -0.12, 0x3f7f3a]]) { cyl(0.065, 0.2, 0xb8bcc0, x, 0.32, z, 0, 0, 0.35, 0.8); const lb = new THREE.Mesh(new THREE.CylinderGeometry(0.067, 0.067, 0.12, 14), mat(c, 0.7)); lb.position.set(x, 0.32, z); g.add(lb); }
    cyl(0.07, 0.34, 0x9ec6dc, -0.34, 0.27, 0.16, Math.PI / 2, 0.3, 0.2, 0);                                                                         // water bottles
    cyl(0.07, 0.34, 0x9ec6dc, 0.0, 0.17, 0.0, Math.PI / 2, 1.3, 0.2, 0);
    box(0.26, 0.1, 0.18, mat(0x8a6b3a, 0.9), 0.24, 0.17, 0.2, g);
  } else if (loot === 'medical') {
    for (const [x, z, ry] of [[-0.25, -0.1, 0.1], [0.12, -0.12, -0.08]]) { const kit = box(0.3, 0.18, 0.2, mat(0xe9e7de, 0.6), x, 0.2, z, g); kit.rotation.y = ry; const cr = mat(0xc0221a, 0.6); box(0.14, 0.012, 0.04, cr, x, 0.292, z, g, false).rotation.y = ry; box(0.04, 0.012, 0.14, cr, x, 0.292, z, g, false).rotation.y = ry; }
    for (let i = 0; i < 4; i++) cyl(0.055, 0.12, i % 2 ? 0xf2efe6 : 0xe5dfcf, -0.3 + i * 0.1, 0.12, 0.18, Math.PI / 2, 0, 0.9, 0);                    // bandage rolls
    for (const [x, c] of [[0.32, 0x7a4a1c], [0.4, 0x2a6a8a]]) { cyl(0.035, 0.16, c, x, 0.12, 0.15, 0, 0, 0.3, 0); cyl(0.02, 0.04, 0xf0f0f0, x, 0.22, 0.15, 0, 0, 0.6, 0); }   // bottles
    box(0.3, 0.08, 0.14, mat(0x3c6b3a, 0.8), 0.18, 0.1, 0.18, g);
  } else {
    const roll = cyl(0.12, 0.5, 0x6c7a52, -0.1, 0.2, -0.12, Math.PI / 2, 0.15, 0.95, 0); roll.scale.set(1, 1, 1);                                     // rolled blanket
    cyl(0.12, 0.04, 0x3b4430, -0.1, 0.2, -0.12, Math.PI / 2, 0.15, 0.95, 0).position.x += 0.26;
    const rp = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 20), m.rope); rp.rotation.x = Math.PI / 2; rp.position.set(0.28, 0.1, 0.12); g.add(rp);       // rope coil
    const rp2 = rp.clone(); rp2.position.y = 0.16; g.add(rp2);
    for (const [x, z] of [[-0.3, 0.16], [-0.18, 0.2]]) { cyl(0.04, 0.3, 0xc9362a, x, 0.15, z, Math.PI / 2, 0.2, 0.5, 0); cyl(0.042, 0.04, 0x2a2a2a, x + 0.12, 0.15, z + 0.02, Math.PI / 2, 0.2, 0.6, 0); }   // flares
    cyl(0.065, 0.2, 0xb8bcc0, 0.05, 0.12, 0.18, 0, 0, 0.35, 0.8); cyl(0.065, 0.2, 0xb8bcc0, 0.2, 0.12, -0.14, 0, 0, 0.35, 0.8);                      // tins
    const kn = box(0.3, 0.06, 0.12, mat(0x2b2b2b, 0.5), 0.0, 0.07, 0.0, g); kn.rotation.y = 0.35;
  }
}

export function crateObject(loot = 'supplies') {
  const m = mats(loot), g = new THREE.Group(), L = 1.0, H = 0.65, D = 0.65, t = 0.04;
  // hollow body: four plank walls, a floor and a dark liner
  box(L, H, t, m.side, 0, H / 2 + 0.07, D / 2 - t / 2, g).material = [m.end, m.end, m.top, m.top, m.side, m.side];
  box(L, H, t, m.side, 0, H / 2 + 0.07, -D / 2 + t / 2, g).material = [m.end, m.end, m.top, m.top, m.side, m.side];
  for (const sx of [-1, 1]) box(t, H, D - 2 * t, m.end, sx * (L / 2 - t / 2), H / 2 + 0.07, 0, g);
  box(L - 2 * t, 0.03, D - 2 * t, m.timber, 0, 0.09, 0, g);
  const liner = new THREE.Mesh(new THREE.BoxGeometry(L - 2 * t - 0.004, H - 0.02, D - 2 * t - 0.004), m.liner); liner.position.y = H / 2 + 0.1; g.add(liner);
  // skids and bottom rails
  for (const z of [-0.2, 0.2]) box(L + 0.1, 0.07, 0.08, m.timber, 0, 0.035, z, g);
  // corner posts, top and bottom rails
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.07, H + 0.02, 0.07, m.timber, sx * (L / 2 - 0.005), H / 2 + 0.07, sz * (D / 2 - 0.005), g);
  for (const sz of [-1, 1]) { box(L + 0.02, 0.05, 0.03, m.timber, 0, H + 0.04, sz * (D / 2 + 0.005), g); box(L + 0.02, 0.05, 0.03, m.timber, 0, 0.12, sz * (D / 2 + 0.005), g); }
  // steel straps with rivets on the long faces, and corner brackets
  for (const x of [-0.4, 0.4]) for (const sz of [-1, 1]) {
    box(0.05, H + 0.01, 0.012, m.metal, x, H / 2 + 0.07, sz * (D / 2 + 0.018), g);
    for (const y of [0.16, 0.42, 0.66]) { const rv = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 8), m.rust); rv.rotation.x = Math.PI / 2; rv.position.set(x, y, sz * (D / 2 + 0.028)); g.add(rv); }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { box(0.14, 0.012, 0.14, m.metal, sx * (L / 2 - 0.05), 0.06, sz * (D / 2 - 0.05), g, false); }
  // rope handles on the end walls
  for (const sx of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.014, 6, 14, Math.PI), m.rope); h.rotation.set(0, Math.PI / 2, Math.PI); h.position.set(sx * (L / 2 + 0.03), H - 0.1, 0); g.add(h); box(0.02, 0.03, 0.2, m.rust, sx * (L / 2 + 0.015), H - 0.05, 0, g, false); }
  // hasp latch on the front: plate on the lid edge, staple on the body, and a pin
  box(0.09, 0.14, 0.012, m.metal, 0, H - 0.02, D / 2 + 0.03, g); const hole = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.006, 6, 12), m.rust); hole.position.set(0, H - 0.07, D / 2 + 0.04); g.add(hole);
  // contents
  const inner = new THREE.Group(); inner.position.y = 0.3; g.add(inner);
  box(L - 2 * t - 0.02, 0.26, D - 2 * t - 0.02, new THREE.MeshStandardMaterial({ color: 0x6b5a40, roughness: 1 }), 0, 0.21, 0, g, false);   // packing filler under the loot
  contents(loot, m, inner);
  // lid: top planks with end cleats and an edge frame, a small stencil strip, and a nameplate
  const lid = new THREE.Group(); lid.position.y = 0.04 + H + 0.03; g.add(lid);
  const top = box(L + 0.05, 0.05, D + 0.05, m.top, 0, 0, 0, lid); top.material = [m.end, m.end, m.top, m.top, m.side, m.side];
  for (const x of [-0.36, 0.36]) box(0.08, 0.03, D + 0.06, m.timber, x, 0.04, 0, lid);
  box(L + 0.08, 0.02, 0.025, m.timber, 0, 0.03, D / 2 + 0.03, lid, false); box(L + 0.08, 0.02, 0.025, m.timber, 0, 0.03, -D / 2 - 0.03, lid, false);
  box(0.11, 0.012, 0.14, m.metal, 0, 0.033, D / 2 - 0.05, lid, false);
  g.userData.lid = lid; g.userData.lidY = lid.position.y;
  g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  return g;
}
