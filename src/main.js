import * as THREE from 'three';
import './style.css';
import { G, DAY_SECONDS } from './game.js';
import { World, R } from './world.js';
import { Sky } from './sky.js';
import { Controls } from './controls.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import { Player } from './player.js';
import { Stats } from './stats.js';
import { Inventory } from './inventory.js';
import { Animals } from './animals.js';
import { Structures } from './structures.js';
import { Gameplay } from './gameplay.js';
import { Intro } from './intro.js';
import { loadHeroModel } from './heroModel.js';
import { loadAnimalModel, setFurCamera } from './animalGLB.js';
import { loadHelicopterModel } from './helicopter.js';
import { loadWreckModel } from './wreckScene.js';
import { MapSystem } from './map.js';
import { hasSave, writeSave, readSave, clearSave } from './save.js';
import { smoothstep } from './noise.js';
import { Post } from './post.js';
import { Effects } from './effects.js';
import { ICON_NAMES } from './icons.js';

const MODELS = import.meta.env.BASE_URL + 'models/';      // relative base so the build works from any folder or sub-path

const canvas = document.getElementById('c');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
catch (e) { const t = document.getElementById('ldText'); if (t) t.textContent = 'WebGL is not available in this browser'; throw e; }
canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());      // lets the browser restore the context; three.js rebuilds its GPU state
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); if (post) post.setSize(innerWidth, innerHeight); });

const ui = new UI();
const ctl = new Controls(canvas);
const audio = new AudioEngine();
const stats = new Stats();
const inv = new Inventory();
let world, sky, player, animals, structures, gameplay, intro, map, post, fx;
let menuAngle = 0, lastSave = 0, deadT = 0, wakeFade = 0, mapTick = 0, miniTick = 0, shoreTimer = 0, revealT = 0, lastAttacker = '';
const audioCtx = { day: 1, night: 0, jungle: 1, water: 0, lake: 0, fire: 0, windy: 0, health: 100 };
const clock = new THREE.Clock();
const _v = new THREE.Vector3();
// ---- render scale: quality tier sets a cap, dynamic resolution lowers it when the frame rate dips
const PR_CAP = { low: 1.0, high: 1.5, ultra: 2.0 };
let prCap = 1.5, prNow = Math.min(devicePixelRatio, 1.5), emaDt = 1 / 60, drsT = 0, drsHold = 0, slowT = 0, fastT = 0;
function setRenderScale(pr) {
  prNow = pr; renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight); if (post) post.setSize(innerWidth, innerHeight);
}
function updateDRS(dt) {
  emaDt = emaDt * 0.97 + Math.min(dt, 0.1) * 0.03; drsHold -= dt;
  if (emaDt > 1 / 42) { slowT += dt; fastT = 0; } else if (emaDt < 1 / 52) { fastT += dt; slowT = 0; } else { slowT = 0; fastT = 0; }
  const cap = Math.min(devicePixelRatio, prCap);
  if (slowT > 1.2 && prNow > 0.75) { setRenderScale(Math.max(0.75, prNow - 0.125)); slowT = 0; drsHold = 25; emaDt = 1 / 50; }
  else if (fastT > 5 && drsHold <= 0 && prNow < cap - 0.01) { setRenderScale(Math.min(cap, prNow + 0.125)); fastT = 0; }
}

