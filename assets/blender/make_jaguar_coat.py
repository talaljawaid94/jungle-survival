"""Tileable jaguar coat map (multiplied with the vertex colour): near-white base, mid-tone rosette interiors, black rosette rings and solid spots.
Tile = ~0.29 m of fur at the UV scale used in build_jaguar.py (x3.4), so rosettes land ~5 cm across like the reference."""
import numpy as np, random, math, os
from PIL import Image, ImageDraw, ImageFilter
rnd = random.Random(14); S = 1024
img = Image.new('L', (S, S), 247)
d = ImageDraw.Draw(img)
def wrapped(fn, cx, cy, pad):
    for ox in (-S, 0, S):
        for oy in (-S, 0, S):
            if -pad <= cx + ox <= S + pad and -pad <= cy + oy <= S + pad: fn(cx + ox, cy + oy)
def blob(cx, cy, rx, ry, rot, val):
    pts = []
    for k in range(18):
        a = k / 18 * math.tau; r = 1.0 + 0.07 * math.sin(a * 2 + rot * 5) + rnd.uniform(-0.03, 0.03)
        x, y = rx * r * math.cos(a), ry * r * math.sin(a); pts.append((cx + x * math.cos(rot) - y * math.sin(rot), cy + x * math.sin(rot) + y * math.cos(rot)))
    d.polygon(pts, fill=val)
# jittered grid of rosette centres (4 x 4 per tile) so the pattern is even but irregular
G = 4; cell = S / G; centres = []
for i in range(G):
    for j in range(G):
        centres.append(((i + 0.5 + rnd.uniform(-0.22, 0.22) + (0.5 if j % 2 else 0.0)) * cell % S, (j + 0.5 + rnd.uniform(-0.2, 0.2)) * cell))
for (cx, cy) in centres:
    R = rnd.uniform(62, 80); n = rnd.randint(10, 13); rot0 = rnd.uniform(0, math.tau)
    wrapped(lambda x, y: d.ellipse((x - R + 8, y - R + 8, x + R - 8, y + R - 8), fill=200), cx, cy, R + 40)           # darker fur inside the ring
    for k in range(n):
        a = rot0 + k / n * math.tau + rnd.uniform(-0.15, 0.15); rr = R * rnd.uniform(0.92, 1.08)
        bx, by = cx + math.cos(a) * rr, cy + math.sin(a) * rr; sx = rnd.uniform(24, 34); sy = rnd.uniform(8, 13); rot = a + math.pi / 2 + rnd.uniform(-0.25, 0.25)
        wrapped(lambda x, y: blob(x, y, sx, sy, rot, 18), bx, by, 60)
    if rnd.random() < 0.6: wrapped(lambda x, y: blob(x, y, rnd.uniform(7, 11), rnd.uniform(6, 9), rnd.uniform(0, 3), 40), cx + rnd.uniform(-10, 10), cy + rnd.uniform(-10, 10), 30)    # centre dot
# solid spots between the rosettes
for _ in range(80):
    x, y = rnd.uniform(0, S), rnd.uniform(0, S)
    if min(math.hypot(((x - c[0] + S / 2) % S) - S / 2, ((y - c[1] + S / 2) % S) - S / 2) for c in centres) < 112: continue
    rx = rnd.uniform(7, 15); ry = rx * rnd.uniform(0.6, 1.0); rot = rnd.uniform(0, math.tau)
    wrapped(lambda xx, yy: blob(xx, yy, rx, ry, rot, 20), x, y, 40)
img = img.filter(ImageFilter.GaussianBlur(1.6))
a = np.asarray(img, np.float32) / 255.0
rng = np.random.default_rng(3); n = np.zeros_like(a)
for sc, w in ((6, 0.5), (22, 0.3)):
    q = rng.standard_normal((S // sc + 2, S // sc + 2)).astype(np.float32); q = np.asarray(Image.fromarray(q).resize((S, S), Image.BICUBIC)); n += q * w
a = np.clip(a * (1.0 + 0.045 * n / (n.std() + 1e-6)), 0, 1)
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex', 'jaguar_coat.png')
Image.fromarray((np.stack([a, a, a], -1) * 255).astype(np.uint8)).save(out); print('wrote', out)
