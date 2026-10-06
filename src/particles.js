import * as THREE from 'three';

const VERT = `
  attribute float aSize; attribute float aAlpha; varying float vA;
  void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * (600.0 / -mv.z); vA = aAlpha; gl_Position = projectionMatrix * mv; }`;
const FRAG = `
  uniform vec3 uColor; varying float vA;
  void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA; if (a < 0.01) discard; gl_FragColor = vec4(uColor, a); }`;

// A pool of billboard points that rise, grow and fade.
export class Emitter {
  constructor(scene, opts = {}) {
    this.o = Object.assign({ count: 80, rate: 20, life: 4, speed: 1.5, spread: 0.4, size: 1.2, grow: 2.0, alpha: 0.5, color: 0x777777, additive: false, gravity: 0, drift: new THREE.Vector3(0.4, 0, 0.1) }, opts);
    const n = this.o.count;
    this.pos = new Float32Array(n * 3); this.size = new Float32Array(n); this.alpha = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.age = new Float32Array(n).fill(-1); this.maxAge = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, uniforms: { uColor: { value: new THREE.Color(this.o.color) } }, blending: this.o.additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 4;      // after the transparent water, so smoke is not washed out by the sea haze
    this.position = new THREE.Vector3(); this.active = true; this.acc = 0; this.cursor = 0;
    scene.add(this.points);
  }
  setColor(c) { this.mat.uniforms.uColor.value.set(c); }
  spawn(n = 1, spreadMul = 1, speedMul = 1) {
    const o = this.o;
    for (let k = 0; k < n; k++) {
      const i = this.cursor; this.cursor = (this.cursor + 1) % o.count;
      this.age[i] = 0; this.maxAge[i] = o.life * (0.7 + Math.random() * 0.6);
      this.pos[i * 3] = this.position.x + (Math.random() - 0.5) * o.spread * spreadMul;
      this.pos[i * 3 + 1] = this.position.y;
      this.pos[i * 3 + 2] = this.position.z + (Math.random() - 0.5) * o.spread * spreadMul;
      const a = Math.random() * 6.283, s = Math.random() * o.spread * 2 * spreadMul;
      this.vel[i * 3] = Math.cos(a) * s + o.drift.x; this.vel[i * 3 + 1] = o.speed * speedMul * (0.6 + Math.random() * 0.8); this.vel[i * 3 + 2] = Math.sin(a) * s + o.drift.z;
    }
  }
  update(dt) {
    const o = this.o;
    if (this.active) { this.acc += dt * o.rate; const n = Math.floor(this.acc); this.acc -= n; if (n) this.spawn(n); }
    for (let i = 0; i < o.count; i++) {
      if (this.age[i] < 0) { this.alpha[i] = 0; this.size[i] = 0; continue; }
      this.age[i] += dt; const t = this.age[i] / this.maxAge[i];
      if (t >= 1) { this.age[i] = -1; this.alpha[i] = 0; this.size[i] = 0; continue; }
      this.vel[i * 3 + 1] += o.gravity * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = o.size + o.grow * t;
      this.alpha[i] = o.alpha * Math.min(1, t * 6) * (1 - t);
    }
    const g = this.points.geometry; g.attributes.position.needsUpdate = true; g.attributes.aSize.needsUpdate = true; g.attributes.aAlpha.needsUpdate = true;
  }
  dispose(scene) { scene.remove(this.points); this.points.geometry.dispose(); this.mat.dispose(); }
}