// ------------------------------------------------------------------ build
const nextPaint = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
const loadStep = async (label, pct) => { const t = document.getElementById('ldText'), f = document.getElementById('ldFill'); if (t) t.textContent = label; if (f) f.style.width = pct + '%'; await nextPaint(); };
async function build() {
  const T = (label, fn) => { const t = performance.now(); const r = fn(); console.info(`[load] ${label}: ${Math.round(performance.now() - t)} ms`); return r; };
  await loadStep('Shaping the island', 12);
  world = T('world', () => new World(scene));
  await loadStep('Painting the sky', 40);
  sky = T('sky', () => new Sky(scene, renderer));
  structures = new Structures(scene, world, audio);
  await loadStep('Waking the wildlife', 55);
  animals = T('animals', () => new Animals(scene, world, audio));
  await loadStep('Dressing the survivor', 72);
  player = T('player', () => new Player(scene));
  fx = new Effects(scene, world, audio); player.fx = fx;
  map = T('map', () => new MapSystem(world));
  await loadStep('Charting the map', 86);
  intro = new Intro(scene, camera, world, audio, ui); intro.renderer = renderer;
  await loadStep('Final touches', 94);
  post = new Post(renderer, scene, camera);
  gameplay = new Gameplay({ world, inv, stats, audio, animals, structures, ui, player, fx, getExplored: () => map.fraction() });
  const c = world.crash; player.teleport(c.x - 3.5, c.y, c.z + 6);
  player.char.group.visible = false;

  ui.on.newGame = () => startNew();
  ui.on.continueGame = () => startContinue();
  ui.on.resume = () => resume();
  ui.on.save = () => { save(); ui.toast('Game saved'); ui.on.resume(); };
  ui.on.retry = () => { ui.hideDead(); startNew(); };
  ui.on.select = (i) => gameplay.select(i);
  ui.on.useSlot = (i) => gameplay.useSlot(i);
  ui.on.discard = (i) => gameplay.discard(i);
  ui.on.craft = (r) => { gameplay.craft(r); };
  ui.on.craftTick = () => audio.craft();
  ui.on.swap = (a, b) => { inv.swap(a, b); gameplay.afterInvChange(); };
  ui.on.close = () => { ui.closePanel(); if (G.state === 'play' && !G.paused) ctl.lock(); };
  ui.on.quit = () => { save(); location.reload(); };
  ui.on.setting = (k, v) => applySetting(k, v);
  for (const k of Object.keys(ui.settings)) applySetting(k, ui.settings[k]);
  document.getElementById('compass').style.display = ui.settings.compass ? '' : 'none';

  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && (G.state === 'play' || G.state === 'intro') && !G.modal && !G.suppressPause) { G.paused = true; ui.showPause(true); }
  });
  ui.showMenu(hasSave());
  await loadStep('Ready', 100); const ld = document.getElementById('loading'); if (ld) { ld.classList.add('out'); setTimeout(() => ld.remove(), 800); }
  if (import.meta.env.DEV || location.search.includes('debug')) window.game = { fx, post, G, world, player, stats, inv, animals, structures, gameplay, intro, sky, camera, ui, audio, map, scene, renderer, save, startNew, ctl, advance };
}

// ------------------------------------------------------------------ state changes
function applySetting(k, v) {
  if (k === 'quality') { prCap = PR_CAP[v] || 1.5; post.setMode(v); setRenderScale(Math.min(devicePixelRatio, prCap)); }
  else if (k === 'volume') audio.setVolume(v);
  else if (k === 'muted') audio.setMuted(!!v);
  else if (k === 'sens') player.sens = v;
  else if (k === 'invertY') player.invertY = v;
  else if (k === 'fov') player.baseFov = v;
}

function resetAll() {
  world.reset(); structures.clear(); animals.reset(); stats.reset(); inv.clear(); gameplay.reset();
  G.time = 15.7; G.day = 1; G.paused = false; G.modal = null; deadT = 0;
  player.dead = false; player.flareT = 0; player.sleeping = false; player.setEquipped(null); ui.invDirty = true;
  const c = world.crash; player.teleport(c.x - 3.5, c.y, c.z + 6);
  if (intro.wreckSmoke) { intro.wreckSmoke.dispose(scene); intro.wreckSmoke = null; intro.wreckFire.dispose(scene); intro.wreckFire = null; scene.remove(intro.wreckLight); intro.wreckLight = null; }
  intro.removeWreckScene(); intro.heli.group.visible = false; intro.crashed = false; intro.heli.group.rotation.set(0, 0, 0); intro.heli.body.position.y = 0; intro.heli.rotor.rotation.set(0, 0, 0);
  map.eg.fill(0); map.seen = 0; map.expl.getContext('2d').clearRect(0, 0, 300, 300);
  ui.hideDead(); ui.showPause(false); ui.fade(0); ui.closePanel();
}

function startNew() {
  audio.init(); audio.resume(); clearSave(); resetAll();
  ui.hideMenu(); ui.showHud(false); player.char.group.visible = false;
  G.state = 'intro'; ctl.lock(); intro.start();
}

