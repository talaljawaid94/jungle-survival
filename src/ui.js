import { ITEMS, RECIPES, CATS } from './items.js';
import { icon, CUSTOM_ICON_COUNT } from './icons.js';
import { G } from './game.js';
import logoUrl from './assets/logo.png';
import { isTouch } from './controls.js';

export const DEFAULT_SETTINGS = { quality: 'high', volume: 0.85, sens: 1, invertY: false, fov: 62, hints: true, compass: true, muted: false };
export function loadSettings() { try { return { ...DEFAULT_SETTINGS, ...(isTouch ? { quality: 'low' } : {}), ...JSON.parse(localStorage.getItem('js-settings') || '{}') }; } catch (e) { return { ...DEFAULT_SETTINGS }; } }
// keyboard hints in copy become touch wording on phones
const tx = (t) => (isTouch && typeof t === 'string' ? t.replace(/ \((E|C|Z)\)/g, '').replace('press Z to sleep', 'tap the moon to sleep').replace('You can sleep here (Z)', 'Tap the moon to sleep') : t);
const saveSettings = (s) => { try { localStorage.setItem('js-settings', JSON.stringify(s)); } catch (e) {} };

const TEMPLATE = `
<div id="hud" class="hidden">
  <div id="compass"><canvas width="1040" height="92"></canvas></div>
  <div id="pcard">
    <div id="avatar"><svg class="arc" viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="54"/><circle class="fg" id="hpArc" cx="60" cy="60" r="54" stroke-dasharray="339.3" stroke-dashoffset="0"/></svg><div class="face"><img src="/ui/avatar.png" alt="" draggable="false"></div><span id="dayBadge">Day 1</span></div>
    <div id="pstats" class="gpanel">
      <div class="vital big" data-k="health"><div class="vi">${icon('heart', 20)}</div><div class="vbar"><div class="trail"></div><div class="fill"></div></div><div class="vv"></div></div>
      <div class="minis">
        <div class="vital mini" data-k="hunger"><div class="vi">${icon('food', 16)}</div><div class="vbar"><div class="trail"></div><div class="fill"></div></div><div class="vv"></div></div>
        <div class="vital mini" data-k="thirst"><div class="vi">${icon('drop', 16)}</div><div class="vbar"><div class="trail"></div><div class="fill"></div></div><div class="vv"></div></div>
        <div class="vital mini" data-k="energy"><div class="vi">${icon('bolt', 16)}</div><div class="vbar"><div class="trail"></div><div class="fill"></div></div><div class="vv"></div></div>
      </div>
      <div id="status"></div>
    </div>
  </div>
  <div id="objective" class="gpill">
    <span class="pin">${icon('pin', 20)}</span>
    <div class="otx"><span id="objText"></span><div id="objSteps"></div></div>
    <div id="objGo" class="hidden"><span id="objDist"></span><svg id="objArrow" viewBox="0 0 24 24"><path d="M12 2.500l7.500 18-7.500-4.500-7.500 4.500z"/></svg></div>
  </div>
  <div id="topright">
    <div id="mapCol">
      <div id="miniWrap"><canvas id="minimap" width="190" height="190"></canvas><span id="miniN">N</span><span id="miniM">M</span></div>
      <div id="place" class="gpanel">
        <div class="pn"><span class="gi">${icon('compass', 16)}</span><b id="placeName">Jungle</b></div>
        <div class="pt"><span id="clockIc"></span><b id="clockTime"></b><span id="clockDay"></span></div>
        <div class="pp"><span class="gi">${icon('gauge', 18)}</span><b id="paceNum">0</b><small>km/h</small><em id="paceMode">Standing</em></div>
      </div>
    </div>
    <div id="sideBtns">
      <button class="rbtn" id="btnHudPause" title="Pause (Esc)">${icon('pause', 20)}</button>
      <button class="rbtn" id="btnPhoto" title="Photo (P)">${icon('camera', 20)}</button>
      <button class="rbtn" id="btnHudSettings" title="Settings">${icon('cog', 21)}</button>
      <button class="rbtn" id="muteBtn" title="Sound (K)"></button>
    </div>
  </div>
  <div id="actions">
    <div class="abtn" id="aSprint"><div class="ring"><span class="ai">${icon('run', 30)}</span></div><b>Sprint</b><kbd>Shift</kbd></div>
    <div class="abtn" id="aUse"><div class="ring"><svg class="prog" viewBox="0 0 72 72"><circle class="fg" cx="36" cy="36" r="32" stroke-dasharray="201" stroke-dashoffset="201"/></svg><span class="ai">${icon('hand', 30)}</span></div><b id="aUseLbl">Interact</b><kbd>E</kbd></div>
    <div class="abtn" id="aAtk"><div class="ring"><span class="ai">${icon('fist', 30)}</span></div><b id="aAtkLbl">Attack</b><kbd>Click</kbd></div>
  </div>
  <div id="itemLabel"></div>
  <div id="hotbar"></div>
  <div id="crosshair"></div>
  <div id="marker"><div class="ring"><svg class="prog" viewBox="0 0 60 60"><circle class="bg" cx="30" cy="30" r="26"/><circle class="fg" cx="30" cy="30" r="26" stroke-dasharray="163.4" stroke-dashoffset="163.4"/></svg><span class="key">E</span></div><div class="meta"><div class="nm"></div><div class="act"></div></div></div>
  <div id="feed"></div>
  <div id="toasts"></div>
  <div id="banner" class="glass"><div class="bi">${icon('check', 22)}</div><div><b>Objective complete</b><span id="bannerText"></span></div></div>
  <div id="dmg"></div>
  <div id="hints" class="glass">
    <div><b>W</b><b>A</b><b>S</b><b>D</b> Move &nbsp; <b>Shift</b> Sprint &nbsp; <b>Space</b> Jump</div>
    <div><b>E</b> Hold to interact &nbsp; <b>Click</b> Attack &nbsp; <b>F</b> Use item</div>
    <div><b>Tab</b> Bag &nbsp; <b>C</b> Craft &nbsp; <b>M</b> Map &nbsp; <b>Z</b> Sleep &nbsp; <b>H</b> Hide hints</div>
  </div>
  <button id="hintBtn" class="glass"><b style="margin-right:6px">H</b> Controls</button>
</div>
<div id="vignette"></div><div id="flash"></div><div id="fade"></div><div id="flyLayer"></div>
<div id="titleWrap"><div id="title"></div><div id="subtitle"></div></div>
<div id="backdrop" class="backdrop hidden"></div>
<div id="inv" class="sheet hidden">
  <header><h2>${icon('bag', 24)} Backpack</h2><span class="hintTxt">Click to use or equip · Shift+click to drop · drag to rearrange</span><button class="xbtn" data-close>${icon('close', 18)}</button></header>
  <div id="invGrid"></div><div id="invInfo"></div>
</div>
<div id="craft" class="sheet hidden">
  <header><h2>${icon('hammer', 24)} Crafting</h2><span class="hintTxt">Press C to close</span><button class="xbtn" data-close>${icon('close', 18)}</button></header>
  <div id="craftList"></div>
</div>
<div id="map" class="sheet hidden">
  <header><h2>${icon('map', 24)} Island Map</h2><button class="xbtn" data-close>${icon('close', 18)}</button></header>
  <canvas id="mapCanvas" width="760" height="760"></canvas>
  <div class="legend"><span><i style="background:#ff5b5b"></i>Crash site</span><span><i style="background:#ffb347"></i>Campfire</span><span><i style="background:#fff"></i>You</span><span><i style="background:#4aaac3"></i>Fresh water</span><span style="margin-left:auto">Explore to reveal the island</span></div>
</div>
<div id="settings" class="sheet hidden">
  <header><h2>${icon('cog', 24)} Settings</h2><button class="xbtn" data-close>${icon('close', 18)}</button></header>
  <div class="set" id="setBody"></div>
</div>
<div id="menu" class="screen hidden">
  <div class="col">
    <img class="logo" src="${logoUrl}" alt="Jungle Survival" draggable="false">
    <p>Your helicopter went down over an uncharted island. Find water, build fire, hunt, shelter from the night, and stay alive until help finds you.</p>
    <button id="btnContinue" class="mbtn hidden">${icon('compass', 22)} Continue</button>
    <button id="btnNew" class="mbtn primary">${icon('campfire', 22)} New game</button>
    <button id="btnSettings" class="mbtn">${icon('cog', 22)} Settings</button>
    <div class="mhint">${isTouch ? 'Best in landscape · left thumb moves, right thumb looks' : 'The game captures your mouse to look around · press <kbd>Esc</kbd> any time to get your cursor back'}</div>
  </div>
  <div class="ver">FIRST PREVIEW · v0.3</div>
</div>
<div id="pause" class="screen hidden">
  <div class="pbox gpanel2">
    <div class="pavatar"><img src="/ui/avatar.png" alt="" draggable="false"></div>
    <h1>PAUSED</h1>
    <div class="psub" id="pauseSub">Day 1</div>
    <div class="pstat" id="pauseStats"></div>
    <button id="btnResume" class="mbtn primary">${icon('arrow_up', 22)} Resume</button>
    <button id="btnPSettings" class="mbtn">${icon('cog', 22)} Settings</button>
    <button id="btnSave" class="mbtn">${icon('check', 22)} Save game</button>
    <button id="btnQuit" class="mbtn">${icon('close', 22)} Quit to menu</button>
    <div class="pfoot"><kbd>Esc</kbd> Resume &nbsp; <kbd>P</kbd> Photo &nbsp; <kbd>K</kbd> Sound</div>
  </div>
</div>
<div id="dead" class="screen hidden">
  <div class="pbox gpanel2 deadbox">
    <div class="skull">${icon('skull', 46)}</div><h1>YOU DID NOT SURVIVE</h1><p id="deadCause"></p>
    <div class="deadStats"><div><b id="deadDay">1</b><span>Days survived</span></div></div>
    <button id="btnRetry" class="mbtn primary">${icon('campfire', 22)} Try again</button>
    <button id="btnDeadMenu" class="mbtn">${icon('close', 22)} Main menu</button>
  </div>
</div>
<div id="capture" class="hidden"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 3v7"/></svg><b>Click the game to capture your mouse</b></div>
<div id="mouseTip"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 3v7"/></svg><span id="mouseTipTx"></span></div>
<div id="skipHint"><kbd>${isTouch ? 'Tap' : 'Space'}</kbd><span>Skip intro</span></div>
<div id="tip" class="glass"></div>
`;

