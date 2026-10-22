import type { Kit } from "./kit";

/**
 * Figures for the story layer, drawn with the kit in local units: the origin is
 * at the feet, y is up, and one unit is the figure's height (people) or its
 * shoulder height (animals). Poses and gaits are plain functions of a phase so
 * a scene can drive them from the clock.
 */

const TAU = Math.PI * 2;
const sin = Math.sin;
const cos = Math.cos;

export type Rgb = [number, number, number];
export const WARM: Rgb = [1.0, 0.72, 0.38];
export const LAMP: Rgb = [1.0, 0.86, 0.62];
export const COLD: Rgb = [0.85, 0.92, 1.0];
export const RED: Rgb = [1.0, 0.16, 0.1];

/* ---------------- people ---------------- */

export type Pose = "stand" | "walk" | "binoculars" | "camera" | "scope" | "antenna" | "pole" | "wave" | "sit" | "point";

export interface HumanOpts {
  pose?: Pose;
  /** gait phase (radians), for walk and pole */
  phase?: number;
  pack?: boolean;
  /** a basket carried on the back with a head strap */
  basket?: boolean;
  hat?: boolean;
  /** a long robe or skirt */
  robe?: boolean;
  /** headlamp: 0 off .. 1 on */
  lamp?: number;
  /** headlamp beam length in units (0: no beam) */
  beam?: number;
  umbrella?: boolean;
  /** lean forward (radians), climbing */
  lean?: number;
}

export function human(k: Kit, o: HumanOpts = {}) {
  const pose = o.pose ?? "stand";
  const ph = o.phase ?? 0;
  const walking = pose === "walk" || pose === "pole";
  const lean = o.lean ?? 0;
  // legs
  const hipY = pose === "sit" ? 0.3 : 0.48;
  if (pose === "sit") {
    k.cap(0.0, 0.3, 0.17, 0.27, 0.05, 0.045).cap(0.17, 0.27, 0.2, 0.02, 0.04, 0.032);
  } else {
    for (const side of [1, -1]) {
      const a = walking ? sin(ph + (side > 0 ? 0 : Math.PI)) * 0.34 : side * 0.04;
      const lift = walking ? Math.max(0, cos(ph + (side > 0 ? 0 : Math.PI))) * 0.05 : 0;
      const kx = sin(a) * 0.24 + (walking ? 0.02 : 0);
      const ky = hipY - 0.24 + lift * 0.4;
      const fx = sin(a) * 0.46 + (walking ? Math.max(0, -a) * 0.05 : 0);
      k.cap(side * 0.012 + lean * 0.1, hipY, kx, ky, 0.05, 0.042).cap(kx, ky, fx, lift, 0.04, 0.03);
      k.cap(fx, lift + 0.012, fx + 0.06, lift + 0.008, 0.022, 0.018);
    }
  }
  if (o.robe) k.tri(-0.11, 0.18, 0.11, 0.18, 0, 0.62);
  // torso, head
  const sx = lean * 0.3;
  const shY = pose === "sit" ? 0.62 : 0.79;
  k.cap(0, hipY + 0.02, sx, shY, 0.075, 0.095);
  const hx = sx + lean * 0.08;
  const hy = shY + 0.11;
  k.ellipse(hx, hy, 0.062, 0.07);
  if (o.hat) k.ellipse(hx, hy + 0.05, 0.1, 0.022).ellipse(hx, hy + 0.07, 0.055, 0.035);
  if (o.pack) k.ellipse(sx - 0.1, shY - 0.13, 0.075, 0.13).ellipse(sx - 0.1, shY + 0.0, 0.05, 0.03);
  if (o.basket) k.ellipse(sx - 0.12, shY - 0.08, 0.1, 0.15).cap(sx - 0.05, shY + 0.02, hx, hy + 0.05, 0.012);
  // arms
  const sh = { x: sx, y: shY - 0.02 };
  const arm = (ex: number, ey: number, hx2: number, hy2: number) => k.cap(sh.x, sh.y, ex, ey, 0.038, 0.032).cap(ex, ey, hx2, hy2, 0.03, 0.026);
  switch (pose) {
    case "binoculars":
      arm(sh.x + 0.1, sh.y - 0.1, hx + 0.07, hy - 0.01);
      k.ellipse(hx + 0.085, hy, 0.035, 0.025);
      break;
    case "camera":
      arm(sh.x + 0.1, sh.y - 0.12, hx + 0.08, hy - 0.03);
      k.cap(hx + 0.06, hy - 0.01, hx + 0.28, hy - 0.02, 0.035, 0.03);
      break;
    case "scope":
      arm(sh.x + 0.1, sh.y - 0.14, hx + 0.12, hy - 0.06);
      k.cap(hx + 0.09, hy - 0.02, hx + 0.3, hy + 0.01, 0.022, 0.03);
      k.cap(hx + 0.2, hy - 0.04, hx + 0.12, 0, 0.012).cap(hx + 0.2, hy - 0.04, hx + 0.3, 0, 0.012).cap(hx + 0.2, hy - 0.04, hx + 0.21, 0, 0.012);
      break;
    case "antenna": {
      // a telemetry Yagi held up, listening for a collar
      const sw = sin(ph * 0.5) * 0.25;
      const ax = hx + 0.06 + sw * 0.1;
      const ay = hy + 0.2;
      arm(sh.x + 0.06, sh.y + 0.08, ax, ay);
      k.cap(ax - 0.16 * cos(sw), ay + 0.04 - 0.16 * sin(sw) * 0.3, ax + 0.22 * cos(sw), ay + 0.04 + 0.22 * sin(sw) * 0.3, 0.012);
      for (let e = 0; e < 4; e++) {
        const t = -0.12 + e * 0.11;
        const ex = ax + t * cos(sw);
        const ey = ay + 0.04 + t * sin(sw) * 0.3;
        k.cap(ex, ey - 0.07, ex, ey + 0.07, 0.009);
      }
      arm(sh.x - 0.02, sh.y - 0.12, hx + 0.02, hy - 0.02);
      break;
    }
    case "pole": {
      const a = sin(ph) * 0.3;
      arm(sh.x + 0.08 + a * 0.1, sh.y - 0.14, sh.x + 0.16 + a * 0.2, sh.y - 0.28);
      k.cap(sh.x + 0.16 + a * 0.2, sh.y - 0.26, sh.x + 0.24 + a * 0.32, 0, 0.012);
      break;
    }
    case "wave": {
      const w = sin(ph * 3) * 0.12;
      arm(sh.x + 0.1, sh.y + 0.1, sh.x + 0.12 + w, sh.y + 0.3);
      arm(sh.x - 0.03, sh.y - 0.16, sh.x - 0.02, sh.y - 0.3);
      break;
    }
    case "point":
      arm(sh.x + 0.14, sh.y + 0.0, sh.x + 0.3, sh.y + 0.06);
      break;
    case "sit":
      arm(sh.x + 0.08, sh.y - 0.14, sh.x + 0.2, sh.y - 0.2);
      break;
    default: {
      const a = walking ? sin(ph + Math.PI) * 0.22 : 0.05;
      arm(sh.x + sin(a) * 0.14, sh.y - 0.15, sh.x + sin(a) * 0.24 + 0.02, sh.y - 0.29);
    }
  }
  if (o.umbrella) {
    k.cap(sh.x + 0.1, sh.y - 0.1, sh.x + 0.1, hy + 0.32, 0.01);
    k.tri(sh.x - 0.2, hy + 0.24, sh.x + 0.4, hy + 0.24, sh.x + 0.1, hy + 0.38, 0.01);
  }
  if (o.lamp && o.lamp > 0) {
    const s = k.s;
    k.glow(hx + 0.06, hy + 0.02, Math.max(6, s * 0.5), Math.max(1.1, s * 0.035), 1.6 * o.lamp, LAMP);
    if (o.beam) k.beam(hx + 0.06, hy + 0.01, hx + 0.06 + o.beam, hy - o.beam * 0.35, Math.max(1, s * 0.03), Math.max(3, s * o.beam * 0.22), 0.16 * o.lamp, LAMP);
  }
}

