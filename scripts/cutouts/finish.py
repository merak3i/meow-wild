"""Turn the photos, masks and depth maps into the shipped cutouts.

public/cats/<id>.webp       RGBA cutout, fur edges decontaminated (pymatting)
public/cats/aux/<id>.webp   R, G = surface normal x, y (0.5 = flat), B = depth (near = 1);
                            320 px on the long edge, read by the living-photo shader
src/lib/catImages.ts        cutout sizes for next/image

Per-species fixes come from ops.json (fractions of the original photo; see README.md).

usage: python3 finish.py [id ...] [--out DIR]
       --out writes DIR/<id>.webp and DIR/aux/<id>.webp instead and leaves
       public/ and catImages.ts alone (for comparing a change before shipping it)
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from pymatting import estimate_foreground_ml

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
D = os.path.join(HERE, "work")
args = sys.argv[1:]
OUT = os.path.join(ROOT, "public", "cats")
if "--out" in args:
    i = args.index("--out")
    OUT = os.path.abspath(args[i + 1])
    args = args[:i] + args[i + 2:]
SHIP = OUT == os.path.join(ROOT, "public", "cats")
os.makedirs(os.path.join(OUT, "aux"), exist_ok=True)


def load_ops():
    return json.load(open(os.path.join(HERE, "ops.json")))


def process(cid, ops):
    im = Image.open(os.path.join(D, "orig", f"{cid}.webp")).convert("RGB")
    W, H = im.size
    rgb = np.asarray(im).astype(np.float64) / 255.0
    al = np.asarray(Image.open(os.path.join(D, "masks", f"{cid}.png"))).astype(np.float64) / 255.0
    o = ops.get(cid, {})
    yy, xx = np.mgrid[0:H, 0:W]
    fx, fy = xx / W, yy / H

    # bring in the tree the animal lies on: near surfaces (depth) connected to it, snapped to the
    # bark edges with a guided filter, faded out with an elliptical vignette around the animal
    if "tree_depth" in o:
        import cv2
        td = o["tree_depth"]
        dep = np.asarray(Image.open(os.path.join(D, "depth", f"{cid}.png"))).astype(np.float64) / 65535.0
        near = dep > td["t"]
        lab, n = ndi.label(near)
        ids_ = [i for i in np.unique(lab[(al > 0.5) & (lab > 0)]) if i > 0]
        tree = np.isin(lab, ids_).astype(np.float32)
        guide = (rgb * 255).astype(np.uint8)
        tree = cv2.ximgproc.guidedFilter(guide, tree, radius=6, eps=1e-3 * 255 * 255 * 0.02)
        tree = np.clip((tree - 0.25) / 0.5, 0, 1).astype(np.float64)
        cx, cy, rx, ry = td["vignette"]
        v = np.sqrt(((fx - cx) / rx) ** 2 + ((fy - cy) / ry) ** 2)
        vig = np.clip((1.0 - v) / td.get("soft", 0.35), 0, 1) ** 1.2
        al = np.maximum(al, tree * vig)

    # remove thin strays (twigs) in a region with a grey opening of the alpha
    for (x0, x1, y0, y1, r) in o.get("open_region", []):
        region = ((fx >= x0) & (fx <= x1) & (fy >= y0) & (fy <= y1)).astype(np.float64)
        region = ndi.gaussian_filter(region, 3)
        opened = ndi.grey_opening(al, footprint=np.hypot(*np.mgrid[-r:r + 1, -r:r + 1]) <= r)
        al = al * (1 - region) + np.minimum(al, opened + 0.02) * region

    # clear rectangles (supports, foliage) with a soft edge
    for (x0, x1, y0, y1) in o.get("cut", []):
        r = ((fx >= x0) & (fx <= x1) & (fy >= y0) & (fy <= y1)).astype(np.float64)
        r = ndi.gaussian_filter(r, 2.0)
        al = al * (1 - r)
    # polygons are expressed as lists of points; cleared inside
    for poly in o.get("poly", []):
        from matplotlib.path import Path
        path = Path(np.array(poly) * [W, H])
        inside = path.contains_points(np.stack([xx.ravel() + 0.5, yy.ravel() + 0.5], 1)).reshape(H, W).astype(np.float64)
        inside = ndi.gaussian_filter(inside, 1.5)
        al = al * (1 - inside)

    # keep the animal: largest component and big neighbours (a separated tail tip)
    m = al > 0.3
    lab, n = ndi.label(m)
    if n > 1:
        sizes = ndi.sum(m, lab, range(1, n + 1))
        keep_ids = [i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * o.get("min_part", 0.03)]
        keep = ndi.binary_dilation(np.isin(lab, keep_ids), iterations=3)
        keep = ndi.gaussian_filter(keep.astype(np.float64), 1.2)
        al = al * keep

    # dissolve edges where the frame crops the animal (left, right, top); bottom handled in CSS/GL
    for side in ("l", "r", "t"):
        band = {"l": al[:, :3], "r": al[:, -3:], "t": al[:3, :]}[side]
        if (band > 0.5).mean() > 0.02:
            fw = max(8, int((W if side != "t" else H) * 0.08))
            ramp = np.linspace(0, 1, fw) ** 1.3
            if side == "l":
                al[:, :fw] *= ramp[None, :]
            elif side == "r":
                al[:, -fw:] *= ramp[::-1][None, :]
            else:
                al[:fw, :] *= ramp[:, None]
    # vertical fades (optionally limited to an x range): a cat rising out of leaves or grass
    for fz in o.get("fade_y", []):
        y0f, y1f = fz[0], fz[1]
        x0f, x1f = (fz[2], fz[3]) if len(fz) > 2 else (-1.0, 2.0)
        t = np.clip((fy - y0f) / max(1e-4, y1f - y0f), 0, 1)
        t = t * t * (3 - 2 * t)
        xs_ = np.clip((fx - x0f) / 0.06, 0, 1) * np.clip((x1f - fx) / 0.06, 0, 1)
        al = al * (1 - t * xs_)
    # fade below a slanted line (x0, y0) -> (x1, y1) over a band of the given width
    for (lx0, ly0, lx1, ly1, wd) in o.get("fade_line", []):
        ex, ey = lx1 - lx0, ly1 - ly0
        L = np.hypot(ex, ey)
        nx_, ny_ = -ey / L, ex / L
        if ny_ < 0:
            nx_, ny_ = -nx_, -ny_
        dist = (fx - lx0) * nx_ + (fy - ly0) * ny_
        t = np.clip(dist / wd, 0, 1)
        al = al * (1 - t * t * (3 - 2 * t))
    if o.get("bottom"):
        fb = int(H * o["bottom"])
        al[-fb:, :] *= (np.linspace(1, 0, fb) ** 1.5)[:, None]

    al = np.clip(al, 0, 1)
    al[al < 0.012] = 0

    # foreground colour estimation removes background spill from fur edges
    fg = estimate_foreground_ml(rgb, al, regularization=1e-5, n_small_iterations=10, n_big_iterations=2)
    fg = np.clip(fg, 0, 1)

    # crop to content
    ys, xs = np.where(al > 0.025)
    pad = 4
    x0, x1 = max(0, xs.min() - pad), min(W, xs.max() + 1 + pad)
    y0, y1 = max(0, ys.min() - pad), min(H, ys.max() + 1 + pad)
    a8 = (al[y0:y1, x0:x1] * 255 + 0.5).astype(np.uint8)
    f8 = (fg[y0:y1, x0:x1] * 255 + 0.5).astype(np.uint8)
    # transparent pixels carry the edge colour outward (better filtering and mipmaps)
    inv = a8 < 8
    if inv.any():
        idx = ndi.distance_transform_edt(inv, return_distances=False, return_indices=True)
        f8 = f8[idx[0], idx[1]]
    out = Image.fromarray(np.dstack([f8, a8]), "RGBA")
    scale = o.get("scale", 1.0)
    if scale != 1.0:
        out = out.resize((round(out.width * scale), round(out.height * scale)), Image.LANCZOS)
    out.save(os.path.join(OUT, f"{cid}.webp"), "WEBP", quality=90, alpha_quality=100, method=6, exact=True)

    # ---- aux: normals + depth ----
    dep = np.asarray(Image.open(os.path.join(D, "depth", f"{cid}.png"))).astype(np.float64) / 65535.0
    dep = dep[y0:y1, x0:x1]
    ac = al[y0:y1, x0:x1]
    inside = ac > 0.5
    if inside.sum() > 50:
        lo, hi = np.percentile(dep[inside], [3, 97])
        dep = np.clip((dep - lo) / max(1e-4, hi - lo), 0, 1)
    # carry the cat's own depth outward so the silhouette has no false cliff
    if (~inside).any() and inside.any():
        idx = ndi.distance_transform_edt(~inside, return_distances=False, return_indices=True)
        dep = dep[idx[0], idx[1]]
    hgt = ac.shape[0]
    ds = ndi.gaussian_filter(dep, max(1.5, hgt / 260))
    gy, gx = np.gradient(ds)
    k = hgt * 0.9
    ab = ndi.gaussian_filter(ac, max(2.0, hgt / 70))
    ay, ax = np.gradient(ab)
    ka = hgt * 0.18
    nx = -gx * k - ax * ka
    ny = gy * k + ay * ka
    nl = np.sqrt(nx * nx + ny * ny + 1.0)
    nx, ny = nx / nl, ny / nl
    aux = np.dstack([
        (nx * 0.5 + 0.5) * 255,
        (ny * 0.5 + 0.5) * 255,
        dep * 255,
        np.full_like(dep, 255),
    ]).clip(0, 255).astype(np.uint8)
    auxim = Image.fromarray(aux[..., :3], "RGB")
    k = 320 / max(out.width, out.height)
    aw = max(48, round(out.width * k))
    ah = max(48, round(out.height * k))
    auxim.resize((aw, ah), Image.LANCZOS).save(os.path.join(OUT, "aux", f"{cid}.webp"), "WEBP", quality=90, method=6, use_sharp_yuv=True)
    return {"crop": [int(x0), int(y0), int(x1), int(y1)], "size": [out.width, out.height], "orig": [W, H]}


def write_image_data():
    """src/lib/catImages.ts from whatever cutouts are in public/cats."""
    cats = os.path.join(ROOT, "public", "cats")
    rows = []
    for f in sorted(os.listdir(cats)):
        if f.endswith(".webp"):
            w, h = Image.open(os.path.join(cats, f)).size
            cid = f[:-5]
            rows.append(f'  "{cid}": {{ src: "/cats/{cid}.webp", width: {w}, height: {h} }},')
    ts = (
        "// AUTO-GENERATED by scripts/cutouts/finish.py, do not edit by hand.\n\n"
        "export interface CatImage {\n  src: string;\n  width: number;\n  height: number;\n}\n\n"
        "export const CAT_IMAGES: Record<string, CatImage> = {\n" + "\n".join(rows) + "\n};\n"
    )
    with open(os.path.join(ROOT, "src", "lib", "catImages.ts"), "w") as fh:
        fh.write(ts)
    print("wrote src/lib/catImages.ts")


def main():
    ops = load_ops()
    ids = args or sorted(f[:-4] for f in os.listdir(os.path.join(D, "masks")) if f.endswith(".png"))
    for cid in ids:
        info = process(cid, ops)
        print(cid, info["size"], "from crop", info["crop"], flush=True)
    if SHIP:
        write_image_data()


if __name__ == "__main__":
    main()
