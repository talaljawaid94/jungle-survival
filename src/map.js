import { SIZE } from './world.js';
import { clamp } from './noise.js';

const S = 300;      // map texture resolution
const GC = 75;      // explored grid cells per side

export class MapSystem {
  constructor(world) {
    this.world = world;
    this.base = document.createElement('canvas'); this.base.width = this.base.height = S;
    this.expl = document.createElement('canvas'); this.expl.width = this.expl.height = S;
    this.eg = new Uint8Array(GC * GC); this.landCells = 0; this.seen = 0; this.dirty = true;
    this.tmp = document.createElement('canvas'); this.tmp.width = this.tmp.height = S;
    this.render();
    for (let gz = 0; gz < GC; gz++) for (let gx = 0; gx < GC; gx++) {
      const x = -SIZE / 2 + (gx + 0.5) * (SIZE / GC), z = -SIZE / 2 + (gz + 0.5) * (SIZE / GC);
      if (world.heightAt(x, z) > 0.3) this.landCells++;
    }
  }
  render() {
    const w = this.world, ctx = this.base.getContext('2d'), img = ctx.createImageData(S, S), k = SIZE / S;
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const x = -SIZE / 2 + (px + 0.5) * k, z = -SIZE / 2 + (py + 0.5) * k, h = w.heightAt(x, z);
      let r, g, b;
      if (h < 0) {
        if (w.isFresh(x, z)) { const t = clamp(-h / 3, 0, 1); r = 96 - 40 * t; g = 214 - 50 * t; b = 214 - 30 * t; }                      // lakes: bright turquoise
        else { const t = clamp(-h / 7, 0, 1); r = 52 - 40 * t; g = 176 - 100 * t; b = 192 - 70 * t; }                                     // sea: turquoise shallows fading to deep blue
      } else if (h < 0.6) { r = 246; g = 244; b = 226; }                                                                                  // surf line
      else if (h < 2.4) { r = 236; g = 214; b = 150; }                                                                                    // sand
      else if (h > 30) { r = 150; g = 146; b = 134; }
      else { const t = clamp((h - 2.4) / 26, 0, 1); r = 104 - 44 * t; g = 168 - 40 * t; b = 74 - 14 * t; }                               // jungle: light grass to deep canopy
      const sh = 1 + clamp((w.heightAt(x + 5, z + 5) - w.heightAt(x - 5, z - 5)) * -0.05, -0.3, 0.3);
      const i = (py * S + px) * 4; img.data[i] = clamp(r * sh, 0, 255); img.data[i + 1] = clamp(g * sh, 0, 255); img.data[i + 2] = clamp(b * sh, 0, 255); img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  reveal(x, z) {
    const gx = Math.floor((x + SIZE / 2) / SIZE * GC), gz = Math.floor((z + SIZE / 2) / SIZE * GC);
    const ctx = this.expl.getContext('2d'), px = (x + SIZE / 2) / SIZE * S, py = (z + SIZE / 2) / SIZE * S;
    const g = ctx.createRadialGradient(px, py, 6, px, py, 26); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(px - 26, py - 26, 52, 52);
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      const cx = gx + dx, cz = gz + dz; if (cx < 0 || cz < 0 || cx >= GC || cz >= GC || dx * dx + dz * dz > 9) continue;
      const i = cz * GC + cx; if (!this.eg[i]) { this.eg[i] = 1; const wx = -SIZE / 2 + (cx + 0.5) * (SIZE / GC), wz = -SIZE / 2 + (cz + 0.5) * (SIZE / GC); if (this.world.heightAt(wx, wz) > 0.3) this.seen++; }
    }
  }
  fraction() { return this.landCells ? this.seen / this.landCells : 0; }
  exploredData() { return this.expl.toDataURL(); }
  loadExplored(url, cb) { if (!url) return cb && cb(); const im = new Image(); im.onload = () => { this.expl.getContext('2d').drawImage(im, 0, 0); cb && cb(); }; im.src = url; }
  recount() { /* recompute grid from the canvas is not needed: grid is stored in save */ }