/* ---------------- four-legged animals ---------------- */

export interface QuadSpec {
  /** shoulder to hip, in shoulder heights */
  len: number;
  /** torso depth */
  depth: number;
  /** neck length and thickness */
  neck: number;
  neckW: number;
  /** head length and depth */
  head: number;
  headD: number;
  /** leg thickness at the top */
  legW: number;
  ear: number;
  tail: number;
  horns?: "bharal" | "lyre" | "antler" | "spike" | "cattle" | "none";
  hump?: number;
  /** back slopes down to the hips (hyena) */
  slope?: number;
  /** ears up rather than back (camelids, rodents) */
  earsUp?: boolean;
}

export const BHARAL: QuadSpec = { len: 0.92, depth: 0.46, neck: 0.32, neckW: 0.11, head: 0.27, headD: 0.14, legW: 0.085, ear: 0.08, tail: 0.1, horns: "bharal" };
export const GUANACO: QuadSpec = { len: 0.9, depth: 0.4, neck: 0.62, neckW: 0.075, head: 0.24, headD: 0.11, legW: 0.06, ear: 0.1, tail: 0.14, earsUp: true };
export const LLAMA: QuadSpec = { ...GUANACO, depth: 0.46, neckW: 0.09 };
export const DEER: QuadSpec = { len: 0.95, depth: 0.38, neck: 0.42, neckW: 0.08, head: 0.27, headD: 0.11, legW: 0.055, ear: 0.11, tail: 0.06, horns: "antler", earsUp: true };
export const DOE: QuadSpec = { ...DEER, horns: "none" };
export const SPRINGBOK: QuadSpec = { len: 0.88, depth: 0.37, neck: 0.36, neckW: 0.07, head: 0.25, headD: 0.1, legW: 0.05, ear: 0.12, tail: 0.1, horns: "lyre", earsUp: true };
export const CATTLE: QuadSpec = { len: 1.15, depth: 0.55, neck: 0.25, neckW: 0.16, head: 0.32, headD: 0.17, legW: 0.09, ear: 0.08, tail: 0.38, horns: "cattle" };
export const CAMEL: QuadSpec = { len: 1.0, depth: 0.42, neck: 0.75, neckW: 0.09, head: 0.3, headD: 0.12, legW: 0.065, ear: 0.06, tail: 0.25, hump: 0.28, earsUp: true };
export const HYENA: QuadSpec = { len: 0.85, depth: 0.42, neck: 0.3, neckW: 0.14, head: 0.3, headD: 0.15, legW: 0.075, ear: 0.1, tail: 0.18, slope: 0.22, earsUp: true };
export const CAPYBARA: QuadSpec = { len: 1.1, depth: 0.75, neck: 0.12, neckW: 0.28, head: 0.45, headD: 0.28, legW: 0.12, ear: 0.06, tail: 0.0, earsUp: true };
export const HORSE: QuadSpec = { len: 1.05, depth: 0.45, neck: 0.5, neckW: 0.13, head: 0.38, headD: 0.13, legW: 0.07, ear: 0.08, tail: 0.45, earsUp: true };

