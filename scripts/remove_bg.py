import os
from rembg import remove, new_session
from PIL import Image

SRC = os.path.join(os.path.dirname(__file__), "..", "public", "cats")
OUT = os.path.join(SRC, "cut")
os.makedirs(OUT, exist_ok=True)
session = new_session("isnet-general-use")
ids = sorted(f[:-5] for f in os.listdir(SRC) if f.endswith(".webp"))
for cid in ids:
    img = Image.open(os.path.join(SRC, cid + ".webp")).convert("RGBA")
    out = remove(
        img, session=session, alpha_matting=True,
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=10,
        alpha_matting_erode_size=10,
    )
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    w, h = out.size
    m = max(w, h)
    if m > 1100:
        s = 1100 / m
        out = out.resize((round(w * s), round(h * s)), Image.LANCZOS)
    out.save(os.path.join(OUT, cid + ".webp"), "WEBP", quality=88, method=6)
    print(cid, out.size)
