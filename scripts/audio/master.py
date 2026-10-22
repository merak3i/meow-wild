"""Cut, clean, level and encode each cat call, plus the music bed.

Reads the source recordings from scripts/audio/raw/ (see README.md: they are
not in the repository) and writes
  public/sound/calls/<id>.m4a and .webm   AAC 72 kbps and Opus 64 kbps, as shipped
  public/sound/music-dark-glow.m4a/.webm  the music bed
  scripts/audio/work/<id>.wav             the edit before encoding, for listening

usage: python3 scripts/audio/master.py [id ...]   (ids: only those calls, no music)
"""
import os
import subprocess

import numpy as np
import soundfile as sf
import librosa
import noisereduce as nr
import pyloudnorm as pyln
from scipy import signal

D = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(D, "..", ".."))
RAW = os.path.join(D, "raw")
WORK = os.path.join(D, "work")
OUT = os.path.join(ROOT, "public", "sound", "calls")
MUSIC = os.path.join(ROOT, "public", "sound")
SR = 44100
os.makedirs(WORK, exist_ok=True)
os.makedirs(OUT, exist_ok=True)

# id: source, segments [(t0, t1)], gap between segments (s), highpass, lowpass, notches (Hz), denoise strength,
#     noise sample (t0, t1) or None, target loudness (LUFS), fade ms
CALLS = {
    "snow-leopard": dict(src="Snow_Leopard_Snuffles", seg=[(0.62, 1.98), (3.42, 4.62)], gap=0.55, hp=90, lp=7500,
                         notch=[256, 512, 768, 1024], nr=0.75, noise=(8.0, 9.8), lufs=-19, fade=40),
    "puma": dict(src="1189983", seg=[(1.62, 2.55), (3.42, 4.42), (5.82, 6.75)], gap=0.0, hp=650, lp=6000,
                 notch=[], nr=0.85, noise=(0.2, 1.5), lufs=-21, fade=60),
    "eurasian-lynx": dict(src="243496__ylearkisto__ilves-murisee-ja-mou", seg=[(70.6, 75.5)], gap=0, hp=110, lp=8000,
                          notch=[], nr=0.6, noise=(88.8, 89.6), lufs=-19, fade=120),
    "caracal": dict(src="647637__druulian__caracal07", seg=[(0.03, 1.62)], gap=0, hp=350, lp=9000,
                    notch=[], nr=0.4, noise=None, lufs=-21, fade=40),
    "clouded-leopard": dict(src="bbc_clouded-le_nhu0510220", seg=[(63.4, 67.2)], gap=0, hp=160, lp=8000,
                            notch=[], nr=0.7, noise=(20.2, 21.4), lufs=-20, fade=80),
    "leopard": dict(src="346402__drobiumdesign__leopards-cough-is", seg="saw", gap=0, hp=90, lp=6000,
                    notch=[], nr=0.0, noise=None, lufs=-18, fade=15),
    "serval": dict(src="bbc_serval--fe_nhu0508811", seg=[(13.0, 16.2)], gap=0, hp=140, lp=7000,
                   notch=[], nr=0.65, noise=(1.0, 2.0), lufs=-21, fade=90),
    "tiger": dict(src="149190__videog__tiger-roar", seg=[(3.08, 6.95)], gap=0, hp=40, lp=9000,
                  notch=[], nr=0.35, noise=(0.0, 0.25), lufs=-16, fade=60),
    "margay": dict(src="188740", seg=[(7.05, 7.95), (11.75, 12.65)], gap=0.35, hp=1300, lp=3600,
                   notch=[], nr=0.8, noise=(5.0, 6.6), lufs=-24, fade=60),
    "jaguar": dict(src="Jaguar_saw", seg=[(0.0, 1.39)], gap=0, hp=45, lp=7000,
                   notch=[], nr=0.3, noise=None, lufs=-17, fade=20),
    "sand-cat": dict(src="bbc_sand-cat--_nhu0507618", seg=[(2.7, 5.1)], gap=0, hp=300, lp=9000,
                     notch=[], nr=0.7, noise=(6.0, 8.5), lufs=-21, fade=50),
    "domestic-cat": dict(src="Whiskers__purr", seg=[(0.05, 10.6)], gap=0, hp=35, lp=6500,
                         notch=[], nr=0.45, noise=None, lufs=-22, fade=400),
    # Animal Sound Archive, Museum fuer Naturkunde Berlin (Guenter Tembrock), CC BY-SA 3.0 DE
    "pallass-cat": dict(src="1881_Manul_Fauchen_Stosslaute", seg=[(8.55, 12.15)], gap=0, hp=120, lp=8000,
                        notch=[50, 100, 150, 200], nr=0.4, noise=(12.7, 15.4), lufs=-20, fade=60),
    "ocelot": dict(src="1884_Ozelot_Maunzen", seg=[(62.25, 68.15)], gap=0, hp=180, lp=7500,
                   notch=[50, 100, 150], nr=0.6, noise=(59.2, 62.1), lufs=-20, fade=60),
    "fishing-cat": dict(src="Prionailurus_viverrinus_S1036_02", seg=[(13.15, 16.05)], gap=0, hp=170, lp=7000,
                        notch=[50, 100, 150], nr=0.3, noise=None, lufs=-21, fade=70),
    "asian-golden-cat": dict(src="Catopuma_temminckii_V1966_08_spur1", seg=[(85.80, 88.25)], gap=0, hp=150, lp=6000,
                             notch=[50, 100, 150], nr=0.6, noise=(76.0, 80.0), lufs=-21, fade=60),
}
ONLY = set(__import__("sys").argv[1:])


