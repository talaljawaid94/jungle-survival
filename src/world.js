import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Noise, mulberry32, clamp, smoothstep, mix } from './noise.js';
import { jungleTree, palmGeo, bushGeo, rockGeo, grassGeo, fernGeo, broadLeafGeo } from './vegetation.js';
import { crateObject } from './crate.js';
import { leafSprayTexture, frondTexture, broadLeafTexture, barkTextures, groundDetail } from './textures.js';

export const SIZE = 600;      // terrain extent in metres
export const SEG = 400;       // grid cells per side
export const R = 262;         // island radius
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

// ---------------------------------------------------------------- spatial hash
class Hash {
  constructor(cell = 16) { this.cell = cell; this.m = new Map(); }
  k(cx, cz) { return (cx + 1024) * 4096 + (cz + 1024); }
  add(o, x, z) {
    const key = this.k(Math.floor(x / this.cell), Math.floor(z / this.cell));
    let a = this.m.get(key); if (!a) { a = []; this.m.set(key, a); } a.push(o);
  }
  near(x, z, r, fn) {
    const c = this.cell;
    for (let cx = Math.floor((x - r) / c); cx <= Math.floor((x + r) / c); cx++)
      for (let cz = Math.floor((z - r) / c); cz <= Math.floor((z + r) / c); cz++) {
        const a = this.m.get(this.k(cx, cz)); if (a) for (const o of a) fn(o);
      }
  }
}

// ---------------------------------------------------------------- geometry helpers
function paint(geo, hex) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
function prep(geo) {
  geo.deleteAttribute('uv');
  if (geo.index) geo = geo.toNonIndexed();
  return geo;
}
function blob(r, detail, jitter, seed) {
  let g = new THREE.IcosahedronGeometry(r, detail);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-4);
  const rnd = mulberry32(seed), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const l = v.length();
    v.multiplyScalar(1 + (rnd() - 0.5) * 2 * jitter / 1.0); p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
function merged(list) {
  const prepped = list.map((g) => { const x = prep(g); if (!x.attributes.normal) x.computeVertexNormals(); return x; });
  return mergeGeometries(prepped, false);
}

// ---------------------------------------------------------------- World
export class World {
  constructor(scene) {
    this.scene = scene;
    this.noise = new Noise(1337);
    this.rng = mulberry32(4242);
    this.timeU = { value: 0 };
    this.items = [];
    this.ihash = new Hash(16);   // interactables
    this.chash = new Hash(8);    // colliders
    this.removed = new Set();
    this.lakes = [];
    this.crash = { x: -40, z: 30, y: 6 };
    const T = (label, fn) => { const t = performance.now(); fn(); console.info(`[load]   world.${label}: ${Math.round(performance.now() - t)} ms`); };
    T('findLakes', () => this.findLakes());
    T('findCrash', () => this.findCrash());
    T('buildGrid', () => this.buildGrid());
    T('buildTerrain', () => this.buildTerrain());
    T('buildWater', () => this.buildWater());
    T('buildVegetation', () => this.buildVegetation());
    T('buildCrates', () => this.buildCrates());
  }

