#!/usr/bin/env python3
"""a slow way down: the walk's beat.

An original ambient downtempo piece for the meow.wild walkthrough, made after the
feel of Vismay's Ambient-ish playlist (warm chillhouse groove, felt piano, soft
pads, folk warmth) without sampling or quoting any recording: every sound here
is synthesised in code. 88 BPM, D minor, 96 bars (4:22), built to sit under a
calm voice and to loop: it opens and closes on pad and piano alone.

    python3 scripts/audio/beats.py            # writes public/sound/walk/beats.{m4a,webm}
    python3 scripts/audio/beats.py --wav out  # also keeps the master WAV

Grid: bar n (1-based) starts at (n - 1) * BAR seconds.
"""
from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy import signal

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "sound" / "walk"
WORK = ROOT / "scripts" / "audio" / "work"

SR = 44100
BPM = 88.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
BARS = 96
TAIL = 3.0
N = int((BARS * BAR + TAIL) * SR)
rng = np.random.default_rng(88)


def hz(note: str) -> float:
    names = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
    n = names[note[0]]
    rest = note[1:]
    if rest.startswith("b"):
        n -= 1
        rest = rest[1:]
    elif rest.startswith("#"):
        n += 1
        rest = rest[1:]
    midi = 12 * (int(rest) + 1) + n
    return 440.0 * 2 ** ((midi - 69) / 12)


def t_of(bar: int, beat: float = 0.0) -> float:
    """seconds at a 1-based bar and a 0-based beat within it"""
    return (bar - 1) * BAR + beat * BEAT


class Bus:
    """a stereo accumulator"""

    def __init__(self) -> None:
        self.x = np.zeros((2, N), dtype=np.float32)

    def add(self, sig: np.ndarray, t: float, gain: float = 1.0, pan: float = 0.0) -> None:
        i = int(round(t * SR))
        if i >= N:
            return
        sig = sig[: N - i]
        if sig.ndim == 1:
            l = np.cos((pan + 1) * np.pi / 4) * np.sqrt(2)
            r = np.sin((pan + 1) * np.pi / 4) * np.sqrt(2)
            self.x[0, i : i + len(sig)] += (sig * gain * l).astype(np.float32)
            self.x[1, i : i + len(sig)] += (sig * gain * r).astype(np.float32)
        else:
            self.x[:, i : i + sig.shape[1]] += (sig * gain).astype(np.float32)


# ---------------------------------------------------------------- oscillators

def polyblep(t: np.ndarray, dt: np.ndarray) -> np.ndarray:
    out = np.zeros_like(t)
    a = t < dt
    x = t[a] / dt[a]
    out[a] = x + x - x * x - 1.0
    b = t > 1.0 - dt
    x = (t[b] - 1.0) / dt[b]
    out[b] = x * x + x + x + 1.0
    return out


def saw(f: float, n: int, detune_cents: float = 0.0, phase0: float | None = None) -> np.ndarray:
    ff = f * 2 ** (detune_cents / 1200)
    dt = np.full(n, ff / SR)
    ph = (np.cumsum(dt) + (rng.random() if phase0 is None else phase0)) % 1.0
    return 2.0 * ph - 1.0 - polyblep(ph, dt)


def adsr(n: int, a: float, d: float, s: float, r: float, hold: float) -> np.ndarray:
    """attack, decay, sustain level, release; `hold` seconds before release starts"""
    t = np.arange(n) / SR
    env = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel = t > hold
    env[rel] *= np.exp(-(t[rel] - hold) / max(r, 1e-4))
    return env


def lp(x: np.ndarray, fc: float, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, fc, "low", fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=-1)


def hp(x: np.ndarray, fc: float, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, fc, "high", fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=-1)


def bp(x: np.ndarray, lo: float, hi: float, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, [lo, hi], "band", fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=-1)


def fade_edges(x: np.ndarray, ms: float = 3.0) -> np.ndarray:
    k = max(1, int(SR * ms / 1000))
    w = np.linspace(0, 1, k)
    x = x.copy()
    x[..., :k] *= w
    x[..., -k:] *= w[::-1]
    return x


# ---------------------------------------------------------------- instruments