export interface QuadState {
  /** gait phase (radians); undefined stands still */
  phase?: number;
  /** stride amplitude 0..1 (0 stands) */
  stride?: number;
  /** 0 head up .. 1 grazing */
  graze?: number;
  /** head turned toward the viewer, 0..1 (alert) */
  alert?: number;
  /** springbok pronk: body lifted, legs stiff, 0..1 */
  pronk?: number;
  /** extra vertical lift of the whole body (a bound) */
  lift?: number;
  tailFlick?: number;
}

export function quad(k: Kit, sp: QuadSpec, q: QuadState = {}) {
  const ph = q.phase ?? 0;
  const stride = q.stride ?? 0;
  const graze = q.graze ?? 0;
  const pronk = q.pronk ?? 0;
  const lift = (q.lift ?? 0) + pronk * 0.45;
  const bob = stride * Math.abs(sin(ph)) * 0.03;
  const ry = sp.depth / 2;
  const back = 1.0 + lift + bob;
  const by = back - ry * 0.85;
  const L = sp.len;
  const slope = sp.slope ?? 0;
  // legs: far side first so they read behind the body
  const shoulder = { x: L * 0.42, y: by - ry * 0.25 };
  const hip = { x: -L * 0.4, y: by - ry * 0.15 - slope * 0.5 };
  const legLenF = shoulder.y;
  const legLenH = hip.y;
  const rot = (x: number, y: number, ang: number): [number, number] => [x * cos(ang) - y * sin(ang), x * sin(ang) + y * cos(ang)];
  /** a leg as joints relative to its top, swung by `a` about the top, the lower part folding while it swings forward */
  const leg = (bx: number, top: number, len: number, a: number, fold: number, hind: boolean, w: number) => {
    const stiff = pronk;
    const j = hind
      ? [
          [len * 0.16, -len * 0.34],
          [-len * 0.1 - fold * len * 0.12, -len * 0.64 + fold * len * 0.06],
          [-len * 0.04 + fold * len * 0.06, -len + fold * len * 0.16],
        ]
      : [
          [0, -len * 0.38],
          [len * 0.03 + fold * len * 0.14, -len * 0.66 + fold * len * 0.05],
          [0 + fold * len * 0.02, -len + fold * len * 0.18],
        ];
    const pts = j.map(([x, y]) => {
      const sx = stiff > 0 ? x * (1 - stiff) : x;
      const [rx, ry] = rot(sx, y, a * (1 - stiff));
      return [bx + rx, top + ry] as [number, number];
    });
    let px = bx;
    let py = top;
    const widths = [w, w * 0.62, w * 0.46];
    pts.forEach(([x, y], n) => {
      k.cap(px, py, x, Math.max(y, lift * 0.3), widths[n], n === 2 ? w * 0.4 : widths[n + 1] ?? w * 0.4);
      px = x;
      py = Math.max(y, lift * 0.3);
    });
  };
  const swing = (o: number) => (stride > 0 ? sin(ph + o) * 0.38 * stride : 0);
  const foldOf = (o: number) => (stride > 0 ? Math.max(0, cos(ph + o)) * stride : 0);
  const shade = k.st.shade;
  // far legs first, a touch darker, then the near pair over them
  k.st.shade = shade * 0.8;
  leg(shoulder.x - 0.05, shoulder.y, legLenF, swing(Math.PI), foldOf(Math.PI), false, sp.legW);
  leg(hip.x + 0.04, hip.y, legLenH, swing(0), foldOf(0), true, sp.legW * 1.15);
  k.st.shade = shade;
  leg(shoulder.x + 0.03, shoulder.y, legLenF, swing(Math.PI * 0.5), foldOf(Math.PI * 0.5), false, sp.legW);
  leg(hip.x - 0.03, hip.y, legLenH, swing(Math.PI * 1.5), foldOf(Math.PI * 1.5), true, sp.legW * 1.15);
  // torso
  k.ellipse(0, by, L * 0.62, ry, slope * 0.25);
  k.ellipse(-L * 0.36, by + ry * 0.05 - slope * 0.4, ry * 0.88, ry * 0.86);
  k.ellipse(L * 0.33, by, ry * 0.92, ry * 0.95);
  if (sp.hump) k.ellipse(-0.02, back + sp.hump * 0.3, sp.hump * 0.75, sp.hump * 0.55);
  // tail
  if (sp.tail > 0) {
    const tf = (q.tailFlick ?? 0) * sin(ph * 2.3);
    k.cap(-L * 0.62, by + ry * 0.4 - slope * 0.5, -L * 0.62 - sp.tail * 0.5, by + ry * 0.3 - sp.tail * 0.9 + tf * 0.1, 0.03, 0.02);
  }
  // neck and head: grazing lowers the neck from the chest until the muzzle reaches the grass
  const up = 1 - graze;
  const camelid = sp.earsUp && sp.neck > 0.5;
  const na = mixA(-1.2, 0.95, up) + (camelid ? 0.4 * up : 0);
  const nb = { x: L * 0.5, y: by + ry * (0.05 + 0.32 * up) };
  const nl = sp.neck * (1 + graze * 0.3);
  const nt = { x: nb.x + cos(na) * nl, y: nb.y + sin(na) * nl };
  k.cap(nb.x - 0.03, nb.y - ry * 0.1, nt.x, nt.y, sp.neckW * 1.45, sp.neckW);
  const alert = q.alert ?? 0;
  const ha = mixA(-1.5, -0.4, up) - (camelid ? 0.25 * up : 0);
  const hl = sp.head * (1 - alert * 0.35);
  const hx = nt.x + cos(ha) * hl;
  const hy = nt.y + sin(ha) * hl;
  k.cap(nt.x, nt.y, hx, hy, sp.headD * 0.62, sp.headD * 0.36);
  // ears
  const ea = sp.earsUp ? 1.75 : 2.6;
  k.cap(nt.x + 0.01, nt.y + 0.02, nt.x + cos(ea + ha * 0.3) * sp.ear, nt.y + sin(ea + ha * 0.3) * sp.ear, 0.022, 0.012);
  if (alert > 0.3) k.cap(nt.x - 0.01, nt.y + 0.02, nt.x - cos(ea) * sp.ear * 0.9, nt.y + sin(ea) * sp.ear * 0.9, 0.022, 0.012);
  // horns
  switch (sp.horns) {
    case "bharal": {
      // thick horns sweeping back and out over the neck
      let px = nt.x;
      let py = nt.y + 0.03;
      let a = 2.1;
      for (let i = 0; i < 4; i++) {
        const nx = px + cos(a) * 0.07;
        const ny = py + sin(a) * 0.07;
        k.cap(px, py, nx, ny, 0.035 - i * 0.006, 0.03 - i * 0.006);
        px = nx;
        py = ny;
        a += 0.55;
      }
      break;
    }
    case "lyre":
      k.cap(nt.x, nt.y + 0.03, nt.x - 0.02, nt.y + 0.16, 0.016, 0.012).cap(nt.x - 0.02, nt.y + 0.16, nt.x + 0.03, nt.y + 0.26, 0.012, 0.007);
      break;
    case "antler": {
      const bx = nt.x - 0.01;
      const byy = nt.y + 0.04;
      k.cap(bx, byy, bx - 0.04, byy + 0.2, 0.012, 0.008).cap(bx - 0.02, byy + 0.1, bx + 0.05, byy + 0.17, 0.009, 0.006).cap(bx - 0.035, byy + 0.17, bx - 0.1, byy + 0.24, 0.008, 0.005);
      break;
    }
    case "spike":
      k.cap(nt.x, nt.y + 0.03, nt.x - 0.03, nt.y + 0.12, 0.012, 0.006);
      break;
    case "cattle":
      k.cap(nt.x - 0.02, nt.y + 0.05, nt.x + 0.1, nt.y + 0.12, 0.02, 0.01).cap(nt.x - 0.03, nt.y + 0.05, nt.x - 0.15, nt.y + 0.1, 0.02, 0.01);
      break;
    default:
      break;
  }
  return { head: { x: hx, y: hy } };
}

