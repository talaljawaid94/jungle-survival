"""Square (1080x1080) LinkedIn version: the whole 16:9 frame (HUD intact) fitted to the width over a blurred, darkened copy of itself.
   python3 assets/video/square.py <scratch_dir>   (reads <scratch>/vt/c_*.png, writes <scratch>/vsq/c_*.png)"""
import sys, os, glob
from PIL import Image, ImageFilter, ImageEnhance
from concurrent.futures import ProcessPoolExecutor
sp = sys.argv[1]; SRC = sp + '/vt/'; OUT = sp + '/vsq/'; os.makedirs(OUT, exist_ok=True)
def work(p):
    o = OUT + os.path.basename(p)
    if os.path.exists(o): return
    im = Image.open(p).convert('RGB'); w, h = im.size
    bg = im.resize((int(w * 1080 / h), 1080), Image.BILINEAR); x0 = (bg.width - 1080) // 2; bg = bg.crop((x0, 0, x0 + 1080, 1080)).filter(ImageFilter.GaussianBlur(28)); bg = ImageEnhance.Brightness(bg).enhance(0.55)
    fg = im.resize((1080, 608), Image.LANCZOS); bg.paste(fg, (0, (1080 - 608) // 2)); bg.save(o, compress_level=1)
if __name__ == '__main__':
    fs = sorted(glob.glob(SRC + 'c_*.png'))
    with ProcessPoolExecutor(max_workers=6) as ex: list(ex.map(work, fs, chunksize=8))
    print('square frames', len(fs))