function startContinue() {
  const d = readSave(); if (!d) return startNew();
  audio.init(); audio.resume(); resetAll();
  ui.hideMenu(); ui.hideDead();
  intro.finishCrash(); intro.heli.group.visible = true;      // build the wreck site first so blast-felled trees are charred, not plain stumps
  try {
    G.time = d.time; G.day = d.day;
    Object.assign(stats, d.stats); inv.load(d.inv); inv.selected = d.sel || 0;
    world.applyRemoved(d.removed || []); for (const id of d.opened || []) { const o = world.items[id]; if (o && o.kind === 'crate') { o.data.opened = true; world.openCrate(o); } }
    structures.load(d.structures); animals.loadState(d.animals);
    gameplay.flags = d.flags || {}; gameplay.objIdx = d.objIdx || 0;
    if (d.eg) { for (let i = 0; i < d.eg.length; i++) map.eg[i] = d.eg[i] === '1' ? 1 : 0; map.seen = d.seen || 0; map.loadExplored(d.expl); }
    player.teleport(d.player.x, d.player.y, d.player.z); player.yaw = d.player.yaw; player.heading = d.player.yaw;
  } catch (e) { console.warn('Save load failed', e); }
  player.char.group.visible = true; player.setEquipped(inv.equipped);
  G.state = 'play'; ui.showHud(true); ctl.lock(); gameplay.checkObjectives(); ui.toast('Welcome back, survivor.');
}

function beginPlay() {
  const c = world.crash, px = c.x - 4.5, pz = c.z + 6.5;
  player.teleport(px, world.heightAt(px, pz), pz);
  player.yaw = Math.atan2(c.x - px, c.z - pz); player.heading = player.yaw; player.pitch = 0.3; player.camPos.set(0, 0, 0);
  player.char.group.visible = true; player.startWake(); ui.showHud(true); G.state = 'play'; wakeFade = 3.2; ui.fade(1);
  gameplay.checkObjectives(); lastSave = performance.now();
  ui.toast('You wake beside the wreckage. Your head is pounding...');
}

function resume() { G.paused = false; ui.showPause(false); ctl.lock(); audio.resume(); }
function togglePanel(name) { if (G.modal === name) { ui.closePanel(); ctl.lock(); } else { ui.openPanel(name); ctl.unlock(); if (name === 'map') drawFullMap(); } }
function drawFullMap() { map.drawFull(ui.mapCanvas, player, structures, world.crash); }

function save() {
  if (G.state !== 'play' || player.dead) return;
  writeSave({
    v: 1, time: G.time, day: G.day, stats: { health: stats.health, hunger: stats.hunger, thirst: stats.thirst, energy: stats.energy, sick: stats.sick },
    inv: inv.slots, sel: inv.selected, removed: [...world.removed], opened: world.crates.filter((c) => c.data.opened).map((c) => c.id),
    structures: structures.serialize(), animals: animals.serialize(), flags: gameplay.flags, objIdx: gameplay.objIdx,
    player: { x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw }, eg: [...map.eg].join(''), seen: map.seen, expl: map.exploredData(),
  });
}

function onPlayerHit(dmg, a) {
  if (player.dead) return;
  stats.damage(dmg); audio.hurt(); lastAttacker = a.sp.name;
  const att = Math.atan2(a.x - player.pos.x, a.z - player.pos.z); let rel = att - player.yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel)); ui.hitFrom(rel);
}

// ------------------------------------------------------------------ ambient inputs for audio
function updateAudioCtx(dt) {
  const p = player.pos;
  audioCtx.day = sky.daylight; audioCtx.night = sky.night; audioCtx.health = stats.health;
  const h = world.heightAt(p.x, p.z);
  audioCtx.jungle += ((h > 2.6 ? 1 : 0.15) - audioCtx.jungle) * Math.min(1, dt * 1.5);
  audioCtx.windy = h > 18 ? 1 : 0;
  audioCtx.fire = structures.fireIntensityAt(p.x, p.z);
  shoreTimer -= dt;
  if (shoreTimer <= 0) {
    shoreTimer = 0.5; let best = 60;
    for (let a = 0; a < 6.28; a += 0.52) for (const r of [4, 9, 16, 26, 40]) { if (r >= best) break; if (world.heightAt(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r) < -0.2) { best = r; break; } }
    audioCtx.water = h < -0.2 ? 1 : 1 - smoothstep(3, 45, best);
    let ld = 99; for (const l of world.lakes) ld = Math.min(ld, Math.hypot(l.x - p.x, l.z - p.z) - l.r);
    audioCtx.lake = 1 - smoothstep(5, 60, ld);
  }
}

