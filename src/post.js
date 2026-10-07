import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Final colour grade, applied after tone mapping: filmic contrast, tint by time of day, vignette, grain,
// plus gameplay feedback (desaturate when hurt, red flash on damage, teal tint under water).
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uVignette: { value: 0.32 }, uGrain: { value: 0.035 },
    uSat: { value: 1.1 }, uContrast: { value: 1.14 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uLift: { value: new THREE.Vector3(0, 0, 0) },
    uDesat: { value: 0 }, uHurt: { value: 0 }, uUnder: { value: 0 }, uPulse: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uSat, uContrast, uDesat, uHurt, uUnder, uPulse;
    uniform vec3 uTint, uLift; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      c = (c - 0.5) * uContrast + 0.5; c += uLift * (1.0 - c);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSat * (1.0 - uDesat * 0.85));
      c *= uTint;
      vec3 teal = vec3(0.15, 0.55, 0.62); c = mix(c, c * teal * 1.8, uUnder * 0.75);
      vec2 d = vUv - 0.5; float v = smoothstep(0.85, 0.2, length(d * vec2(1.0, 0.9)) * (1.0 + uVignette * 0.9));
      c *= mix(1.0 - uVignette, 1.0, v);
      float r = smoothstep(0.35, 0.95, length(d) * 1.5); c = mix(c, vec3(0.65, 0.04, 0.04), r * (uHurt + uPulse * 0.5));
      c += (hash(vUv * 1500.0 + uTime) - 0.5) * uGrain;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export class Post {
  constructor(renderer, scene, camera) {
    this.renderer = renderer; this.scene = scene; this.camera = camera; this.mode = 'high'; this.composer = null;
    this.build('high');
  }
  // tiers: low = direct render; high = 2x MSAA + half-res bloom; ultra = 4x MSAA + higher-res bloom
  build(mode) {
    const r = this.renderer, size = r.getSize(new THREE.Vector2()), pr = r.getPixelRatio();
    if (this.composer) { this.composer.renderTarget1.dispose(); this.composer.renderTarget2.dispose(); }
    const samples = mode === 'ultra' ? 4 : 2, bloomScale = mode === 'ultra' ? 0.6 : 0.5;
    const rt = new THREE.WebGLRenderTarget(size.x * pr, size.y * pr, { type: THREE.HalfFloatType, samples });
    this.composer = new EffectComposer(r, rt); this.composer.setPixelRatio(pr); this.composer.setSize(size.x, size.y);
    this.render = new RenderPass(this.scene, this.camera);
    this.bloomScale = bloomScale;
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x * pr * bloomScale, size.y * pr * bloomScale), 0.42, 0.55, 0.9);
    this.out = new OutputPass(); this.grade = new ShaderPass(GradeShader);
    for (const p of [this.render, this.bloom, this.out, this.grade]) this.composer.addPass(p);
    this.builtMode = mode;
  }
  setMode(mode) { this.mode = mode; if (mode !== 'low' && this.builtMode !== mode) this.build(mode); }
  setSize(w, h) {
    const pr = this.renderer.getPixelRatio(); this.composer.setPixelRatio(pr); this.composer.setSize(w, h);
    this.bloom.setSize(w * pr * this.bloomScale, h * pr * this.bloomScale);
  }
  get u() { return this.grade.uniforms; }

  frame(dt, t, env) {
    const u = this.u; u.uTime.value = t % 100;
    u.uTint.value.set(env.tint[0], env.tint[1], env.tint[2]); u.uLift.value.set(env.lift[0], env.lift[1], env.lift[2]);
    u.uSat.value = env.sat; u.uDesat.value = env.desat; u.uHurt.value = env.hurt; u.uUnder.value = env.under; u.uPulse.value = env.pulse;
    this.bloom.strength = env.bloom;
    if (this.mode === 'low') { this.renderer.render(this.scene, this.camera); return; }
    this.composer.render(dt);
  }
}