  // ------------------------------------------------ height field
  rawHeight(x, z, lakes = true) {
    const n = this.noise, d = Math.hypot(x, z) / R;
    const warp = n.fbm(x * 0.004 + 11.3, z * 0.004 - 7.1, 3) * 0.35;
    const e = 1 - Math.pow(Math.max(d + warp * 0.5, 0), 1.7);
    let h = e > 0 ? Math.pow(e, 1.5) * 24 - 4 : e * 34 - 4;
    const land = smoothstep(0.0, 0.5, e);
    h += (n.fbm(x * 0.009 + 3, z * 0.009 + 8, 4) * 9 + n.fbm(x * 0.035, z * 0.035, 3) * 1.3) * land;
    h += 14 * Math.exp(-(((x - 70) ** 2 + (z + 45) ** 2) / (75 * 75))) * land;
    if (lakes) for (const l of this.lakes) {
      const dd = Math.hypot(x - l.x, z - l.z), t = smoothstep(l.r * 1.7, l.r * 0.7, dd);
      if (t > 0) h = mix(h, -2.4, t);
    }
    return h;
  }
  findLakes() {
    const rnd = mulberry32(99);
    for (let tries = 0; tries < 600 && this.lakes.length < 2; tries++) {
      const a = rnd() * 6.283, rr = 50 + rnd() * 130, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      const h = this.rawHeight(x, z, false);
      if (h < 3 || h > 7) continue;
      if (this.lakes.some((l) => Math.hypot(l.x - x, l.z - z) < 130)) continue;
      this.lakes.push({ x, z, r: 20 + rnd() * 10 });
    }
    if (!this.lakes.length) this.lakes.push({ x: 60, z: 60, r: 26 });
  }
  findCrash() {
    const rnd = mulberry32(7);
    for (let tries = 0; tries < 800; tries++) {
      const a = rnd() * 6.283, rr = 60 + rnd() * 90, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      const h = this.rawHeight(x, z);
      if (h < 4 || h > 9) continue;
      const s = Math.abs(this.rawHeight(x + 4, z) - h) + Math.abs(this.rawHeight(x, z + 4) - h);
      if (s > 1.4) continue;
      if (this.lakes.some((l) => Math.hypot(l.x - x, l.z - z) < l.r * 2.2 + 30)) continue;
      this.crash = { x, z, y: h };
      return;
    }
  }
  buildGrid() {
    const N = SEG + 1; this.grid = new Float32Array(N * N);
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++)
      this.grid[iz * N + ix] = this.rawHeight(-SIZE / 2 + (ix / SEG) * SIZE, -SIZE / 2 + (iz / SEG) * SIZE);
    this.crash.y = this.heightAt(this.crash.x, this.crash.z);
  }
  heightAt(x, z) {
    const fx = ((x + SIZE / 2) / SIZE) * SEG, fz = ((z + SIZE / 2) / SIZE) * SEG;
    if (fx < 0 || fz < 0 || fx >= SEG || fz >= SEG) return -40;
    const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, N = SEG + 1, g = this.grid;
    const a = g[iz * N + ix], b = g[iz * N + ix + 1], c = g[(iz + 1) * N + ix], d = g[(iz + 1) * N + ix + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }
  slopeAt(x, z) {
    return (Math.abs(this.heightAt(x + 2, z) - this.heightAt(x - 2, z)) + Math.abs(this.heightAt(x, z + 2) - this.heightAt(x, z - 2))) / 4;
  }
  nearLake(x, z, pad = 0) { return this.lakes.some((l) => Math.hypot(l.x - x, l.z - z) < l.r * 1.7 + pad); }
  isFresh(x, z) { return this.lakes.some((l) => Math.hypot(l.x - x, l.z - z) < l.r * 1.75); }
  surfaceAt(x, z) {
    const h = this.heightAt(x, z);
    if (h < -0.1) return 'water';
    if (this.nearLake(x, z, 4) && h < 1.2) return 'mud';
    if (h < 2.1) return 'sand';
    if (this.slopeAt(x, z) > 0.62) return 'rock';
    return 'grass';
  }

  // ------------------------------------------------ terrain mesh
  buildTerrain() {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color(), n = this.noise;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), h = this.heightAt(x, z); p.setY(i, h);
      const s = this.slopeAt(x, z), v = n.fbm(x * 0.12, z * 0.12, 3) * 0.5 + 0.5, v2 = n.noise2(x * 0.7, z * 0.7) * 0.5 + 0.5;
      if (h < 0) {                       // under water: sand to deep teal
        const t = clamp(-h / 6, 0, 1); c.setRGB(mix(0.72, 0.05, t), mix(0.64, 0.25, t), mix(0.46, 0.32, t));
      } else if (this.nearLake(x, z, 5) && h < 1.4) {
        c.setRGB(0.28 + v * 0.1, 0.22 + v * 0.06, 0.14);
      } else if (h < 2.0) {
        const t = smoothstep(0.0, 2.0, h); c.setRGB(mix(0.78, 0.7, v2) , mix(0.7, 0.62, v2), mix(0.5, 0.42, v2));
        c.lerp(new THREE.Color(0.2, 0.36, 0.12), t * t * 0.7);
      } else if (s > 0.62 || h > 32) {
        c.setRGB(0.36 + v * 0.1, 0.34 + v * 0.09, 0.3 + v * 0.08);
      } else {
        const t = v * 0.7 + v2 * 0.3;
        c.setRGB(mix(0.1, 0.2, t), mix(0.26, 0.42, t), mix(0.07, 0.12, t));
        if (n.noise2(x * 0.05 + 40, z * 0.05) > 0.45) c.lerp(new THREE.Color(0.26, 0.2, 0.1), 0.5); // leaf litter / dirt
      }
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const det = groundDetail(4); this.detail = det;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, bumpMap: det.bump, bumpScale: 1.6, envMapIntensity: 0.55 });
    det.bump.repeat.set(210, 210);
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uDetail = { value: det.map };
      sh.vertexShader = 'varying vec3 vWPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'uniform sampler2D uDetail; varying vec3 vWPos;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float d1 = texture2D(uDetail, vWPos.xz * 0.21).r, d2 = texture2D(uDetail, vWPos.xz * 0.031 + 0.37).r, d3 = texture2D(uDetail, vWPos.xz * 1.15).r;
        float dd = d1 * 0.45 + d2 * 0.35 + d3 * 0.2;
        diffuseColor.rgb *= mix(0.5, 1.5, dd); diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.333))), diffuseColor.rgb, 1.25);`);
    };
    this.terrain = new THREE.Mesh(geo, mat); this.terrain.receiveShadow = true; this.scene.add(this.terrain);
  }

  buildWater() {
    const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(S, S), TAU = Math.PI * 2;
    const hf = (u, v) => Math.sin(TAU * (2 * u + 1 * v)) * 0.5 + Math.sin(TAU * (3 * u - 2 * v) + 1.3) * 0.35 + Math.sin(TAU * (5 * u + 4 * v) + 0.4) * 0.2 + Math.cos(TAU * (7 * u - 6 * v)) * 0.1;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const e = 1 / S, u = x / S, v = y / S;
      const dx = (hf(u + e, v) - hf(u - e, v)) * 4, dy = (hf(u, v + e) - hf(u, v - e)) * 4;
      const l = Math.hypot(dx, dy, 1), i = (y * S + x) * 4;
      img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(220, 220);
    this.waterTex = tex;
    const geo = new THREE.PlaneGeometry(4000, 4000); geo.rotateX(-Math.PI / 2);
    // depth map: 0 at the shoreline, 1 in deep water. Drives colour, transparency and foam in the water shader.
    const DN = 512, dd = new Uint8Array(DN * DN);
    for (let iz = 0; iz < DN; iz++) for (let ix = 0; ix < DN; ix++) {
      const h = this.heightAt(-SIZE / 2 + (ix + 0.5) / DN * SIZE, -SIZE / 2 + (iz + 0.5) / DN * SIZE);
      dd[iz * DN + ix] = h >= 0 ? 0 : Math.min(255, Math.round(Math.min(-h / 7, 1) * 255));
    }
    const depthTex = new THREE.DataTexture(dd, DN, DN, THREE.RedFormat, THREE.UnsignedByteType); depthTex.magFilter = depthTex.minFilter = THREE.LinearFilter; depthTex.needsUpdate = true;
    depthTex.wrapS = depthTex.wrapT = THREE.ClampToEdgeWrapping;
    this.waterMat = new THREE.MeshStandardMaterial({ color: 0x2b8aa0, transparent: true, roughness: 0.06, metalness: 0.0, normalMap: tex, normalScale: new THREE.Vector2(0.7, 0.7), depthWrite: false, envMapIntensity: 1.3 });
    this.waterMat.onBeforeCompile = (sh) => {
      sh.uniforms.uDepthMap = { value: depthTex }; sh.uniforms.uSize = { value: SIZE }; sh.uniforms.uTime = this.timeU;
      sh.vertexShader = 'varying vec3 vWPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'uniform sampler2D uDepthMap; uniform float uSize; uniform float uTime; varying vec3 vWPos;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        vec2 dUv = (vWPos.xz + uSize * 0.5) / uSize; bool inside = dUv.x > 0.0 && dUv.x < 1.0 && dUv.y > 0.0 && dUv.y < 1.0;
        float dep = inside ? texture2D(uDepthMap, dUv).r : 1.0;
        vec3 shallowC = vec3(0.10, 0.52, 0.50), midC = vec3(0.02, 0.30, 0.40), deepC = vec3(0.005, 0.09, 0.18);
        vec3 wc = mix(shallowC, midC, smoothstep(0.0, 0.3, dep)); wc = mix(wc, deepC, smoothstep(0.25, 0.9, dep));
        diffuseColor.rgb = wc; diffuseColor.a = mix(0.25, 0.94, smoothstep(0.0, 0.3, dep));
        float wave = sin(uTime * 1.6 - dep * 55.0 + vWPos.x * 0.35 + vWPos.z * 0.2);
        float foam = smoothstep(0.075, 0.0, dep) * (0.55 + 0.45 * wave) + smoothstep(0.02, 0.0, dep) * 0.6;
        float ripple = smoothstep(0.9, 1.0, sin(vWPos.x * 0.8 + uTime * 0.7) * sin(vWPos.z * 0.9 - uTime * 0.5)) * 0.08 * (1.0 - smoothstep(0.3, 0.9, dep));
        foam = clamp(foam + ripple, 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.97, 0.98), foam); diffuseColor.a = max(diffuseColor.a, foam * 0.95);`);
    };
    this.water = new THREE.Mesh(geo, this.waterMat); this.water.position.y = 0; this.water.renderOrder = 1; this.scene.add(this.water);
  }

  // ------------------------------------------------ vegetation
  sway(mat, amount, { noFlip = false, nearFade = false } = {}) {
    mat.onBeforeCompile = (s) => {
      s.uniforms.uTime = this.timeU; s.uniforms.uSway = { value: amount };
      s.vertexShader = 'uniform float uTime;\nuniform float uSway;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float sw = sin(uTime * 1.4 + instanceMatrix[3].x * 0.21 + instanceMatrix[3].z * 0.17);
          float sh = max(position.y, 0.0);
          transformed.x += sw * uSway * sh;
          transformed.z += cos(uTime * 1.1 + instanceMatrix[3].x * 0.13) * uSway * sh * 0.6;
          transformed.xz += vec2(sin(uTime * 2.3 + position.x * 3.1 + position.y * 2.0), cos(uTime * 2.1 + position.z * 2.7)) * uSway * 0.25 * min(sh, 4.0);
        #endif`);
      if (noFlip) s.fragmentShader = s.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal *= faceDirection;');
      if (nearFade) s.fragmentShader = s.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        { float nd = length(vViewPosition); float th = clamp((nd - 1.6) / 2.4, 0.0, 1.0);
          if (th < 1.0 && fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) > th) discard; }`);
    };
    return mat;
  }
  foliageMat(map, { amount = 0.014, vc = false, noFlip = true, alphaTest = 0.42, rough = 0.78, nearFade = false } = {}) {
    return this.sway(new THREE.MeshStandardMaterial({ map, alphaTest, side: THREE.DoubleSide, roughness: rough, vertexColors: vc, metalness: 0 }), amount, { noFlip, nearFade });
  }

  buildVegetation() {
    const bark = barkTextures(2), leafA = leafSprayTexture(3), leafB = leafSprayTexture(17, 9), frond = frondTexture(5, 18, 0), fern = frondTexture(8, 14, 0.25), broad = broadLeafTexture(9);
    this.barkMat = this.sway(new THREE.MeshStandardMaterial({ map: bark.map, bumpMap: bark.bump, bumpScale: 3, roughness: 1 }), 0.012);
    this.leafMat = this.foliageMat(leafA, { vc: true, amount: 0.016, nearFade: true });
    this.leafMatB = this.foliageMat(leafB, { vc: true, amount: 0.016, nearFade: true });
    this.frondMat = this.foliageMat(frond, { noFlip: false, amount: 0.02, rough: 0.6 });
    this.fernMat = this.foliageMat(fern, { noFlip: false, amount: 0.12, rough: 0.7, nearFade: true });
    this.broadMat = this.foliageMat(broad, { noFlip: false, amount: 0.1, rough: 0.55, nearFade: true });
    this.vegMat = this.sway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), 0.012);
    this.grassMat = this.sway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), 0.14, { nearFade: true });
    this.rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    const depthFor = (map) => new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.42, side: THREE.DoubleSide });
    const dA = depthFor(leafA), dB = depthFor(leafB), dF = depthFor(frond);

    const rnd = this.rng, noise = this.noise, cr = this.crash;
    const q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(), m = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0);
    const tint = new THREE.Color();

    // parts: [{ geo, mat, depth?, shadow? }]; every part shares the same instance transforms so trunks and foliage stay aligned.
    const place = (kind, parts, count, cfg) => {
      const list = [];
      let tries = 0;
      while (list.length < count && tries < count * 40) {
        tries++;
        const x = (rnd() - 0.5) * SIZE * 0.94, z = (rnd() - 0.5) * SIZE * 0.94, h = this.heightAt(x, z);
        if (h < cfg.minH || h > cfg.maxH) continue;
        if (cfg.maxSlope !== undefined && this.slopeAt(x, z) > cfg.maxSlope) continue;
        if (cfg.avoidLake !== false && this.nearLake(x, z, cfg.lakePad ?? 4)) continue;
        if (Math.hypot(x - cr.x, z - cr.z) < (cfg.clear ?? 15)) continue;
        if (cfg.density && rnd() > cfg.density(x, z)) continue;
        if (cfg.spacing) { let bad = false; this.chash.near(x, z, cfg.spacing, (o) => { if (Math.hypot(o.x - x, o.z - z) < cfg.spacing) bad = true; }); if (bad) continue; }
        list.push({ x, z, y: h });
      }
      const chunks = new Map();
      for (const o of list) { const key = Math.floor((o.x + SIZE / 2) / 100) * 16 + Math.floor((o.z + SIZE / 2) / 100); if (!chunks.has(key)) chunks.set(key, []); chunks.get(key).push(o); }
      for (const group of chunks.values()) {
        const mk = (p) => {
          const mesh = new THREE.InstancedMesh(p.geo, p.mat, group.length);
          mesh.castShadow = !!(cfg.shadow && p.shadow !== false); mesh.receiveShadow = true;
          if (p.depth) mesh.customDepthMaterial = p.depth;
          return mesh;
        };
        const nearMeshes = parts.filter((p) => p.geo).map(mk), farMeshes = cfg.lod ? cfg.lod.filter((p) => p.geo).map(mk) : [];
        for (const f of farMeshes) f.visible = false;
        const meshes = nearMeshes.concat(farMeshes);
        group.forEach((o, i) => {
          const s = cfg.scale[0] + rnd() * (cfg.scale[1] - cfg.scale[0]);
          q.setFromAxisAngle(up, rnd() * 6.283); pos.set(o.x, o.y + (cfg.lift ?? -0.1), o.z); scl.set(s, s * (cfg.stretchY ? 0.85 + rnd() * 0.3 : 1), s);
          m.compose(pos, q, scl);
          tint.setRGB(0.84 + rnd() * 0.26, 0.88 + rnd() * 0.24, 0.84 + rnd() * 0.22);
          for (const mesh of meshes) { mesh.setMatrixAt(i, m); mesh.setColorAt(i, tint); }
          if (kind !== 'rock' && kind !== 'stone' && Math.hypot(o.x - cr.x, o.z - cr.z) < 34) (this.blastList ||= []).push({ meshes: meshes, idx: i, m: m.clone(), tint: tint.clone(), x: o.x, z: o.z, kind, soft: !!cfg.decor || kind === 'bush' || kind === 'berry' });
          if (cfg.decor) return;
          o.m0 = m.clone();
          o.kind = kind; o.meshes = meshes; o.idx = i; o.scale = s; o.id = this.items.length; o.removed = false; o.cooldown = 0;
          o.ir = cfg.ir ?? 0; o.cr = cfg.cr ? cfg.cr * s : 0;
          o.data = cfg.data ? cfg.data() : {};
          this.items.push(o);
          if (cfg.interact) this.ihash.add(o, o.x, o.z);
          if (cfg.cr) this.chash.add(o, o.x, o.z);
        });
        for (const mesh of meshes) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere(); this.scene.add(mesh); }
        const bs = nearMeshes[0].boundingSphere; (this.chunkRecs ||= []).push({ near: nearMeshes, far: farMeshes, x: bs.center.x, y: bs.center.y, z: bs.center.z, r: bs.radius, maxDist: cfg.maxDist || 0 });
      }
    };

    const dens = (f) => (x, z) => f * (0.45 + 0.55 * (noise.fbm(x * 0.012 + 50, z * 0.012, 2) * 0.5 + 0.5));
    const treeParts = (t, leaf, dep) => [{ geo: t.trunk, mat: this.barkMat }, { geo: t.foliage, mat: leaf, depth: dep }, { geo: t.extra, mat: this.vegMat }];
    const T = { minH: 2.4, maxH: 33, maxSlope: 0.7, scale: [0.8, 1.4], cr: 0.5, interact: true, ir: 1.8, shadow: true, spacing: 2.6, density: dens(1) };
    const TL = (seed, kind, leaf, dep) => ({ ...T, lod: treeParts(jungleTree(seed, kind, 1), leaf, dep) });
    place('tree', treeParts(jungleTree(11, 'tall'), this.leafMat, dA), 700, TL(11, 'tall', this.leafMat, dA));
    place('tree', treeParts(jungleTree(23, 'tall'), this.leafMatB, dB), 500, TL(23, 'tall', this.leafMatB, dB));
    place('tree', treeParts(jungleTree(37, 'mid'), this.leafMat, dA), 400, TL(37, 'mid', this.leafMat, dA));
    place('fruit', treeParts(jungleTree(5, 'fruit'), this.leafMatB, dB), 60, { minH: 2.6, maxH: 22, maxSlope: 0.5, scale: [0.9, 1.2], cr: 0.45, interact: true, ir: 1.8, shadow: true, spacing: 4, data: () => ({ fruits: 3 }) });
    for (const sd of [3, 9, 15]) {
      const pg = palmGeo(sd);
      place('palm', [{ geo: pg.trunk, mat: this.barkMat }, { geo: pg.foliage, mat: this.frondMat, depth: dF }, { geo: pg.extra, mat: this.vegMat }], 55, { minH: 0.5, maxH: 2.6, maxSlope: 0.4, scale: [0.85, 1.2], cr: 0.3, interact: true, ir: 1.6, shadow: true, spacing: 4, clear: 8, data: () => ({ coconuts: 2 }) });
    }
    const bg = bushGeo(31, false), bb = bushGeo(37, true);
    place('bush', [{ geo: bg.foliage, mat: this.leafMat, depth: dA, shadow: false }], 260, { minH: 2.2, maxH: 30, maxSlope: 0.65, scale: [0.8, 1.4], interact: true, ir: 1.5, clear: 6, shadow: false });
    place('berry', [{ geo: bb.foliage, mat: this.leafMatB, depth: dB, shadow: false }, { geo: bb.extra, mat: this.vegMat }], 110, { minH: 2.4, maxH: 28, maxSlope: 0.6, scale: [0.9, 1.3], interact: true, ir: 1.5, clear: 6 });
    place('rock', [{ geo: rockGeo(61), mat: this.rockMat }], 130, { minH: 0.3, maxH: 40, scale: [1.1, 3.2], cr: 0.85, lift: -0.35, clear: 10, shadow: true, avoidLake: false, lakePad: -10 });
    place('stone', [{ geo: rockGeo(71, 0x8d8d86, false), mat: this.rockMat }], 240, { minH: 0.5, maxH: 34, scale: [0.16, 0.28], interact: true, ir: 1.3, lift: 0.02, clear: 3 });
    const stickGeo = new THREE.CylinderGeometry(0.03, 0.04, 1.1, 6); stickGeo.rotateZ(Math.PI / 2); stickGeo.translate(0, 0.05, 0); paint(stickGeo, 0x6b4a2b);
    place('stick', [{ geo: prep(stickGeo), mat: this.vegMat }], 260, { minH: 1.5, maxH: 30, maxSlope: 0.6, scale: [0.8, 1.3], interact: true, ir: 1.3, clear: 2, lift: 0.0 });
    // undergrowth (decoration only)
    place('grass', [{ geo: grassGeo(), mat: this.grassMat }], 9000, { maxDist: 150, minH: 1.6, maxH: 32, maxSlope: 0.65, scale: [0.8, 1.7], clear: 0, decor: true, avoidLake: true, lakePad: -3 });
    place('fern', [{ geo: fernGeo(4), mat: this.fernMat }], 2200, { maxDist: 200, minH: 2.2, maxH: 30, maxSlope: 0.6, scale: [0.8, 1.6], clear: 0, decor: true, avoidLake: true, lakePad: 0, lift: 0.02 });
    place('broad', [{ geo: broadLeafGeo(6), mat: this.broadMat }], 700, { minH: 2.2, maxH: 28, maxSlope: 0.55, scale: [0.9, 1.7], clear: 6, decor: true, avoidLake: true, lakePad: 0, lift: 0.02 });
  }

  buildCrates() {
    const c = this.crash;
    const spots = [[6, 3, 0.4, 'supplies'], [-5, 5, -0.8, 'medical'], [3, -7, 1.2, 'food']];
    this.crates = [];
    spots.forEach(([dx, dz, rot, loot], i) => {
      const g = crateObject(loot); const x = c.x + dx, z = c.z + dz;
      g.position.set(x, this.heightAt(x, z), z); g.rotation.y = rot; this.scene.add(g);
      const o = { x, z, y: g.position.y, kind: 'crate', obj3d: g, ir: 2.0, id: this.items.length, removed: false, data: { loot, opened: false } };
      this.items.push(o); this.ihash.add(o, x, z); this.crates.push(o);
    });
  }

  // ------------------------------------------------ collisions / items
  pushOut(pos, radius) {   // pos: {x,z} mutated, returns true if pushed
    let hit = false;
    this.chash.near(pos.x, pos.z, radius + 3.5, (o) => {
      if (o.removed) return;
      const dx = pos.x - o.x, dz = pos.z - o.z, d = Math.hypot(dx, dz), min = o.cr + radius;
      if (d < min && d > 0.0001) { pos.x = o.x + (dx / d) * min; pos.z = o.z + (dz / d) * min; hit = true; }
    });
    return hit;
  }
  itemsNear(x, z, r, fn) { this.ihash.near(x, z, r, (o) => { if (!o.removed) fn(o); }); }
  removeItem(o, silent = false) {
    o.removed = true; this.removed.add(o.id);
    if (o.meshes) for (const mesh of o.meshes) { mesh.setMatrixAt(o.idx, ZERO); mesh.instanceMatrix.needsUpdate = true; }
    if (o.kind === 'tree' || o.kind === 'fruit' || o.kind === 'palm') {   // leave a stump behind
      if (!this.stumpGeo) { this.stumpGeo = new THREE.CylinderGeometry(0.36, 0.52, 0.6, 9); this.stumpGeo.translate(0, 0.3, 0); this.stumpCap = new THREE.MeshStandardMaterial({ color: 0xb59a6c, roughness: 0.9 }); }
      const st = new THREE.Mesh(this.stumpGeo, [this.barkMat, this.stumpCap, this.barkMat]);
      const k = (o.scale || 1) * (o.kind === 'palm' ? 0.5 : 1); st.scale.set(k, k, k); st.position.set(o.x, o.y - 0.1, o.z); st.rotation.y = o.x; st.castShadow = true; st.receiveShadow = true;
      this.scene.add(st); o.stump = st;
    }
    if (o.obj3d) o.obj3d.visible = false;
  }
  // crash shockwave: nearby foliage is scorched dark and bent away from the blast; ground cover close in is burnt away
  blastDamage(cx, cz) {
    this.clearBlast(); const m = new THREE.Matrix4(), T = new THREE.Matrix4(), R = new THREE.Matrix4(), ax = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color(), dark = new THREE.Color(0.05, 0.03, 0.02);
    const touched = new Set();
    for (const e of this.blastList || []) {
      const dx = e.x - cx, dz = e.z - cz, d = Math.hypot(dx, dz) || 1;
      if (e.kind === 'tree' && d < 11) continue;                                           // these were snapped off
      const f = Math.max(0, 1 - d / (e.soft ? 24 : 32)); if (f <= 0) continue;
      m.copy(e.m);
      if (e.soft && d < 5 + this.rng() * 3) m.makeScale(0, 0, 0);                         // burnt away
      else {
        const ang = (e.soft ? 0.9 : 0.4) * f * (0.6 + this.rng() * 0.7);
        ax.set(dz / d, 0, -dx / d); p.setFromMatrixPosition(e.m);
        R.makeRotationAxis(ax, ang); T.makeTranslation(p.x, p.y, p.z);
        m.copy(T).multiply(R).multiply(new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z)).multiply(e.m);
      }
      col.copy(e.tint).lerp(dark, e.soft ? Math.min(0.94, Math.pow(f, 0.55) * 1.1) : Math.max(0, Math.min(0.95, 1 - (d - 11) / 22)));
      for (const mesh of e.meshes) { mesh.setMatrixAt(e.idx, m); mesh.setColorAt(e.idx, col); touched.add(mesh); }
    }
    for (const mesh of touched) { mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; }
    this.blasted = touched;
  }
  clearBlast() {
    if (!this.blasted) return;
    for (const e of this.blastList || []) for (const mesh of e.meshes) { if (!this.blasted.has(mesh)) continue; mesh.setMatrixAt(e.idx, e.m); mesh.setColorAt(e.idx, e.tint); }
    for (const mesh of this.blasted) { mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; }
    this.blasted = null;
  }
  reset() {
    this.clearBlast();
    for (const o of this.items) {
      if (o.removed) { o.removed = false; if (o.stump) { this.scene.remove(o.stump); o.stump = null; } if (o.meshes && o.m0) for (const mesh of o.meshes) { mesh.setMatrixAt(o.idx, o.m0); mesh.instanceMatrix.needsUpdate = true; } if (o.obj3d) o.obj3d.visible = true; }
      o.cooldown = 0;
      if (o.kind === 'fruit') o.data.fruits = 3; if (o.kind === 'palm') o.data.coconuts = 2;
      if (o.kind === 'crate') { o.data.opened = false; const lid = o.obj3d.userData.lid; lid.position.set(0, o.obj3d.userData.lidY, 0); lid.rotation.set(0, 0, 0); }
    }
    this.removed.clear();
  }
  applyRemoved(ids) { for (const id of ids) { const o = this.items[id]; if (o && !o.removed && o.kind !== 'crate') this.removeItem(o); } }
  openCrate(o) { o.data.opened = true; if (o.obj3d.userData.lid) { o.obj3d.userData.lid.position.set(0.15, 0.04, 0.98); o.obj3d.userData.lid.rotation.set(0.03, 0.4, 0.05); } }

  // distance culling and tree LOD: chunks beyond the fog's opaque distance are skipped, far trees use a lighter model
  updateLOD(cam, fogDensity) {
    const fogD = Math.min(650, 2.3 / Math.max(fogDensity, 0.0035));
    for (const c of this.chunkRecs || []) {
      const dx = c.x - cam.x, dz = c.z - cam.z, d = Math.max(0, Math.hypot(dx, dz) - c.r), lim = c.maxDist ? Math.min(c.maxDist, fogD) : fogD, vis = d < lim;
      const useNear = d < 95;
      for (const m of c.near) m.visible = vis && (useNear || !c.far.length);
      for (const m of c.far) m.visible = vis && !useNear;
    }
  }
  update(dt, t) {
    this.timeU.value = t;
    this.waterTex.offset.x = (t * 0.004) % 1; this.waterTex.offset.y = (t * 0.0025) % 1;
    for (const o of this.items) if (o.cooldown > 0) o.cooldown -= dt;
  }
}
