import { ITEMS } from './items.js';

export const SLOTS = 24;
export class Inventory {
  constructor() { this.slots = Array(SLOTS).fill(null); this.selected = 0; }
  clear() { this.slots = Array(SLOTS).fill(null); this.selected = 0; }
  add(id, n = 1) {
    const max = ITEMS[id].max;
    for (const s of this.slots) if (s && s.id === id && s.count < max && n > 0) { const t = Math.min(max - s.count, n); s.count += t; n -= t; }
    for (let i = 0; i < SLOTS && n > 0; i++) if (!this.slots[i]) { const t = Math.min(max, n); this.slots[i] = { id, count: t }; n -= t; }
    return n; // leftover
  }
  count(id) { return this.slots.reduce((a, s) => a + (s && s.id === id ? s.count : 0), 0); }
  has(needs) { return Object.entries(needs).every(([id, n]) => this.count(id) >= n); }
  remove(id, n = 1) {
    for (let i = SLOTS - 1; i >= 0 && n > 0; i--) {
      const s = this.slots[i]; if (s && s.id === id) { const t = Math.min(s.count, n); s.count -= t; n -= t; if (s.count <= 0) this.slots[i] = null; }
    }
    return n === 0;
  }
  removeAt(i, n = 1) { const s = this.slots[i]; if (!s) return; s.count -= n; if (s.count <= 0) this.slots[i] = null; }
  swap(a, b) { const t = this.slots[a]; this.slots[a] = this.slots[b]; this.slots[b] = t; }
  get equipped() { const s = this.slots[this.selected]; return s ? s.id : null; }
  get tool() { const id = this.equipped; return id && ITEMS[id].kind === 'tool' ? ITEMS[id] : null; }
  toJSON() { return this.slots; }
  load(slots) { this.slots = Array(SLOTS).fill(null); (slots || []).forEach((s, i) => { if (i < SLOTS) this.slots[i] = s; }); }
}
