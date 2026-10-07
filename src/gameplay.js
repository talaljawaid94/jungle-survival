import { ITEMS, RECIPES, COOK } from './items.js';
import { G } from './game.js';
import * as THREE from 'three';

const KIND_INFO = {
  stick: { name: 'Dry stick', icon: 'stick', h: 0.3 }, stone: { name: 'Stone', icon: 'stone', h: 0.3 }, bush: { name: 'Bush', icon: 'fiber', h: 0.8 },
  berry: { name: 'Berry bush', icon: 'berries', h: 0.9 }, fruit: { name: 'Fruit tree', icon: 'fruit', h: 2.4 }, palm: { name: 'Palm tree', icon: 'coconut', h: 3.2 },
  tree: { name: 'Jungle tree', icon: 'log', h: 2.2 }, crate: { name: 'Supply crate', icon: 'bag', h: 1.1 }, corpse: { name: 'Carcass', icon: 'raw_meat', h: 0.7 },
  fire: { name: 'Campfire', icon: 'campfire', h: 1.0 }, shelter: { name: 'Shelter', icon: 'shelter', h: 1.6 }, water: { name: 'Fresh water', icon: 'drop', h: 0.4 }, sea: { name: 'Sea water', icon: 'drop', h: 0.4 },
};

const LOOT = {
  supplies: { knife: 1, flare: 2, canned_food: 2 },
  medical:  { first_aid: 2, bandage: 2, water_clean: 1 },
  food:     { canned_food: 2, water_clean: 2, bottle_empty: 1 },
};

const OBJECTIVES = [
  { text: 'Search the wreckage for supplies (E)', done: (f) => f.crate },
  { text: 'Find fresh water: lakes are inland', done: (f) => f.water },
  { text: 'Gather sticks, stones and plant fibre (E)', done: (f, g) => f.campfire || (g.inv.count('stick') >= 4 && g.inv.count('stone') >= 3) },
  { text: 'Craft a campfire (C)', done: (f) => f.campfire },
  { text: 'Craft a spear or axe (C) and hunt for meat', done: (f) => f.meat },
  { text: 'Cook meat at your campfire', done: (f) => f.cooked },
  { text: 'Sleep beside a fire or shelter (Z)', done: (f) => f.slept },
  { text: 'Explore the island (reveal 35% of the map: M)', done: (f) => f.explored },
];

export class Gameplay {
  constructor(o) {
    Object.assign(this, o);
    this.flags = {}; this.objIdx = 0; this.busy = null; this.atkCd = 0; this.sleepSeq = null; this.target = null; this.objTimer = 0; this.chopTick = 0;
  }
  reset() { this.flags = {}; this.objIdx = 0; this.busy = null; this.sleepSeq = null; }

  toast(m) { this.ui.toast(m); }
  give(id, n = 1) {
    const left = this.inv.add(id, n);
    if (left > 0) this.toast(`Inventory full: ${ITEMS[id].name} left behind`);
    else { this.ui.pickupToast(id, n); if (!G.modal) { const sp = this.screenPos || { x: innerWidth / 2, y: innerHeight / 2 }; this.ui.flyIcon(id, sp.x, sp.y); } }
    if (id === 'raw_meat' || id === 'raw_fish') this.flags.meat = true;
    return left === 0;
  }

