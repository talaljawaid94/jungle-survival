import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Blender-built helicopter (public/models/helicopter.glb): nodes Body > Rotor, TailRotor. Falls back to the procedural one below.
let loadedHeli = null;
export async function loadHelicopterModel(url) { loadedHeli = (await new GLTFLoader().loadAsync(url)).scene; }


const mat = (c, r = 0.5, m = 0.2) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });

export function createHelicopter() {
  if (loadedHeli) {
    const model = loadedHeli.clone(true), g = new THREE.Group(); g.add(model);
    const body = model.getObjectByName('Body'), rotor = model.getObjectByName('Rotor'), tailRotor = model.getObjectByName('TailRotor');
    model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; if (o.material.name === 'HeliGlass') { o.material.transparent = true; o.material.depthWrite = false; } o.material.envMapIntensity = 1.1; } });
    const blurMat = new THREE.MeshBasicMaterial({ color: 0x1a1f24, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
    const blur = new THREE.Mesh(new THREE.CircleGeometry(4.95, 40), blurMat); blur.rotation.x = -Math.PI / 2; blur.position.set(0, 2.52, 0.15); body.add(blur);
    const tailBlur = new THREE.Mesh(new THREE.CircleGeometry(0.64, 20), blurMat.clone()); tailBlur.rotation.y = Math.PI / 2; tailBlur.position.set(0.14, 1.8, -6.78); body.add(tailBlur);
    const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a })); strobe.position.set(0, 2.68, -6.92); body.add(strobe);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2c4 })); nose.position.set(0, 0.7, 2.7); body.add(nose);
    return { group: g, body, rotor, tailRotor, blur, tailBlur, strobe };
  }
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const paint = mat(0xd8dde2, 0.35, 0.4), red = mat(0xb02020, 0.4, 0.3), dark = mat(0x222a30, 0.6, 0.3), glass = new THREE.MeshStandardMaterial({ color: 0x6aa0c0, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.75 });
  const fus = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), paint); fus.scale.set(1.15, 1.05, 2.2); fus.position.y = 1.6; body.add(fus);
  const stripe = new THREE.Mesh(new THREE.SphereGeometry(1.012, 32, 2, 0, Math.PI * 2, Math.PI * 0.5 - 0.1, 0.16), new THREE.MeshStandardMaterial({ color: 0xb02020, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide })); stripe.scale.copy(fus.scale); stripe.position.copy(fus.position); body.add(stripe);
  const cock = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), glass); cock.scale.set(1.0, 0.95, 1.2); cock.position.set(0, 1.85, 1.35); cock.rotation.x = 0.35; body.add(cock);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.34, 5.2, 10), paint); boom.rotation.x = Math.PI / 2; boom.position.set(0, 1.85, -4.2); body.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.3, 0.9), red); fin.position.set(0, 2.45, -6.5); fin.rotation.x = -0.25; body.add(fin);
  const tailRotor = new THREE.Group(); tailRotor.position.set(0.18, 2.6, -6.6); body.add(tailRotor);
  for (let i = 0; i < 2; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.3, 0.14), dark); b.rotation.x = i * Math.PI / 2; tailRotor.add(b); }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.7, 8), dark); mast.position.y = 2.95; body.add(mast);
  const rotor = new THREE.Group(); rotor.position.y = 3.35; body.add(rotor);
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.05, 0.32), dark); b.position.x = 2.8; const pv = new THREE.Group(); pv.rotation.y = i * Math.PI / 2; pv.add(b); rotor.add(pv); }
  for (const s of [-1, 1]) {
    const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.6, 8), dark); sk.rotation.x = Math.PI / 2; sk.position.set(s * 1.05, 0.12, 0.2); body.add(sk);
    for (const z of [-0.7, 1.1]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.0, 6), dark); st.position.set(s * 0.98, 0.62, z); st.rotation.z = s * 0.2; body.add(st); }
  }
  // extra detail: doors, side windows, engine cowl, exhaust, tail plane, nose light, strobe, rotor blur discs
  const trim = mat(0x8c949b, 0.4, 0.5), black = mat(0x0c1014, 0.5, 0.2);
  const cowl = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), paint); cowl.scale.set(0.8, 0.45, 1.1); cowl.position.set(0, 2.55, -0.6); body.add(cowl);
  const exh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.5, 10, 1, true), black); exh.rotation.x = Math.PI / 2 + 0.3; exh.position.set(0, 2.5, -1.75); body.add(exh);
  for (const sd of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.62), glass); win.position.set(sd * 1.18, 1.85, 0.45); win.rotation.y = sd * Math.PI / 2; win.scale.set(1, 1, 1); body.add(win);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.35), trim); door.position.set(sd * 1.175, 1.3, -0.25); door.rotation.y = sd * Math.PI / 2; door.material = mat(0xc8ced3, 0.4, 0.4); body.add(door);
    const hnd = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.22), black); hnd.position.set(sd * 1.2, 1.35, -0.7); body.add(hnd);
    const tp = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 0.45), red); tp.position.set(sd * 0.55, 2.15, -6.0); body.add(tp);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2c4 })); nose.position.set(0, 1.0, 2.5); body.add(nose);
  const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a })); strobe.position.set(0, 2.95, -6.75); body.add(strobe);
  const blurMat = new THREE.MeshBasicMaterial({ color: 0x1a1f24, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
  const blur = new THREE.Mesh(new THREE.CircleGeometry(5.7, 40), blurMat); blur.rotation.x = -Math.PI / 2; blur.position.y = 3.37; body.add(blur);
  const tailBlur = new THREE.Mesh(new THREE.CircleGeometry(0.66, 20), blurMat.clone()); tailBlur.rotation.y = Math.PI / 2; tailBlur.position.set(0.22, 2.6, -6.6); body.add(tailBlur);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  blur.castShadow = false; tailBlur.castShadow = false; strobe.castShadow = false; nose.castShadow = false;
  return { group: g, body, rotor, tailRotor, blur, tailBlur, strobe };
}
