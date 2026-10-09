// Touch controls: floating move stick (left), drag-to-look (anywhere else on the 3D view), and the
// on-screen action buttons. Everything feeds the same Controls object the keyboard and mouse use.
import { icon } from './icons.js';
import { G } from './game.js';

const STICK_R = 56; // px of travel for full deflection
const LOOK = 1.55; // drag pixels -> "mouse" pixels

export function initTouch(ctl, ui) {
  if (!ctl.touch) return;
  const root = document.documentElement; root.classList.add('touch');
  const hud = document.getElementById('hud');

  // ---- extra buttons
  const jump = document.createElement('div'); jump.className = 'abtn'; jump.id = 'aJump';
  jump.innerHTML = `<div class="ring"><span class="ai">${icon('arrow_up', 30)}</span></div><b>Jump</b>`;
  document.getElementById('actions').appendChild(jump);

  const util = document.createElement('div'); util.id = 'touchUtil';
  util.innerHTML = [['bag', 'Tab'], ['hammer', 'KeyC'], ['map', 'KeyM'], ['zzz', 'KeyZ'], ['drop_item', 'KeyQ'], ['hand', 'KeyF']]
    .map(([ic, code]) => `<button class="rbtn" data-k="${code}">${icon(ic, 20)}</button>`).join('');
  hud.appendChild(util);
  util.querySelectorAll('button').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); ctl.press(b.dataset.k); }));

  const stickEl = document.createElement('div'); stickEl.id = 'stick'; stickEl.innerHTML = '<i class="ring"></i><i class="knob"></i>';
  hud.appendChild(stickEl); const knob = stickEl.querySelector('.knob');

  // ---- hold buttons (interact / sprint toggle / jump / attack)
  const hold = (el, down, up) => {
    el.style.pointerEvents = 'auto';
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (_) {} el.classList.add('held'); down(); });
    const end = (e) => { if (!el.classList.contains('held')) return; el.classList.remove('held'); up && up(); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
  };
  hold(document.getElementById('aUse'), () => ctl.press('KeyE'), () => ctl.release('KeyE'));
  hold(document.getElementById('aAtk'), () => { ctl.mouseDown = true; ctl.mousePressed = true; }, () => { ctl.mouseDown = false; });
  hold(jump, () => ctl.press('Space'));
  let sprintLatch = false;
  hold(document.getElementById('aSprint'), () => { sprintLatch = !sprintLatch; document.getElementById('aSprint').classList.toggle('latched', sprintLatch); });

  // ---- stick + look on the 3D view
  let stick = null, look = null, tapT = 0;
  const canvas = ctl.canvas;
  const free = () => (G.state === 'play' || G.state === 'intro') && !G.paused && !G.modal;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && !ctl.touch) return;
    if (!free()) return; e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    if (G.state === 'intro') { tapT = performance.now(); look = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 }; return; }
    if (!stick && e.clientX < innerWidth * 0.5 && e.clientY > innerHeight * 0.22) {
      stick = { id: e.pointerId, x: e.clientX, y: e.clientY };
      stickEl.style.left = e.clientX + 'px'; stickEl.style.top = e.clientY + 'px'; stickEl.classList.add('on'); knob.style.transform = 'translate(-50%,-50%)';
    } else if (!look) look = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (stick && e.pointerId === stick.id) {
      let dx = e.clientX - stick.x, dy = e.clientY - stick.y; const d = Math.hypot(dx, dy), m = Math.min(1, d / STICK_R);
      if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; }
      knob.style.transform = `translate(calc(${dx}px - 50%), calc(${dy}px - 50%))`;
      ctl.axis = m > 0.12 ? { x: dx / d, y: -dy / d, m } : null;
      stick.m = m;
    } else if (look && e.pointerId === look.id) {
      const dx = e.clientX - look.x, dy = e.clientY - look.y; look.x = e.clientX; look.y = e.clientY; look.moved += Math.abs(dx) + Math.abs(dy);
      if (G.state === 'play') { ctl.mouseDX += dx * LOOK; ctl.mouseDY += dy * LOOK; }
    }
  });
  const up = (e) => {
    if (stick && e.pointerId === stick.id) { stick = null; ctl.axis = null; stickEl.classList.remove('on'); }
    if (look && e.pointerId === look.id) {
      if (G.state === 'intro' && look.moved < 14 && performance.now() - tapT < 450) ctl.press('Space'); // tap skips the intro
      look = null;
    }
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);

  // auto-sprint: sprint latch, or pushing the stick to its edge
  ctl.touchTick = () => {
    const edge = stick && stick.m > 0.97;
    if (sprintLatch || edge) ctl.keys.add('ShiftLeft'); else ctl.keys.delete('ShiftLeft');
    if (!free() && stick) { stick = null; ctl.axis = null; stickEl.classList.remove('on'); }
  };
  // a panel opening should drop any held input
  ctl.touchReset = () => { stick = null; look = null; ctl.axis = null; sprintLatch = false; document.getElementById('aSprint').classList.remove('latched'); stickEl.classList.remove('on'); ctl.keys.delete('ShiftLeft'); ctl.keys.delete('KeyE'); ctl.mouseDown = false; };

  // fullscreen + landscape where the browser allows it (not iPhone Safari)
  ctl.goFullscreen = () => {
    try {
      const el = document.documentElement; const r = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : null;
      Promise.resolve(r).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => {});
    } catch (_) {}
  };
}
