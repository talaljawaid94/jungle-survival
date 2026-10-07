export class Controls {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDX = 0; this.mouseDY = 0;
    this.mouseDown = false; this.mousePressed = false;
    this.locked = false;
    addEventListener('keydown', (e) => {
      if (e.repeat) { if (e.code === 'Tab') e.preventDefault(); return; }
      this.keys.add(e.code); this.pressed.add(e.code);
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
    });
    addEventListener('mousedown', (e) => { if (e.button === 0) { this.mouseDown = true; this.mousePressed = true; } });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas = canvas;
  }
  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  endFrame() { this.pressed.clear(); this.mouseDX = 0; this.mouseDY = 0; this.mousePressed = false; }
  lock() { try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
}
