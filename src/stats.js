import { clamp } from './noise.js';

export class Stats {
  constructor() { this.reset(); }
  reset() {
    this.health = 55; this.hunger = 80; this.thirst = 70; this.energy = 75;
    this.sick = 0; this.hurtFlash = 0; this.lastDamage = 0; this.deadFlag = false;
  }
  get dead() { return this.deadFlag || this.health <= 0; }
  update(dt, c) {
    // c: { sprinting, swimming, resting, moving }
    this.hunger -= (0.055 + (c.sprinting ? 0.05 : 0)) * dt;
    this.thirst -= (0.085 + (c.sprinting ? 0.08 : 0) + (c.swimming ? 0.02 : 0)) * dt;
    if (c.resting) this.energy += 0.9 * dt;
    else this.energy -= (0.028 + (c.sprinting ? 1.1 : 0) + (c.swimming ? 0.5 : 0) + (c.moving ? 0.02 : 0)) * dt;
    if (this.sick > 0) { this.sick -= dt; this.health -= 0.55 * dt; this.thirst -= 0.12 * dt; }
    if (this.hunger <= 0) this.health -= 0.45 * dt;
    if (this.thirst <= 0) this.health -= 0.7 * dt;
    if (this.energy <= 0) this.health -= 0.08 * dt;
    if (this.hunger > 40 && this.thirst > 40 && this.sick <= 0 && this.energy > 10) this.health += 0.22 * dt;
    this.clampAll();
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
  }
  clampAll() {
    if (this.health <= 0) this.deadFlag = true;
    this.health = clamp(this.health, 0, 100); this.hunger = clamp(this.hunger, 0, 100);
    this.thirst = clamp(this.thirst, 0, 100); this.energy = clamp(this.energy, 0, 100);
  }
  damage(n) { this.health -= n; this.hurtFlash = 0.5; this.lastDamage = performance.now(); this.clampAll(); }
  heal(n) { this.health += n; this.clampAll(); }
}