def butter(y, hp, lp):
    if hp:
        b, a = signal.butter(4, hp / (SR / 2), "highpass")
        y = signal.filtfilt(b, a, y)
    if lp:
        b, a = signal.butter(4, lp / (SR / 2), "lowpass")
        y = signal.filtfilt(b, a, y)
    return y


def notch(y, freqs):
    for f in freqs:
        b, a = signal.iirnotch(f, 18, SR)
        y = signal.filtfilt(b, a, y)
    return y


def fade(y, ms):
    n = int(SR * ms / 1000)
    if n > 1 and len(y) > 2 * n:
        r = np.sin(np.linspace(0, np.pi / 2, n)) ** 2
        y[:n] *= r
        y[-n:] *= r[::-1]
    return y


def level(y, lufs):
    meter = pyln.Meter(SR, block_size=0.2 if len(y) / SR < 1.0 else 0.4)
    try:
        cur = meter.integrated_loudness(y)
        if np.isfinite(cur):
            y = y * (10 ** ((lufs - cur) / 20))
    except Exception:
        pass
    pk = np.max(np.abs(y)) + 1e-9
    if pk > 0.89:  # -1 dBFS ceiling
        y = y * (0.89 / pk)
    return y


def saw_from_cough(y):
    """A leopard's sawing call is a series of coughs, alternating in- and out-breath.
    Build one from the single recorded cough: varied level, slight pitch and timing variation."""
    y = y / (np.max(np.abs(y)) + 1e-9)
    parts = []
    rng = np.random.default_rng(7)
    n = 9
    for i in range(n):
        g = 1.0 if i % 2 == 0 else 0.62  # out-breath stronger than in-breath
        g *= 1.0 - 0.45 * (i / (n - 1)) ** 1.5  # the series fades
        st = rng.uniform(-0.6, 0.4)
        c = librosa.effects.pitch_shift(y, sr=SR, n_steps=st - (0.8 if i % 2 else 0))
        c = c * g
        parts.append(c)
        gap = 0.17 if i % 2 == 0 else 0.29
        parts.append(np.zeros(int(SR * (gap + rng.uniform(-0.02, 0.03)))))
    return np.concatenate(parts)


meta = {}
for cid, s in CALLS.items():
    if ONLY and cid not in ONLY:
        continue
    y, _ = librosa.load(os.path.join(RAW, s["src"] + ".wav"), sr=SR, mono=True)
    y = y.astype(np.float64)
    noise = None
    if s["noise"]:
        a, b = s["noise"]
        noise = y[int(a * SR):int(b * SR)].copy()
    if s["seg"] == "saw":
        z = saw_from_cough(y)
    else:
        pieces = []
        for (a, b) in s["seg"]:
            p = y[int(a * SR):int(b * SR)].copy()
            pieces.append(fade(p, 25))
            if s["gap"]:
                pieces.append(np.zeros(int(SR * s["gap"])))
        z = np.concatenate(pieces[:-1] if s["gap"] else pieces)
    z = butter(z, s["hp"], s["lp"])
    if s["notch"]:
        z = notch(z, s["notch"])
    if s["nr"] > 0:
        kw = dict(y=z, sr=SR, prop_decrease=s["nr"], stationary=noise is not None, n_fft=2048)
        if noise is not None:
            nz = butter(noise, s["hp"], s["lp"])
            if s["notch"]:
                nz = notch(nz, s["notch"])
            kw["y_noise"] = nz
        z = nr.reduce_noise(**kw)
    z = fade(z, s["fade"])
    z = level(z, s["lufs"])
    # a little air on each end
    z = np.concatenate([np.zeros(int(SR * 0.04)), z, np.zeros(int(SR * 0.12))])
    wav = os.path.join(WORK, f"{cid}.wav")
    sf.write(wav, z.astype(np.float32), SR)
    m4a = os.path.join(OUT, f"{cid}.m4a")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-c:a", "aac", "-b:a", "72k", "-movflags", "+faststart", m4a], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-c:a", "libopus", "-b:a", "64k", "-vbr", "on", "-application", "audio", os.path.join(OUT, f"{cid}.webm")], check=True)
    meta[cid] = round(len(z) / SR, 2)
    print(f"{cid:16s} {meta[cid]:5.2f}s  {os.path.getsize(m4a) // 1024}KB")

if ONLY:
    raise SystemExit(0)
# music bed: 0:22 to 12:48, 4 s fades baked in, stereo
src = os.path.join(RAW, "Chris_Zabriskie_-_01_-_The_Dark_Glow_of_the_Mountains.mp3")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "22", "-to", "768", "-i", src,
                "-af", "afade=t=in:st=0:d=4,afade=t=out:st=742:d=4,loudnorm=I=-20:TP=-1.5:LRA=7",
                "-ar", "44100", "-c:a", "aac", "-b:a", "80k", "-movflags", "+faststart", os.path.join(MUSIC, "music-dark-glow.m4a")], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "22", "-to", "768", "-i", src,
                "-af", "afade=t=in:st=0:d=4,afade=t=out:st=742:d=4,loudnorm=I=-20:TP=-1.5:LRA=7",
                "-ar", "48000", "-c:a", "libopus", "-b:a", "56k", "-vbr", "on", "-application", "audio", os.path.join(MUSIC, "music-dark-glow.webm")], check=True)
print("music", os.path.getsize(os.path.join(MUSIC, "music-dark-glow.m4a")) // 1024, "KB")
