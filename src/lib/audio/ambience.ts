/**
 * Procedural ambience for the descent. No audio files: every sound is
 * synthesised in the browser and steered by the same world parameters that
 * drive the picture. Wind on the roof of the world, drip inside the cloud,
 * birds and cicadas in the forests, water at the river, frogs and crickets at
 * dusk, and a purr at the very bottom. Off until the visitor turns it on.
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

export class Ambience {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private layers: Record<string, Layer> = {};
  private windFilter: BiquadFilterNode | null = null;
  private timer = 0;
  private lastUpdate = 0;
  private on = false;
  private levels = { wind: 0, rain: 0, birds: 0, cicada: 0, crickets: 0, frogs: 0, water: 0, purr: 0 };

  get running() {
    return this.on;
  }

  start() {
    if (typeof window === "undefined") return;
    if (!this.ctx) this.build();
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    ctx.resume().catch(() => {});
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setTargetAtTime(0.55, ctx.currentTime, 0.6);
    this.on = true;
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
      if (!this.on) ctx.suspend().catch(() => {});
    }, 1200);
  }

  dispose() {
    window.clearInterval(this.timer);
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }

  private build() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(comp).connect(ctx.destination);
    this.master = master;

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
    set("purr", L.purr * 0.55);
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

  private voice(t: number, dur: number, peak: number): GainNode {
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
      const g = this.voice(s, 0.09, 0.05);
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
    o.connect(this.voice(t, 0.06, 0.03));
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
    const g = this.voice(t, 0.35, 0.05);
    o.connect(am).connect(g);
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.36);
    lfo.stop(t + 0.36);
  }
}
