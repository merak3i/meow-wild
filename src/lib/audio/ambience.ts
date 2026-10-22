/**
 * Sound for the descent, in three layers, all off until the visitor turns it on.
 *
 * 1. Ambience, synthesised in the browser and steered by the same world
 *    parameters that drive the picture: wind on the roof of the world, drip
 *    inside the cloud, birds and cicadas in the forests, water at the river,
 *    frogs and crickets at dusk.
 * 2. A music bed (Chris Zabriskie, "The Dark Glow of the Mountains", CC BY-NC
 *    3.0), streamed, darkened as the descent goes down and ducked under calls.
 * 3. Real recordings of each cat that has one (public/sound/calls, AAC with
 *    an Opus fallback), played once as it appears,
 *    panned to where it stands, with a little air from the landscape around it.
 *    The house cat at the window purrs for as long as you stay.
 * 4. The crossings between cats, scored like a film from those same
 *    recordings, processed here in the browser: the arriving cat's voice
 *    swells up in reverse out of a long reverb and lands as its call, with the
 *    same voice an octave down for weight; the cat you leave echoes away down
 *    the valley; while a chapter or teaser holds the screen, the next cat's
 *    voice drifts through it slowed and far off; and each chapter title lands
 *    on a low boom made from that voice.
 * 5. The walk: Vismay's narration (public/sound/walk) over an ambient beat,
 *    which takes the music bed's place while the walk runs.
 */

type Ctx = AudioContext;

function noiseBuffer(ctx: Ctx, kind: "white" | "pink" | "brown", seconds = 4): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === "white") d[i] = w * 0.5;
    else if (kind === "pink") {
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    } else {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2;
    }
  }
  return buf;
}

interface Layer {
  gain: GainNode;
  level: number;
}

/** cats with a real recording (public/sound/calls/<id>.m4a), and how loud each sits in the mix */
export const CALL_GAIN: Record<string, number> = {
  "snow-leopard": 0.8,
  puma: 0.6,
  "eurasian-lynx": 0.6,
  caracal: 0.6,
  "clouded-leopard": 0.75,
  leopard: 0.75,
  serval: 0.6,
  tiger: 0.7,
  margay: 0.8,
  jaguar: 0.85,
  "sand-cat": 0.75,
  "pallass-cat": 0.8,
  "asian-golden-cat": 0.75,
  ocelot: 0.75,
  "fishing-cat": 0.75,
  // the purr is not a call: it loops, in grains, while you stay at the window
  "domestic-cat": 0.7,
};

/** breaths of the purr recording (seconds), each cut in a quiet moment between two breaths */
const PURR_BREATHS: [number, number][] = [
  [3.9, 5.6],
  [5.6, 7.3],
  [7.3, 9.0],
];
const PURR_XF = 0.14;
/** music level in the mix: about -28 LUFS at the output, ducked 7 dB under a call */
const MUSIC = 0.7;

/** how much low weight each cat's call gets when it lands: its own voice an octave down, under 220 Hz */
const CINE_WEIGHT: Record<string, number> = {
  "snow-leopard": 0.55,
  puma: 0.6,
  "eurasian-lynx": 0.45,
  caracal: 0.4,
  "clouded-leopard": 0.6,
  leopard: 0.9,
  serval: 0.35,
  tiger: 1,
  margay: 0.2,
  jaguar: 0.95,
  "sand-cat": 0.25,
  "pallass-cat": 0.3,
  "asian-golden-cat": 0.35,
  ocelot: 0.3,
  "fishing-cat": 0.35,
};
/** length of the reversed-reverb swell that rises into a call (seconds) */
export const SWELL_S = 1.9;
/** ghost voices between cats, relative to a call */
const GHOST = 0.9;
/** the walk's beat under the narration, and how far it dips in the speech band while Vismay talks (dB) */
const BEATS = 0.5;
/** the synthesised landscape sits under the cats: this is its level on the master */
const AMB = 0.55;
const BEATS_DIP = -8;

/** a Hann window for grains */
const HANN = new Float32Array(64).map((_, i) => 0.5 - 0.5 * Math.cos((i / 63) * Math.PI * 2));

interface CallInfo {
  /** where any sound begins (seconds): a call plays from here, quiet breaths before it included */
  lead: number;
  /** where the voice proper begins (seconds): the swell peaks and the weight lands exactly here */
  onset: number;
  /** 20 ms frames with voice in them (start times, seconds): where ghost grains come from */
  voiced: Float32Array;
}

/** a cat's call scheduled behind its swell, until it has begun */
interface Arrival {
  id: string;
  at: number;
  end: number;
  swell: AudioBufferSourceNode;
  swellGain: GainNode;
  call: AudioBufferSourceNode;
  sub: AudioBufferSourceNode | null;
}

/** a line of narration in flight */
export interface Spoken {
  start: number;
  end: number;
  stop: () => void;
}

/** where a call has a voice, and where it starts */
function analyse(buf: AudioBuffer): CallInfo {
  const d = buf.getChannelData(0);
  const hop = Math.max(1, Math.round(buf.sampleRate * 0.02));
  const n = Math.floor(d.length / hop);
  const rms = new Float32Array(n);
  let peak = 1e-9;
  for (let f = 0; f < n; f++) {
    let sum = 0;
    for (let i = f * hop, e = i + hop; i < e; i++) sum += d[i] * d[i];
    rms[f] = Math.sqrt(sum / hop);
    if (rms[f] > peak) peak = rms[f];
  }
  let on = 0;
  while (on < n && rms[on] < peak * 0.12) on++;
  let lead = 0;
  while (lead < on && rms[lead] < peak * 0.012) lead++;
  const voiced: number[] = [];
  for (let f = 0; f < n - 12; f++) if (rms[f] > peak * 0.2) voiced.push(f * 0.02);
  return { lead: Math.max(0, lead * 0.02 - 0.03), onset: Math.max(0, on * 0.02 - 0.012), voiced: Float32Array.from(voiced) };
}

