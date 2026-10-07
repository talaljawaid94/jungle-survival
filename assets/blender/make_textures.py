# Survivor texture set derived from MPFB2 CC0 base textures (tan skin, worn khaki shirt, dirty trousers, boots).
import numpy as np, os, random
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter
D = "/Users/talaljawaid/Library/Application Support/Blender/5.2/extensions/.user/user_default/mpfb/data/"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tex"); os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7); random.seed(7)

def noise(h, w, scales=(6, 18, 60, 160), weights=(0.25, 0.3, 0.3, 0.15)):
    out = np.zeros((h, w), np.float32)
    for s, wt in zip(scales, weights):
        n = gaussian_filter(rng.standard_normal((h, w)).astype(np.float32), s); n /= (n.std() + 1e-6); out += n * wt
    return out
def load(p): return np.asarray(Image.open(p).convert('RGB'), np.float32) / 255.0
def save(a, name): Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).save(os.path.join(OUT, name)); print('wrote', name)
def lum(a): return (a * np.array([0.3, 0.59, 0.11], np.float32)).sum(-1, keepdims=True)

# ---------------- skin
s = load(D + "skins/young_caucasian_male/young_lightskinned_male_diffuse.png"); H, W, _ = s.shape
tan = np.array([0.88, 0.74, 0.64], np.float32)
s = s * tan + np.array([0.02, 0.0, -0.01], np.float32)
face = np.zeros((H, W, 1), np.float32); face[int(H * 0.17):int(H * 0.80), int(W * 0.63):int(W * 0.99)] = 1; face = gaussian_filter(face[..., 0], 40)[..., None]
s = s * (1 - face * 0.12 * np.array([0, 1, 1], np.float32))                       # sunburn on face
dirt = np.clip(noise(H, W, (12, 40, 120), (0.3, 0.4, 0.3)) * 0.5 + 0.1, 0, 1)[..., None]
s = s * (1 - dirt * 0.28 * np.array([0.35, 0.55, 0.8], np.float32)) 
img = Image.fromarray((np.clip(s, 0, 1) * 255).astype(np.uint8)); d = ImageDraw.Draw(img)
for _ in range(14):                                                               # scratches on arms/torso
    x = random.randint(20, int(W * 0.6)); y = random.randint(int(H * 0.04), int(H * 0.45)); L = random.randint(25, 70)
    d.line([(x, y), (x + L, y + random.randint(-14, 14))], fill=(150, 70, 60), width=2)
