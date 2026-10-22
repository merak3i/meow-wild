"""Soft foreground masks with BiRefNet (PyTorch, CPU).

Writes work/masks/<id>.png: an 8-bit alpha at the photo's own resolution,
predicted at 1024 x 1024 and resized back with bicubic filtering.

usage: python3 segment.py [id ...]          (default: every photo in work/orig)
env:   BIREFNET_REPO     clone of github.com/ZhengPeng7/BiRefNet (default work/BiRefNet)
       BIREFNET_WEIGHTS  BiRefNet-general-epoch_244.pth (default work/models/)
"""
import os
import sys
import time

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(HERE, "work")
REPO = os.environ.get("BIREFNET_REPO", os.path.join(WORK, "BiRefNet"))
WEIGHTS = os.environ.get("BIREFNET_WEIGHTS", os.path.join(WORK, "models", "BiRefNet-general-epoch_244.pth"))
SIZE = 1024

sys.path.insert(0, REPO)
import torch  # noqa: E402
from models.birefnet import BiRefNet  # noqa: E402
from utils import check_state_dict  # noqa: E402

torch.set_num_threads(int(os.environ.get("THREADS", "2")))


def main():
    ids = sys.argv[1:] or sorted(f[:-5] for f in os.listdir(os.path.join(WORK, "orig")) if f.endswith(".webp"))
    os.makedirs(os.path.join(WORK, "masks"), exist_ok=True)
    model = BiRefNet(bb_pretrained=False)
    model.load_state_dict(check_state_dict(torch.load(WEIGHTS, map_location="cpu", weights_only=True)))
    model.eval()
    mean = torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1)
    std = torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1)
    for cid in ids:
        t = time.time()
        im = Image.open(os.path.join(WORK, "orig", f"{cid}.webp")).convert("RGB")
        W, H = im.size
        x = torch.from_numpy(np.asarray(im.resize((SIZE, SIZE), Image.BICUBIC), np.float32) / 255.0).permute(2, 0, 1)[None]
        x = (x - mean) / std
        with torch.inference_mode():
            pred = model(x)[-1].sigmoid()[0, 0].numpy()
        m = Image.fromarray(np.clip(pred * 255 + 0.5, 0, 255).astype(np.uint8), "L").resize((W, H), Image.BICUBIC)
        m.save(os.path.join(WORK, "masks", f"{cid}.png"))
        print(cid, f"{time.time() - t:.1f}s", flush=True)


if __name__ == "__main__":
    main()