// ------------------------------------------------------------------ frame
function step(dt, t) {
  if (G.state === 'menu') {
    menuAngle += dt * 0.06; const c = world.crash;
    camera.position.set(c.x + Math.cos(menuAngle) * 90, c.y + 55, c.z + Math.sin(menuAngle) * 90); camera.lookAt(c.x, c.y + 4, c.z);
    sky.update(dt, 16.2, camera.position); world.update(dt, t); structures.update(dt, t);
    if (intro.wreckSmoke) { intro.wreckSmoke.update(dt); intro.wreckFire.update(dt); if (intro.wreckScene) intro.wreckScene.update(performance.now() / 1000); }
    return;
  }

  if (G.state === 'intro') {
    if (!G.paused) {
      if (ctl.hit('Space') || ctl.hit('Enter') || ctl.hit('Escape')) intro.skip();
      if (ctl.hit('KeyK')) ui.setSetting('muted', !ui.settings.muted);
      intro.update(dt); G.time = 15.7; world.update(dt, t); sky.update(dt, G.time, camera.position);
      audioCtx.day = 0.9; audioCtx.night = 0; audioCtx.jungle = 0.4; audioCtx.water = 0.2; audioCtx.fire = 0; audioCtx.health = 100; audio.update(dt, audioCtx);
      if (intro.done) beginPlay();
    }
    return;
  }

  if (G.state === 'dead') {
    deadT += dt; player.char.update(dt, { speed: 0, dead: true }); player.updateCamera(camera, world, dt);
    sky.update(dt, G.time, camera.position); world.update(dt, t); structures.update(dt, t); if (intro.wreckSmoke) { intro.wreckSmoke.update(dt); intro.wreckFire.update(dt); if (intro.wreckScene) intro.wreckScene.update(performance.now() / 1000); }
    if (deadT > 2.2 && document.getElementById('dead').classList.contains('hidden')) {
      ctl.unlock(); const cause = stats.hunger <= 0 ? 'You starved. Keep your food up.' : stats.thirst <= 0 ? 'You died of thirst. Fresh water is inland.' : stats.sick > 0 ? 'Illness got the better of you. Boil your water.' : lastAttacker ? `You were killed by a ${lastAttacker.toLowerCase()}.` : 'Your wounds were too severe.';
      ui.showDead(G.day, cause); ui.showHud(false);
    }
    return;
  }

  // ---------- play
  if (G.paused) return;
  if (ctl.hit('Tab')) togglePanel('inventory'); if (ctl.hit('KeyC')) togglePanel('craft'); if (ctl.hit('KeyM')) togglePanel('map');
  if (ctl.hit('Escape') && G.modal) ui.requestClose();
  if (ctl.hit('KeyH')) ui.toggleHints();
  if (ctl.hit('KeyK')) { ui.setSetting('muted', !ui.settings.muted); ui.toast(ui.settings.muted ? 'Sound off' : 'Sound on'); }

  const locked = G.modal !== null || !!gameplay.sleepSeq;
  if (!gameplay.sleepSeq || gameplay.sleepSeq.t < 1.4) G.time += (dt * 24) / DAY_SECONDS;
  while (G.time >= 24) { G.time -= 24; G.day++; }

  player.update(dt, ctl, world, stats, audio, locked);
  gameplay.update(dt, ctl, locked);
  const resting = !player.moving && (structures.firesNear(player.pos.x, player.pos.z, 6) || structures.nearestShelter(player.pos.x, player.pos.z, 4)) && stats.energy < 100;
  stats.update(dt, { sprinting: player.sprinting, swimming: player.swimming, resting: !!resting, moving: player.moving });
  animals.update(dt, player, sky, (x, z, r) => structures.firesNear(x, z, r), onPlayerHit);
  structures.update(dt, t); world.update(dt, t);
  if (intro.wreckSmoke) { intro.wreckSmoke.update(dt); intro.wreckFire.update(dt); if (intro.wreckScene) intro.wreckScene.update(performance.now() / 1000); }
  player.updateCamera(camera, world, dt);
  fx.update(dt, camera, { night: sky.night, jungle: audioCtx.jungle });
  sky.update(dt, G.time, player.pos);
  updateAudioCtx(dt); audio.update(dt, audioCtx);
  const markers = [{ x: world.crash.x, z: world.crash.z, color: '#ff5b5b' }, ...structures.fires.map((f) => ({ x: f.x, z: f.z, color: '#ffb347' })), ...structures.shelters.map((q) => ({ x: q.x, z: q.z, color: '#a4c76a' }))];
  ui.update(dt, { stats, inv, player, yaw: player.yaw, markers });
  const tg = gameplay.target;
  if (tg && tg.pos && !locked && !player.dead) {
    _v.copy(tg.pos).project(camera);
    if (_v.z > -1 && _v.z < 1) {
      const x = Math.max(60, Math.min(innerWidth - 220, (_v.x * 0.5 + 0.5) * innerWidth)), y = Math.max(80, Math.min(innerHeight - 140, (-_v.y * 0.5 + 0.5) * innerHeight));
      gameplay.screenPos = { x, y }; ui.setTarget({ x, y, label: tg.label, name: tg.name, icon: tg.icon, blocked: tg.blocked, prog: gameplay.busy ? gameplay.busy.t / gameplay.busy.dur : 0 });
    } else ui.setTarget(null);
  } else { ui.setTarget(null); gameplay.screenPos = null; }

  if (wakeFade > 0) { wakeFade -= dt; ui.fade(Math.max(0, wakeFade / 3.2)); }
  revealT -= dt; if (revealT <= 0) { revealT = 0.6; map.reveal(player.pos.x, player.pos.z); }
  if ((miniTick += 1) % 3 === 0) map.drawMini(ui.minimap, player, structures, world.crash);
  if (G.modal === 'map' && (mapTick += 1) % 15 === 0) drawFullMap();
  if (performance.now() - lastSave > 30000) { lastSave = performance.now(); save(); }

  if (stats.dead && !player.dead) { player.dead = true; G.state = 'dead'; deadT = 0; ctl.unlock(); ui.setPrompt(null); ui.setProgress(null); clearSave(); }
}

