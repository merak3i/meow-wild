# Cutouts

How the 19 species photographs became the cutouts that lift off the page.

| Output | What it is |
| --- | --- |
| `public/cats/<id>.webp` | RGBA cutout. Fur edges are decontaminated (background colour removed from semi-transparent pixels with pymatting), and edges where the photo's frame cropped the animal dissolve. |
| `public/cats/aux/<id>.webp` | Relief map, 320 px on the long edge: R, G = surface normal x, y (0.5 is flat), B = depth (near is 1). The living-photo shader (`src/lib/world/living.ts`) relights and parallaxes the photo with it. |
| `src/lib/catImages.ts` | Cutout sizes for `next/image`. Generated, do not edit. |

## Run

```bash
scripts/cutouts/originals.sh            # the full photos, from commit 4ac84f3, into work/orig
python3 scripts/cutouts/segment.py      # BiRefNet soft masks into work/masks
python3 scripts/cutouts/depth.py        # Depth Anything V2 depth into work/depth
python3 scripts/cutouts/finish.py       # cutouts, relief maps, catImages.ts
python3 scripts/cutouts/grid.py /tmp/rigs   # every cutout on a grid with its rig drawn over it
```

Each step takes cat ids to redo only those (`python3 scripts/cutouts/finish.py puma`).
`finish.py --out DIR` writes somewhere else and leaves the site alone, for comparing a change first.
Everything under `scripts/cutouts/work/` is ignored by git.

Running the pipeline as committed reproduces the shipped files byte for byte.

## Setup

CPU only; no GPU needed.

```bash
mkdir -p scripts/cutouts/work/models
git clone https://github.com/ZhengPeng7/BiRefNet scripts/cutouts/work/BiRefNet   # used at 97e4f35
curl -L -o scripts/cutouts/work/models/BiRefNet-general-epoch_244.pth \
  https://github.com/ZhengPeng7/BiRefNet/releases/download/v1/BiRefNet-general-epoch_244.pth
curl -L -o scripts/cutouts/work/models/depth_anything_v2_vitb.onnx \
  https://github.com/fabio-sim/Depth-Anything-ONNX/releases/download/v2.0.0/depth_anything_v2_vitb.onnx
pip install torch torchvision timm einops kornia huggingface_hub tqdm \
  onnxruntime numpy pillow scipy pymatting opencv-contrib-python matplotlib
```

`opencv-contrib-python` is for the guided filter (`cv2.ximgproc`) in the leopard's branch; `matplotlib` only for polygon fixes.

### Model licences

- BiRefNet (Zheng et al. 2024): MIT.
- Depth Anything V2 (Yang et al. 2024): the ViT-B weights used here are CC BY-NC 4.0, like the site's other non-commercial assets. For commercial use, regenerate the relief maps with the ViT-S export from the same release (`depth_anything_v2_vits.onnx`, Apache 2.0) and check them.

## Per-species fixes: `ops.json`

Background removal keeps whatever the animal touches. Each entry fixes one cat; all numbers are fractions of the original photo (x right, y down).

| Key | Does |
| --- | --- |
| `tree_depth: {t, vignette: [cx, cy, rx, ry], soft}` | Brings back the branch the animal lies on: depth above `t` connected to the animal, snapped to the bark with a guided filter, faded out with an ellipse. |
| `open_region: [[x0, x1, y0, y1, r]]` | Inside the box, a grey opening of the alpha with radius `r` px: removes thin strays such as twigs. |
| `cut: [[x0, x1, y0, y1]]` | Clears a box. |
| `poly: [[[x, y], ...]]` | Clears inside a polygon. |
| `min_part` | Keeps separate pieces at least this share of the largest (default 0.03), so a tail tip survives and specks do not. |
| `fade_y: [[y0, y1, x0, x1]]` | Fades out downward from `y0` to `y1`, optionally only between `x0` and `x1`: a cat rising out of grass. |
| `fade_line: [[x0, y0, x1, y1, width]]` | Fades out below a slanted line over `width`. |
| `bottom` | Fades this share of the height at the bottom. |
| `scale` | Resizes the final cutout. |

## Rigs

`src/lib/rigs.ts` holds a hand-placed rig per cat (breathing chest, head and neck pivot, eyes, ears, tail, feet) in fractions of the cutout. After changing a cutout's crop, run `grid.py` and move the rig points to match.
