// Procedural textures painted on canvases at start-up (no image files needed).
import * as THREE from 'three';
import { mulberry32 } from './noise.js';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, { repeat = false, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true;
  return t;
}

function leafPath(ctx, len, wid) {
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.bezierCurveTo(wid, len * 0.22, wid * 0.85, len * 0.72, 0, len);
  ctx.bezierCurveTo(-wid * 0.85, len * 0.72, -wid, len * 0.22, 0, 0); ctx.closePath();
}

// A spray of leaves on transparent ground: used on canopy cards.
export function leafSprayTexture(seed = 3, hue = 0) {
  const S = 512, c = canvas(S, S), ctx = c.getContext('2d'), rnd = mulberry32(seed);
  const leaves = [];
  for (let i = 0; i < 95; i++) {
    const a = rnd() * Math.PI * 2, r = Math.pow(rnd(), 0.6) * S * 0.38;
    leaves.push({ x: S / 2 + Math.cos(a) * r, y: S / 2 + Math.sin(a) * r, rot: Math.atan2(Math.sin(a), Math.cos(a)) - Math.PI / 2 + (rnd() - 0.5) * 1.6, len: 62 + rnd() * 46, wid: 16 + rnd() * 10, d: rnd() });
  }
  leaves.sort((p, q) => p.d - q.d);
  for (const l of leaves) {
    ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.rot);
    const g = ctx.createLinearGradient(0, 0, 0, l.len), k = 0.55 + l.d * 0.45;
    g.addColorStop(0, `hsl(${100 + hue + l.d * 14}, 48%, ${18 + k * 14}%)`); g.addColorStop(1, `hsl(${92 + hue + l.d * 18}, 58%, ${28 + k * 22}%)`);
    ctx.fillStyle = g; leafPath(ctx, l.len, l.wid); ctx.fill();
    ctx.strokeStyle = `rgba(190,225,130,${0.28 + l.d * 0.25})`; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, l.len * 0.92); ctx.stroke();
    ctx.strokeStyle = 'rgba(10,30,5,0.25)'; ctx.lineWidth = 1; leafPath(ctx, l.len, l.wid); ctx.stroke();
    ctx.restore();
  }
  return tex(c);
}