function mixA(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/* ---------------- small mammals ---------------- */

/** pika or vole: a round body that sits up and looks about */
export function pika(k: Kit, up = 0, look = 0) {
  k.ellipse(0, 0.32 + up * 0.08, 0.42, 0.32 + up * 0.06);
  k.ellipse(0.33 + look * 0.03, 0.52 + up * 0.22, 0.2, 0.18);
  k.ellipse(0.24, 0.72 + up * 0.22, 0.085, 0.085);
  k.cap(0.2, 0.05, 0.24, 0.0, 0.05).cap(-0.2, 0.05, -0.18, 0.0, 0.06);
}

/** viscacha: a chinchilla-like rodent sitting up on a rock, long ears, a curled bushy tail */
export function viscacha(k: Kit, alert = 0, t = 0) {
  k.ellipse(0, 0.36, 0.34, 0.36);
  k.ellipse(0.05, 0.62, 0.27, 0.22);
  k.ellipse(0.16, 0.86 + alert * 0.03, 0.17, 0.15);
  k.ellipse(0.28, 0.82 + alert * 0.03, 0.08, 0.07);
  const ea = 1.75 - alert * 0.2;
  k.ellipse(0.08 + Math.cos(ea) * 0.14, 1.0 + Math.sin(ea) * 0.14 + alert * 0.03, 0.05, 0.17, ea - Math.PI / 2);
  k.ellipse(0.16 + Math.cos(ea - 0.25) * 0.13, 1.0 + Math.sin(ea - 0.25) * 0.13 + alert * 0.03, 0.045, 0.15, ea - 0.25 - Math.PI / 2);
  const c = Math.sin(t * 0.6) * 0.03;
  k.cap(-0.26, 0.16, -0.62, 0.3 + c, 0.09, 0.08).cap(-0.62, 0.3 + c, -0.66, 0.58 + c, 0.08, 0.06);
  k.cap(0.14, 0.06, 0.32, 0.0, 0.07, 0.05);
}

/** hare: crouched (run 0) or bounding (run > 0, phase drives the gait) */
export function hare(k: Kit, run = 0, phase = 0, ears = 1) {
  const b = run > 0 ? Math.abs(sin(phase)) * 0.35 * run : 0;
  const stretch = run > 0 ? (sin(phase) * 0.5 + 0.5) * 0.35 * run : 0;
  k.ellipse(0, 0.32 + b, 0.48 + stretch * 0.5, 0.27 - stretch * 0.05, run > 0 ? cos(phase) * 0.15 : 0);
  k.ellipse(0.46 + stretch * 0.4, 0.5 + b, 0.17, 0.14);
  const ea = ears > 0.5 ? 1.45 : 2.5;
  k.cap(0.42 + stretch * 0.4, 0.6 + b, 0.42 + stretch * 0.4 + cos(ea) * 0.45, 0.6 + b + sin(ea) * 0.45, 0.045, 0.03);
  k.cap(0.38 + stretch * 0.4, 0.6 + b, 0.38 + stretch * 0.4 + cos(ea + 0.15) * 0.42, 0.6 + b + sin(ea + 0.15) * 0.42, 0.045, 0.03);
  if (run > 0) {
    k.cap(0.3 + stretch, 0.25 + b, 0.55 + stretch * 1.2, 0.04 + b * 0.5, 0.05, 0.035);
    k.cap(-0.3, 0.25 + b, -0.6 - stretch * 0.8, 0.05 + b * 0.4, 0.07, 0.04);
  } else {
    k.cap(0.3, 0.12, 0.4, 0.0, 0.05).cap(-0.25, 0.15, -0.05, 0.0, 0.08, 0.05);
  }
}

/** jerboa: kangaroo-like hops on two long feet, a long tufted tail */
export function jerboa(k: Kit, hop: number) {
  const h = Math.max(0, sin(hop)) * 0.9;
  const lean = cos(hop) * 0.25;
  k.ellipse(0, 0.45 + h, 0.24, 0.2, 0.3 + lean);
  k.ellipse(0.2, 0.65 + h, 0.13, 0.12);
  k.cap(0.16, 0.74 + h, 0.06, 1.05 + h, 0.05, 0.03).cap(0.2, 0.74 + h, 0.18, 1.04 + h, 0.05, 0.03);
  k.cap(-0.05, 0.38 + h, 0.05 - lean * 0.2, 0.0 + h * 0.6, 0.04, 0.025).cap(0.05 - lean * 0.2, 0.0 + h * 0.6, 0.22 - lean * 0.2, 0.0 + h * 0.6, 0.025);
  k.cap(-0.2, 0.42 + h, -1.0, 0.5 + h * 0.8, 0.025, 0.012);
  k.ellipse(-1.05, 0.52 + h * 0.8, 0.08, 0.05);
}

/** mouse or rat in the grass */
export function mouse(k: Kit, up = 0) {
  k.ellipse(0, 0.35 + up * 0.15, 0.5, 0.33 + up * 0.05, up * 0.6);
  k.ellipse(0.45, 0.45 + up * 0.45, 0.22, 0.18);
  k.ellipse(0.38, 0.65 + up * 0.45, 0.1, 0.1);
  k.cap(-0.45, 0.25, -1.1, 0.1, 0.035, 0.02);
}

/* ---------------- birds ---------------- */

export type BirdKind = "small" | "hornbill" | "flamingo" | "toucan" | "crow" | "dove";

/**
 * A bird crossing the sky, drawn the way the eye reads a distant bird: the
 * body small and level, both wings rising and falling in an M (flap in
 * radians), or held in a shallow glide. One unit is half the wingspan.
 */
export function flyer(k: Kit, kind: BirdKind, flap: number, glide = 0) {
  const w = glide > 0.5 ? 0.15 + sin(flap * 0.25) * 0.05 : sin(flap);
  const big = kind === "hornbill" || kind === "toucan";
  // body, head and tail, facing +x
  const bl = kind === "flamingo" ? 0.22 : big ? 0.3 : 0.22;
  k.ellipse(0, 0, bl, kind === "dove" || kind === "small" ? 0.085 : 0.075);
  if (kind === "flamingo") {
    k.cap(0.18, 0.0, 0.85, 0.03, 0.03, 0.025).ellipse(0.88, 0.03, 0.06, 0.045).cap(0.92, 0.02, 1.0, -0.03, 0.025, 0.008);
    k.cap(-0.2, -0.01, -0.95, -0.05, 0.02, 0.016);
  } else if (kind === "hornbill") {
    k.ellipse(0.32, 0.03, 0.09, 0.08).cap(0.38, 0.03, 0.66, -0.02, 0.06, 0.02).ellipse(0.5, 0.09, 0.1, 0.04, -0.12);
    k.cap(-0.28, 0.0, -0.75, -0.03, 0.07, 0.055);
  } else if (kind === "toucan") {
    k.ellipse(0.3, 0.03, 0.08, 0.075).cap(0.36, 0.03, 0.62, 0.0, 0.065, 0.025);
    k.cap(-0.26, 0.0, -0.55, -0.04, 0.05, 0.035);
  } else {
    k.ellipse(bl * 0.95, 0.025, 0.075, 0.065);
    k.tri(-bl * 0.8, 0.02, -bl * 1.6, 0.06, -bl * 1.6, -0.03);
  }
  // wings: shoulder at the body, wrist high in the upstroke, tip trailing
  const shade = k.st.shade;
  for (const side of [-1, 1]) {
    k.st.shade = side < 0 ? shade * 0.85 : shade;
    const wy = w * 0.55;
    const ty = w * 0.75 - 0.12;
    const reach = side < 0 ? 0.82 : 1;
    const wx = side * 0.42 * reach * 0.55;
    const tx = side * 0.95 * reach * 0.55;
    // the wings spread toward and away from us, so they show as a lean either side of the body
    k.cap(0.02, 0.03, wx * 0.6 - 0.06, wy * reach + 0.03, big ? 0.07 : 0.055, big ? 0.06 : 0.045);
    k.cap(wx * 0.6 - 0.06, wy * reach + 0.03, tx * 0.6 - 0.2, ty * reach + 0.03, big ? 0.06 : 0.045, 0.012);
  }
  k.st.shade = shade;
}

/**
 * A big soaring bird seen from below as it circles: broad wings, fingered
 * tips, a fanned or wedge tail. bank tilts it (-1..1). One unit is half the span.
 */
export function soarer(k: Kit, kind: "condor" | "vulture" | "lammergeier" | "eagle", bank = 0) {
  const sq = 1 - Math.abs(bank) * 0.35;
  const tilt = bank * 0.25;
  k.ellipse(0, 0, 0.09, 0.3, tilt);
  k.ellipse(sin(tilt) * 0.32, cos(tilt) * 0.32, 0.06, 0.065);
  if (kind === "lammergeier") k.tri(-0.07, -0.25, 0.07, -0.25, 0.0, -0.62);
  else k.tri(-0.1, -0.26, 0.1, -0.26, 0.0, -0.46, 0.02);
  for (const sgn of [1, -1]) {
    const len = sgn * (1 + bank * 0.18 * sgn) * sq;
    const chord = kind === "lammergeier" ? 0.14 : 0.2;
    k.tri(0.0, chord * 0.9, 0.0, -chord, len * 0.95, chord * 0.35);
    k.tri(0.0, -chord, len * 0.95, chord * 0.35, len * 0.9, -chord * 0.4);
    if (kind !== "lammergeier" && k.s > 18) {
      for (let f = 0; f < 4; f++) {
        const fy = chord * 0.3 - f * 0.12 * chord * 1.6;
        k.cap(len * 0.92, fy, len * (1.06 + f * 0.012), fy - 0.03 + f * 0.01, 0.025, 0.01);
      }
    } else {
      k.tri(len * 0.9, chord * 0.35, len * 0.9, -chord * 0.4, len * 1.12, chord * 0.05);
    }
  }
}

/** a standing wading bird: crane (crest) or heron */
export function wader(k: Kit, kind: "crane" | "heron", peck = 0, t = 0) {
  const lean = peck * 0.6;
  k.cap(0.0, 0.0, 0.02, 0.5, 0.012).cap(0.08, 0.0, 0.06, 0.5, 0.012);
  k.ellipse(0.0, 0.62, 0.24, 0.12, 0.15 - lean * 0.3);
  k.tri(-0.2, 0.62, -0.42, 0.52, -0.2, 0.55);
  const nx = 0.18 + lean * 0.25;
  const ny = 0.92 - lean * 0.55;
  k.cap(0.16, 0.66, nx, ny, 0.035, 0.028);
  k.ellipse(nx + 0.02, ny + 0.02, 0.05, 0.045);
  k.cap(nx + 0.05, ny + 0.01, nx + 0.17 + lean * 0.05, ny - 0.02 - lean * 0.05, 0.016, 0.006);
  if (kind === "crane") {
    for (let i = 0; i < 4; i++) k.cap(nx, ny + 0.05, nx - 0.03 + i * 0.02 + sin(t + i) * 0.005, ny + 0.13 + (i % 2) * 0.02, 0.008, 0.004);
  }
}

/** a peacock: round body, long train */
export function peacock(k: Kit) {
  k.cap(0.02, 0.0, 0.04, 0.22, 0.012).cap(0.1, 0.0, 0.08, 0.22, 0.012);
  k.ellipse(0.05, 0.32, 0.18, 0.13, 0.2);
  k.cap(0.16, 0.38, 0.22, 0.62, 0.035, 0.025).ellipse(0.24, 0.65, 0.045, 0.04);
  for (let i = 0; i < 3; i++) k.cap(0.23, 0.68, 0.2 + i * 0.03, 0.76, 0.006);
  k.tri(-0.08, 0.36, -0.95, 0.06, -0.92, 0.2);
}

/** a guineafowl or partridge on the ground */
export function fowl(k: Kit, peck = 0) {
  k.cap(0.02, 0, 0.03, 0.18, 0.012).cap(0.08, 0, 0.06, 0.18, 0.012);
  k.ellipse(0.0, 0.32, 0.3, 0.2);
  k.ellipse(0.28 + peck * 0.06, 0.42 - peck * 0.3, 0.07, 0.07);
  k.cap(0.33 + peck * 0.06, 0.41 - peck * 0.3, 0.42 + peck * 0.06, 0.38 - peck * 0.32, 0.02, 0.008);
}

/* ---------------- water ---------------- */

/** a fish leaping: p from 0 (leaving the water) to 1 (back in); one unit is its length */
export function fish(k: Kit, p: number) {
  const ang = 0.9 - p * 1.8;
  const x = (p - 0.5) * 1.6;
  const y = Math.sin(p * Math.PI) * 1.1;
  const c = cos(ang);
  const s = sin(ang);
  k.ellipse(x, y, 0.5, 0.13, ang);
  k.tri(x - c * 0.45, y - s * 0.45, x - c * 0.75 - s * 0.16, y - s * 0.75 + c * 0.16, x - c * 0.75 + s * 0.16, y - s * 0.75 - c * 0.16);
}

/** a caiman cruising: only the snout, the eyes and the ridges of the back break the surface; one unit is the head */
export function caiman(k: Kit) {
  k.tri(0.0, 0.0, 1.0, 0.0, 0.05, 0.06, 0.008);
  k.tri(0.0, 0.0, 0.05, 0.06, -0.2, 0.05, 0.008);
  k.ellipse(0.92, 0.035, 0.05, 0.03);
  k.ellipse(0.02, 0.07, 0.07, 0.045).ellipse(-0.1, 0.065, 0.06, 0.04);
  for (let i = 0; i < 6; i++) k.tri(-0.35 - i * 0.2, 0.0, -0.25 - i * 0.2, 0.0, -0.3 - i * 0.2, 0.05 - i * 0.004);
}

/* ---------------- vehicles and things people build ---------------- */

/** a safari vehicle with a pop-up roof; one unit is its height */
export function jeep(k: Kit, people = 3, t = 0) {
  k.rect(-0.95, 0.18, 0.75, 0.62);
  k.tri(0.75, 0.62, 0.75, 0.3, 1.0, 0.3);
  k.rect(0.75, 0.18, 1.02, 0.32);
  k.rect(-0.9, 0.62, 0.45, 0.92);
  k.rect(-0.95, 0.92, 0.5, 0.97);
  k.ellipse(-0.6, 0.16, 0.17, 0.17).ellipse(0.62, 0.16, 0.17, 0.17);
  k.ellipse(-1.0, 0.45, 0.07, 0.16);
  for (let i = 0; i < people; i++) {
    const px = -0.65 + i * 0.38;
    const bob = sin(t * 0.7 + i * 2) * 0.01;
    k.ellipse(px, 1.12 + bob, 0.075, 0.085).cap(px, 0.95, px, 1.04 + bob, 0.1, 0.09);
    if (i === 1) k.cap(px + 0.03, 1.12 + bob, px + 0.26, 1.13 + bob, 0.04, 0.035);
  }
}

/** a tourist launch with a canopy */
export function launch(k: Kit, people = 4, t = 0) {
  k.tri(-1.6, 0.2, 1.4, 0.2, 1.75, 0.38).tri(-1.6, 0.2, 1.75, 0.38, -1.6, 0.42);
  k.rect(-1.62, 0.38, 1.4, 0.44);
  for (const x of [-1.4, 0.0, 1.1]) k.cap(x, 0.42, x, 1.15, 0.02);
  k.rect(-1.55, 1.12, 1.2, 1.2);
  k.rect(-1.75, 0.3, -1.55, 0.7);
  for (let i = 0; i < people; i++) {
    const px = -1.15 + i * 0.55;
    const bob = sin(t * 0.8 + i * 1.7) * 0.012;
    k.ellipse(px, 0.84 + bob, 0.075, 0.085).cap(px, 0.42, px, 0.74 + bob, 0.11, 0.1);
    if (i % 2 === 0) k.cap(px + 0.04, 0.82 + bob, px + 0.28, 0.83 + bob, 0.04, 0.035);
  }
}

/** a dugout canoe with a paddler; paddle phase drives the stroke */
export function canoe(k: Kit, stroke: number) {
  k.tri(-1.2, 0.05, 1.2, 0.05, 1.35, 0.17).tri(-1.2, 0.05, 1.35, 0.17, -1.35, 0.17);
  k.cap(0.0, 0.15, 0.02, 0.5, 0.1, 0.09).ellipse(0.04, 0.62, 0.07, 0.08);
  const a = sin(stroke);
  const hx = 0.12 + a * 0.18;
  k.cap(0.02, 0.45, hx, 0.4, 0.035, 0.03);
  k.cap(hx - 0.05, 0.7, hx + 0.08 - a * 0.1, -0.15, 0.018, 0.015).ellipse(hx + 0.08 - a * 0.1, -0.15, 0.05, 0.1);
}

/** a dome tent; light 0..1 makes it glow from inside */
export function tent(k: Kit, light = 0) {
  k.tri(-0.75, 0, 0.75, 0, 0.0, 0.62, 0.04);
  k.tri(-0.75, 0, -0.95, 0.0, -0.45, 0.3, 0.02);
  if (light > 0) {
    const st = k.st;
    const old = [st.mode, st.shade, st.tint] as const;
    st.mode = 2;
    st.shade = 0.55 * light;
    const rgb = st.rgb;
    st.rgb = WARM;
    k.tri(-0.62, 0.04, 0.62, 0.04, 0.0, 0.53, 0.02);
    st.rgb = rgb;
    st.mode = old[0];
    st.shade = old[1];
    k.glow(0, 0.3, k.s * 1.6, k.s * 0.3, 0.5 * light, WARM);
  }
}

/** a ger: round felt walls, a domed roof, a stove pipe */
export function ger(k: Kit) {
  k.rect(-0.8, 0.0, 0.8, 0.45);
  k.ellipse(0, 0.45, 0.85, 0.3);
  k.cap(0.25, 0.6, 0.25, 0.9, 0.03);
}

/** smoke rising from (0, 0): a column of soft puffs drifting downwind */
export function smoke(k: Kit, t: number, wind: number, n = 7) {
  for (let i = 0; i < n; i++) {
    const p = (t * 0.12 + i / n) % 1;
    const r = 0.12 + p * 0.55;
    k.st.alpha = (1 - p) * 0.22;
    k.ellipse(p * wind * 2.2 + sin(t * 0.5 + i) * 0.05, p * 2.4, r, r * 0.8);
  }
  k.st.alpha = 1;
}

/** a forest watchtower on four legs, with a guard */
export function watchtower(k: Kit, t: number) {
  k.cap(-0.4, 0, -0.3, 1.5, 0.03).cap(0.4, 0, 0.3, 1.5, 0.03).cap(-0.4, 0.5, 0.4, 1.0, 0.015).cap(0.4, 0.5, -0.4, 1.0, 0.015);
  k.rect(-0.45, 1.5, 0.45, 1.58);
  k.rect(-0.45, 1.58, -0.4, 1.8).rect(0.4, 1.58, 0.45, 1.8);
  k.tri(-0.6, 2.05, 0.6, 2.05, 0.0, 2.3, 0.01);
  k.cap(-0.43, 1.8, -0.43, 2.05, 0.02).cap(0.43, 1.8, 0.43, 2.05, 0.02);
  // the guard with binoculars, turning now and then
  const turn = sin(t * 0.15) > 0;
  const keep = k.fx;
  const ox = k.ox;
  const oy = k.oy;
  const s = k.s;
  k.at(ox + keep * 0.05 * s, oy - 1.58 * s, s * 0.42, turn ? keep > 0 : keep < 0);
  human(k, { pose: "binoculars", hat: true });
  k.at(ox, oy, s, keep < 0);
}

/** a Karoo wind pump turning in the wind */
export function windpump(k: Kit, t: number, wind: number) {
  k.cap(-0.22, 0, -0.05, 2.0, 0.02).cap(0.22, 0, 0.05, 2.0, 0.02);
  for (let i = 0; i < 4; i++) {
    const y0 = 0.3 + i * 0.42;
    const y1 = y0 + 0.42;
    const w0 = 0.22 - y0 * 0.085;
    const w1 = 0.22 - y1 * 0.085;
    k.cap(-w0, y0, w1, y1, 0.008).cap(w0, y0, -w1, y1, 0.008);
  }
  const hub = { x: 0.0, y: 2.08 };
  k.cap(-0.12, hub.y, -0.75, hub.y + 0.03, 0.02).tri(-0.75, hub.y - 0.12, -0.75, hub.y + 0.2, -0.95, hub.y + 0.04);
  const rot = t * (0.8 + wind * 3.0);
  for (let b = 0; b < 12; b++) {
    const a = rot + (b / 12) * TAU;
    const ex = cos(a) * 0.12;
    k.cap(hub.x + 0.04, hub.y, hub.x + 0.04 + ex * 0.6, hub.y + sin(a) * 0.55, 0.035, 0.05);
  }
  k.ellipse(hub.x + 0.05, hub.y, 0.06, 0.07);
}

/** the top of a Maya temple above the canopy, people sitting on the steps */
export function temple(k: Kit, t: number) {
  const steps = [
    [1.2, 0.0, 0.32],
    [1.0, 0.32, 0.62],
    [0.8, 0.62, 0.9],
    [0.6, 0.9, 1.16],
  ];
  for (const [w, y0, y1] of steps) k.rect(-w, y0, w, y1);
  k.rect(-0.4, 1.16, 0.4, 1.58);
  k.rect(-0.3, 1.58, 0.3, 1.95);
  k.rect(-0.12, 1.95, 0.12, 2.12);
  const keep = k.fx;
  const ox = k.ox;
  const oy = k.oy;
  const s = k.s;
  const seat: [number, number][] = [[-0.25, 1.16], [0.18, 1.16], [-0.62, 0.9]];
  seat.forEach(([x, y], i) => {
    k.at(ox + keep * x * s, oy - y * s, s * 0.24, i === 1 ? keep > 0 : keep < 0);
    human(k, { pose: i === 2 ? "point" : "sit", phase: t });
  });
  k.at(ox, oy, s, keep < 0);
}

/** a camera trap strapped to a trunk; the red light winks when it fires */
export function cameraTrap(k: Kit, t: number, period = 7) {
  k.rect(-0.18, -0.25, 0.18, 0.25);
  k.cap(-0.3, 0.1, 0.3, 0.1, 0.03);
  k.ellipse(0.0, 0.05, 0.08, 0.08);
  const ph = t % period;
  const on = ph < 0.18 || (ph > 0.42 && ph < 0.56) ? 1 : 0;
  k.glow(0.1, 0.18, Math.max(5, k.s * 0.9), Math.max(0.9, k.s * 0.07), 2.6 * on + 0.15, RED);
}

/** a string of prayer flags between two posts, fluttering */
export function flags(k: Kit, x1: number, y1: number, t: number, wind: number) {
  const n = 9;
  const cols: [number, number, number][] = [
    [0.25, 0.45, 0.95],
    [0.98, 0.98, 0.98],
    [0.9, 0.2, 0.15],
    [0.25, 0.7, 0.3],
    [0.98, 0.82, 0.2],
  ];
  k.cap(0, 0, 0, 0.62, 0.02).cap(x1, y1, x1, y1 + 0.62, 0.02);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const sag = sin(u * Math.PI) * 0.12;
    const x = u * x1;
    const y = 0.6 + (y1 - 0) * u - sag;
    if (i < n) {
      const u2 = (i + 1) / n;
      k.cap(x, y, u2 * x1, 0.6 + y1 * u2 - sin(u2 * Math.PI) * 0.12, 0.006);
    }
    if (i > 0 && i < n) {
      const c = cols[i % 5];
      const f = sin(t * (2 + wind * 4) + i * 1.3) * 0.04;
      k.tint(0.75, c[0], c[1], c[2]);
      k.tri(x - 0.04, y, x + 0.04, y, x + f, y - 0.13);
      k.untint();
    }
  }
}

/** a lit window far away, with someone in it, and their cat on the sill */
export function litWindow(k: Kit, t: number) {
  k.lightRect(-0.5, 0, 0.5, 0.8, WARM, 0.75);
  k.glow(0, 0.4, k.s * 1.8, k.s * 0.4, 0.35, WARM);
  const st = k.st;
  const old = [st.mode, st.shade] as const;
  st.mode = 2;
  st.shade = 0.05;
  st.rgb = [0.1, 0.07, 0.05];
  // the person: shoulders and head, turning a page now and then
  const turn = sin(t * 0.21) > 0.95 ? 0.04 : 0;
  k.ellipse(0.14, 0.42 + turn, 0.07, 0.08).ellipse(0.14, 0.22, 0.17, 0.14);
  // the cat: a loaf on the sill, ears up
  k.ellipse(-0.24, 0.07, 0.13, 0.07).ellipse(-0.14, 0.13, 0.055, 0.05);
  k.tri(-0.18, 0.16, -0.16, 0.22, -0.14, 0.16).tri(-0.13, 0.16, -0.11, 0.22, -0.09, 0.16);
  st.mode = old[0];
  st.shade = old[1];
}
