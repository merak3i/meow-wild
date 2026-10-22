"""Relative depth with Depth Anything V2 (ViT-B, ONNX).

Writes work/depth/<id>.png: 16-bit relative inverse depth (near = bright),
normalised per photo, at the photo's own resolution.

usage: python3 depth.py [id ...]            (default: every photo in work/orig)
env:   DEPTH_MODEL  depth_anything_v2_vitb.onnx (default work/models/)
"""
import os
import sys
import time

import numpy as np
import onnxruntime as ort
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(HERE, "work")
MODEL = os.environ.get("DEPTH_MODEL", os.path.join(WORK, "models", "depth_anything_v2_vitb.onnx"))


def main():
    ids = sys.argv[1:] or sorted(f[:-5] for f in os.listdir(os.path.join(WORK, "orig")) if f.endswith(".webp"))
    os.makedirs(os.path.join(WORK, "depth"), exist_ok=True)
    so = ort.SessionOptions()
    so.intra_op_num_threads = int(os.environ.get("THREADS", "2"))
    sess = ort.InferenceSession(MODEL, so, providers=["CPUExecutionProvider"])
    inp = sess.get_inputs()[0].name
    mean = np.array([0.485, 0.456, 0.406], np.float32)
    std = np.array([0.229, 0.224, 0.225], np.float32)
    for cid in ids:
        t = time.time()
        im = Image.open(os.path.join(WORK, "orig", f"{cid}.webp")).convert("RGB")
        W, H = im.size
        x = np.asarray(im.resize((518, 518), Image.BICUBIC), np.float32) / 255.0
        x = ((x - mean) / std).transpose(2, 0, 1)[None]
        d = sess.run(None, {inp: x})[0].squeeze().astype(np.float32)
        d = (d - d.min()) / max(1e-6, d.max() - d.min())
        Image.fromarray((d * 65535).astype(np.uint16)).resize((W, H), Image.BICUBIC).save(os.path.join(WORK, "depth", f"{cid}.png"))
        print(cid, f"{time.time() - t:.1f}s", flush=True)


if __name__ == "__main__":
    main()