const catColor = { med: '#ef8f87', food: '#ecbf6a', tool: '#d4dbc4', mat: '#c8b283', misc: '#9fc8e8' };
const itemColor = (id) => (id === 'water_clean' || id === 'water_dirty') ? '#62b4f0' : catColor[ITEMS[id].kind] || '#cfd6c0';

function describe(def) {
  const L = [];
  if (def.heal) L.push(['heart', 'var(--hp)', 'Restores health', '+' + def.heal]);
  if (def.hunger) L.push(['food', 'var(--food)', 'Restores food', '+' + def.hunger]);
  if (def.thirst) L.push(['drop', 'var(--water)', 'Quenches thirst', '+' + def.thirst]);
  if (def.health) L.push(['heart', 'var(--hp)', 'Also heals', '+' + def.health]);
  if (def.sick) L.push(['sick', 'var(--danger)', 'Chance of illness', Math.round(def.sick * 100) + '%']);
  if (def.dmg) L.push(['fist', 'var(--amber)', 'Damage', String(def.dmg)]);
  if (def.chop) L.push(['stone_axe', 'var(--accent)', 'Chopping power', '×' + def.chop]);
  if (def.reach) L.push(['arrow_up', 'var(--water)', 'Reach', def.reach + ' m']);
  return L;
}