  // ------------------------------------------------------------------ targets
  findTarget() {
    const p = this.player, w = this.world, ax = Math.sin(p.yaw), az = Math.cos(p.yaw);
    let best = null, bs = 1e9;
    const consider = (key, x, z, range, label, dur, perform, opts = {}) => {
      const dx = x - p.pos.x, dz = z - p.pos.z, d = Math.hypot(dx, dz); if (d > range) return;
      const dot = (dx * ax + dz * az) / (d || 1); if (dot < 0.25 && d > 1.3) return;
      const score = d + (1 - dot) * 3.5;
      if (score < bs) {
        bs = score; const info = KIND_INFO[this._k] || {}; const icon = label.startsWith('Chop') ? 'stone_axe' : label.startsWith('Cook') ? 'cooked_meat' : label.startsWith('Boil') ? 'water_clean' : label.startsWith('Drink') || label.startsWith('Fill') ? 'drop' : info.icon;
        best = { key, label, dur, perform, name: info.name, icon, blocked: !perform, pos: new THREE.Vector3(x, w.heightAt(x, z) + (info.h ?? 0.9), z), ...opts };
      }
    };
    const eq = this.inv.equipped, tool = this.inv.tool;
    w.itemsNear(p.pos.x, p.pos.z, 3.6, (o) => {
      this._k = o.kind;
      switch (o.kind) {
        case 'stick': consider('i' + o.id, o.x, o.z, 2.6, 'Pick up Stick', 0.3, () => { this.give('stick'); w.removeItem(o); this.audio.pickup(); }); break;
        case 'stone': consider('i' + o.id, o.x, o.z, 2.6, 'Pick up Stone', 0.3, () => { this.give('stone'); w.removeItem(o); this.audio.pickup(); }); break;
        case 'bush': if (o.cooldown > 0) break;
          consider('i' + o.id, o.x, o.z, 2.2, 'Gather plant fibre', 0.9, () => { this.give('fiber', 1 + ((Math.random() * 2) | 0)); o.cooldown = 160; this.audio.rustle(); }); break;
        case 'berry': if (o.cooldown > 0) break;
          consider('i' + o.id, o.x, o.z, 2.2, 'Pick berries', 1.0, () => { this.give('berries', 2 + ((Math.random() * 2) | 0)); this.give('fiber', 1); o.cooldown = 240; this.audio.rustle(); }); break;
        case 'fruit': {
          if (o.data.fruits <= 0 && o.cooldown <= 0) o.data.fruits = 3;
          if (o.data.fruits > 0) consider('i' + o.id, o.x, o.z, 3.0, 'Pick jungle fruit', 0.8, () => { this.give('fruit'); o.data.fruits--; if (o.data.fruits <= 0) o.cooldown = 300; this.audio.rustle(); });
          break;
        }
        case 'palm': {
          if (o.data.coconuts <= 0 && o.cooldown <= 0) o.data.coconuts = 2;
          if (o.data.coconuts > 0) consider('i' + o.id, o.x, o.z, 2.6, 'Shake palm for a coconut', 1.4, () => { this.give('coconut'); o.data.coconuts--; if (o.data.coconuts <= 0) o.cooldown = 300; this.audio.rustle(); });
          break;
        }
        case 'tree':
          if (tool && tool.chop > 0) consider('i' + o.id, o.x, o.z, 2.6, 'Chop tree', Math.max(2.2, 3.2 / tool.chop), () => { this.give('log', 3); this.give('stick', 2); this.fx.fallTree(o, p.pos.x, p.pos.z); w.removeItem(o); }, { act: 'chop', every: 0.8, tick: () => { this.audio.chop(); this.player.char.attack(); this.fx.chips(o.x + (p.pos.x - o.x) * 0.4, o.y + 1.1, o.z + (p.pos.z - o.z) * 0.4); this.fx.shake(0.04); } });
          else consider('t' + o.id, o.x, o.z, 2.6, 'Chopping needs an axe or knife (equip it)', 0, null);
          break;
        case 'crate':
          if (!o.data.opened) consider('i' + o.id, o.x, o.z, 2.8, 'Open supply crate', 1.9, () => {
            for (const [id, n] of Object.entries(LOOT[o.data.loot])) this.give(id, n);
            w.openCrate(o); this.flags.crate = true; this.audio.pickup();
          }, { act: 'crate', obj: o });
          break;
      }
    });
    // corpses
    const corpse = this.animals.nearestCorpse(p.pos.x, p.pos.z, 3.0); this._k = 'corpse';
    if (corpse) consider('c' + corpse.x.toFixed(1), corpse.x, corpse.z, 3.0, `Butcher ${corpse.sp.name}`, tool ? 2.4 : 5, () => {
      this.give('raw_meat', corpse.sp.meat); corpse.butchered = true; this.fx.bloodSplash(corpse.x, corpse.y + 0.35, corpse.z, 30); this.fx.puff(corpse.x, corpse.y + 0.4, corpse.z, 8, 0.8); this.animals.remove(corpse); this.audio.chop();
    }, { act: 'butcher', tick: () => {
      this.audio.chop(); const b = this.busy; if (b) corpse.g.scale.setScalar(Math.max(0.4, 1 - 0.6 * (b.t / b.dur)));       // the carcass shrinks as it is cut up
      this.fx.bloodSplash(corpse.x + (Math.random() - 0.5) * 0.5, corpse.y + 0.3, corpse.z + (Math.random() - 0.5) * 0.5, 10);
    } });
    // campfires
    const fire = this.structures.nearestFire(p.pos.x, p.pos.z, 3.2); this._k = 'fire';
    if (fire) {
      const key = 'f' + fire.x.toFixed(1);
      if (fire.lit) {
        if (this.inv.count('water_dirty') > 0) consider(key, fire.x, fire.z, 3.2, 'Boil lake water', 3, () => { this.inv.remove('water_dirty'); this.give('water_clean'); this.flags.boiled = true; this.audio.pickup(); });
        else {
          const raw = Object.keys(COOK).find((id) => this.inv.count(id) > 0);
          if (raw) consider(key, fire.x, fire.z, 3.2, `Cook ${ITEMS[raw].name}`, 3, () => { this.inv.remove(raw); this.give(COOK[raw]); this.flags.cooked = true; this.audio.eat(); });
          else if (this.inv.count('stick') > 0) consider(key, fire.x, fire.z, 3.2, 'Add fuel (stick)', 0.6, () => { this.inv.remove('stick'); fire.fuel += 80; this.audio.pickup(); });
          else consider(key, fire.x, fire.z, 3.2, 'Campfire: warm and safe', 0, null);
        }
      } else if (this.inv.count('stick') > 0) consider(key, fire.x, fire.z, 3.2, 'Rekindle fire (stick)', 1.2, () => { this.inv.remove('stick'); fire.fuel = 120; fire.lit = true; fire.flame.active = true; fire.smoke.o.rate = 7; this.audio.fireStart(); });
      else consider(key, fire.x, fire.z, 3.2, 'Fire has burnt out (needs a stick)', 0, null);
    }
    // shelter hint
    const sh = this.structures.nearestShelter(p.pos.x, p.pos.z, 3.0); this._k = 'shelter';
    if (sh) consider('s', sh.x, sh.z, 3.0, 'Lean-to shelter: press Z to sleep', 0, null);
    // water
    if (!p.swimming) for (const d of [1.2, 2.0, 2.9]) {
      const x = p.pos.x + ax * d, z = p.pos.z + az * d;
      if (w.heightAt(x, z) < -0.2) {
        const fresh = w.isFresh(x, z), key = 'w'; this._k = fresh ? 'water' : 'sea';
        if (!fresh) consider(key, x, z, 4, 'Sea water: undrinkable (salt)', 0, null);
        else if (eq === 'bottle_empty') consider(key, x, z, 4, 'Fill bottle', 1.3, () => { this.inv.remove('bottle_empty'); this.give('water_dirty'); this.flags.water = true; this.audio.drink(); });
        else consider(key, x, z, 4, 'Drink from the lake', 2.0, () => {
          this.stats.thirst += 26; this.flags.water = true; this.audio.drink();
          if (Math.random() < 0.35) { this.stats.sick = Math.max(this.stats.sick, 20); this.toast('The water tasted foul. You feel sick...'); } else this.toast('You drink. Refreshing.');
        });
        break;
      }
    }
    return best;
  }

