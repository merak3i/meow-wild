#!/usr/bin/env python3
"""The walk's narration: Voicebox takes in, calm and slow lines out.

Voicebox (Qwen3-TTS 1.7B, Vismay's cloned profile) speaks at its natural,
fairly brisk pace and ignores style instructions for a cloned voice, so the
calm comes from here:

1. trim the take to its words, with a short breath of room either side;
2. slow the speech by about 10% with WSOLA, which keeps the pitch;
3. stretch every pause between phrases (x1.5, up to +0.7 s), so the line breathes;
4. warm it a little (low shelf), soften the presence peak, tame sibilance;
5. level every line to the same loudness (-19 LUFS, true peak below -1.5 dBTP);
6. encode AAC (m4a) and Opus (webm), mono, 48 kHz.

    python3 scripts/audio/walk.py TAKES_DIR [--only id ...]

TAKES_DIR holds one WAV per line, named after the line id in src/lib/walkthrough.ts.
"""
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from audiotsm import wsola
from audiotsm.io.array import ArrayReader, ArrayWriter
from scipy import signal

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "sound" / "walk"
SR = 48000
RATE = 0.9  # speech speed after the stretch
PAUSE_X = 1.5
PAUSE_MAX = 0.7
TARGET_LUFS = -19.0


def load(path: Path) -> np.ndarray:
    x, sr = sf.read(path, always_2d=True)
    x = x.mean(axis=1)
    if sr != SR:
        g = np.gcd(sr, SR)
        x = signal.resample_poly(x, SR // g, sr // g)
    return x.astype(np.float64)


def frames_db(x: np.ndarray, hop: int) -> np.ndarray:
    n = len(x) // hop
    e = np.sqrt((x[: n * hop].reshape(n, hop) ** 2).mean(axis=1) + 1e-12)
    return 20 * np.log10(e / (e.max() + 1e-12))


def trim(x: np.ndarray) -> np.ndarray:
    hop = int(0.01 * SR)
    db = frames_db(x, hop)
    on = np.where(db > -42)[0]
    if not len(on):
        return x
    a = max(0, (on[0] - 6) * hop)
    b = min(len(x), (on[-1] + 12) * hop)
    return x[a:b]


def stretch(x: np.ndarray, rate: float) -> np.ndarray:
    reader = ArrayReader(x[np.newaxis, :].astype(np.float32))
    writer = ArrayWriter(channels=1)
    wsola(channels=1, speed=rate, frame_length=1024, synthesis_hop=256).run(reader, writer)
    return writer.data[0].astype(np.float64)


def breathe(x: np.ndarray) -> tuple[np.ndarray, int]:
    """lengthen the pauses between phrases by stretching the quiet itself"""
    hop = int(0.01 * SR)
    db = frames_db(x, hop)
    quiet = db < -40
    out = []
    i = 0
    n = len(db)
    pauses = 0
    last = 0
    while i < n:
        if quiet[i]:
            j = i
            while j < n and quiet[j]:
                j += 1
            dur = (j - i) * hop / SR
            if dur >= 0.14 and i > 5 and j < n - 5:
                a, b = i * hop, j * hop
                out.append(x[last:a])
                gap = x[a:b]
                extra = min(dur * (PAUSE_X - 1), PAUSE_MAX)
                k = int(extra * SR)
                # room tone: the pause's own quiet, repeated and crossfaded
                mid = gap[len(gap) // 4 : 3 * len(gap) // 4]
                if len(mid) < 256:
                    mid = np.zeros(256)
                reps = int(np.ceil(k / len(mid))) + 1
                fill = np.tile(mid, reps)[:k] * 0.8
                out.append(gap[: len(gap) // 2])
                out.append(fill)
                out.append(gap[len(gap) // 2 :])
                last = b
                pauses += 1
            i = j
        else:
            i += 1
    out.append(x[last:])
    return np.concatenate(out), pauses


def tone(x: np.ndarray) -> np.ndarray:
    def shelf_low(x, f, gain_db):
        sos = signal.butter(2, f, "low", fs=SR, output="sos")
        return x + (10 ** (gain_db / 20) - 1) * signal.sosfilt(sos, x)

    x = signal.sosfilt(signal.butter(2, 70, "high", fs=SR, output="sos"), x)
    x = shelf_low(x, 180, 1.8)
    # soften the presence peak a touch
    pres = signal.sosfilt(signal.butter(2, [3000, 5200], "band", fs=SR, output="sos"), x)
    x = x - 0.14 * pres
    # de-ess: duck the band above 5.5 kHz where it jumps out of the line
    hi = signal.sosfilt(signal.butter(4, 5500, "high", fs=SR, output="sos"), x)
    env = np.sqrt(signal.lfilter([1 - 0.995], [1, -0.995], hi ** 2) + 1e-12)
    ref = np.sqrt(signal.lfilter([1 - 0.9995], [1, -0.9995], x ** 2) + 1e-12)
    over = np.clip(env / (ref * 0.45 + 1e-9), 1, None)
    g = 1 / over ** 0.6
    x = x - hi + hi * g
    return x


def compress(x: np.ndarray, thresh_db: float = -26.0, ratio: float = 2.0) -> np.ndarray:
    hop = 128
    n = len(x) // hop + 1
    pad = np.pad(np.abs(x), (0, n * hop - len(x)))
    blocks = np.sqrt((pad.reshape(n, hop) ** 2).mean(axis=1))
    env = 0.0
    gains = np.empty(n)
    a_up, a_dn = np.exp(-hop / (0.008 * SR)), np.exp(-hop / (0.18 * SR))
    th = 10 ** (thresh_db / 20)
    for i, v in enumerate(blocks):
        env = a_up * env + (1 - a_up) * v if v > env else a_dn * env + (1 - a_dn) * v
        gains[i] = (th / env) ** (1 - 1 / ratio) if env > th else 1.0
    g = np.interp(np.arange(len(x)), np.arange(n) * hop + hop / 2, gains)
    return x * g


def true_peak(x: np.ndarray) -> float:
    return float(np.abs(signal.resample_poly(x, 4, 1)).max())


def finish(x: np.ndarray) -> np.ndarray:
    meter = pyln.Meter(SR)
    lufs = meter.integrated_loudness(x)
    x = x * 10 ** ((TARGET_LUFS - lufs) / 20)
    tp = true_peak(x)
    ceiling = 10 ** (-1.5 / 20)
    if tp > ceiling:
        # soft-knee the rare peaks rather than turn the whole line down
        k = ceiling * 0.85
        a = np.abs(x)
        over = a > k
        x[over] = np.sign(x[over]) * (k + (ceiling - k) * np.tanh((a[over] - k) / (ceiling - k)))
    pad = np.zeros(int(0.04 * SR))
    x = np.concatenate([pad, x, pad])
    f = int(0.006 * SR)
    x[:f] *= np.linspace(0, 1, f)
    x[-f:] *= np.linspace(1, 0, f)
    return x


def process(src: Path, work: Path) -> dict:
    x = load(src)
    raw = len(x) / SR
    x = trim(x)
    x = stretch(x, RATE)
    x, pauses = breathe(x)
    x = tone(x)
    x = compress(x)
    x = finish(x)
    lid = src.stem
    wav = work / f"{lid}.wav"
    sf.write(wav, x.astype(np.float32), SR, subtype="PCM_24")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-ac", "1", "-c:a", "aac", "-b:a", "72k", "-movflags", "+faststart", str(OUT / f"{lid}.m4a")], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-ac", "1", "-c:a", "libopus", "-b:a", "48k", "-application", "voip", str(OUT / f"{lid}.webm")], check=True)
    meter = pyln.Meter(SR)
    return {
        "id": lid,
        "take_s": round(raw, 2),
        "line_s": round(len(x) / SR, 2),
        "pauses": pauses,
        "lufs": round(meter.integrated_loudness(x), 1),
        "peak_dbtp": round(20 * np.log10(true_peak(x) + 1e-12), 2),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("takes", type=Path)
    ap.add_argument("--only", nargs="*")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    work = ROOT / "scripts" / "audio" / "work" / "walk"
    work.mkdir(parents=True, exist_ok=True)
    rows = []
    for src in sorted(args.takes.glob("*.wav")):
        if args.only and src.stem not in args.only:
            continue
        rows.append(process(src, work))
        print(json.dumps(rows[-1]))
    total = sum(r["line_s"] for r in rows)
    print(f"{len(rows)} lines, {total:.0f} s of narration")


if __name__ == "__main__":
    main()
