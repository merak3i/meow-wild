"""Clean the species cutouts in public/cats.

Removes leftover scenery from the background removal (leaves, twigs, a patch
of snow), drops stray specks, dissolves edges where the original photo cropped
the animal, and regenerates src/lib/catImages.ts with the new dimensions.

usage: python3 scripts/clean_cutouts.py [--out DIR]   (default: overwrite public/cats)
"""
import colorsys
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.join(os.path.dirname(__file__), "..")
SRC = os.path.join(ROOT, "public", "cats")
OUT = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else SRC

# per-species fixes
OPS = {
    # leaves cover its lower chest: let it rise out of the mist as a portrait instead
    "clouded-leopard": {"bottom": 0.42},
    # the twig hanging below its belly
    "eurasian-lynx": {"open_region": [(0.7, 0.81, 0.83, 1.0, 6)]},
    # a lump of snow and ice between its front legs
    "snow-leopard": {"snowpatch": (0.12, 0.58, 0.44, 0.73)},
    # the rock it lies on
    "fishing-cat": {"bottom": 0.2},
    "leopard": {"open": 1},
    "sand-cat": {"open": 1},
}


def hsv_arrays(rgb):
    r, g, b = [rgb[..., i] / 255.0 for i in range(3)]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    d = mx - mn + 1e-6
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6.0
    s = np.where(mx > 0, d / (mx + 1e-6), 0)
    return h, s, mx


def clean(cid):
    im = Image.open(os.path.join(SRC, f"{cid}.webp")).convert("RGBA")
    a = np.array(im).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3]
    h, w = al.shape
    ops = OPS.get(cid, {})
    yy, xx = np.mgrid[0:h, 0:w]
    fx, fy = xx / w, yy / h

    if "green" in ops:
        x0, x1, y0, y1 = ops["green"]
        hue, sat, val = hsv_arrays(rgb)
        leaf = (hue > 0.17) & (hue < 0.47) & (sat > 0.22) & (val > 0.08)
        region = (fx >= x0) & (fx <= x1) & (fy >= y0) & (fy <= y1)
        leaf = ndi.binary_dilation(leaf & region, iterations=3) & region
        al[leaf] = 0

    if "snowpatch" in ops:
        x0, x1, y0, y1 = ops["snowpatch"]
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        bright = (r + g + b) / 3
        region = (fx >= x0) & (fx <= x1) & (fy >= y0) & (fy <= y1)
        snow = (b - r > -8) & (bright > 90) & region
        snow = ndi.binary_closing(snow, iterations=3) & region
        snow = ndi.binary_dilation(snow, iterations=2) & region
        al[snow] = 0

    for (x0, x1, y0, y1, it) in ops.get("open_region", []):
        region = (fx >= x0) & (fx <= x1) & (fy >= y0) & (fy <= y1)
        m = al > 40
        st = ndi.generate_binary_structure(2, 1)
        opened = ndi.binary_dilation(ndi.binary_opening(m, structure=st, iterations=it), structure=st, iterations=it + 1)
        al = np.where(region, al * opened, al)

    if ops.get("open"):
        m = al > 40
        st = ndi.generate_binary_structure(2, 1)
        opened = ndi.binary_opening(m, structure=st, iterations=ops["open"])
        keep = ndi.binary_dilation(opened, structure=st, iterations=ops["open"] + 1)
        al = al * keep

    # keep the animal: largest component plus large neighbours (a separated tail tip)
    m = al > 40
    lab, n = ndi.label(m)
    if n > 1:
        sizes = ndi.sum(m, lab, range(1, n + 1))
        keep_ids = [i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * 0.04]
        keep = ndi.binary_dilation(np.isin(lab, keep_ids), iterations=2)
        al = al * keep

    # dissolve edges where the original frame cropped the animal (bottom is masked in CSS)
    fw_x = max(8, int(w * 0.09))
    fw_y = max(8, int(h * 0.09))
    ramp_x = np.linspace(0, 1, fw_x) ** 1.3
    ramp_y = np.linspace(0, 1, fw_y) ** 1.3
    if (al[:, :2] > 128).mean() > 0.02:
        al[:, :fw_x] *= ramp_x[None, :]
    if (al[:, -2:] > 128).mean() > 0.02:
        al[:, -fw_x:] *= ramp_x[::-1][None, :]
    if (al[:2, :] > 128).mean() > 0.02:
        al[:fw_y, :] *= ramp_y[:, None]
    if ops.get("bottom"):
        fb = int(h * ops["bottom"])
        al[-fb:, :] *= (np.linspace(1, 0, fb) ** 1.6)[:, None]

    # tidy the matte: knock back the outermost halo a touch
    al = ndi.grey_erosion(al, size=(2, 2)) * 0.35 + al * 0.65

    out = np.dstack([rgb, np.clip(al, 0, 255)]).astype(np.uint8)
    img = Image.fromarray(out, "RGBA")
    bbox = img.getchannel("A").point(lambda v: 255 if v > 6 else 0).getbbox()
    if bbox:
        l, t, r, b = bbox
        img = img.crop((max(0, l - 2), max(0, t - 2), min(w, r + 2), min(h, b + 2)))
    os.makedirs(OUT, exist_ok=True)
    img.save(os.path.join(OUT, f"{cid}.webp"), "WEBP", quality=90, alpha_quality=100, method=6)
    return img.size


def main():
    ids = sorted(f[:-5] for f in os.listdir(SRC) if f.endswith(".webp"))
    rows = []
    for cid in ids:
        w, h = clean(cid)
        rows.append((cid, w, h))
        print(f"{cid:22s} {w}x{h}")
    if OUT == SRC:
        body = "\n".join(f'  "{cid}": {{ src: "/cats/{cid}.webp", width: {w}, height: {h} }},' for cid, w, h in rows)
        ts = (
            "// AUTO-GENERATED by scripts/clean_cutouts.py, do not edit by hand.\n\n"
            "export interface CatImage {\n  src: string;\n  width: number;\n  height: number;\n}\n\n"
            f"export const CAT_IMAGES: Record<string, CatImage> = {{\n{body}\n}};\n"
        )
        with open(os.path.join(ROOT, "src", "lib", "catImages.ts"), "w") as f:
            f.write(ts)
        print("wrote src/lib/catImages.ts")


if __name__ == "__main__":
    main()