// grade + post parameters derived from time of day and player state
let frameNo = 0;
function renderFrame(dt, t) {
  world.updateLOD(camera.position, scene.fog.density);
  renderer.shadowMap.autoUpdate = false; sky.sun.shadow.needsUpdate = (frameNo++ & 1) === 0;      // sun shadows refresh every other frame: half the shadow cost, static shadows are unaffected
  if (!post) { renderer.render(scene, camera); return; }
  const d = sky.daylight, gold = sky.golden, n = sky.night;
  const tint = [1 + 0.07 * gold - 0.15 * n, 1 - 0.04 * gold - 0.07 * n, 1 - 0.1 * gold + 0.12 * n];
  const lift = [0.012 * n, 0.026 * n, 0.05 * n];
  const hp = stats.health, under = camera.position.y < 0.05 && world.heightAt(camera.position.x, camera.position.z) < -0.2 ? 1 : 0;
  const low = G.state === 'play' && hp < 30 ? (30 - hp) / 30 : 0;
  post.frame(dt, t, { tint, lift, sat: 1.1 - 0.12 * n, bloom: 0.34 + 0.35 * n + 0.15 * gold, desat: low * 0.8, hurt: Math.max(stats.hurtFlash, 0) * 0.6, under, pulse: low * (0.5 + 0.5 * Math.sin(t * (4 + low * 3))) });
}

let simT = 1000;
// debug helper: run the simulation forward by `sec` seconds at 30 Hz, then render once
function advance(sec, hold = {}) {
  for (let i = 0; i < sec * 30; i++) { for (const k of Object.keys(hold)) { if (k === 'Mouse') { if (hold[k] && i % 20 === 0) ctl.mousePressed = true; continue; } if (hold[k]) { ctl.keys.add(k); if (i === 0) ctl.pressed.add(k); } } simT += 1 / 30; step(1 / 30, simT); ctl.endFrame(); }
  for (const k of Object.keys(hold)) ctl.keys.delete(k); if (hold.Mouse) { /* mousePressed consumed by gameplay */ }
  renderFrame(1 / 30, simT);
}

function frame() {
  requestAnimationFrame(frame);
  const rawDt = clock.getDelta(), dt = Math.min(rawDt, 0.05);
  if (G.state === 'play' && !G.paused) updateDRS(rawDt);
  setFurCamera(camera.position);
  const t0 = performance.now();
  step(dt, clock.elapsedTime);
  const t1 = performance.now();
  renderFrame(dt, clock.elapsedTime);
  const t2 = performance.now();
  ctl.endFrame();
  window.__perf = { step: t1 - t0, render: t2 - t1, dt };
}

setTimeout(async () => {
  await loadStep('Loading characters and animals', 4);
  try { await loadHeroModel(MODELS + 'survivor.glb'); } catch (e) { console.warn('hero model failed, using procedural hero', e); }
  try { await loadWreckModel(MODELS + 'helicopter_wreck.glb'); } catch (e) { console.warn('wreck model failed', e); }
  try { await loadHelicopterModel(MODELS + 'helicopter.glb'); } catch (e) { console.warn('helicopter model failed, using procedural helicopter', e); }
  for (const t of ['deer', 'boar', 'jaguar']) { try { await loadAnimalModel(t, `${MODELS}${t}.glb`); } catch (e) { console.warn(t + ' model failed, using procedural version', e); } }
  await build(); frame();
}, 30);
