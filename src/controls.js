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
    // noLock: the browser refused pointer lock (embedded/preview browsers), so plain mouse movement drives the camera (cursor hidden, edges keep turning)
    this.noLock = !isTouch && !document.documentElement.requestPointerLock; this.everLocked = false; this.cx = 0; this.cy = 0;
    document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement) { this.everLocked = true; this.noLock = false; } });
    document.addEventListener('pointerlockerror', () => { if (!this.everLocked && !this.touch) this.noLock = true; });
    addEventListener('mousemove', (e) => {
      this.cx = e.clientX; this.cy = e.clientY;
      if (document.pointerLockElement || (this.noLock && this.wantLock)) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
    });
    addEventListener('mousedown', (e) => {
      if (e.button !== 0 || this.touch) return;
      if (document.pointerLockElement || (this.noLock && this.wantLock && e.target === this.canvas)) { this.mouseDown = true; this.mousePressed = true; }
      else if (e.target === this.canvas && this.wantLock) this.lock();
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas = canvas;
  }
  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  endFrame() { this.pressed.clear(); this.mouseDX = 0; this.mouseDY = 0; this.mousePressed = false; }
  // without pointer lock the cursor stops at the screen edge, so holding it there keeps turning
  edgeTick(dt) {
    if (!(this.noLock && this.wantLock) || document.pointerLockElement) return; const m = 36;
    const ex = this.cx < m ? -1 : this.cx > innerWidth - m ? 1 : 0, ey = this.cy < m ? -1 : this.cy > innerHeight - m ? 1 : 0;
    this.mouseDX += ex * 700 * dt; this.mouseDY += ey * 500 * dt;
  }
  press(code) { this.keys.add(code); this.pressed.add(code); }
  release(code) { this.keys.delete(code); }
  lock() { if (this.touch) return; try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { if (!this.everLocked) this.noLock = true; }); } catch (e) { if (!this.everLocked) this.noLock = true; } }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
}
