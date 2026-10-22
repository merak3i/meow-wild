#!/usr/bin/env python3
"""The walk's narration: Voicebox takes in, calm and slow lines out.

Voicebox (Qwen3-TTS 1.7B, Vismay's cloned profile) speaks at its natural,
fairly brisk pace and ignores style instructions for a cloned voice, so the
calm comes from here:

1. thin the room tone the clone carries over from its reference recording
   (gently: a heavier hand starts eating soft consonants);
2. align the take to its line word by word (PocketSphinx, offline), trim it to
   its first and last word, and open the pauses the punctuation asks for and
   the model ran through: 0.75 s at "...", 0.55 s at a full stop, 0.28 s at a
   comma; a take that will not align falls back to stretching the pauses it has;
3. slow the whole line by 8% with WSOLA, which keeps the pitch;
4. warm it a little (low shelf), soften the presence peak, tame sibilance;
5. level every line to the same loudness (-19 LUFS, true peak below -1.5 dBTP);
6. encode AAC (m4a) and Opus (webm), mono, 48 kHz.

    python3 scripts/audio/walk.py TAKES_DIR [--only id ...]

TAKES_DIR holds one WAV per line, named after the line id in src/lib/walkthrough.ts;
the words come from the `say` of that line.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path

import noisereduce as nr
import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from audiotsm import wsola
from audiotsm.io.array import ArrayReader, ArrayWriter
from scipy import signal

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "sound" / "walk"
SR = 48000
RATE = 0.92  # speech speed after the stretch
PAUSE = {"...": 0.75, ".": 0.55, "?": 0.55, "!": 0.55, ";": 0.4, ":": 0.4, ",": 0.28}
# words the aligner's dictionary does not have (CMU phones)
EXTRA_WORDS = {
    "caracal": "K AE R AH K AE L",
    "cupped": "K AH P T",
    "margay": "M AA R G EY",
    "serval": "S ER V AH L",
    "sikkim": "S IH K IH M",
    "swats": "S W AA T S",
    "vismay": "V IH S M EY",
}
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


def floor_db(db: np.ndarray) -> float:
    """the take's own room tone, relative to its loudest moment"""
    return float(np.percentile(db, 6))


