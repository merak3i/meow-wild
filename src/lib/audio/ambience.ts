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
function impulse(ctx: Ctx, seconds: number, decay: number): AudioBuffer {
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
    if (this.music) {
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
        ctx.suspend().catch(() => {});
      }
    }, 1200);
  }

  dispose() {
    window.clearInterval(this.timer);
    this.music?.pause();
    this.music = null;
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
        })
        .catch(() => {});
    }
  }

  /**
   * A cat has just appeared. Play its recording once (not again for a while),
   * panned to where it stands on screen (-1 left .. 1 right).
   */
  call(id: string, pan = 0) {
    const ctx = this.ctx;
    if (!this.on || !ctx || !this.callBus || id === "domestic-cat") return false;
    const buf = this.buffers.get(id);
    if (!buf) return false;
    const now = ctx.currentTime;
    // one voice at a time: the next cat waits for this one to finish
    if (now < this.busyUntil) return false;
    const last = this.lastCall.get(id) ?? -1e9;
    if (now - last < 40) return false;
    this.lastCall.set(id, now);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = CALL_GAIN[id] ?? 0.6;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-0.7, Math.min(0.7, pan * 0.6));
    src.connect(g).connect(p).connect(this.callBus);
    const t = now + 0.05;
    src.start(t);
    // duck the music under the call
    if (this.musicGain) {
      const mg = this.musicGain.gain;
      mg.cancelScheduledValues(t);
      mg.setTargetAtTime(MUSIC * 0.45, t, 0.25);
      mg.setTargetAtTime(MUSIC, t + buf.duration + 0.4, 1.4);
    }
    this.busyUntil = t + buf.duration + 1.2;
    this.speaking = { id, until: t + buf.duration };
    return true;
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
    const layer = (name: string, input: AudioNode) => {
      const g = ctx.createGain();
      g.gain.value = 0;
      input.connect(g).connect(master);
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
    const set = (name: string, v: number) => {
      const l = this.layers[name];
      if (!l || l.gain === this.master) return;
      if (Math.abs(l.level - v) < 0.005) return;
      l.level = v;
      l.gain.gain.setTargetAtTime(v, t, 0.6);
    };
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
    g.connect(this.master as GainNode);
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
    pan.connect(this.master as GainNode);
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