def pad_note(f: float, dur: float) -> np.ndarray:
    """five detuned band-limited saws, softened; stereo"""
    n = int((dur + 2.2) * SR)
    voices = [(-9, -0.7), (-4, -0.3), (0, 0.0), (4, 0.3), (9, 0.7)]
    out = np.zeros((2, n))
    for cents, pan in voices:
        v = saw(f, n, cents)
        out[0] += v * np.cos((pan + 1) * np.pi / 4)
        out[1] += v * np.sin((pan + 1) * np.pi / 4)
    out = lp(out, min(4200.0, f * 10.0), 2)
    out *= adsr(n, 1.1, 1.0, 0.85, 1.0, dur)
    return fade_edges(out * 0.12, 5)


def rhodes(f: float, dur: float, vel: float = 0.7) -> np.ndarray:
    """two-operator FM electric piano with a tine on top"""
    n = int((dur + 1.8) * SR)
    t = np.arange(n) / SR
    index = (0.4 + 2.4 * vel) * np.exp(-t / 0.34) + 0.5
    mod = np.sin(2 * np.pi * f * t)
    car = np.sin(2 * np.pi * f * t + index * mod)
    tine = np.sin(2 * np.pi * f * 7.0 * t + 1.2 * np.sin(2 * np.pi * f * t)) * np.exp(-t / 0.05) * 0.12 * vel
    env = np.exp(-t / (1.4 + 220.0 / f)) * np.minimum(1, t / 0.003)
    rel = t > dur
    env[rel] *= np.exp(-(t[rel] - dur) / 0.18)
    return fade_edges((car * env + tine) * vel * 0.33)


def piano(f: float, dur: float, vel: float = 0.6) -> np.ndarray:
    """additive piano: inharmonic partials, two strings per note, felt hammer"""
    n = int((dur + 4.0) * SR)
    t = np.arange(n) / SR
    B = 0.00035
    out = np.zeros(n)
    bright = 0.55 + 0.45 * vel
    tau1 = 2.6 * (261.6 / f) ** 0.35 + 0.8
    for k in range(1, 14):
        fk = k * f * np.sqrt(1 + B * k * k)
        if fk > SR * 0.45:
            break
        amp = (1.0 / k ** 1.25) * (bright ** (k - 1))
        tau = tau1 / (1 + 0.45 * (k - 1))
        for det in (-0.55, 0.55):
            ph = rng.random() * 2 * np.pi
            out += amp * 0.5 * np.sin(2 * np.pi * fk * 2 ** (det / 1200) * t + ph) * (
                0.62 * np.exp(-t / (tau * 0.18)) + 0.38 * np.exp(-t / tau)
            )
    hammer = lp(rng.standard_normal(int(0.012 * SR)), 1800 + 1400 * vel) * np.exp(-np.arange(int(0.012 * SR)) / (0.003 * SR))
    out[: len(hammer)] += hammer * 0.05 * vel
    env = np.minimum(1, t / 0.002)
    rel = t > dur
    env[rel] *= np.exp(-(t[rel] - dur) / 0.6)
    return fade_edges(out * env * vel * 0.28)


def mallet(f: float, vel: float = 0.6) -> np.ndarray:
    """felt mallet: a soft kalimba-ish tone"""
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    x = (
        np.sin(2 * np.pi * f * t) * np.exp(-t / 0.55)
        + 0.22 * np.sin(2 * np.pi * f * 4.0 * t) * np.exp(-t / 0.09)
        + 0.06 * np.sin(2 * np.pi * f * 9.8 * t) * np.exp(-t / 0.025)
    )
    x[: int(0.004 * SR)] += lp(rng.standard_normal(int(0.004 * SR)), 2500) * 0.08
    return fade_edges(x * np.minimum(1, t / 0.0015) * vel * 0.3)


def kick(vel: float = 1.0) -> np.ndarray:
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    f = 47 + (140 - 47) * np.exp(-t / 0.032)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.26)
    click = hp(rng.standard_normal(n), 3000) * np.exp(-t / 0.0025) * 0.08
    x = np.tanh(1.6 * (body + click)) / np.tanh(1.6)
    return fade_edges(x * vel * 0.62)