/** equal-power fade curves for the purr grains */
const FADE_IN = new Float32Array(32).map((_, i) => Math.sin((i / 31) * Math.PI * 0.5));
const FADE_OUT = new Float32Array(32).map((_, i) => Math.cos((i / 31) * Math.PI * 0.5));

/**
 * AAC where the browser has it (Safari, Chrome, Edge), Opus in WebM where it
 * does not (Chromium builds without proprietary codecs, some Firefox installs).
 */
function soundExt(): "m4a" | "webm" {
  try {
    const a = new Audio();
    return a.canPlayType('audio/mp4; codecs="mp4a.40.2"') ? "m4a" : "webm";
  } catch {
    return "m4a";
  }
}

/** a decaying stereo noise tail: an outdoor space rather than a room */
function impulse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (t < 0.002 ? t / 0.002 : 1);
    }
  }
  return buf;
}

export class Ambience {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private layers: Record<string, Layer> = {};
  private windFilter: BiquadFilterNode | null = null;
  private timer = 0;
  private lastUpdate = 0;
  private on = false;
  private levels = { wind: 0, rain: 0, birds: 0, cicada: 0, crickets: 0, frogs: 0, water: 0, purr: 0 };
  private music: HTMLAudioElement | null = null;
  private musicGain: GainNode | null = null;
  private musicTone: BiquadFilterNode | null = null;
  private callBus: GainNode | null = null;
  private wet: GainNode | null = null;
  private meter: AnalyserNode | null = null;
  private meterData: Float32Array<ArrayBuffer> | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loading = false;
  private lastCall = new Map<string, number>();
  private busyUntil = 0;
  private speaking: { id: string; until: number } | null = null;
  private purrGain: GainNode | null = null;
  private purrOn = false;
  private purrNext = 0;
  private purrLast = -1;
  private voiceLevel = 0;
  private ext: "m4a" | "webm" = "m4a";
  // cinematic crossings
  private info = new Map<string, CallInfo>();
  private swells = new Map<string, AudioBuffer>();
  private swelling = new Set<string>();
  private arrival: Arrival | null = null;
  private echoed = new Map<string, number>();
  private boomed = new Map<string, number>();
  private cineIn: GainNode | null = null;
  private echoIn: GainNode | null = null;
  private ghostBus: GainNode | null = null;
  private ghostTone: BiquadFilterNode | null = null;
  private ghostId: string | null = null;
  private ghostLevel = 0;
  private ghostMotion = 0;
  private ghostNext = 0;
  private sendCine: GainNode | null = null;
  /** the synthesised landscape, as one: it holds its breath while a cat arrives */
  private ambBus: GainNode | null = null;
  private hushUntil = 0;
  private ambTarget = AMB;
  private ghostSet = { level: -1, tone: -1 };
  // the walk
  private walking = false;
  private beats: HTMLAudioElement | null = null;
  private beatsGain: GainNode | null = null;
  private beatsDip: BiquadFilterNode | null = null;
  private voiceBus: GainNode | null = null;
  private lines = new Map<string, Promise<AudioBuffer | null>>();
  private spoken: Spoken | null = null;
  private ambScale = 1;

  get running() {
    return this.on;
  }

