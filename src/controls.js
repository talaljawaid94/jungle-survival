// Phones and tablets (not touch laptops with a mouse). ?touch / ?notouch force it for testing.
export const isTouch = (() => {
  try {
    const q = location.search;
    if (q.includes('notouch')) return false; if (q.includes('touch')) return true;
    const mobileUA = /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return matchMedia('(pointer: coarse)').matches || (mobileUA && navigator.maxTouchPoints > 0);
  } catch (e) { return false; }
})();

export class Controls {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDX = 0; this.mouseDY = 0;
    this.mouseDown = false; this.mousePressed = false;
    this.locked = false;
    this.touch = isTouch; this.wantLock = false; this.axis = null; // axis: analog move stick {x right, y forward, m magnitude} or null
    addEventListener('keydown', (e) => {
      if (e.repeat) { if (e.code === 'Tab') e.preventDefault(); return; }
      this.keys.add(e.code); this.pressed.add(e.code);
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    // noLock: the browser refused pointer lock (embedded/preview browsers), so drag-to-look replaces it: drag = look, click = act
    this.noLock = !isTouch && !document.documentElement.requestPointerLock; this.everLocked = false; this.drag = null;
    document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement) { this.everLocked = true; this.noLock = false; } });
    document.addEventListener('pointerlockerror', () => { if (!this.everLocked && !this.touch) this.noLock = true; });
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
      else if (this.drag) { this.drag.d += Math.abs(e.movementX) + Math.abs(e.movementY); if (this.drag.d > 4) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; } }
    });
    addEventListener('mousedown', (e) => {
      if (e.button !== 0 || this.touch) return;
      if (document.pointerLockElement) { this.mouseDown = true; this.mousePressed = true; }
      else if (e.target === this.canvas && this.wantLock) { if (this.noLock) this.drag = { d: 0 }; else this.lock(); }
    });
    addEventListener('mouseup', (e) => {
      if (e.button !== 0) return; this.mouseDown = false;
      if (this.drag) { if (this.drag.d <= 4) this.mousePressed = true; this.drag = null; }
    });
    addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas = canvas;
  }
  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  endFrame() { this.pressed.clear(); this.mouseDX = 0; this.mouseDY = 0; this.mousePressed = false; }
  press(code) { this.keys.add(code); this.pressed.add(code); }
  release(code) { this.keys.delete(code); }
  lock() { if (this.touch) return; try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { if (!this.everLocked) this.noLock = true; }); } catch (e) { if (!this.everLocked) this.noLock = true; } }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
}