for _ in range(0):                                                                # bruises (disabled: UV placement is unpredictable)
    x = random.randint(40, int(W * 0.5)); y = random.randint(int(H * 0.05), int(H * 0.3)); r = random.randint(30, 60)
    d.ellipse([x - r, y - r // 2, x + r, y + r // 2], fill=(120, 84, 104))
sk = np.asarray(img, np.float32) / 255
sk = gaussian_filter(sk, (1.2, 1.2, 0)) * 0.55 + np.asarray(Image.fromarray((np.clip(s, 0, 1) * 255).astype(np.uint8)), np.float32) / 255 * 0.45
save(sk, 'skin_surv.png')

# ---------------- t-shirt + trousers (single atlas, casualsuit06: tee in the top half, jeans in the bottom half)
c = load(D + "clothes/male_casualsuit06/male_casualsuit06_diffuse.png"); H, W, _ = c.shape
yy = np.arange(H)[:, None] / H
top = np.broadcast_to(yy < 0.47, (H, W))
fiber = 1 + noise(H, W, (0.7, 1.6), (0.6, 0.4))[..., None] * 0.07
tee_base = np.array([0.36, 0.36, 0.22], np.float32)                                       # faded olive tee
sweat = np.clip(noise(H, W, (25, 70), (0.6, 0.4)) * 0.6, 0, 1)[..., None]
tee = tee_base * fiber * (1 - sweat * 0.30)
tee = tee * (1 - np.clip(noise(H, W, (15, 50, 130), (0.3, 0.4, 0.3)) * 0.5 + 0.25, 0, 1)[..., None] * 0.35) + np.array([0.18, 0.14, 0.09], np.float32) * np.clip(noise(H, W, (20, 80), (0.5, 0.5)) * 0.5 + 0.2, 0, 1)[..., None] * 0.35
den = lum(c) * np.array([0.42, 0.50, 0.62], np.float32) * 0.8 + 0.015
wear = np.clip(noise(H, W, (10, 40, 120), (0.3, 0.4, 0.3)) * 0.5 + 0.35, 0, 1)[..., None]
den = den * (1 - wear * 0.35) + np.array([0.30, 0.23, 0.15], np.float32) * wear * 0.25
out = np.where(top[..., None], tee, den)
save(out, 'suit_surv.png')

# ---------------- boots (recolor shoes04)
b = load(D + "clothes/shoes04/shoes04_diffuse.png"); H, W, _ = b.shape
bl = lum(b); bw = np.clip(noise(H, W, (8, 30, 90), (0.3, 0.4, 0.3)) * 0.5 + 0.4, 0, 1)[..., None]
boots = bl * np.array([0.55, 0.38, 0.24], np.float32) * 2.7 + 0.04
boots = boots * (1 - bw * 0.4) + np.array([0.33, 0.27, 0.19], np.float32) * bw * 0.35
save(boots, 'boots_surv.png')

# ---------------- gear textures (canvas pack, leather, bandage, hat)
def weave(h, w, base, warp=0.08):
    y, x = np.mgrid[0:h, 0:w]; p = ((np.sin(x * 1.1) + np.sin(y * 1.1)) * 0.5)[..., None].astype(np.float32)
    return np.array(base, np.float32) * (1 + p * warp)
def grime(h, w, base, soil, amt=0.5):
    g = np.clip(noise(h, w, (8, 30, 100), (0.3, 0.4, 0.3)) * 0.5 + 0.35, 0, 1)[..., None] * amt
    return base * (1 - g * 0.4) + np.array(soil, np.float32) * g * 0.3
cvs = grime(1024, 1024, weave(1024, 1024, (0.30, 0.22, 0.09), 0.10) * (1 + noise(1024, 1024, (0.8, 2), (0.5, 0.5))[..., None] * 0.05), (0.28, 0.20, 0.10), 0.9); save(cvs, 'pack_canvas.png')
lt = grime(512, 512, np.array((0.26, 0.15, 0.08), np.float32) * (1 + noise(512, 512, (1.2, 4, 12), (0.4, 0.4, 0.2))[..., None] * 0.12), (0.36, 0.27, 0.18), 0.6); save(lt, 'leather.png')
bd = grime(256, 256, weave(256, 256, (0.78, 0.74, 0.64), 0.06), (0.35, 0.28, 0.2), 0.7)
img = Image.fromarray((np.clip(bd, 0, 1) * 255).astype(np.uint8)); dd = ImageDraw.Draw(img)
for _ in range(7):
    x = random.randint(20, 230); y = random.randint(20, 230); r = random.randint(6, 22); dd.ellipse([x - r, y - r // 2, x + r, y + r // 2], fill=(110, 28, 22))
img.filter(__import__('PIL.ImageFilter', fromlist=['x']).GaussianBlur(2)).save(os.path.join(OUT, 'bandage.png')); print('wrote bandage.png')
h = load(D + "clothes/fedora01/fedora_diffuse.png"); H, W, _ = h.shape
hat = lum(h) * np.array([0.78, 0.50, 0.26], np.float32) * 1.15 + 0.005
hg = np.clip(noise(H, W, (10, 40, 120), (0.3, 0.4, 0.3)) * 0.5 + 0.35, 0, 1)[..., None]
hat = hat * (1 - hg * 0.42) + np.array([0.35, 0.28, 0.2], np.float32) * hg * 0.3; save(hat, 'hat_surv.png')

bs = grime(512, 512, np.array((0.36, 0.21, 0.11), np.float32) * (1 + noise(512, 512, (1.2, 4, 12, 40), (0.3, 0.3, 0.2, 0.2))[..., None] * 0.14), (0.40, 0.32, 0.22), 0.8); save(bs, 'boots_shaft.png')