  drawFull(canvas, player, structures, crash) {
    const W = canvas.width, H = canvas.height, ctx = canvas.getContext('2d');
    ctx.fillStyle = '#08141a'; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.16; ctx.imageSmoothingEnabled = true; ctx.drawImage(this.base, 0, 0, W, H); ctx.globalAlpha = 1;
    const t = this.tmp.getContext('2d'); t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, S, S); t.drawImage(this.base, 0, 0);
    t.globalCompositeOperation = 'destination-in'; t.drawImage(this.expl, 0, 0); t.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.tmp, 0, 0, W, H);
    const P = (x, z) => [(x + SIZE / 2) / SIZE * W, (z + SIZE / 2) / SIZE * H];
    ctx.font = '600 13px system-ui'; ctx.textAlign = 'center';
    let [cx, cy] = P(crash.x, crash.z); ctx.fillStyle = '#ff5b5b'; ctx.fillText('✕', cx, cy + 5); ctx.fillStyle = '#fff'; ctx.fillText('Crash site', cx, cy - 9);
    for (const f of structures.fires) { [cx, cy] = P(f.x, f.z); ctx.fillText('🔥', cx, cy + 5); }
    for (const s of structures.shelters) { [cx, cy] = P(s.x, s.z); ctx.fillText('⛺', cx, cy + 5); }
    const [px, py] = P(player.pos.x, player.pos.z);
    ctx.save(); ctx.translate(px, py); ctx.rotate(Math.PI - player.yaw); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, W - 2, H - 2);
  }

  drawMini(canvas, player, structures, crash, objTarget) {
    const sz = canvas.width, ctx = canvas.getContext('2d'), view = 190, s = sz / view, rot = player.yaw + Math.PI;
    ctx.save(); ctx.clearRect(0, 0, sz, sz); ctx.beginPath(); ctx.arc(sz / 2, sz / 2, sz / 2, 0, 6.283); ctx.clip();
    ctx.fillStyle = '#0b3a52'; ctx.fillRect(0, 0, sz, sz);
    ctx.translate(sz / 2, sz / 2); ctx.rotate(rot);
    ctx.drawImage(this.base, -(player.pos.x + SIZE / 2) * s, -(player.pos.z + SIZE / 2) * s, SIZE * s, SIZE * s);
    const mk = (x, z, fn) => { ctx.save(); ctx.translate((x - player.pos.x) * s, (z - player.pos.z) * s); ctx.rotate(-rot); fn(); ctx.restore(); };
    const dot = (col, r) => () => { ctx.fillStyle = col; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill(); ctx.stroke(); };
    mk(crash.x, crash.z, () => { ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(5, 5); ctx.moveTo(5, -5); ctx.lineTo(-5, 5); ctx.stroke(); });
    for (const f of structures.fires) mk(f.x, f.z, dot('#ffb040', 5)); for (const sh of structures.shelters) mk(sh.x, sh.z, dot('#8fd45a', 5));
    if (objTarget) {                                    // the objective: a gold pin, pinned to the rim of the map when it is out of view
      let dx = (objTarget.x - player.pos.x) * s, dz = (objTarget.z - player.pos.z) * s; const d = Math.hypot(dx, dz), lim = sz / 2 - 11; if (d > lim) { dx *= lim / d; dz *= lim / d; }
      ctx.save(); ctx.translate(dx, dz); ctx.rotate(-rot); ctx.fillStyle = '#ffd54a'; ctx.strokeStyle = '#6b3f06'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -4, 6, Math.PI * 0.82, Math.PI * 2.18); ctx.lineTo(0, 8); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#6b3f06'; ctx.beginPath(); ctx.arc(0, -4, 2, 0, 6.283); ctx.fill(); ctx.restore();
    }
    ctx.restore();
    const g = ctx.createRadialGradient(sz / 2, sz / 2, sz * 0.4, sz / 2, sz / 2, sz / 2); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,20,30,0.45)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sz / 2, sz / 2, sz / 2, 0, 6.283); ctx.fill();
    ctx.save(); ctx.translate(sz / 2, sz / 2);                                                                                                  // you: an orange arrow with a white outline
    ctx.fillStyle = '#ff8a2a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(8, 9); ctx.lineTo(0, 4.5); ctx.lineTo(-8, 9); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
  }
}