  // ------------------------------------------------------------------ per frame
  update(dt, ctl, locked) {
    this.atkCd -= dt;
    if (this.sleepSeq) { this.updateSleep(dt); return; }
    // hotbar select
    for (let i = 0; i < 9; i++) if (ctl.hit('Digit' + (i + 1))) this.select(i);
    if (ctl.hit('KeyF')) this.useSlot(this.inv.selected);
    if (ctl.hit('KeyQ') && this.inv.slots[this.inv.selected]) { const s = this.inv.slots[this.inv.selected]; this.toast(`Dropped ${ITEMS[s.id].name}`); this.inv.removeAt(this.inv.selected, 1); this.afterInvChange(); }
    if (ctl.hit('KeyZ')) this.trySleep();

    if (locked || this.player.dead) { this.cancelBusy(); this.ui.setPrompt(null); return; }

    this.target = this.findTarget();
    const t = this.target;
    if (this.busy) {
      if (!ctl.down('KeyE') || !t || t.key !== this.busy.key) this.cancelBusy();
      else {
        this.busy.t += dt; this.ui.setProgress(this.busy.t / this.busy.dur); this.player.gathering = true;
        const bz = this.busy; this.player.act = { kind: bz.act || 'pick', t: bz.t, u: Math.min(1, bz.t / bz.dur), x: bz.pos.x, z: bz.pos.z }; if (bz.act === 'crate') this.crateLid(bz.obj, bz.t / bz.dur);
        this.busy.tickT = (this.busy.tickT || 0) + dt; if (this.busy.tick && this.busy.tickT > (this.busy.every || 0.55)) { this.busy.tickT = 0; this.busy.tick(); }
        if (this.busy.t >= this.busy.dur) { const b = this.busy; this.busy = null; this.player.gathering = false; this.player.act = null; this.ui.setProgress(null); b.perform(); this.afterInvChange(); }
      }
    } else {
      this.player.gathering = false; this.player.act = null;
      if (t && ctl.hit('KeyE') && t.perform) {
        if (t.dur <= 0.01) { t.perform(); this.afterInvChange(); } else this.busy = { ...t, t: 0 };
      }
    }
    this.ui.setPrompt(t ? (t.perform ? `[E] ${t.label}${t.dur > 0.4 ? ' (hold)' : ''}` : t.label) : null);

    if (ctl.mousePressed) this.attack();

    this.objTimer -= dt;
    if (this.objTimer <= 0) { this.objTimer = 0.7; this.checkObjectives(); }
  }