// A feathery frond (palm / fern): rib with paired leaflets.
export function frondTexture(seed = 5, leaflets = 18, droop = 0.0) {
  const W = 256, H = 512, c = canvas(W, H), ctx = c.getContext('2d'), rnd = mulberry32(seed);
  ctx.translate(W / 2, H - 6);
  ctx.strokeStyle = '#3d5a1f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -H + 20); ctx.stroke();
  for (let i = 1; i <= leaflets; i++) {
    const t = i / (leaflets + 1), y = -t * (H - 30), len = (W / 2 - 8) * Math.sin(Math.PI * Math.pow(t, 0.7)) * (0.55 + 0.45 * (1 - t)) + 14;
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(0, y); ctx.rotate(s * (1.05 + droop - t * 0.5)); ctx.scale(1, 1);
      const g = ctx.createLinearGradient(0, 0, 0, -len); const l = 22 + rnd() * 10;
      g.addColorStop(0, `hsl(98, 50%, ${l}%)`); g.addColorStop(1, `hsl(88, 62%, ${l + 14}%)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(6, -len * 0.5, 0.5, -len); ctx.quadraticCurveTo(-5, -len * 0.5, 0, 0); ctx.fill();
      ctx.restore();
    }
  }
  return tex(c);
}

// Big broad tropical leaf (banana / monstera-like) for undergrowth.
export function broadLeafTexture(seed = 9) {
  const W = 256, H = 256, c = canvas(W, H), ctx = c.getContext('2d'), rnd = mulberry32(seed);
  ctx.translate(W / 2, H - 4);
  const g = ctx.createLinearGradient(0, 0, 0, -H); g.addColorStop(0, '#2c5a1a'); g.addColorStop(1, '#5b9a34');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(W * 0.62, -H * 0.2, W * 0.5, -H * 0.82, 0, -H + 6); ctx.bezierCurveTo(-W * 0.5, -H * 0.82, -W * 0.62, -H * 0.2, 0, 0); ctx.fill();
  ctx.strokeStyle = 'rgba(200,235,140,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -H + 12); ctx.stroke();
  ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(190,225,130,0.3)';
  for (let i = 1; i < 14; i++) { const y = -i * (H / 15); for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.quadraticCurveTo(s * 40, y - 14, s * (95 - i * 3.2), y - 38); ctx.stroke(); } }
  return tex(c);
}

export function barkTextures(seed = 2) {
  const W = 256, H = 512, c = canvas(W, H), b = canvas(W, H), x = c.getContext('2d'), y = b.getContext('2d'), rnd = mulberry32(seed);
  x.fillStyle = '#85705a'; x.fillRect(0, 0, W, H); y.fillStyle = '#808080'; y.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    const px = rnd() * W, w = 2 + rnd() * 9, h = 80 + rnd() * 380, py = rnd() * H, v = rnd();
    x.fillStyle = `rgba(${28 + v * 30},${20 + v * 22},${14 + v * 14},${0.18 + rnd() * 0.3})`; for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) x.fillRect(px + ox, py + oy, w, h);
    const l = 90 + rnd() * 100; y.fillStyle = `rgb(${l},${l},${l})`; for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) y.fillRect(px + ox, py + oy, w * 0.8, h);
  }
  for (let i = 0; i < 120; i++) { const px = rnd() * W, py = rnd() * H; x.fillStyle = `rgba(120,110,90,${0.06 + rnd() * 0.1})`; for (const oy of [-H, 0, H]) { x.beginPath(); x.ellipse(px, py + oy, 2 + rnd() * 6, 6 + rnd() * 18, 0, 0, 7); x.fill(); } }
  for (let i = 0; i < 70; i++) { const px = rnd() * W, py = rnd() * H; y.fillStyle = 'rgba(20,20,20,0.5)'; y.fillRect(px, py, 1.5, 20 + rnd() * 60); }
  return { map: tex(c, { repeat: true }), bump: tex(b, { repeat: true, srgb: false }) };
}

// Soft tileable noise used to break up flat vertex colours on the ground.
export function groundDetail(seed = 4) {
  const S = 512, c = canvas(S, S), ctx = c.getContext('2d'), rnd = mulberry32(seed), b = canvas(S, S), bx = b.getContext('2d');
  ctx.fillStyle = '#9a9a9a'; ctx.fillRect(0, 0, S, S); bx.fillStyle = '#808080'; bx.fillRect(0, 0, S, S);
  const blot = (cx, cy, r, v, dst) => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { const g = dst.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, r); g.addColorStop(0, `rgba(${v},${v},${v},0.5)`); g.addColorStop(1, `rgba(${v},${v},${v},0)`); dst.fillStyle = g; dst.fillRect(cx + ox - r, cy + oy - r, r * 2, r * 2); } };
  for (let i = 0; i < 520; i++) { const v = rnd() > 0.5 ? 255 : 40, r = 4 + rnd() * 26; blot(rnd() * S, rnd() * S, r, v, ctx); blot(rnd() * S, rnd() * S, r * 0.6, v, bx); }
  for (let i = 0; i < 3500; i++) { const v = (rnd() * 255) | 0; ctx.fillStyle = `rgba(${v},${v},${v},0.25)`; ctx.fillRect(rnd() * S, rnd() * S, 1.5, 1.5); bx.fillStyle = `rgba(${v},${v},${v},0.5)`; bx.fillRect(rnd() * S, rnd() * S, 2, 2); }
  return { map: tex(c, { repeat: true }), bump: tex(b, { repeat: true, srgb: false }) };
}

// Soft round sprite for fireflies, dust, light glows.
export function glowTexture() {
  const S = 64, c = canvas(S, S), ctx = c.getContext('2d'), g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S); return tex(c, { srgb: true });
}
