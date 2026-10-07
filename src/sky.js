import * as THREE from 'three';
import { mulberry32, smoothstep, clamp } from './noise.js';

const C = (r, g, b) => new THREE.Color(r, g, b);
const NIGHT_TOP = C(0.018, 0.032, 0.085), NIGHT_HOR = C(0.055, 0.085, 0.165);
const DAY_TOP = C(0.16, 0.42, 0.85), DAY_HOR = C(0.66, 0.82, 0.92);
const GOLD_HOR = C(1.0, 0.52, 0.22), GOLD_TOP = C(0.28, 0.32, 0.6);

export class Sky {
  constructor(scene, renderer) {
    this.scene = scene; this.renderer = renderer;
    this.sunDir = new THREE.Vector3(0, 1, 0); this.daylight = 1; this.golden = 0; this.night = 0;
    scene.fog = new THREE.FogExp2(0xa8c8d8, 0.0065);

    this.uniforms = {
      top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3() }, sunColor: { value: new THREE.Color(1, 0.95, 0.85) },
      moonDir: { value: new THREE.Vector3() },
    };
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(820, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: this.uniforms,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        varying vec3 vDir; uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunColor; uniform vec3 moonDir;
        void main(){
          vec3 d = normalize(vDir); float h = d.y;
          vec3 col = mix(bottom, top, pow(clamp(h, 0.0, 1.0), 0.5));
          if (h < 0.0) col = mix(bottom, bottom * 0.7, clamp(-h * 3.0, 0.0, 1.0));
          float s = max(dot(d, sunDir), 0.0);
          col += sunColor * (pow(s, 900.0) * 3.0 + pow(s, 14.0) * 0.28 + pow(s, 3.0) * 0.08);
          float m = max(dot(d, moonDir), 0.0);
          col += vec3(0.8, 0.85, 1.0) * (smoothstep(0.9993, 0.9996, m) * 1.2 + pow(m, 60.0) * 0.08);
          gl_FragColor = vec4(col, 1.0);
        }`,
    }));
    this.dome.frustumCulled = false; this.dome.renderOrder = -10; scene.add(this.dome);

    // image-based lighting: bake the sky into a PMREM cube so every PBR surface gets ambient light and reflections
    this.pmrem = new THREE.PMREMGenerator(renderer); this.envRT = null; this.envHours = -99;
    this.envScene = new THREE.Scene(); this.envScene.add(new THREE.Mesh(new THREE.SphereGeometry(500, 24, 12), this.dome.material));

    // stars
    const rnd = mulberry32(8), n = 1600, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = rnd() * 2 - 1, a = rnd() * 6.283, r = Math.sqrt(1 - u * u), y = Math.abs(u) * 0.95 + 0.05;
      pos[i * 3] = Math.cos(a) * r * 780; pos[i * 3 + 1] = y * 780; pos[i * 3 + 2] = Math.sin(a) * r * 780;
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.stars = new THREE.Points(sg, this.starMat); this.stars.frustumCulled = false; scene.add(this.stars);

    // lights
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 1; sc.far = 400;
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun); scene.add(this.sun.target);
    this.moon = new THREE.DirectionalLight(0x8fa8e8, 0.0); scene.add(this.moon);
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x2a3a1a, 0.6); scene.add(this.hemi);

    // clouds
    this.clouds = new THREE.Group();
    const rnd2 = mulberry32(21), cm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, fog: false, depthWrite: false });
    this.cloudMat = cm;
    for (let i = 0; i < 26; i++) {
      const g = new THREE.Group();
      for (let k = 0; k < 5; k++) {
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), cm);
        b.position.set((k - 2) * 20 * (0.7 + rnd2() * 0.5), rnd2() * 6, (rnd2() - 0.5) * 22);
        b.scale.set(26 + rnd2() * 20, 6 + rnd2() * 4, 18 + rnd2() * 12); g.add(b);
      }
      const a = rnd2() * 6.283, r = 250 + rnd2() * 450;
      g.position.set(Math.cos(a) * r, 150 + rnd2() * 90, Math.sin(a) * r); g.userData.speed = 2 + rnd2() * 3;
      this.clouds.add(g);
    }
    scene.add(this.clouds);
  }

  updateEnv(hours) {
    this.envHours = hours;
    const rt = this.pmrem.fromScene(this.envScene, 0.0, 0.1, 1000);
    if (this.envRT) this.envRT.dispose();
    this.envRT = rt; this.scene.environment = rt.texture;
  }

  update(dt, hours, center) {
    const ang = ((hours - 6) / 24) * Math.PI * 2;
    this.sunDir.set(Math.cos(ang) * 0.85, Math.sin(ang), 0.45).normalize();
    const e = this.sunDir.y;
    const day = smoothstep(-0.12, 0.3, e), gold = Math.exp(-Math.pow(e / 0.17, 2)) * smoothstep(-0.3, -0.05, e + 0.12);
    this.daylight = day; this.golden = gold; this.night = 1 - smoothstep(-0.2, 0.05, e);

    const top = NIGHT_TOP.clone().lerp(DAY_TOP, day).lerp(GOLD_TOP, gold * 0.55);
    const hor = NIGHT_HOR.clone().lerp(DAY_HOR, day).lerp(GOLD_HOR, gold * 0.85);
    this.uniforms.top.value.copy(top); this.uniforms.bottom.value.copy(hor);
    this.uniforms.sunDir.value.copy(this.sunDir);
    this.uniforms.sunColor.value.set(1, 0.95, 0.85).lerp(GOLD_HOR, gold);
    this.uniforms.moonDir.value.copy(this.sunDir).multiplyScalar(-1);
    this.dome.position.copy(center); this.stars.position.copy(center);
    this.starMat.opacity = clamp(1 - day * 1.6, 0, 1) * 0.95;
    this.stars.rotation.y += dt * 0.002;

    this.scene.fog.color.copy(hor).lerp(top, 0.28).lerp(new THREE.Color(0.55, 0.68, 0.6), 0.18 * day);
    this.scene.fog.density = 0.0095 - 0.0045 * day + gold * 0.0012;

    // sun light with shadows following the player
    const snap = 2;
    const cx = Math.round(center.x / snap) * snap, cz = Math.round(center.z / snap) * snap;
    this.sun.target.position.set(cx, center.y, cz);
    this.sun.position.set(cx + this.sunDir.x * 160, center.y + Math.max(this.sunDir.y, 0.12) * 160, cz + this.sunDir.z * 160);
    this.sun.color.set(1, 0.96, 0.88).lerp(GOLD_HOR, gold * 0.9);
    this.sun.intensity = 3.2 * smoothstep(-0.02, 0.35, e);
    this.moon.position.set(center.x - this.sunDir.x * 160, center.y + 120, center.z - this.sunDir.z * 160);
    this.moon.target.position.copy(center);
    this.moon.intensity = 0.85 * (1 - day);
    this.hemi.intensity = 0.21 + 0.15 * day;
    this.hemi.color.copy(top).lerp(new THREE.Color(1, 1, 1), 0.35);
    this.hemi.groundColor.set(0.085, 0.15, 0.06).lerp(new THREE.Color(0.22, 0.36, 0.12), day);
    this.renderer.toneMappingExposure = 1.08 + 0.04 * day;
    if (Math.abs(hours - this.envHours) > 0.45 || (hours < this.envHours - 1)) this.updateEnv(hours);
    const envI = 0.21 + 0.52 * day; this.scene.environmentIntensity = envI * (1 - gold * 0.2);

    // clouds drift and are tinted by the light
    this.cloudMat.color.set(0.06, 0.07, 0.11).lerp(new THREE.Color(1, 1, 1), day).lerp(new THREE.Color(1, 0.7, 0.55), gold * 0.5);
    for (const c of this.clouds.children) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 650) c.position.x = -650;
    }
    this.clouds.position.set(center.x, 0, center.z);
  }
}