export class UI {
  constructor() {
    document.getElementById('ui').innerHTML = TEMPLATE;
    const $ = (id) => document.getElementById(id); this.$ = $;
    this.settings = loadSettings();
    this.hud = $('hud'); this.hotbarEl = $('hotbar'); this.feed = $('feed'); this.toasts = $('toasts'); this.marker = $('marker'); this.tipEl = $('tip');
    this.vitals = {}; document.querySelectorAll('.vital').forEach((el) => { this.vitals[el.dataset.k] = { el, fill: el.querySelector('.fill'), trail: el.querySelector('.trail'), vv: el.querySelector('.vv'), last: 100 }; });
    this.minimap = $('minimap'); this.mapCanvas = $('mapCanvas'); this.compassCv = document.querySelector('#compass canvas'); this.cctx = this.compassCv.getContext('2d');
    this.on = {}; this.invDirty = true; this.lastPrompt = null; this.lastObj = null; this.lastSig = ''; this.pick = -1; this.invTab = 'All'; this.craftTab = 'All'; this.rsel = 0; this.crafting = null; this.dragFrom = null; this.lastSel = -1; this.labelT = 0; this.lastMarkerKey = null;
        this.buildSettings();
    $('btnNew').onclick = () => this.on.newGame && this.on.newGame();
    $('btnContinue').onclick = () => this.on.continueGame && this.on.continueGame();
    $('btnSettings').onclick = () => this.openPanel('settings');
    $('btnPSettings').onclick = () => this.openPanel('settings');
    $('btnResume').onclick = () => this.on.resume && this.on.resume();
    $('btnSave').onclick = () => this.on.save && this.on.save();
    $('btnQuit').onclick = () => this.on.quit && this.on.quit();
    $('btnRetry').onclick = () => this.on.retry && this.on.retry();
    $('btnDeadMenu').onclick = () => this.on.quit && this.on.quit();
    $('backdrop').onclick = () => this.requestClose();
    document.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => this.requestClose(); });
    $('hintBtn').onclick = () => this.toggleHints();
    if (CUSTOM_ICON_COUNT) { const v = this.$('menu').querySelector('.ver'); if (v) v.innerHTML += ' · ICONS FROM <a href="https://www.flaticon.com" target="_blank" rel="noopener" style="color:inherit">FLATICON</a>'; }
    this.$('muteBtn').onclick = () => this.setSetting('muted', !this.settings.muted); this.updateMuteBtn();
    $('capture').onclick = () => this.on.capture && this.on.capture(); $('btnHudPause').onclick = () => this.on.pause && this.on.pause(); $('btnHudSettings').onclick = () => this.on.openSettings && this.on.openSettings(); $('btnPhoto').onclick = () => this.on.photo && this.on.photo();
    this.hintsOn = this.settings.hints; this.$('hints').classList.toggle('off', !this.hintsOn);
  }

  requestClose() { if (this.on.close) this.on.close(); else this.closePanel(); }
  toggleHints() { this.hintsOn = !this.hintsOn; this.$('hints').classList.toggle('off', !this.hintsOn); }

  // ---------------------------------------------------------------- screens & panels
  showMenu(hasSave) { this.$('menu').classList.remove('hidden'); this.$('btnContinue').classList.toggle('hidden', !hasSave); this.hud.classList.add('hidden'); }
  hideMenu() { this.$('menu').classList.add('hidden'); }
  showHud(on) { this.hud.classList.toggle('hidden', !on); }
  showPause(on) {
    this.$('pause').classList.toggle('hidden', !on);
    if (on && this.lastStats) {
      const s = this.lastStats, row = (ic, c, v) => `<span style="--c:${c}">${icon(ic, 18)}<b>${Math.round(Math.max(0, v))}%</b></span>`;
      this.$('pauseSub').textContent = `Day ${G.day}`;
      this.$('pauseStats').innerHTML = row('heart', '#ff6f61', s.health) + row('food', '#f6a844', s.hunger) + row('drop', '#5cc4f4', s.thirst) + row('bolt', '#f4d84e', s.energy);
    }
  }
  showCapture(on) { if (this._cap !== on) { this._cap = on; this.$('capture').classList.toggle('hidden', !on); } }
  mouseTip(noLock) {
    if (isTouch) return; this.$('mouseTipTx').innerHTML = noLock ? 'Drag with the mouse to look around, click to act. <kbd>Esc</kbd> pauses.' : 'Your mouse is captured: move it to look. Press <kbd>Esc</kbd> to get your cursor back.'; let n = 0; try { n = +localStorage.getItem('js-mousetip') || 0; localStorage.setItem('js-mousetip', n + 1); } catch (e) {}
    if (n >= 3) return; const el = this.$('mouseTip'); el.classList.add('on'); clearTimeout(this._mt); this._mt = setTimeout(() => el.classList.remove('on'), 8000);
  }
  showSkip(on) { this.$('skipHint').classList.toggle('on', !!on); }
  showDead(day, cause) { this.$('dead').classList.remove('hidden'); this.$('deadDay').textContent = day; this.$('deadCause').textContent = cause; }
  hideDead() { this.$('dead').classList.add('hidden'); }
  openPanel(name) {
    this.closePanel(); G.modal = name; this.$('backdrop').classList.remove('hidden');
    const el = this.$(name === 'inventory' ? 'inv' : name); el.classList.remove('hidden');
    if (name === 'inventory') this.renderInv(); if (name === 'craft') this.renderCraft(); if (name === 'settings') this.refreshSettings();
  }
  closePanel() { G.modal = null; this.$('backdrop').classList.add('hidden'); for (const id of ['inv', 'craft', 'map', 'settings']) this.$(id).classList.add('hidden'); this.hideTip(); }

  // ---------------------------------------------------------------- overlays
  fade(a) { this.$('fade').style.opacity = a; }
  flash(a) { const f = this.$('flash'); f.style.transition = 'none'; f.style.opacity = a; requestAnimationFrame(() => { f.style.transition = 'opacity 1.6s'; f.style.opacity = 0; }); }
  title(t) { this.$('title').textContent = t; }
  subtitle(t) { this.$('subtitle').textContent = t; }
  toast(msg) {
    const d = document.createElement('div'); d.className = 'toast glass'; d.textContent = tx(msg); this.toasts.appendChild(d);
    while (this.toasts.children.length > 3) this.toasts.firstChild.remove();
    setTimeout(() => d.remove(), 3500);
  }
  pickupToast(id, n) {
    const d = document.createElement('div'); d.className = 'feed glass'; d.style.setProperty('--ic', itemColor(id));
    d.innerHTML = `<div class="fi">${icon(id, 22)}</div><div><b>+${n} ${ITEMS[id].name}</b><small>${CATS[ITEMS[id].kind]}</small></div>`;
    this.feed.appendChild(d); while (this.feed.children.length > 5) this.feed.firstChild.remove(); setTimeout(() => d.remove(), 3700);
  }
  flyIcon(id, x, y) {
    const layer = this.$('flyLayer'), el = document.createElement('div'); el.className = 'fly'; el.style.setProperty('--ic', itemColor(id)); el.innerHTML = icon(id, 20); el.style.left = x + 'px'; el.style.top = y + 'px';
    layer.appendChild(el);
    let idx = this.lastInv ? this.lastInv.slots.findIndex((s) => s && s.id === id) : -1; const tgt = (idx >= 0 && idx < 9 ? this.hotbarEl.children[idx] : this.hotbarEl).getBoundingClientRect();
    const tx = tgt.left + tgt.width / 2, ty = tgt.top + tgt.height / 2;
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transform = `translate(${tx - x}px, ${ty - y}px) scale(0.55)`; el.style.opacity = '0.15'; }));
    setTimeout(() => el.remove(), 760);
  }
  banner(text) { const b = this.$('banner'); this.$('bannerText').textContent = tx(text); b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); }
  hitFrom(rel) { const a = document.createElement('div'); a.className = 'dmgArc'; a.style.transform = `rotate(${(-rel * 180) / Math.PI}deg)`; this.$('dmg').appendChild(a); setTimeout(() => a.remove(), 1400); }
  setPrompt(t) { this.lastPrompt = t; }
  setProgress() {}
  setObjective(t, idx = 0, total = 8) {
    if (t === this.lastObj && idx === this.lastIdx) return; this.lastObj = t; this.lastIdx = idx; this.$('objText').textContent = tx(t);
    this.$('objSteps').innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i < idx ? 'on' : i === idx ? 'cur' : ''}"></i>`).join('');
  }
  setTarget(t) {
    const m = this.marker;
    if (!t) { if (this.markerOn) { m.classList.remove('on'); this.markerOn = false; this.$('crosshair').classList.remove('on'); } return; }
    if (!this.markerOn) { m.classList.add('on'); this.markerOn = true; this.$('crosshair').classList.add('on'); }
    m.style.transform = `translate(${Math.round(t.x - 30)}px, ${Math.round(t.y - 30)}px)`;
    const sig = t.label + '|' + t.name + '|' + t.blocked + '|' + (t.icon || '');
    if (sig !== this.lastMarkerKey) {
      this.lastMarkerKey = sig; m.classList.toggle('blocked', !!t.blocked);
      m.querySelector('.nm').textContent = t.name || ''; m.querySelector('.act').innerHTML = `${t.icon ? icon(t.icon, 18) : ''}<span>${tx(t.label)}</span>`;
      m.querySelector('.key').textContent = isTouch ? '' : 'E'; m.querySelector('.key').style.visibility = t.blocked ? 'hidden' : 'visible';
    }
    m.querySelector('.fg').style.strokeDashoffset = 163.4 * (1 - Math.min(1, t.prog || 0));
  }

  // ---------------------------------------------------------------- tooltip
  showTip(html, x, y) { this.tipEl.innerHTML = html; this.tipEl.classList.add('on'); const w = this.tipEl.offsetWidth; this.tipEl.style.left = Math.min(innerWidth - w - 12, x + 14) + 'px'; this.tipEl.style.top = y + 16 + 'px'; }
  hideTip() { this.tipEl.classList.remove('on'); }
  tipFor(s) { return s ? `<b>${ITEMS[s.id].name}</b><span>${ITEMS[s.id].desc || CATS[ITEMS[s.id].kind]}</span>` : null; }

  // ---------------------------------------------------------------- slots
  makeSlot(i, inv, { hotkey = false, big = false } = {}) {
    const s = inv.slots[i], el = document.createElement('div');
    el.className = 'slot' + (s ? '' : ' vac') + (i === inv.selected && hotkey ? ' sel' : '') + (!hotkey && i < 9 ? ' hot' : '');
    if (s) { el.dataset.cat = ITEMS[s.id].kind; el.dataset.id = s.id; }
    el.innerHTML = `${hotkey || i < 9 ? `<span class="k">${i + 1}</span>` : ''}${s ? icon(s.id, big ? 34 : 28) : ''}${s && s.count > 1 ? `<span class="n">${s.count}</span>` : ''}`;
    el.draggable = !!s;
    el.ondragstart = (e) => { this.dragFrom = i; e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move'; this.hideTip(); };
    el.ondragover = (e) => { e.preventDefault(); el.classList.add('drop'); };
    el.ondragleave = () => el.classList.remove('drop');
    el.ondrop = (e) => { e.preventDefault(); el.classList.remove('drop'); if (this.dragFrom != null && this.dragFrom !== i) this.on.swap && this.on.swap(this.dragFrom, i); this.dragFrom = null; };
    el.onmousemove = (e) => { const t = this.tipFor(inv.slots[i]); if (t) this.showTip(t, e.clientX, e.clientY); else this.hideTip(); };
    el.onmouseleave = () => this.hideTip();
    return el;
  }
  renderHotbar(inv) {
    this.hotbarEl.innerHTML = '';
    for (let i = 0; i < 9; i++) { const el = this.makeSlot(i, inv, { hotkey: true }); el.onclick = () => this.on.select && this.on.select(i); this.hotbarEl.appendChild(el); }
  }

  // ---------------------------------------------------------------- inventory
  buildTabsUnused() {
    const mk = (id, list, key) => { const wrap = this.$(id); wrap.innerHTML = list.map((t) => `<button class="tab${t === this[key] ? ' on' : ''}" data-t="${t}">${t}</button>`).join(''); wrap.querySelectorAll('.tab').forEach((b) => { b.onclick = () => { this[key] = b.dataset.t; this.buildTabs(); this.G_render(); }; }); };
    mk('invTabs', ['All', 'Medical', 'Food', 'Tools', 'Materials'], 'invTab'); mk('craftTabs', ['All', 'Survival', 'Tools', 'Build'], 'craftTab');
  }
  G_render() { if (G.modal === 'inventory') this.renderInv(); if (G.modal === 'craft') this.renderCraft(); }
  catOk(def) { const t = this.invTab; return t === 'All' || (t === 'Medical' && def.kind === 'med') || (t === 'Food' && def.kind === 'food') || (t === 'Tools' && def.kind === 'tool') || (t === 'Materials' && (def.kind === 'mat' || def.kind === 'misc')); }
  renderInv(inv = this.lastInv) {
    if (!inv) return; const grid = this.$('invGrid'); grid.innerHTML = '';
    inv.slots.forEach((s, i) => {
      const el = this.makeSlot(i, inv, { big: true });
      el.onmouseenter = () => { this.$('invInfo').textContent = s ? `${ITEMS[s.id].name}${ITEMS[s.id].desc ? ' · ' + ITEMS[s.id].desc : ''}` : ''; };
      el.onclick = (e) => { if (!s) return; if (e.shiftKey) this.on.discard && this.on.discard(i); else this.on.useSlot && this.on.useSlot(i); };
      grid.appendChild(el);
    });
  }

  // ---------------------------------------------------------------- crafting (simple list, instant)
  recipes() { return RECIPES; }
  renderCraft(inv = this.lastInv) {
    if (!inv) return; const L = this.$('craftList'); L.innerHTML = '';
    for (const r of RECIPES) {
      const outId = r.out ? Object.keys(r.out)[0] : r.id, icn = r.icon || outId, name = r.name || ITEMS[outId].name, can = inv.has(r.needs);
      const needs = Object.entries(r.needs).map(([id, n]) => { const have = inv.count(id); return `<span class="${have >= n ? 'ok' : 'no'}">${icon(id, 16)} ${have}/${n}</span>`; }).join('');
      const el = document.createElement('div'); el.className = 'recipe';
      el.innerHTML = `<div class="ic2">${icon(icn, 30)}</div><div class="rbody"><div class="nm">${name}</div><div class="nt">${r.note || ''}</div><div class="nd">${needs}</div></div><button class="btn ${can ? 'primary' : ''}" ${can ? '' : 'disabled'}>${r.place ? 'Build' : 'Craft'}</button>`;
      el.querySelector('button').onclick = () => { this.on.craft && this.on.craft(r); this.renderCraft(); };
      L.appendChild(el);
    }
  }

  // ---------------------------------------------------------------- settings
  buildSettings() {
    const S = this.settings, body = this.$('setBody');
    const row = (lab, sub, ctrl) => `<div class="row"><div class="lab"><b>${lab}</b><small>${sub}</small></div>${ctrl}</div>`;
    body.innerHTML =
      row('Graphics quality', 'Low: fastest · High: bloom + grading · Ultra: sharper', `<div class="seg" data-k="quality">${['low', 'high', 'ultra'].map((q) => `<button data-v="${q}">${q[0].toUpperCase() + q.slice(1)}</button>`).join('')}</div>`) +
      row('Mute sound', 'Silence all audio (K)', `<button class="switch" data-k="muted"></button>`) +
      row('Master volume', 'All game audio', `<input type="range" min="0" max="1" step="0.05" data-k="volume"><span class="val" data-val="volume"></span>`) +
      row('Mouse sensitivity', 'Look speed', `<input type="range" min="0.4" max="2.5" step="0.05" data-k="sens"><span class="val" data-val="sens"></span>`) +
      row('Field of view', 'Camera angle', `<input type="range" min="50" max="90" step="1" data-k="fov"><span class="val" data-val="fov"></span>`) +
      row('Invert Y axis', 'Flip vertical look', `<button class="switch" data-k="invertY"></button>`) +
      row('Compass', 'Show the compass strip', `<button class="switch" data-k="compass"></button>`) +
      row('Show control hints', 'On-screen key reminders', `<button class="switch" data-k="hints"></button>`);
    body.querySelectorAll('.seg').forEach((seg) => seg.querySelectorAll('button').forEach((b) => { b.onclick = () => this.setSetting(seg.dataset.k, b.dataset.v); }));
    body.querySelectorAll('input[type=range]').forEach((r) => { r.oninput = () => this.setSetting(r.dataset.k, parseFloat(r.value)); });
    body.querySelectorAll('.switch').forEach((b) => { b.onclick = () => this.setSetting(b.dataset.k, !this.settings[b.dataset.k]); });
    this.refreshSettings();
  }
  refreshSettings() {
    const S = this.settings, body = this.$('setBody');
    body.querySelectorAll('.seg').forEach((seg) => seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', S[seg.dataset.k] === b.dataset.v)));
    body.querySelectorAll('input[type=range]').forEach((r) => { r.value = S[r.dataset.k]; const v = body.querySelector(`[data-val=${r.dataset.k}]`); v.textContent = r.dataset.k === 'volume' ? Math.round(S.volume * 100) + '%' : r.dataset.k === 'fov' ? S.fov + '°' : S[r.dataset.k].toFixed(2) + '×'; });
    body.querySelectorAll('.switch').forEach((b) => b.classList.toggle('on', !!S[b.dataset.k]));
  }
  setSetting(k, v) { this.settings[k] = v; saveSettings(this.settings); this.refreshSettings(); if (k === 'compass') this.$('compass').style.display = v ? '' : 'none'; if (k === 'muted') this.updateMuteBtn(); if (k === 'hints') { this.hintsOn = v; this.$('hints').classList.toggle('off', !v); } this.on.setting && this.on.setting(k, v); }

  updateMuteBtn() { const b = this.$('muteBtn'); if (b) { b.innerHTML = icon(this.settings.muted ? 'speaker_off' : 'speaker', 20); b.classList.toggle('off', !!this.settings.muted); } }

  // ---------------------------------------------------------------- compass
  drawCompass(yaw, px, pz, markers) {
    const c = this.cctx, W = 1040, H = 92, ppd = 8; // pixels per degree (device px)
    c.clearRect(0, 0, W, H);
    const hdg = ((Math.atan2(Math.sin(yaw), -Math.cos(yaw)) * 180) / Math.PI + 360) % 360;
    c.fillStyle = 'rgba(12,16,12,0.55)'; c.fillRect(0, 0, W, H);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let d = -75; d <= 75; d += 5) {
      const a = Math.round(hdg / 5) * 5 + d, x = W / 2 + (a - hdg) * ppd, n = ((a % 360) + 360) % 360;
      const card = n % 90 === 0, mid = n % 15 === 0;
      c.strokeStyle = card ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,' + (mid ? 0.55 : 0.28) + ')'; c.lineWidth = card ? 3 : 2;
      c.beginPath(); c.moveTo(x, H - 8); c.lineTo(x, H - (card ? 26 : mid ? 20 : 14)); c.stroke();
      if (n % 45 === 0) { const t = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }[n]; c.font = n % 90 === 0 ? '700 24px system-ui' : '600 17px system-ui'; c.fillStyle = n === 0 ? '#e6b450' : n % 90 === 0 ? '#fff' : 'rgba(255,255,255,0.7)'; c.fillText(t, x, 30); }
    }
    for (const m of markers) {
      const dx = m.x - px, dz = m.z - pz, bearing = ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360; let diff = bearing - hdg; diff = ((diff + 540) % 360) - 180;
      if (Math.abs(diff) > 78) continue; const x = W / 2 + diff * ppd, y = 62;
      c.fillStyle = m.color; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y - 11); c.lineTo(x + 9, y); c.lineTo(x, y + 11); c.lineTo(x - 9, y); c.closePath(); c.stroke(); c.fill();
    }
  }

  // ---------------------------------------------------------------- per frame
  update(dt, c) {
    const { stats, inv, player } = c; this.lastInv = inv; this.lastStats = stats;
    for (const k of ['health', 'hunger', 'thirst', 'energy']) {
      const v = Math.max(0, stats[k]), b = this.vitals[k];
      b.fill.style.width = v + '%'; if (v < b.last - 0.05) b.trail.style.width = b.last + '%'; else b.trail.style.width = v + '%';
      if (b.shown !== Math.round(v)) { b.shown = Math.round(v); b.vv.textContent = b.shown; }
      if (v < b.last - 0.05) setTimeout(() => { b.trail.style.width = Math.max(0, stats[k]) + '%'; }, 60);
      b.last = v; b.el.classList.toggle('low', v < 22);
    }
    // health ring around the avatar, day badge
    const hp = Math.max(0, Math.min(100, stats.health)), arc = this.$('hpArc'); arc.style.strokeDashoffset = 339.3 * (1 - hp / 100); arc.parentNode.parentNode.dataset.hp = hp < 25 ? 'crit' : hp < 55 ? 'warn' : 'ok';
    if (this.lastDay !== G.day) { this.lastDay = G.day; this.$('dayBadge').textContent = 'Day ' + G.day; }
    // where you are, and how fast
    if (c.place !== this.lastPlace) { this.lastPlace = c.place; this.$('placeName').textContent = c.place || ''; }
    const spd = player.speed || 0, mode = player.swimming ? 'Swimming' : player.sprinting ? 'Sprinting' : spd > 0.6 ? 'Moving' : 'Standing', kmh = Math.round(spd * 3.6);
    if (this.lastKmh !== kmh) { this.lastKmh = kmh; this.$('paceNum').textContent = kmh; } if (this.lastMode !== mode) { this.lastMode = mode; this.$('paceMode').textContent = mode; }
    // objective distance and a pointer that turns with you
    const og = this.$('objGo'), ot = c.objTarget;
    if (!ot) { if (!og.classList.contains('hidden')) og.classList.add('hidden'); } else {
      og.classList.remove('hidden'); const dx = ot.x - player.pos.x, dz = ot.z - player.pos.z, d = Math.hypot(dx, dz), fw = (dx * Math.sin(player.yaw) + dz * Math.cos(player.yaw)) / (d || 1), rt = (-dx * Math.cos(player.yaw) + dz * Math.sin(player.yaw)) / (d || 1);
      const ds = d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m'; if (ds !== this.lastDist) { this.lastDist = ds; this.$('objDist').textContent = ds; }
      this.$('objArrow').style.transform = `rotate(${(Math.atan2(rt, fw) * 180 / Math.PI).toFixed(0)}deg)`;
    }
    // action buttons: lit when the action is available
    const aS = this.$('aSprint'), aU = this.$('aUse'), aA = this.$('aAtk'), tg = c.target;
    aS.classList.toggle('on', !!player.sprinting); aS.classList.toggle('dim', stats.energy < 5);
    const useKey = tg ? (tg.blocked ? 'x' : tg.label) + '|' + (tg.icon || '') : '';
    if (useKey !== this.lastUseKey) { this.lastUseKey = useKey; aU.classList.toggle('ready', !!tg && !tg.blocked); aU.querySelector('.ai').innerHTML = icon(tg && tg.icon ? tg.icon : 'hand', 30); this.$('aUseLbl').textContent = tg && !tg.blocked ? tg.label.split(' ')[0] : 'Interact'; }
    aU.querySelector('.fg').style.strokeDashoffset = 201 * (1 - Math.min(1, c.prog || 0));
    const eq = inv.equipped && ITEMS[inv.equipped].kind === 'tool' ? inv.equipped : null, eqKey = (eq || '') + '|' + (c.atkCd > 0 ? 1 : 0);
    if (eqKey !== this.lastAtkKey) { this.lastAtkKey = eqKey; aA.querySelector('.ai').innerHTML = icon(eq || 'fist', 30); this.$('aAtkLbl').textContent = eq ? ITEMS[eq].name : 'Attack'; aA.classList.toggle('on', !!eq); }
    aA.classList.toggle('dim', c.atkCd > 0);
    const sig = JSON.stringify(inv.slots) + inv.selected;
    if (this.invDirty || sig !== this.lastSig) { this.invDirty = false; this.lastSig = sig; this.renderHotbar(inv); if (G.modal === 'inventory') this.renderInv(inv); if (G.modal === 'craft') this.renderCraft(inv); }
    if (inv.selected !== this.lastSel) {
      this.lastSel = inv.selected; const s = inv.slots[inv.selected], lab = this.$('itemLabel');
      if (s) { lab.textContent = ITEMS[s.id].name; lab.classList.add('on'); clearTimeout(this.labelT); this.labelT = setTimeout(() => lab.classList.remove('on'), 1600); } else lab.classList.remove('on');
    }
    const hh = Math.floor(G.time), mm = Math.floor((G.time - hh) * 60), night = G.time < 5.5 || G.time >= 19;
    this.$('clockTime').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    const phase = G.time < 5 ? 'Night' : G.time < 7.5 ? 'Dawn' : G.time < 11 ? 'Morning' : G.time < 14 ? 'Midday' : G.time < 17.5 ? 'Afternoon' : G.time < 19.5 ? 'Dusk' : 'Night';
    this.$('clockDay').textContent = `Day ${G.day} · ${phase}`;
    if (this.lastNight !== night) { this.lastNight = night; this.$('clockIc').innerHTML = icon(night ? 'moon' : 'sun', 22); this.$('clockIc').style.color = night ? '#a9bde8' : '#f0c75e'; }
    const chips = [];
    if (stats.sick > 0) chips.push(['sick', 'Sick']); if (stats.hunger <= 0) chips.push(['food', 'Starving']); if (stats.thirst <= 0) chips.push(['drop', 'Dehydrated']); if (stats.energy < 15) chips.push(['zzz', 'Exhausted']);
    if (player.warn) chips.push(['compass', 'Open sea ahead', 'info']); if (player.swimming) chips.push(['drop', 'Swimming', 'info']); if (player.flareT > 0) chips.push(['flare', 'Flare lit', 'info']);
    const cs = chips.map((x) => x.join('|')).join(';'); if (cs !== this.lastChips) { this.lastChips = cs; this.$('status').innerHTML = chips.map((x) => `<span class="${x[2] || ''}">${icon(x[0], 14)}${x[1]}</span>`).join(''); }
    const low = stats.health < 30 ? (30 - stats.health) / 30 : 0, a = Math.min(0.8, low * 0.5 + Math.max(stats.hurtFlash, 0) * 1.0);
    this.$('vignette').style.background = a > 0.01 ? `radial-gradient(ellipse at center, transparent ${58 - a * 28}%, rgba(150,10,10,${a}) 100%)` : 'none';
    if (this.crafting) {
      const cr = this.crafting; cr.t += dt; cr.tick -= dt; if (cr.tick <= 0) { cr.tick = 0.42; this.on.craftTick && this.on.craftTick(); }
      const f = this.$('craftFill'); if (f) f.style.width = Math.min(100, (cr.t / cr.dur) * 100) + '%';
      if (cr.t >= cr.dur) { const r = cr.r; this.crafting = null; this.on.craft && this.on.craft(r); this.renderCraft(inv); }
    }
    if (this.settings.compass) this.drawCompass(c.yaw, player.pos.x, player.pos.z, c.markers || []);
  }
}
