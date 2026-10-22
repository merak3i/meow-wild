"""Draw each cutout on a labelled grid, with its rig from src/lib/rigs.ts on top.

Rig points are fractions of the cutout, so placing a new rig is a matter of
reading coordinates off this sheet. Breath ellipse cyan, head orange (dot =
neck pivot), eyes magenta, ears green, tail red, body pivot white.

usage: python3 grid.py OUTDIR [id ...] [--no-rig]   (needs node >= 22.6 for the rigs)
"""
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
CATS = os.path.join(ROOT, "public", "cats")


def load_rigs():
    js = "import('./src/lib/rigs.ts').then((m) => process.stdout.write(JSON.stringify(m.RIGS)))"
    out = subprocess.run(["node", "--experimental-strip-types", "--no-warnings", "-e", js], cwd=ROOT, capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def main():
    args = [a for a in sys.argv[1:] if a != "--no-rig"]
    outdir, ids = args[0], args[1:] or sorted(f[:-5] for f in os.listdir(CATS) if f.endswith(".webp"))
    os.makedirs(outdir, exist_ok=True)
    rigs = {} if "--no-rig" in sys.argv else load_rigs()
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 13)
    except OSError:
        font = ImageFont.load_default()
    for cid in ids:
        im = Image.open(os.path.join(CATS, f"{cid}.webp")).convert("RGBA")
        S = 860 / max(im.size)
        im = im.resize((round(im.width * S), round(im.height * S)), Image.LANCZOS)
        W, H = im.size
        pad = 34
        bg = Image.new("RGBA", (W + pad * 2, H + pad * 2), (58, 62, 70, 255))
        bg.alpha_composite(im, (pad, pad))
        d = ImageDraw.Draw(bg)
        for k in range(21):
            f = k / 20
            x, y = pad + f * W, pad + f * H
            major = k % 2 == 0
            col = (255, 255, 0, 150) if major else (255, 255, 255, 60)
            d.line([(x, pad), (x, pad + H)], fill=col, width=1)
            d.line([(pad, y), (pad + W, y)], fill=col, width=1)
            if major:
                d.text((x - 8, 4), f"{f:.1f}", fill=(255, 255, 0, 255), font=font)
                d.text((2, y - 7), f"{f:.1f}", fill=(255, 255, 0, 255), font=font)
        r = rigs.get(cid)
        if r:
            def A(p):
                return (pad + p[0] * W, pad + p[1] * H)

            # radii and widths are in units of the cutout's height
            bx, by, rx, ry = r["breath"]
            cx, cy = A((bx, by))
            d.ellipse([cx - rx * H, cy - ry * H, cx + rx * H, cy + ry * H], outline=(0, 255, 255, 255), width=2)
            if "head" in r:
                hd = r["head"]
                hx, hy = A(hd["center"])
                d.ellipse([hx - hd["r"] * H, hy - hd["r"] * H, hx + hd["r"] * H, hy + hd["r"] * H], outline=(255, 120, 0, 255), width=2)
                px, py = A(hd["pivot"])
                d.ellipse([px - 5, py - 5, px + 5, py + 5], fill=(255, 120, 0, 255))
            for e in r.get("eyes", []):
                ex, ey = A((e[0], e[1]))
                d.ellipse([ex - e[2] * H, ey - e[3] * H, ex + e[2] * H, ey + e[3] * H], outline=(255, 0, 255, 255), width=2)
            for ear in r.get("ears", []):
                d.line([A(ear["base"]), A(ear["tip"])], fill=(0, 255, 0, 255), width=3)
                b = A(ear["base"])
                d.ellipse([b[0] - 4, b[1] - 4, b[0] + 4, b[1] + 4], fill=(0, 255, 0, 255))
            if "tail" in r:
                pts = [A(p) for p in r["tail"]["pts"]]
                d.line(pts, fill=(255, 60, 60, 255), width=3)
                for p in pts:
                    d.ellipse([p[0] - 4, p[1] - 4, p[0] + 4, p[1] + 4], fill=(255, 60, 60, 255))
            if "pivot" in r:
                p = A(r["pivot"])
                d.rectangle([p[0] - 5, p[1] - 5, p[0] + 5, p[1] + 5], outline=(255, 255, 255, 255), width=2)
        bg.convert("RGB").save(os.path.join(outdir, f"{cid}.jpg"), quality=86)
        print(cid)


if __name__ == "__main__":
    main()