  start() {
    if (typeof window === "undefined") return;
    if (!this.ctx) this.build();
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    ctx.resume().catch(() => {});
    // a sound the visitor asked for plays like a video does, even with the ringer off (iOS 17+)
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) {
      try {
        session.type = "playback";
      } catch {
        /* older engines */
      }
    }
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setTargetAtTime(0.55, ctx.currentTime, 0.6);
    this.on = true;
    this.load();
    if (this.walking) {
      this.beats?.play().catch(() => {});
    } else if (this.music) {
      this.music.play().catch(() => {});
      this.musicGain?.gain.setTargetAtTime(MUSIC, ctx.currentTime, 1.5);
    }
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.events(), 110);
  }

  stop() {
    const ctx = this.ctx;
    this.on = false;
    window.clearInterval(this.timer);
    if (!ctx || !this.master) return;
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    window.setTimeout(() => {
      if (!this.on) {
        this.music?.pause();
        this.beats?.pause();
        ctx.suspend().catch(() => {});
      }
    }, 1200);
  }

  dispose() {
    window.clearInterval(this.timer);
    this.music?.pause();
    this.music = null;
    this.beats?.pause();
    this.beats = null;
    this.purrOn = false;
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }

  /** Fetch and decode the calls, once, the first time sound is turned on. */
  private load() {
    if (this.loading || !this.ctx) return;
    this.loading = true;
    const ctx = this.ctx;
    for (const id of Object.keys(CALL_GAIN)) {
      fetch(`/sound/calls/${id}.${this.ext}`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
        .then((b) => ctx.decodeAudioData(b))
        .then((buf) => {
          this.buffers.set(id, buf);
          if (id !== "domestic-cat") this.info.set(id, analyse(buf));
        })
        .catch(() => {});
    }
  }

  /** the stereo position for a cat standing at `pan` (-1 left .. 1 right) */
  private panner(pan: number, spread = 0.6): StereoPannerNode {
    const p = (this.ctx as Ctx).createStereoPanner();
    p.pan.value = Math.max(-0.85, Math.min(0.85, pan * spread));
    return p;
  }

  /** duck the music bed (or the walk's beat) from `t` for `dur` seconds, to `depth` of its level */
  private duck(t: number, dur: number, depth: number) {
    const g = this.walking ? this.beatsGain?.gain : this.musicGain?.gain;
    const full = this.walking ? BEATS : MUSIC;
    if (!g) return;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(full * depth, t, 0.25);
    g.setTargetAtTime(full, t + dur + 0.4, 1.4);
  }

  /**
   * Play a cat's call at `t`, from its first sound, panned to where it stands,
   * with a touch of the big space and, for the heavier cats, its own voice an
   * octave down under 220 Hz so the call lands with some weight.
   */
  private playCall(id: string, pan: number, t: number): { src: AudioBufferSourceNode; sub: AudioBufferSourceNode | null; end: number } | null {
    const ctx = this.ctx;
    const buf = this.buffers.get(id);
    if (!ctx || !buf || !this.callBus) return null;
    const info = this.info.get(id);
    const lead = info?.lead ?? 0;
    const onset = info?.onset ?? 0;
    const hit = t + (onset - lead);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = CALL_GAIN[id] ?? 0.6;
    const p = this.panner(pan);
    src.connect(g).connect(p).connect(this.callBus);
    if (this.sendCine) p.connect(this.sendCine);
    src.start(t, lead);
    let sub: AudioBufferSourceNode | null = null;
    const w = CINE_WEIGHT[id] ?? 0;
    if (w > 0.05 && this.master) {
      sub = ctx.createBufferSource();
      sub.buffer = buf;
      sub.playbackRate.value = 0.5;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 220;
      lp.Q.value = 0.6;
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0, hit);
      sg.gain.linearRampToValueAtTime(w * 1.25, hit + 0.025);
      sg.gain.exponentialRampToValueAtTime(0.0008, hit + 1.15);
      sub.connect(lp).connect(sg).connect(this.master);
      sub.start(hit, onset);
      sub.stop(hit + 1.25);
    }
    return { src, sub, end: t + (buf.duration - lead) };
  }

  /** the landscape goes quiet from `t` for `dur` seconds (to `depth` of its level), then comes back */
  private hush(t: number, dur: number, depth: number) {
    const g = this.ambBus?.gain;
    if (!g) return;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(AMB * depth, t, 0.35);
    g.setTargetAtTime(AMB, t + dur, 1.2);
    this.hushUntil = Math.max(this.hushUntil, t + dur + 1.5);
    this.ambTarget = AMB;
  }

  /** may this cat call now? one voice at a time, and not the same cat twice within 40 s */
  private free(id: string, now: number) {
    if (now < this.busyUntil) return false;
    return now - (this.lastCall.get(id) ?? -1e9) >= 40;
  }

  /**
   * A cat has just appeared and there is no swell ready for it yet: play its
   * recording once, panned to where it stands on screen (-1 left .. 1 right).
   */
  call(id: string, pan = 0) {
    const ctx = this.ctx;
    if (!this.on || !ctx || !this.callBus || id === "domestic-cat") return false;
    const now = ctx.currentTime;
    if (!this.buffers.has(id) || !this.free(id, now)) return false;
    const t = now + 0.05;
    const c = this.playCall(id, pan, t);
    if (!c) return false;
    this.lastCall.set(id, t);
    this.duck(t, c.end - t, 0.45);
    this.hush(t, c.end - t, 0.5);
    this.busyUntil = c.end + 1.2;
    this.speaking = { id, until: c.end };
    return true;
  }

  /** Render, once, the swell that rises into a cat's call. Cheap, and done before the cat arrives. */
  prepare(id: string) {
    if (!this.ctx || this.swells.has(id) || this.swelling.has(id) || !this.info.has(id)) return;
    this.swelling.add(id);
    this.renderSwell(id)
      .then((b) => {
        if (b) this.swells.set(id, b);
      })
      .catch(() => {})
      .finally(() => this.swelling.delete(id));
  }

  /**
   * The pre-verb: the first moments of the call, reversed, sent through a long
   * reverb, and reversed back, so the reverb rises toward the call instead of
   * trailing after it, and peaks on the very sample the call begins.
   */
  private async renderSwell(id: string): Promise<AudioBuffer | null> {
    const ctx = this.ctx;
    const buf = this.buffers.get(id);
    const info = this.info.get(id);
    const W = window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext; webkitOfflineAudioContext?: typeof OfflineAudioContext };
    const OAC = W.OfflineAudioContext || W.webkitOfflineAudioContext;
    if (!ctx || !buf || !info || !OAC) return null;
    const sr = buf.sampleRate;
    const rate = 0.92;
    const o = Math.floor(info.onset * sr);
    const segLen = Math.max(1, Math.min(Math.floor(1.3 * sr), buf.length - o));
    const tOn = Math.round(segLen / rate);
    const len = tOn + Math.ceil(SWELL_S * sr) + 2;
    const off = new OAC(2, len, sr);
    const rev = off.createBuffer(1, segLen, sr);
    const sd = buf.getChannelData(0);
    const rd = rev.getChannelData(0);
    for (let i = 0; i < segLen; i++) rd[i] = sd[o + segLen - 1 - i];
    const src = off.createBufferSource();
    src.buffer = rev;
    src.playbackRate.value = rate;
    const conv = off.createConvolver();
    conv.buffer = impulse(off, SWELL_S, 2.4);
    const hp = off.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 170;
    const lp = off.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 5200;
    src.connect(conv).connect(hp).connect(lp).connect(off.destination);
    src.start(0);
    const out = await off.startRendering();
    // reversed, the reverb of the call's first sound ends `len - 1 - tOn` samples in
    const keep = len - 1 - tOn;
    const swell = ctx.createBuffer(2, keep, sr);
    let peak = 1e-9;
    for (let c = 0; c < 2; c++) {
      const y = out.getChannelData(Math.min(c, out.numberOfChannels - 1));
      const d = swell.getChannelData(c);
      for (let i = 0; i < keep; i++) {
        const v = y[len - 1 - i];
        d[i] = v;
        if (Math.abs(v) > peak) peak = Math.abs(v);
      }
    }
    const fadeIn = Math.floor(keep * 0.35);
    const fadeOut = Math.floor(sr * 0.004);
    const k = 0.8 / peak;
    for (let c = 0; c < 2; c++) {
      const d = swell.getChannelData(c);
      for (let i = 0; i < keep; i++) {
        let g = k;
        if (i < fadeIn) g *= (i / fadeIn) * (i / fadeIn);
        if (i > keep - fadeOut) g *= (keep - i) / fadeOut;
        d[i] *= g;
      }
    }
    return swell;
  }

  /**
   * A cat is arriving: its voice swells up out of the reverb and the call lands
   * on the swell's peak. Returns false when it cannot (no swell yet, another cat
   * still calling, or this one called a moment ago); the caller then waits and
   * uses call() as before.
   */
  arrive(id: string, pan = 0) {
    const ctx = this.ctx;
    if (!this.on || !ctx || !this.master || id === "domestic-cat") return false;
    const swell = this.swells.get(id);
    if (!swell || this.arrival) return false;
    const now = ctx.currentTime;
    if (!this.free(id, now)) return false;
    const info = this.info.get(id);
    const gap = info ? info.onset - info.lead : 0;
    const t0 = now + 0.03;
    // the call starts at `at` (quiet breaths first, if it has them); the swell peaks on its first real sound
    const at = gap >= swell.duration ? t0 : t0 + swell.duration - gap;
    const ts = at + gap - swell.duration;
    const c = this.playCall(id, pan, at);
    if (!c) return false;
    const s = ctx.createBufferSource();
    s.buffer = swell;
    const sg = ctx.createGain();
    sg.gain.value = CALL_GAIN[id] ?? 0.6;
    const sp = this.panner(pan, 0.45);
    s.connect(sg).connect(sp);
    if (this.master) sp.connect(this.master);
    if (this.sendCine) sp.connect(this.sendCine);
    s.start(ts);
    this.arrival = { id, at, end: c.end, swell: s, swellGain: sg, call: c.src, sub: c.sub };
    this.lastCall.set(id, at);
    this.busyUntil = c.end + 1.2;
    this.speaking = { id, until: c.end };
    const duckFrom = ts + swell.duration * 0.5;
    this.duck(duckFrom, c.end - duckFrom, 0.45);
    this.hush(ts, c.end - ts, 0.42);
    return true;
  }

  /** The visitor turned back before the call began: let the swell fall away and keep the call for next time. */
  cancel(id: string): boolean {
    const ctx = this.ctx;
    const a = this.arrival;
    if (!ctx || !a || a.id !== id) return false;
    const now = ctx.currentTime;
    if (now > a.at - 0.06) return false;
    a.swellGain.gain.cancelScheduledValues(now);
    a.swellGain.gain.setTargetAtTime(0, now, 0.07);
    try {
      a.swell.stop(now + 0.45);
      a.call.stop();
      a.sub?.stop();
    } catch {
      /* already stopped */
    }
    this.arrival = null;
    this.lastCall.delete(id);
    this.busyUntil = now + 0.3;
    this.speaking = null;
    this.duck(now, 0, 1);
    return true;
  }

  /** where a cat's call stands: "none", "pending" (behind its swell) or "playing", and when it ends */
  callState(id: string): { state: "none" | "pending" | "playing"; end: number } {
    const ctx = this.ctx;
    if (!ctx) return { state: "none", end: 0 };
    const now = ctx.currentTime;
    const a = this.arrival;
    if (a && a.id === id && now < a.end) return { state: now < a.at ? "pending" : "playing", end: a.end };
    if (this.speaking && this.speaking.id === id && now < this.speaking.until) return { state: "playing", end: this.speaking.until };
    return { state: "none", end: 0 };
  }

  /**
   * The visitor is moving on from a cat that has called: its call comes back
   * once more, slower and darker, from far down the valley.
   */
  depart(id: string, pan = 0) {
    const ctx = this.ctx;
    if (!this.on || !ctx || !this.echoIn || !this.cineIn || id === "domestic-cat") return;
    const buf = this.buffers.get(id);
    const started = this.lastCall.get(id);
    if (!buf || started === undefined) return;
    const now = ctx.currentTime;
    if (now < started + 0.4 || now - started > 90) return;
    if (now - (this.echoed.get(id) ?? -1e9) < 40) return;
    // leaving while it still calls: the answer comes as the call ends, not over it
    const end = this.speaking && this.speaking.id === id ? this.speaking.until : 0;
    if (end - now > 3) return;
    this.echoed.set(id, now);
    const onset = this.info.get(id)?.onset ?? 0;
    const rate = 0.86;
    const dur = Math.min(3.6, (buf.duration - onset) / rate);
    const t = Math.max(now + 0.04, end + 0.15);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 150;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1500;
    const g = ctx.createGain();
    const level = (CALL_GAIN[id] ?? 0.6) * 0.85;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 0.3);
    g.gain.setTargetAtTime(0, t + Math.max(0.4, dur - 1.1), 0.35);
    const p = this.panner(pan, 0.9);
    src.connect(hp).connect(lp).connect(g).connect(p);
    p.connect(this.echoIn);
    p.connect(this.cineIn);
    src.start(t, onset);
    src.stop(t + dur + 0.1);
  }

  /**
   * Between cats, while a chapter or teaser holds the screen: the next cat's
   * voice, cut into grains, slowed an octave and scattered far off in the big
   * reverb. `level` 0..1 follows the pinned section; `motion` 0..1 (scrolling)
   * brightens it.
   */
  ghost(id: string | null, level: number, motion = 0) {
    const ok = !!id && this.buffers.has(id) && (this.info.get(id)?.voiced.length ?? 0) > 0;
    this.ghostId = ok ? id : null;
    this.ghostLevel = ok ? Math.max(0, Math.min(1, level)) : 0;
    this.ghostMotion = Math.max(0, Math.min(1, motion));
  }

  private ghostTick() {
    const ctx = this.ctx;
    if (!ctx || !this.ghostBus || !this.ghostTone) return;
    const now = ctx.currentTime;
    const lvl = this.ghostLevel * GHOST;
    if (Math.abs(lvl - this.ghostSet.level) > 0.01) {
      this.ghostBus.gain.setTargetAtTime(lvl, now, 0.6);
      this.ghostSet.level = lvl;
    }
    const tone = 900 + 1800 * this.ghostMotion;
    if (Math.abs(tone - this.ghostSet.tone) > 40) {
      this.ghostTone.frequency.setTargetAtTime(tone, now, 0.5);
      this.ghostSet.tone = tone;
    }
    // the landscape thins out a little while the voices drift through (unless a cat has it hushed)
    const amb = AMB * (1 - 0.35 * this.ghostLevel);
    if (this.ambBus && now > this.hushUntil && Math.abs(amb - this.ambTarget) > 0.01) {
      this.ambBus.gain.setTargetAtTime(amb, now, 0.8);
      this.ambTarget = amb;
    }
    const id = this.ghostId;
    if (!id || this.ghostLevel < 0.02) {
      this.ghostNext = now;
      return;
    }
    const buf = this.buffers.get(id);
    const info = this.info.get(id);
    if (!buf || !info || !info.voiced.length) return;
    let n = 0;
    while (this.ghostNext < now + 0.4 && n++ < 8) {
      const t = Math.max(this.ghostNext, now + 0.02);
      const d = 0.38 + Math.random() * 0.42;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = 0.5 + Math.random() * 0.12;
      const g = ctx.createGain();
      g.gain.value = 0;
      const amp = 0.65 + Math.random() * 0.35;
      g.gain.setValueCurveAtTime(HANN.map((v) => v * amp), t, d);
      const p = ctx.createStereoPanner();
      p.pan.value = Math.random() * 1.5 - 0.75;
      src.connect(g).connect(p).connect(this.ghostBus);
      const pos = info.voiced[Math.floor(Math.random() * info.voiced.length)];
      src.start(t, Math.max(0, pos - 0.04));
      src.stop(t + d + 0.05);
      this.ghostNext = t + d * 0.42;
    }
  }

  /** A chapter title lands: a long low boom, made from the voice of the cat the chapter is about to show. */
  boom(id: string) {
    const ctx = this.ctx;
    if (!this.on || !ctx || !this.master || !this.cineIn) return;
    const buf = this.buffers.get(id);
    if (!buf) return;
    const now = ctx.currentTime;
    if (now - (this.boomed.get(id) ?? -1e9) < 40) return;
    this.boomed.set(id, now);
    const onset = this.info.get(id)?.onset ?? 0;
    const t = now + 0.03;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 0.45;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 190;
    lp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1.7, t + 0.06);
    this.hush(t, 1.6, 0.5);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 2.6);
    src.connect(lp).connect(g);
    g.connect(this.master);
    g.connect(this.cineIn);
    src.start(t, onset);
    src.stop(t + 2.7);
  }

  /** the audio clock (seconds); the walk times everything on it, so a pause stops the walk too */
  get now() {
    return this.ctx?.currentTime ?? 0;
  }

  /** Walk mode: the ambient beat takes the music bed's place, and gives it back after. */
  walkMode(on: boolean) {
    const ctx = this.ctx;
    if (!ctx || on === this.walking) return;
    this.walking = on;
    this.ambScale = on ? 0.7 : 1;
    const now = ctx.currentTime;
    if (on) {
      if (!this.beats) this.buildBeats();
      this.beats?.play().catch(() => {});
      this.beatsGain?.gain.cancelScheduledValues(now);
      this.beatsGain?.gain.setTargetAtTime(BEATS, now, 1.2);
      this.musicGain?.gain.cancelScheduledValues(now);
      this.musicGain?.gain.setTargetAtTime(0, now, 0.8);
      window.setTimeout(() => {
        if (this.walking) this.music?.pause();
      }, 4000);
    } else {
      this.beatsGain?.gain.cancelScheduledValues(now);
      this.beatsGain?.gain.setTargetAtTime(0, now, 1.4);
      window.setTimeout(() => {
        if (!this.walking) this.beats?.pause();
      }, 6500);
      if (this.on && this.music) {
        this.music.play().catch(() => {});
        this.musicGain?.gain.cancelScheduledValues(now);
        this.musicGain?.gain.setTargetAtTime(MUSIC, now + 1.5, 1.6);
      }
    }
  }

  private buildBeats() {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    try {
      const el = new Audio();
      el.src = `/sound/walk/beats.${this.ext}`;
      el.loop = true;
      el.preload = "auto";
      const src = ctx.createMediaElementSource(el);
      // a wide dip in the speech band, opened while Vismay talks, so the beat keeps its low end
      const dip = ctx.createBiquadFilter();
      dip.type = "peaking";
      dip.frequency.value = 1500;
      dip.Q.value = 0.45;
      dip.gain.value = 0;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(dip).connect(g).connect(this.master);
      this.beats = el;
      this.beatsGain = g;
      this.beatsDip = dip;
    } catch {
      this.beats = null;
    }
  }

  /** Fetch and decode one line of the narration (kept for a while; the browser caches the file). */
  line(id: string): Promise<AudioBuffer | null> {
    const ctx = this.ctx;
    if (!ctx) return Promise.resolve(null);
    let p = this.lines.get(id);
    if (!p) {
      p = fetch(`/sound/walk/${id}.${this.ext}`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
        .then((b) => ctx.decodeAudioData(b))
        .catch(() => null);
      this.lines.set(id, p);
      if (this.lines.size > 8) {
        const first = this.lines.keys().next().value;
        if (first !== undefined && first !== id) this.lines.delete(first);
      }
    }
    return p;
  }

  /** Say a line now, over the beat, which dips in the speech band underneath it. */
  speak(buf: AudioBuffer): Spoken | null {
    const ctx = this.ctx;
    if (!ctx || !this.voiceBus) return null;
    this.spoken?.stop();
    const t = ctx.currentTime + 0.06;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 1;
    src.connect(g).connect(this.voiceBus);
    src.start(t);
    const end = t + buf.duration;
    const dip = this.beatsDip?.gain;
    if (dip) {
      dip.cancelScheduledValues(t - 0.05);
      dip.setTargetAtTime(BEATS_DIP, t - 0.2, 0.12);
      dip.setTargetAtTime(0, end + 0.15, 0.5);
    }
    const spoken: Spoken = {
      start: t,
      end,
      stop: () => {
        const n = ctx.currentTime;
        g.gain.cancelScheduledValues(n);
        g.gain.setTargetAtTime(0, n, 0.08);
        try {
          src.stop(n + 0.4);
        } catch {
          /* already stopped */
        }
        if (dip) {
          dip.cancelScheduledValues(n);
          dip.setTargetAtTime(0, n, 0.3);
        }
        if (this.spoken === spoken) this.spoken = null;
      },
    };
    this.spoken = spoken;
    return spoken;
  }

  /** The walk's pause: everything holds where it is, voice, beat and world, until it carries on. */
  hold(on: boolean) {
    const ctx = this.ctx;
    if (!ctx) return;
    if (on) {
      ctx.suspend().catch(() => {});
      this.beats?.pause();
    } else {
      ctx.resume().catch(() => {});
      if (this.walking) this.beats?.play().catch(() => {});
    }
  }

  /**
   * Which cat is making a sound right now, and how loud it is (0..1, smoothed):
   * lets a photograph breathe with its own voice.
   */
  voice(): { id: string; level: number } | null {
    const ctx = this.ctx;
    if (!this.on || !ctx || !this.meter || !this.meterData) return null;
    this.meter.getFloatTimeDomainData(this.meterData);
    let sum = 0;
    for (let i = 0; i < this.meterData.length; i++) sum += this.meterData[i] * this.meterData[i];
    const db = 10 * Math.log10(sum / this.meterData.length + 1e-12);
    const target = Math.min(1, Math.max(0, (db + 52) / 32));
    this.voiceLevel += (target - this.voiceLevel) * (target > this.voiceLevel ? 0.5 : 0.12);
    const now = ctx.currentTime;
    if (this.speaking && now < this.speaking.until + 0.3) return { id: this.speaking.id, level: this.voiceLevel };
    if (this.purrOn) return { id: "domestic-cat", level: this.voiceLevel };
    return null;
  }

  /**
   * The house cat purrs while you stay at the window. A loop would repeat one
   * breath pattern; instead each breath of the recording is played as a grain,
   * in a shuffled order, slightly varied in pitch and level, crossfaded in the
   * quiet between breaths. It never repeats the same way twice.
   */
  private purr(on: boolean) {
    const ctx = this.ctx;
    const buf = this.buffers.get("domestic-cat");
    if (!ctx || !this.callBus || !buf) return;
    if (!this.purrGain) {
      this.purrGain = ctx.createGain();
      this.purrGain.gain.value = 0;
      this.purrGain.connect(this.callBus);
    }
    const now = ctx.currentTime;
    if (on !== this.purrOn) {
      this.purrOn = on;
      this.purrGain.gain.cancelScheduledValues(now);
      this.purrGain.gain.setTargetAtTime(on ? 0.6 : 0, now, on ? 1.0 : 0.45);
      if (on) this.purrNext = Math.max(this.purrNext, now + 0.05);
    }
    if (!this.purrOn) return;
    while (this.purrNext < now + 0.7) {
      let k = Math.floor(Math.random() * PURR_BREATHS.length);
      if (k === this.purrLast) k = (k + 1) % PURR_BREATHS.length;
      this.purrLast = k;
      const [a, b] = PURR_BREATHS[k];
      const rate = 0.97 + Math.random() * 0.06;
      const len = (b - a) / rate;
      const t = Math.max(this.purrNext, now + 0.02);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      const g = ctx.createGain();
      const level = 0.88 + Math.random() * 0.17;
      g.gain.value = 0;
      g.gain.setValueCurveAtTime(FADE_IN.map((v) => v * level), t - PURR_XF / 2, PURR_XF);
      g.gain.setValueCurveAtTime(FADE_OUT.map((v) => v * level), t + len - PURR_XF / 2, PURR_XF);
      src.connect(g).connect(this.purrGain);
      src.start(t - PURR_XF / 2, a - (PURR_XF / 2) * rate);
      src.stop(t + len + PURR_XF);
      this.purrNext = t + len;
    }
  }

  private build() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.ext = soundExt();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(comp).connect(ctx.destination);
    this.master = master;

    // calls: dry into the master, plus a send into an outdoor reverb
    const callBus = ctx.createGain();
    callBus.gain.value = 1;
    callBus.connect(master);
    const rev = ctx.createConvolver();
    rev.buffer = impulse(ctx, 2.6, 3.2);
    const wet = ctx.createGain();
    wet.gain.value = 0.25;
    callBus.connect(rev).connect(wet).connect(master);
    this.callBus = callBus;
    this.wet = wet;
    const meter = ctx.createAnalyser();
    meter.fftSize = 512;
    callBus.connect(meter);
    this.meter = meter;
    this.meterData = new Float32Array(meter.fftSize);

    // the big space for the crossings between cats: long and dark, a valley rather than a room (wet only)
    const cineIn = ctx.createGain();
    const cineTone = ctx.createBiquadFilter();
    cineTone.type = "lowpass";
    cineTone.frequency.value = 3200;
    const cineRev = ctx.createConvolver();
    cineRev.buffer = impulse(ctx, 5.2, 2.2);
    const cineWet = ctx.createGain();
    cineWet.gain.value = 0.8;
    cineIn.connect(cineTone).connect(cineRev).connect(cineWet).connect(master);
    this.cineIn = cineIn;
    const sendCine = ctx.createGain();
    sendCine.gain.value = 0.14;
    sendCine.connect(cineIn);
    this.sendCine = sendCine;
    // echoes: a darkening repeat across the valley, into the same space
    const echoIn = ctx.createGain();
    const dl = ctx.createDelay(2);
    dl.delayTime.value = 0.43;
    const dlTone = ctx.createBiquadFilter();
    dlTone.type = "lowpass";
    dlTone.frequency.value = 1800;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    echoIn.connect(dl);
    dl.connect(dlTone).connect(fb).connect(dl);
    const tap = ctx.createGain();
    tap.gain.value = 0.65;
    dlTone.connect(tap);
    tap.connect(master);
    tap.connect(cineIn);
    this.echoIn = echoIn;
    // ghost voices: grains of the next cat, filtered, mostly reverb
    const ghostBus = ctx.createGain();
    ghostBus.gain.value = 0;
    const ghostTone = ctx.createBiquadFilter();
    ghostTone.type = "lowpass";
    ghostTone.frequency.value = 1100;
    ghostBus.connect(ghostTone);
    ghostTone.connect(cineIn);
    const ghostDry = ctx.createGain();
    ghostDry.gain.value = 0.35;
    ghostTone.connect(ghostDry).connect(master);
    this.ghostBus = ghostBus;
    this.ghostTone = ghostTone;
    // the narration: close and dry
    const voiceBus = ctx.createGain();
    voiceBus.gain.value = 1;
    voiceBus.connect(master);
    this.voiceBus = voiceBus;

    // music: streamed from a media element so nothing waits for 7 MB to decode
    try {
      const el = new Audio();
      el.src = `/sound/music-dark-glow.${this.ext}`;
      el.loop = true;
      el.preload = "auto";
      const src = ctx.createMediaElementSource(el);
      const tone = ctx.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.value = 6000;
      tone.Q.value = 0.3;
      const mg = ctx.createGain();
      mg.gain.value = 0;
      src.connect(tone).connect(mg).connect(master);
      this.music = el;
      this.musicGain = mg;
      this.musicTone = tone;
    } catch {
      this.music = null;
    }

    const white = noiseBuffer(ctx, "white");
    const pink = noiseBuffer(ctx, "pink");
    const brown = noiseBuffer(ctx, "brown");
    const loop = (buf: AudioBuffer) => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.start(0, Math.random() * buf.duration);
      return s;
    };
    const ambBus = ctx.createGain();
    ambBus.gain.value = AMB;
    ambBus.connect(master);
    this.ambBus = ambBus;
    const layer = (name: string, input: AudioNode) => {
      const g = ctx.createGain();
      g.gain.value = 0;
      input.connect(g).connect(ambBus);
      this.layers[name] = { gain: g, level: 0 };
    };

    // wind: brown + pink noise through a wandering band-pass
    const wf = ctx.createBiquadFilter();
    wf.type = "bandpass";
    wf.frequency.value = 420;
    wf.Q.value = 0.7;
    const wl = ctx.createOscillator();
    wl.frequency.value = 0.07;
    const wlg = ctx.createGain();
    wlg.gain.value = 180;
    wl.connect(wlg).connect(wf.frequency);
    wl.start();
    const wmix = ctx.createGain();
    loop(brown).connect(wmix);
    const pw = ctx.createGain();
    pw.gain.value = 0.35;
    loop(pink).connect(pw).connect(wmix);
    wmix.connect(wf);
    this.windFilter = wf;
    layer("wind", wf);

    // rain and drip hiss inside the cloud
    const rf = ctx.createBiquadFilter();
    rf.type = "highpass";
    rf.frequency.value = 1800;
    loop(white).connect(rf);
    layer("rain", rf);

    // cicadas: a high noise band with a fast tremolo
    const cf = ctx.createBiquadFilter();
    cf.type = "bandpass";
    cf.frequency.value = 5600;
    cf.Q.value = 6;
    const ct = ctx.createGain();
    ct.gain.value = 0.5;
    const co = ctx.createOscillator();
    co.frequency.value = 38;
    const cog = ctx.createGain();
    cog.gain.value = 0.5;
    co.connect(cog).connect(ct.gain);
    co.start();
    loop(white).connect(cf).connect(ct);
    layer("cicada", ct);

    // crickets: a pure tone chirping in pulses
    const kr = ctx.createOscillator();
    kr.frequency.value = 4300;
    const kg = ctx.createGain();
    kg.gain.value = 0;
    const kp = ctx.createOscillator();
    kp.type = "square";
    kp.frequency.value = 3.1;
    const kpg = ctx.createGain();
    kpg.gain.value = 0.5;
    const kOff = ctx.createConstantSource();
    kOff.offset.value = 0.5;
    kp.connect(kpg).connect(kg.gain);
    kOff.connect(kg.gain);
    kr.connect(kg);
    kr.start();
    kp.start();
    kOff.start();
    const kAm = ctx.createGain();
    kAm.gain.value = 0.35;
    const kfast = ctx.createOscillator();
    kfast.frequency.value = 55;
    const kfg = ctx.createGain();
    kfg.gain.value = 0.35;
    kfast.connect(kfg).connect(kAm.gain);
    kfast.start();
    kg.connect(kAm);
    layer("crickets", kAm);

    // water lapping: low noise with a slow swell
    const lf = ctx.createBiquadFilter();
    lf.type = "lowpass";
    lf.frequency.value = 600;
    const lsw = ctx.createGain();
    lsw.gain.value = 0.6;
    const lo = ctx.createOscillator();
    lo.frequency.value = 0.18;
    const log = ctx.createGain();
    log.gain.value = 0.4;
    lo.connect(log).connect(lsw.gain);
    lo.start();
    loop(pink).connect(lf).connect(lsw);
    layer("water", lsw);

    // purr: a low rumble pulsing at about 25 Hz, breathing in and out
    const pf = ctx.createBiquadFilter();
    pf.type = "lowpass";
    pf.frequency.value = 160;
    const pam = ctx.createGain();
    pam.gain.value = 0.5;
    const po = ctx.createOscillator();
    po.frequency.value = 25;
    const pog = ctx.createGain();
    pog.gain.value = 0.5;
    po.connect(pog).connect(pam.gain);
    po.start();
    const breath = ctx.createGain();
    breath.gain.value = 0.6;
    const bo = ctx.createOscillator();
    bo.frequency.value = 0.42;
    const bog = ctx.createGain();
    bog.gain.value = 0.4;
    bo.connect(bog).connect(breath.gain);
    bo.start();
    loop(brown).connect(pf).connect(pam).connect(breath);
    layer("purr", breath);

    // one-shot voices (birds, drips, frogs) go straight to the master
    this.layers.birds = { gain: master, level: 0 };
    this.layers.frogs = { gain: master, level: 0 };
  }

  /** Steer the mix from the current world parameters. Cheap; called every frame. */
  update(p: Float32Array, altitude: number) {
    if (!this.on || !this.ctx) return;
    const now = performance.now();
    if (now - this.lastUpdate < 120) return;
    this.lastUpdate = now;
    const tod = p[0];
    const wind = p[3];
    const treeD = p[14];
    const forest = Math.min(1, (p[16] + p[17] + p[19]) * treeD);
    const dry = p[15];
    const water = p[20];
    const cloud = p[24];
    const snow = p[25];
    const rain = p[26];
    const mist = p[27];
    const firefly = p[28];
    const win = p[31];
    const day = tod > 0.12 && tod < 0.88 ? 1 : 0;
    const dusk = Math.max(0, Math.min(1, (tod - 0.8) / 0.12));
    const high = Math.min(1, altitude / 5500);

    const L = this.levels;
    L.wind = (0.12 + 0.55 * high) * (0.4 + wind) + snow * 0.2;
    L.rain = rain * 0.55 + mist * cloud * 0.12;
    L.birds = day * forest * (1 - rain) * 0.9;
    L.cicada = day * Math.max(0, Math.min(1, (tod - 0.55) / 0.15)) * (1 - Math.max(0, (tod - 0.86) / 0.06)) * (0.35 + dry * 0.5) * (forest + dry * 0.5) * 0.5;
    L.crickets = Math.max(dusk, firefly * 0.8) * (0.4 + forest * 0.6) * 0.3;
    L.frogs = water * dusk;
    L.water = water * 0.45;
    L.purr = win * 0.9;

    const t = this.ctx.currentTime;
    const set = (name: string, level: number) => {
      const l = this.layers[name];
      if (!l || l.gain === this.master) return;
      const v = level * this.ambScale;
      if (Math.abs(l.level - v) < 0.005) return;
      l.level = v;
      l.gain.gain.setTargetAtTime(v, t, 0.6);
    };
    if (this.arrival && t > this.arrival.end) this.arrival = null;
    this.ghostTick();
    set("wind", Math.min(1, L.wind) * 0.9);
    set("rain", L.rain * 0.4);
    set("cicada", L.cicada * 0.08);
    set("crickets", L.crickets * 0.05);
    set("water", L.water * 0.5);
    // the synthesised purr only stands in until the recording has arrived
    const real = this.buffers.has("domestic-cat");
    set("purr", real ? 0 : L.purr * 0.4);
    if (real) this.purr(L.purr > 0.3);
    // the music darkens as the descent goes down into forest and night, and opens at the window
    if (this.musicTone) {
      const night = tod < 0.1 || tod > 0.9 ? 1 : 0;
      const f = 1800 + 4200 * high - 900 * forest * (1 - high) - 500 * night + 1500 * win;
      this.musicTone.frequency.setTargetAtTime(Math.max(900, f), t, 2.0);
    }
    // more air around the calls in cloud and forest, dry in the open desert
    if (this.wet) this.wet.gain.setTargetAtTime(0.16 + 0.22 * Math.max(cloud * mist, forest) - 0.08 * dry, t, 1.0);
    if (this.windFilter) this.windFilter.frequency.setTargetAtTime(300 + 500 * high + 200 * wind, t, 1.2);
  }

  /** Random one-shot voices: birdsong, drips, frog calls. */
  private events() {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || !this.on) return;
    const L = this.levels;
    const t = ctx.currentTime + 0.02;
    if (Math.random() < L.birds * 0.12) this.bird(t);
    if (Math.random() < L.rain * 0.5) this.drip(t);
    if (Math.random() < L.frogs * 0.18) this.frog(t);
  }

  private shot(t: number, dur: number, peak: number): GainNode {
    const ctx = this.ctx as Ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.ambBus ?? (this.master as GainNode));
    return g;
  }

  private bird(t: number) {
    const ctx = this.ctx as Ctx;
    const notes = 2 + Math.floor(Math.random() * 4);
    const base = 2200 + Math.random() * 1800;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    for (let i = 0; i < notes; i++) {
      const s = t + i * (0.09 + Math.random() * 0.06);
      const o = ctx.createOscillator();
      o.type = "sine";
      const f = base * (0.85 + Math.random() * 0.4);
      o.frequency.setValueAtTime(f, s);
      o.frequency.exponentialRampToValueAtTime(f * (Math.random() < 0.5 ? 1.35 : 0.75), s + 0.07);
      const g = this.shot(s, 0.09, 0.05);
      g.disconnect();
      g.connect(pan);
      o.connect(g);
      o.start(s);
      o.stop(s + 0.1);
    }
    pan.connect(this.ambBus ?? (this.master as GainNode));
  }

  private drip(t: number) {
    const ctx = this.ctx as Ctx;
    const o = ctx.createOscillator();
    const f = 900 + Math.random() * 1400;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.04);
    o.connect(this.shot(t, 0.06, 0.03));
    o.start(t);
    o.stop(t + 0.07);
  }

  private frog(t: number) {
    const ctx = this.ctx as Ctx;
    const o = ctx.createOscillator();
    o.type = "triangle";
    const f = 260 + Math.random() * 220;
    o.frequency.setValueAtTime(f, t);
    const am = ctx.createGain();
    am.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 28 + Math.random() * 18;
    const lg = ctx.createGain();
    lg.gain.value = 0.5;
    lfo.connect(lg).connect(am.gain);
    const g = this.shot(t, 0.35, 0.05);
    o.connect(am).connect(g);
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.36);
    lfo.stop(t + 0.36);
  }
}
