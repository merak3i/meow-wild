"""Draw the paw cursor (rest and tap) as SVG and rasterise crisp 1x/2x PNGs with Chromium.

    python3 scripts/cursor/paw.py

Writes public/cursor/{paw,paw-tap}.svg and {paw,paw-tap}{,@2x}.png. The hotspot is the
tip of the leading toe, (7, 7) in the 32 px image, which globals.css passes to `cursor`.
"""
import math
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parents[2] / "public" / "cursor"
ROT = -22  # degrees: the paw leans so its upper-left toe leads, like an arrow tip
CX, CY = 32, 34  # rotation centre in the 64 viewBox
TOES = [(14.5, 27.0, 5.6, 7.2, -28), (24.2, 15.8, 6.1, 7.9, -9), (39.8, 15.8, 6.1, 7.9, 9), (49.5, 27.0, 5.6, 7.2, 28)]
PAD = ("M32 30.5 C38.5 30.5 43.5 35.5 47.2 41.2 C50.4 46.1 49.6 52.6 44.2 54.2 C40.6 55.3 37.2 53.2 32 53.2 "
       "C26.8 53.2 23.4 55.3 19.8 54.2 C14.4 52.6 13.6 46.1 16.8 41.2 C20.5 35.5 25.5 30.5 32 30.5 Z")


def paw(fill: str, ink: str, scale: float = 1.0, size: int = 64) -> str:
    parts = [
        f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" transform="rotate({a} {x} {y})" fill="{fill}" stroke="{ink}" stroke-width="2.6"/>'
        for (x, y, rx, ry, a) in TOES
    ]
    parts.append(f'<path d="{PAD}" fill="{fill}" stroke="{ink}" stroke-width="2.6" stroke-linejoin="round"/>')
    body = "".join(parts)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="{size}" height="{size}">'
            f'<g transform="rotate({ROT} {CX} {CY}) translate({CX} {CY}) scale({scale}) translate({-CX} {-CY})">{body}</g></svg>\n')


def hotspot() -> tuple[float, float]:
    x, y, _, ry, a = TOES[1]
    tip = (x + math.sin(math.radians(a)) * ry, y - math.cos(math.radians(a)) * ry)
    r = math.radians(ROT)
    dx, dy = tip[0] - CX, tip[1] - CY
    return CX + dx * math.cos(r) - dy * math.sin(r), CY + dx * math.sin(r) + dy * math.cos(r)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    looks = {"paw": ("#f6efe3", 1.0), "paw-tap": ("#f4a9b8", 0.94)}
    ink = "#17181d"
    for name, (fill, scale) in looks.items():
        (OUT / f"{name}.svg").write_text(paw(fill, ink, scale))
    hx, hy = hotspot()
    print(f"hotspot {hx / 2:.1f}, {hy / 2:.1f} in the 32 px image")
    exe = os.environ.get("CHROME", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=exe)
        for name, (fill, scale) in looks.items():
            for dsf, suffix in ((1, ""), (2, "@2x")):
                pg = b.new_page(viewport={"width": 32, "height": 32}, device_scale_factor=dsf)
                pg.set_content(f'<html><body style="margin:0;background:transparent">{paw(fill, ink, scale, 32)}</body></html>')
                pg.screenshot(path=str(OUT / f"{name}{suffix}.png"), omit_background=True, clip={"x": 0, "y": 0, "width": 32, "height": 32})
                pg.close()
        b.close()


if __name__ == "__main__":
    main()
