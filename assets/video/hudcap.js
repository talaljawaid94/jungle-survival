// Frame grabber for single-take gameplay recording: the WebGL canvas plus the game's real HUD (the #ui DOM) rasterised through an SVG foreignObject.
//   const h = await import('/@fs/<abs>/assets/video/hudcap.js?t=' + Date.now()); const snap = h.make(1920, 1080); const jpegDataUrl = await snap();
export function make(W, H, opt = {}) {
  const cv = document.getElementById('c'), ui = document.getElementById('ui'), out = document.createElement('canvas'); out.width = W; out.height = H; const x = out.getContext('2d');
  const cache = new Map();
  const toData = async (src) => { if (cache.has(src)) return cache.get(src); const p = (async () => { try { const b = await (await fetch(src)).blob(); return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); }); } catch (e) { return src; } })(); cache.set(src, p); return p; };
  const skip = new Set(['SCRIPT', 'STYLE']);
  async function inlineTree(src, dst) {                         // copy computed style onto the clone, element by element
    const cs = getComputedStyle(src); let css = '';
    for (let i = 0; i < cs.length; i++) { const p = cs[i]; css += p + ':' + cs.getPropertyValue(p) + ';'; }
    dst.setAttribute('style', css);
    if (src.tagName === 'IMG' && src.src) dst.setAttribute('src', await toData(src.currentSrc || src.src));
    const bg = cs.backgroundImage; if (bg && bg.includes('url(')) { const m = bg.match(/url\(["']?([^"')]+)["']?\)/); if (m && !m[1].startsWith('data:')) { const d = await toData(m[1]); dst.style.backgroundImage = bg.replace(m[1], d); } }
    const kids = [...src.childNodes], dk = [...dst.childNodes];
    for (let i = 0; i < kids.length; i++) {
      const s = kids[i], d = dk[i]; if (!s || !d || s.nodeType !== 1) continue;
      if (skip.has(s.tagName) || getComputedStyle(s).display === 'none') { d.remove(); dk.splice(i, 1, null); continue; }
      if (s.tagName === 'CANVAS') { const im = document.createElement('img'); try { im.setAttribute('src', s.toDataURL('image/png')); } catch (e) { } im.setAttribute('style', getComputedStyle(s).cssText || ''); im.style.width = s.clientWidth + 'px'; im.style.height = s.clientHeight + 'px'; d.replaceWith(im); continue; }
      await inlineTree(s, d);
    }
  }
  return async function snap(q = 0.92) {
    x.clearRect(0, 0, W, H); if (!opt.hudOnly) x.drawImage(cv, 0, 0, W, H);
    const clone = ui.cloneNode(true); await inlineTree(ui, clone);
    clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml'); clone.style.width = innerWidth + 'px'; clone.style.height = innerHeight + 'px'; clone.style.position = 'absolute'; clone.style.left = '0'; clone.style.top = '0';
    const xml = new XMLSerializer().serializeToString(clone);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${innerWidth} ${innerHeight}"><foreignObject x="0" y="0" width="${innerWidth}" height="${innerHeight}">${xml}</foreignObject></svg>`;
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode().catch(() => { });
    x.drawImage(img, 0, 0, W, H);
    return opt.hudOnly ? out.toDataURL('image/png') : out.toDataURL('image/jpeg', q);
  };
}