def rim(vel: float = 1.0) -> np.ndarray:
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 820 * t) * np.exp(-t / 0.012)
    crack = bp(rng.standard_normal(n), 1400, 3600) * np.exp(-t / 0.018)
    brush = lp(rng.standard_normal(n), 6000) * np.exp(-t / 0.09) * 0.25
    return fade_edges((0.5 * tone + 0.6 * crack + brush) * vel * 0.2)


def hat(vel: float = 1.0, open_: bool = False) -> np.ndarray:
    n = int((0.35 if open_ else 0.08) * SR)
    t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 7200, 4) * np.exp(-t / (0.16 if open_ else 0.02))
    return fade_edges(x * vel * 0.11)


def shaker(vel: float = 1.0) -> np.ndarray:
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    env = np.minimum(1, t / 0.006) * np.exp(-t / 0.035)
    return fade_edges(bp(rng.standard_normal(n), 5200, 11000) * env * vel * 0.085)


def sub(f: float, dur: float, vel: float = 1.0) -> np.ndarray:
    n = int((dur + 0.3) * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.34 * np.sin(2 * np.pi * 2 * f * t + 0.3)
    env = np.minimum(1, t / 0.018)
    rel = t > dur
    env[rel] *= np.exp(-(t[rel] - dur) / 0.09)
    return fade_edges(x * env * vel * 0.25)


# ---------------------------------------------------------------- the score

# progression A: Dm9 | Bbmaj9 | Fmaj9 | C/E     progression B: Gm9 | Dm9/F | Bbmaj7 | A7sus4 A7
PROG_A = [
    ("D2", ["F3", "A3", "C4", "E4"], ["D3", "A3", "C4", "E4", "F4"]),
    ("Bb1", ["D3", "F3", "A3", "C4"], ["Bb2", "F3", "A3", "C4", "D4"]),
    ("F2", ["E3", "G3", "A3", "C4"], ["F3", "A3", "C4", "E4", "G4"]),
    ("E2", ["E3", "G3", "C4", "D4"], ["C3", "G3", "C4", "D4", "E4"]),
]
PROG_B = [
    ("G1", ["F3", "Bb3", "D4", "A4"], ["G2", "D3", "F3", "A3", "Bb3"]),
    ("F2", ["E3", "A3", "C4", "D4"], ["D3", "A3", "C4", "E4", "F4"]),
    ("Bb1", ["D3", "F3", "A3", "C4"], ["Bb2", "F3", "A3", "D4"]),
    ("A1", ["G3", "C#4", "D4", "E4"], ["A2", "E3", "G3", "C#4", "D4"]),
]
# the piano motif, four bars: (beat, note, length in beats, velocity)
MOTIF = [
    [(0, "A4", 1.5, 0.55), (1.5, "E5", 1.0, 0.45), (2.5, "D5", 0.75, 0.5), (3.25, "C5", 0.75, 0.4)],
    [(0, "D5", 1.0, 0.5), (1.0, "F5", 1.5, 0.45), (2.5, "A4", 1.5, 0.4)],
    [(0, "C5", 1.0, 0.5), (1.0, "A4", 1.0, 0.42), (2.0, "G4", 1.0, 0.4), (3.0, "A4", 1.0, 0.45)],
    [(0, "G4", 2.5, 0.45), (2.5, "E4", 1.5, 0.38)],
]
MOTIF_B = [
    [(0, "D5", 1.5, 0.5), (1.5, "A4", 1.0, 0.4), (2.5, "Bb4", 1.5, 0.45)],
    [(0, "A4", 2.0, 0.45), (2.0, "F4", 2.0, 0.38)],
    [(0, "F5", 1.0, 0.45), (1.0, "E5", 1.0, 0.42), (2.0, "D5", 1.0, 0.45), (3.0, "C5", 1.0, 0.4)],
    [(0, "C#5", 2.0, 0.45), (2.0, "E5", 2.0, 0.4)],
]

# sections: (first bar, last bar, name)
SECTIONS = [
    (1, 8, "intro"),
    (9, 24, "grooveA"),
    (25, 40, "grooveB"),
    (41, 48, "break"),
    (49, 64, "grooveA2"),
    (65, 80, "grooveC"),
    (81, 88, "break2"),
    (89, 94, "groove_end"),
    (95, 96, "outro"),
]


def section(bar: int) -> str:
    for a, b, name in SECTIONS:
        if a <= bar <= b:
            return name
    return "outro"


def prog_for(bar: int):
    name = section(bar)
    i = (bar - 1) % 4
    if name in ("grooveC",) or (name == "grooveB" and bar >= 33):
        return PROG_B[i]
    return PROG_A[i]


def compose():
    pads, keys, pno, mal, drums, bass, air = Bus(), Bus(), Bus(), Bus(), Bus(), Bus(), Bus()
    kick_times: list[float] = []
    swing8 = 0.075 * BEAT
    swing16 = 0.035 * BEAT

    for bar in range(1, BARS + 1):
        name = section(bar)
        root, stab, padv = prog_for(bar)
        t0 = t_of(bar)
        groove = name.startswith("groove")
        last = bar >= 95
        # pads: always, quieter in grooves so the keys can speak
        pg = {"intro": 0.9, "break": 1.0, "break2": 1.0, "outro": 1.0}.get(name, 0.62)
        if bar <= 2:
            pg *= bar / 2.5
        for k, note in enumerate(padv):
            pads.add(pad_note(hz(note), BAR), t0, pg * (0.8 if k == 0 else 0.55))
        # piano motif: intro, breaks, outro, and every other phrase of groove B and C
        phrase = (bar - 1) % 4
        use_b = prog_for(bar) is PROG_B[phrase]
        motif_on = name in ("intro", "break", "break2", "outro") or (name in ("grooveB", "grooveC") and ((bar - 1) // 4) % 2 == 1)
        if motif_on and not (name == "intro" and bar <= 2):
            for beat, note, ln, vel in (MOTIF_B if use_b else MOTIF)[phrase]:
                if last and beat > 2:
                    continue
                pno.add(piano(hz(note), ln * BEAT, vel), t_of(bar, beat), 0.95, pan=-0.15)
        # rhodes stabs from bar 5 on
        if bar >= 5 and not last and name not in ("break", "break2"):
            hits = [(0.0, 1.5, 0.62), (1.5, 0.4, 0.42), (3.0, 0.45, 0.36)]
            if name == "intro":
                hits = hits[:1]
            for beat, ln, vel in hits:
                for j, note in enumerate(stab):
                    keys.add(rhodes(hz(note), ln * BEAT, vel), t_of(bar, beat) + j * 0.006, 0.85, pan=0.25 if j % 2 else -0.25)
        if name in ("break", "break2"):
            keys.add(rhodes(hz(stab[0]), 3.0 * BEAT, 0.4), t0, 0.7, pan=0.2)
        # sub bass from bar 7
        if bar >= 7 and not last:
            f = hz(root)
            bv = 0.55 if name in ("break", "break2") else 1.0
            if name in ("break", "break2"):
                bass.add(sub(f, 3.6 * BEAT, bv), t0)
            else:
                bass.add(sub(f, 1.75 * BEAT, bv), t0)
                bass.add(sub(f * (1.5 if bar % 2 else 2.0), 0.4 * BEAT, 0.55 * bv), t_of(bar, 2.5))
                bass.add(sub(f, 0.8 * BEAT, 0.7 * bv), t_of(bar, 3.0))
        # drums
        if groove:
            light = name == "groove_end" and bar >= 93
            ks = [0.0, 1.5, 2.5] if name in ("grooveA2", "grooveC") else [0.0, 1.5]
            if bar % 8 == 0:
                ks = [0.0, 1.5, 2.5, 3.5]
            for b in ks:
                v = 1.0 if b == 0 else 0.78
                drums.add(kick(v * (0.7 if light else 1.0)), t_of(bar, b))
                kick_times.append(t_of(bar, b))
            for b in (1.0, 3.0):
                drums.add(rim(0.9), t_of(bar, b) + 0.004, pan=0.05)
            for s8 in range(8):
                b = s8 * 0.5
                dt = swing8 if s8 % 2 else 0.0
                drums.add(hat(0.55 if s8 % 2 else 0.85), t_of(bar, b) + dt, pan=0.3)
            if name in ("grooveB", "grooveA2", "grooveC") and bar % 2 == 0:
                drums.add(hat(0.5, open_=True), t_of(bar, 3.5) + swing8, pan=0.3)
            for s16 in range(16):
                b = s16 * 0.25
                dt = swing16 if s16 % 2 else 0.0
                acc = 1.0 if s16 % 4 == 2 else 0.55
                drums.add(shaker(acc), t_of(bar, b) + dt, pan=-0.35)
        elif name in ("break", "break2") and bar % 8 != 0:
            for s16 in range(16):
                b = s16 * 0.25
                drums.add(shaker(0.35 if s16 % 4 else 0.55), t_of(bar, b) + (swing16 if s16 % 2 else 0.0), pan=-0.35)
        elif name == "intro" and bar == 8:
            drums.add(rim(0.5), t_of(bar, 3.0))
            drums.add(rim(0.35), t_of(bar, 3.5))
        # felt mallet arpeggio in groove B and C
        if name in ("grooveB", "grooveC") or (name == "grooveA2" and bar >= 57):
            tones = sorted(padv, key=hz)
            seq = tones + tones[-2:0:-1]
            accents = [1, 0, 0, 1, 0, 0, 1, 0]
            for s8 in range(8):
                note = seq[s8 % len(seq)]
                f = hz(note) * (2 if hz(note) < 300 else 1)
                v = 0.55 if accents[s8] else 0.33
                mal.add(mallet(f, v), t_of(bar, s8 * 0.5) + (swing8 if s8 % 2 else 0.0), 0.8, pan=0.45 if s8 % 2 else 0.1)

    # air: a soft moving noise, the outdoors behind the music
    pink = rng.standard_normal((2, N)).astype(np.float32)
    b, a = signal.butter(1, 500, "low", fs=SR)
    pink = signal.lfilter(b, a, pink, axis=-1).astype(np.float32)
    lfo = 0.6 + 0.4 * np.sin(2 * np.pi * np.arange(N) / SR / 23.0)
    air.x += (pink * lfo * 0.05).astype(np.float32)

    # the kick ducks the bass
    duck = np.ones(N, dtype=np.float32)
    rel = np.exp(-np.arange(int(0.2 * SR)) / (0.07 * SR)).astype(np.float32)
    for t in kick_times:
        i = int(t * SR)
        j = min(N, i + len(rel))
        duck[i:j] = np.minimum(duck[i:j], 1 - 0.55 * rel[: j - i])
    bass.x *= duck
    return pads, keys, pno, mal, drums, bass, air


# ---------------------------------------------------------------- space and master

def chorus(x: np.ndarray, depth_ms: float = 4.0, base_ms: float = 14.0, rate: float = 0.23) -> np.ndarray:
    n = x.shape[1]
    idx = np.arange(n, dtype=np.float64)
    out = np.empty_like(x)
    for c in range(2):
        d = (base_ms + depth_ms * np.sin(2 * np.pi * rate * idx / SR + c * np.pi / 2)) * SR / 1000
        out[c] = 0.7 * x[c] + 0.45 * np.interp(idx - d, idx, x[c]).astype(np.float32)
    return out


def impulse(seconds: float, rt60: float, bright_rt: float) -> np.ndarray:
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = np.zeros((2, n))
    for c in range(2):
        noise = rng.standard_normal(n)
        low = lp(noise, 1800) * np.exp(-6.91 * t / rt60)
        high = hp(noise, 1800) * np.exp(-6.91 * t / bright_rt)
        ir[c] = low + 0.6 * high
    pre = int(0.022 * SR)
    ir = np.concatenate([np.zeros((2, pre)), ir], axis=1)
    ir[:, pre : pre + int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    return ir / np.sqrt((ir ** 2).sum() / 2)


def reverb(x: np.ndarray, ir: np.ndarray) -> np.ndarray:
    m = x.mean(axis=0)
    out = np.stack([signal.fftconvolve(m, ir[0])[: x.shape[1]], signal.fftconvolve(m, ir[1])[: x.shape[1]]])
    return out.astype(np.float32)


def compress(x: np.ndarray, thresh_db: float, ratio: float, attack: float, release: float) -> np.ndarray:
    hop = 64
    m = np.abs(x).max(axis=0)
    nb = len(m) // hop + 1
    blocks = np.pad(m, (0, nb * hop - len(m))).reshape(nb, hop).max(axis=1)
    ga = np.exp(-hop / (attack * SR))
    gr = np.exp(-hop / (release * SR))
    env = 0.0
    gain = np.empty(nb)
    th = 10 ** (thresh_db / 20)
    for i, v in enumerate(blocks):
        env = ga * env + (1 - ga) * v if v > env else gr * env + (1 - gr) * v
        if env > th:
            over = 20 * np.log10(env / th)
            gain[i] = 10 ** (-(over - over / ratio) / 20)
        else:
            gain[i] = 1.0
    g = np.interp(np.arange(len(m)), np.arange(nb) * hop + hop / 2, gain)
    return (x * g).astype(np.float32)


def limit(x: np.ndarray, ceiling_db: float = -1.2) -> np.ndarray:
    """offline lookahead limiter: hold the deepest reduction needed within 5 ms either side, then smooth it"""
    from scipy.ndimage import minimum_filter1d

    ceiling = 10 ** (ceiling_db / 20)
    look = int(0.005 * SR)
    need = np.minimum(1.0, ceiling / np.maximum(np.abs(x).max(axis=0), 1e-9))
    held = minimum_filter1d(need, size=2 * look + 1, mode="nearest")
    win = signal.windows.hann(2 * look + 1)
    g = np.convolve(held, win / win.sum(), mode="same")
    return (x * np.minimum(g, need)).astype(np.float32)


def true_peak_db(x: np.ndarray) -> float:
    up = signal.resample_poly(x, 4, 1, axis=-1)
    return 20 * np.log10(np.abs(up).max() + 1e-12)


def master(stems) -> np.ndarray:
    pads, keys, pno, mal, drums, bass, air = stems
    padx = chorus(lp(pads.x, 2600, 2).astype(np.float32))
    keyx = keys.x
    # tremolo on the keys, gently, like an old amp
    lfo = 1.0 + 0.12 * np.sin(2 * np.pi * 3.1 * np.arange(N) / SR)
    keyx = (keyx * np.stack([lfo, 2 - lfo])).astype(np.float32)
    big = impulse(4.2, 3.4, 1.6)
    room = impulse(1.2, 0.7, 0.35)
    wet = reverb(padx * 0.6 + pno.x * 0.9 + mal.x * 0.7 + keyx * 0.35, big) * 0.42
    wet += reverb(drums.x * 0.5 + keyx * 0.3, room) * 0.18
    dry = padx * 0.85 + keyx * 0.9 + pno.x * 0.8 + mal.x * 0.75 + drums.x + bass.x + air.x
    mix = hp(dry + wet, 28, 2).astype(np.float32)
    # a little air on top; the page dips the speech band itself while Vismay talks
    mix = (mix + 0.05 * lp(mix, 220, 2) + 0.3 * hp(mix, 5000, 2)).astype(np.float32)
    mix = compress(mix, -16.0, 2.0, 0.02, 0.28)
    meter = pyln.Meter(SR)
    lufs = meter.integrated_loudness(mix.T.astype(np.float64))
    mix = (mix * 10 ** ((-16.5 - lufs) / 20)).astype(np.float32)
    mix = limit(mix, -1.3)
    # the last seconds fade into the loop point
    f = int(2.5 * SR)
    mix[:, -f:] *= np.linspace(1, 0, f) ** 2
    return mix


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--wav", type=Path, default=None, help="also write the master WAV here")
    args = ap.parse_args()
    stems = compose()
    mix = master(stems)
    meter = pyln.Meter(SR)
    lufs = meter.integrated_loudness(mix.T.astype(np.float64))
    print(f"length {mix.shape[1] / SR:.1f} s, {lufs:.1f} LUFS, true peak {true_peak_db(mix):.2f} dBTP")
    WORK.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    wav = args.wav or (WORK / "beats.wav")
    sf.write(wav, mix.T, SR, subtype="PCM_24")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-c:a", "aac", "-b:a", "112k", "-movflags", "+faststart", str(OUT / "beats.m4a")], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-c:a", "libopus", "-b:a", "88k", "-ar", "48000", str(OUT / "beats.webm")], check=True)
    for f in ("beats.m4a", "beats.webm"):
        print(f, (OUT / f).stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