  // the crate lid lifts and tilts while the survivor works at it, and drops back if they let go
  crateLid(o, u) {
    const lid = o && o.obj3d && o.obj3d.userData.lid; if (!lid || o.data.opened) return;
    const ease = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const jiggle = ease(0.28, 0.5, u) * (1 - ease(0.5, 0.6, u)) * Math.sin(u * 60) * 0.012, lift = ease(0.5, 0.95, u);
    lid.position.set(0, o.obj3d.userData.lidY + jiggle + 0.2 * lift, 0.18 * lift); lid.rotation.set(-0.5 * lift, 0, 0);
  }
  cancelBusy() {
    if (this.busy) { const b = this.busy; if (b.act === 'crate' && b.obj && !b.obj.data.opened) { const lid = b.obj.obj3d.userData.lid; if (lid) { lid.position.set(0, b.obj.obj3d.userData.lidY, 0); lid.rotation.set(0, 0, 0); } } this.busy = null; this.ui.setProgress(null); }
    this.player.gathering = false; this.player.act = null;
  }
  afterInvChange() { this.ui.invDirty = true; this.player.setEquipped(this.inv.equipped); }
  select(i) { this.inv.selected = i; this.afterInvChange(); this.audio.click(); }

  attack() {
    if (this.atkCd > 0 || this.busy || this.player.dead) return;
    const tool = this.inv.tool, dmg = tool ? tool.dmg : 5, reach = tool ? tool.reach : 1.7, p = this.player;
    this.atkCd = 0.62; p.heading = p.yaw; p.char.attack(); this.audio.swing(); this.stats.energy -= 0.6;
    setTimeout(() => {
      const a = this.animals.hit(p.pos.x, p.pos.z, p.yaw, reach, dmg * (0.9 + Math.random() * 0.3));
      if (a) { this.audio.hit(); this.fx.impact(a.x, a.y + 0.8, a.z); this.fx.shake(a.dead ? 0.18 : 0.1); if (a.dead) this.ui.toast(`${a.sp.name} down. Butcher it (E)`); }
      else if (tool && tool.fish) this.tryFish();
    }, 190);
  }
  tryFish() {
    const p = this.player, ax = Math.sin(p.yaw), az = Math.cos(p.yaw);
    for (const d of [1.6, 2.4, 3.2]) {
      const h = this.world.heightAt(p.pos.x + ax * d, p.pos.z + az * d);
      if (h < -0.25 && h > -2.8) {
        this.audio.drink();
        if (Math.random() < 0.3) { this.give('raw_fish'); this.toast('You spear a fish!'); } else this.toast('The fish darts away...');
        return;
      }
    }
  }

  // ------------------------------------------------------------------ using items
  useSlot(i) {
    const s = this.inv.slots[i]; if (!s) return; const d = ITEMS[s.id], st = this.stats;
    if (d.kind === 'med') {
      if (st.health >= 99) return this.toast('You are already healthy');
      st.heal(d.heal); this.inv.removeAt(i, 1); this.audio.pickup(); this.toast(`+${d.heal} health`);
    } else if (d.kind === 'food') {
      if (d.thirst) st.thirst += d.thirst; if (d.hunger) st.hunger += d.hunger; if (d.health) st.heal(d.health);
      if (d.sick && Math.random() < d.sick) { st.sick = Math.max(st.sick, 18); this.toast('That did not agree with you...'); }
      else this.toast(`${d.name}: ${d.hunger ? '+' + d.hunger + ' food ' : ''}${d.thirst ? '+' + d.thirst + ' water' : ''}`);
      this.inv.removeAt(i, 1); if (d.returns) this.inv.add(d.returns, 1);
      d.thirst && !d.hunger ? this.audio.drink() : this.audio.eat(); st.clampAll();
    } else if (s.id === 'flare') {
      if (this.player.flareT > 0) return this.toast('A flare is already burning');
      this.player.flareT = 70; this.inv.removeAt(i, 1); this.audio.fireStart(); this.toast('Flare lit. Predators keep away.');
    } else if (d.kind === 'tool') {
      if (i < 9) this.select(i); else { const j = this.inv.selected, t = this.inv.slots[j]; this.inv.slots[j] = this.inv.slots[i]; this.inv.slots[i] = t; this.afterInvChange(); }
    } else this.toast(d.name + ': used for crafting');
    this.afterInvChange();
  }
  discard(i) { const s = this.inv.slots[i]; if (!s) return; this.toast(`Dropped ${ITEMS[s.id].name}`); this.inv.slots[i] = null; this.afterInvChange(); }