def denoise(x: np.ndarray) -> np.ndarray:
    hop = int(0.01 * SR)
    db = frames_db(x, hop)
    quiet = np.argsort(db)[: max(12, len(db) * 6 // 100)]
    profile = np.concatenate([x[i * hop : (i + 1) * hop] for i in sorted(quiet)])
    return nr.reduce_noise(y=x, sr=SR, y_noise=profile, stationary=True, prop_decrease=0.5, n_fft=2048)


def trim(x: np.ndarray) -> np.ndarray:
    hop = int(0.01 * SR)
    db = frames_db(x, hop)
    on = np.where(db > max(-42.0, floor_db(db) + 10))[0]
    if not len(on):
        return x
    a = max(0, (on[0] - 6) * hop)
    b = min(len(x), (on[-1] + 12) * hop)
    return x[a:b]


def script() -> dict[str, str]:
    src = (ROOT / "src" / "lib" / "walkthrough.ts").read_text()
    pat = r'id: "([^"]+)",\s*caption: "(?:[^"\\]|\\.)*",\s*say: "((?:[^"\\]|\\.)*)"'
    return {m.group(1): m.group(2).replace('\\"', '"') for m in re.finditer(pat, src)}


def tokens(text: str) -> list[list]:
    """the line's words, each with the strongest punctuation that follows it"""
    toks: list[list] = []
    for m in re.finditer(r"([A-Za-z][A-Za-z'\-]*)|(\.\.\.|[.,!?;:])", text):
        if m.group(1):
            for part in m.group(1).replace("-", " ").split():
                toks.append([part.lower(), None])
        elif toks:
            p, prev = m.group(2), toks[-1][1]
            toks[-1][1] = p if prev is None or PAUSE[p] > PAUSE[prev] else prev
    return toks


def align(x: np.ndarray, words: list[str]) -> list[tuple[float, float]] | None:
    """word start and end times (s) in x, or None if the take will not align to the line"""
    from pocketsphinx import Decoder

    pcm = (np.clip(signal.resample_poly(x, 1, 3), -1, 1) * 32767).astype(np.int16).tobytes()
    d = Decoder(samprate=16000, bestpath=False, loglevel="ERROR")
    for w, ph in EXTRA_WORDS.items():
        d.add_word(w, ph, True)
    seq = []
    for w in words:
        if d.lookup_word(w) is None and d.lookup_word(w.removesuffix("'s")) is not None:
            w = w.removesuffix("'s")
        if d.lookup_word(w) is None:
            return None
        seq.append(w)
    try:
        d.set_align_text(" ".join(seq))
        d.start_utt()
        d.process_raw(pcm, full_utt=True)
        d.end_utt()
        d.set_alignment()
        d.start_utt()
        d.process_raw(pcm, full_utt=True)
        d.end_utt()
        segs = [(seg.name, seg.start / 100, (seg.start + seg.duration) / 100) for seg in d.get_alignment()]
    except Exception:
        return None
    spans = [(a, b) for name, a, b in segs if not name.startswith("<") and not name.startswith("[")]
    return spans if len(spans) == len(words) else None


def room(x: np.ndarray, n: int) -> np.ndarray:
    """n samples of the take's own quiet: its quietest 120 ms, looped with crossfades"""
    hop = int(0.01 * SR)
    db = frames_db(x, hop)
    w = 12
    k = int(np.argmin(np.convolve(db, np.ones(w), "valid")))
    bit = x[k * hop : (k + w) * hop].copy()
    out = np.zeros(n)
    f = len(bit) // 4
    ramp = np.sin(np.linspace(0, np.pi / 2, f)) ** 2
    i = 0
    while i < n:
        seg = bit.copy()
        seg[:f] *= ramp
        seg[-f:] *= ramp[::-1]
        j = min(n, i + len(seg))
        out[i:j] += seg[: j - i]
        i += len(seg) - f
    return out * 0.7


def pace(x: np.ndarray, toks: list[list], spans: list[tuple[float, float]]) -> tuple[np.ndarray, int]:
    """cut to the words, and open the pauses the punctuation asks for"""
    fade = int(0.012 * SR)
    ramp = np.sin(np.linspace(0, np.pi / 2, fade)) ** 2
    start = max(0, int((spans[0][0] - 0.05) * SR))
    end = min(len(x), int((spans[-1][1] + 0.14) * SR))
    pieces, cursor, opened = [], start, 0
    for i in range(len(toks) - 1):
        p = toks[i][1]
        if p is None:
            continue
        b, a_next = spans[i][1], spans[i + 1][0]
        gap = max(0.0, a_next - b)
        want = PAUSE[p]
        if gap >= want:
            continue
        cut = int(((b + a_next) / 2) * SR)
        if cut <= cursor + fade or cut >= end - fade:
            continue
        left = x[cursor:cut].copy()
        left[-fade:] *= ramp[::-1]
        fill = room(x, int((want - gap) * SR))
        pieces += [left, fill]
        cursor = cut
        opened += 1
    last = x[cursor:end].copy()
    if pieces:
        last[:fade] *= ramp
    pieces.append(last)
    out = np.concatenate(pieces)
    out[: int(0.006 * SR)] *= np.linspace(0, 1, int(0.006 * SR))
    out[-int(0.03 * SR) :] *= np.linspace(1, 0, int(0.03 * SR))
    return out, opened


def stretch(x: np.ndarray, rate: float) -> np.ndarray:
    reader = ArrayReader(x[np.newaxis, :].astype(np.float32))
    writer = ArrayWriter(channels=1)
    wsola(channels=1, speed=rate, frame_length=1024, synthesis_hop=256).run(reader, writer)
    return writer.data[0].astype(np.float64)


def breathe(x: np.ndarray) -> tuple[np.ndarray, int]:
    """lengthen the pauses between phrases by stretching the quiet itself"""
    hop = int(0.01 * SR)
    db = frames_db(x, hop)
    quiet = db < min(-20.0, floor_db(db) + 7)
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
            if dur >= 0.12 and i > 5 and j < n - 5:
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


def process(src: Path, work: Path, text: str) -> dict:
    x = load(src)
    raw = len(x) / SR
    x = denoise(x)
    toks = tokens(text)
    spans = align(x, [w for w, _ in toks]) if toks else None
    if spans:
        x, pauses = pace(x, toks, spans)
        how = "aligned"
    else:
        x = trim(x)
        x, pauses = breathe(x)
        how = "pauses only"
    x = stretch(x, RATE)
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
        "paced": how,
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
    lines = script()
    for src in sorted(args.takes.glob("*.wav")):
        if args.only and src.stem not in args.only:
            continue
        if src.stem not in lines:
            print(f"skip {src.name}: no line with that id in walkthrough.ts")
            continue
        rows.append(process(src, work, lines[src.stem]))
        print(json.dumps(rows[-1]))
    total = sum(r["line_s"] for r in rows)
    print(f"{len(rows)} lines, {total:.0f} s of narration")


if __name__ == "__main__":
    main()
