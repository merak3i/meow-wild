/**
 * The world shader's ridgelines, in JavaScript.
 *
 * WORLD_FS draws seven parallax cards whose crest heights come from a 1D noise
 * stack. This is the same function, step for step (with float32 rounding where
 * the hashes need it), so the story layer can stand a herd on a ridge or a
 * climber on a summit exactly where the GPU draws it.
 *
 * Screen space here is the shader's: p.x in viewport heights from the centre,
 * p.y from 0 at the bottom to 1 at the top.
 */

const f32 = Math.fround;

/** screen units per metre of elevation for each card (far to near) */
export const LS = [1 / 14000, 1 / 8000, 1 / 4800, 1 / 2900, 1 / 1700, 1 / 950, 1 / 420];
/** horizontal feature frequency of each card */
export const KX = [1.15, 1.45, 1.8, 2.2, 2.7, 3.3, 4.0];

// parameter slots (see PARAM_KEYS in presets.ts)
const PITCH = 2;
const FAR_O = 4;
const FAR_A = 5;
const MID_O = 6;
const MID_A = 7;
const NEAR_O = 8;
const NEAR_A = 9;
const JAG_F = 10;
const JAG_N = 11;
const WATER = 20;
const WATER_O = 21;
const MESA = 35;
const TOWER = 36;
const DUNE = 40;

const fract = (x: number) => x - Math.floor(x);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function hash11(p: number): number {
  let q = f32(fract(f32(f32(p) * f32(0.1031))));
  q = f32(q * f32(q + f32(33.33)));
  q = f32(q * f32(q + q));
  return fract(q);
}

function gnoise(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const g0 = hash11(i) * 2 - 1;
  const g1 = hash11(i + 1) * 2 - 1;
  const u = f * f * f * (f * (f * 6 - 15) + 10);
  return mix(g0 * f, g1 * (f - 1), u) * 2;
}

function shapeAt(x: number, jag: number, oct: number): number {
  let fb = 0;
  let rg = 0;
  let a = 0.5;
  let n = 0;
  let w = 1;
  for (let k = 0; k < oct; k++) {
    const v = gnoise(x);
    fb += a * v;
    let r = 1 - Math.abs(v);
    r *= r;
    rg += a * r * w;
    w = clamp01(r * 1.5);
    n += a;
    a *= 0.5;
    x = x * 2.03 + 7.13;
  }
  fb = clamp01((fb / n) * 0.9 + 0.5);
  rg = clamp01((rg / n) * 1.1);
  return mix(fb, rg, jag);
}

function towerAt(x: number): number {
  const cw = 0.6;
  const c = Math.floor(x / cw);
  let best = 0;
  for (let k = -1; k <= 1; k++) {
    const ci = c + k;
    const h = hash11(ci * 1.37 + 4.1);
    const cx = (ci + 0.25 + 0.5 * hash11(ci * 2.91)) * cw;
    const hw = cw * (0.13 + 0.18 * hash11(ci * 5.3));
    const d = Math.abs(x - cx) / hw;
    const prof = (0.45 + 0.55 * h) * (1 - Math.pow(clamp01(d), 4));
    best = Math.max(best, prof);
  }
  return best;
}

function duneAt(x: number): number {
  const w = gnoise(x * 0.27) * 0.45;
  const y = x * 0.55 + w;
  const f = fract(y);
  const prof = Math.min(smoothstep(0, 0.78, f), 1 - smoothstep(0.78, 1, f));
  const amp = 0.5 + 0.5 * hash11(Math.floor(y) * 1.7 + 3);
  return prof * amp + gnoise(x * 3.1) * 0.02;
}

const layerT = (i: number) => i / 6;

export class Terrain {
  /** horizon height on screen (0 bottom, 1 top) */
  yh = 0.5;
  private p: Float32Array = new Float32Array(44);
  private drift = 0;

  /** Set the current world state, exactly as handed to the renderer. */
  set(params: Float32Array, alt: number, drift: number) {
    this.p = params;
    this.drift = drift;
    const dip = Math.sqrt((Math.max(alt, 0) * 2) / 6.371e6);
    this.yh = params[PITCH] - dip * 0.7;
  }

  layerOff(i: number) {
    const t = layerT(i);
    const p = this.p;
    return t < 0.5 ? mix(p[FAR_O], p[MID_O], t * 2) : mix(p[MID_O], p[NEAR_O], t * 2 - 1);
  }

  layerAmp(i: number) {
    const t = layerT(i);
    const p = this.p;
    return Math.max(t < 0.5 ? mix(p[FAR_A], p[MID_A], t * 2) : mix(p[MID_A], p[NEAR_A], t * 2 - 1), 0.0005);
  }

  private shapeFull(i: number, x: number, oct: number) {
    const p = this.p;
    let s = shapeAt(x, mix(p[JAG_F], p[JAG_N], smoothstep(0.3, 0.85, layerT(i))), oct);
    if (p[DUNE] > 0.001) s = mix(s, duneAt(x), p[DUNE]);
    if (p[MESA] > 0.001 && i <= 3) s = mix(s, smoothstep(0.5, 0.58, s) * 0.8 + s * 0.2, p[MESA]);
    if (p[TOWER] > 0.001 && i >= 1 && i <= 4) s = mix(s, Math.max(s * 0.3, towerAt(x)), p[TOWER]);
    return s;
  }

  /** crest height of card i (0 far .. 6 near) at screen x (viewport heights from centre) */
  crest(i: number, px: number): number {
    const xn = (px + this.drift * LS[i]) * KX[i] + i * 13.71;
    const s = this.shapeFull(i, xn, i < 2 ? 5 : 6);
    return this.yh + this.layerOff(i) + this.layerAmp(i) * (s - 0.5) * 2;
  }

  /** the highest crest of the cards nearer than i at px: whatever stands on card i below this is hidden */
  nearer(i: number, px: number): number {
    let y = -1;
    for (let j = i + 1; j < 7; j++) y = Math.max(y, this.crest(j, px));
    return y;
  }

  /** how far the cards slide across the screen per unit of drift */
  parallax(i: number) {
    return LS[i];
  }

  /** screen height of the water plane seen at the distance of card i, or null without water */
  water(i: number): number | null {
    if (this.p[WATER] < 0.05 || this.p[WATER_O] < -1) return null;
    return this.yh + this.p[WATER_O] * 420 * LS[i];
  }
}