  // ------------------------------------------------------------------ crafting
  craft(r) {
    if (!this.inv.has(r.needs)) return this.toast('Missing materials');
    const p = this.player;
    if (r.place) {
      const x = p.pos.x + Math.sin(p.yaw) * 2.4, z = p.pos.z + Math.cos(p.yaw) * 2.4, h = this.world.heightAt(x, z);
      if (h < 0.5 || this.world.slopeAt(x, z) > 0.7) return this.toast('Cannot build here. Find flat dry ground.');
      for (const [id, n] of Object.entries(r.needs)) this.inv.remove(id, n);
      if (r.place === 'campfire') { this.structures.placeCampfire(x, z); this.fx.sparks(x, h + 0.4, z, 24); this.flags.campfire = true; this.toast('Campfire built. Add sticks to keep it burning.'); }
      else { this.structures.placeShelter(x, z, p.yaw); this.flags.shelter = true; this.toast('Shelter built. You can sleep here (Z).'); }
      this.audio.craft(); this.afterInvChange(); return;
    }
    for (const [id, n] of Object.entries(r.needs)) this.inv.remove(id, n);
    for (const [id, n] of Object.entries(r.out)) this.give(id, n);
    this.audio.craft(); this.afterInvChange();
  }

  // ------------------------------------------------------------------ sleep
  trySleep() {
    if (this.sleepSeq || this.player.dead) return;
    const p = this.player.pos, fire = this.structures.firesNear(p.x, p.z, 9), shelter = this.structures.nearestShelter(p.x, p.z, 6);
    if (!fire && !shelter) return this.toast('Too dangerous to sleep here. Build a campfire or shelter.');
    if (this.stats.energy > 88 && G.time > 6 && G.time < 19) return this.toast("You aren't tired");
    this.sleepSeq = { t: 0, applied: false, shelter: !!shelter };
    this.audio.sleep(); this.cancelBusy();
  }
  updateSleep(dt) {
    const s = this.sleepSeq; s.t += dt; this.player.sleeping = true;
    if (s.t < 1.4) this.ui.fade(s.t / 1.4);
    else {
      if (!s.applied) {
        s.applied = true;
        const wake = 6.5; let h = (wake - G.time + 24) % 24; if (h < 3) h = 8;
        this.advanceTime(h);
        this.stats.energy += Math.min(100, h * 11 + (s.shelter ? 12 : 4)); this.stats.hunger -= Math.min(h, 10) * 2.6; this.stats.thirst -= Math.min(h, 10) * 3.6;
        this.stats.heal(h * 1.5); this.stats.clampAll();
        for (const f of this.structures.fires) f.fuel -= h * 20;
        this.flags.slept = true; this.toast(`You slept ${Math.round(h)} hours.`);
      }
      this.ui.fade(1 - Math.min(1, (s.t - 2.6) / 1.4));
      if (s.t >= 4.0) { this.sleepSeq = null; this.player.sleeping = false; this.ui.fade(0); }
    }
  }
  advanceTime(h) { G.time += h; while (G.time >= 24) { G.time -= 24; G.day++; } }

  // ------------------------------------------------------------------ objectives
  checkObjectives() {
    if (this.getExplored && this.getExplored() >= 0.35) this.flags.explored = true;
    while (this.objIdx < OBJECTIVES.length && OBJECTIVES[this.objIdx].done(this.flags, this)) {
      this.ui.banner(OBJECTIVES[this.objIdx].text.replace(/\s*\(.*?\)\s*$/, '')); this.objIdx++;
    }
    this.ui.setObjective(this.objIdx < OBJECTIVES.length ? OBJECTIVES[this.objIdx].text : 'Survive. Rescue is coming in a future update.', this.objIdx, OBJECTIVES.length);
  }
}
export { RECIPES };
