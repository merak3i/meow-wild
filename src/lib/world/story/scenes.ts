import type { Scene, SceneCtx } from "./layer";
import {
  BHARAL,
  CAMEL,
  CAPYBARA,
  CATTLE,
  DEER,
  DOE,
  GUANACO,
  HORSE,
  HYENA,
  LLAMA,
  SPRINGBOK,
  WARM,
  LAMP,
  type QuadSpec,
  caiman,
  cameraTrap,
  canoe,
  fish,
  flags,
  flyer,
  fowl,
  ger,
  hare,
  human,
  jeep,
  jerboa,
  launch,
  litWindow,
  mouse,
  peacock,
  pika,
  quad,
  smoke,
  soarer,
  temple,
  tent,
  viscacha,
  wader,
  watchtower,
  windpump,
} from "./figures";

/**
 * One small story per world. Scenes are written as if the cat stood on the
 * left of the screen; `c.x` mirrors them when it stands on the right.
 *
 * Prey and companions live close to the cat, or in the open foreground under
 * its text. People stay far off, small and quiet, in the open strip between
 * the cat and its text where nothing covers them: easter eggs for whoever
 * looks, watching the cats without ever coming close.
 */

const TAU = Math.PI * 2;
const frac = (x: number) => x - Math.floor(x);
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const hash = (n: number) => frac(Math.sin(n * 12.9898) * 43758.5453);
/** a pulse that rises over `up` seconds, holds, and falls, once every `period` */
const pulse = (t: number, period: number, start: number, len: number, up = 0.4) => {
  const p = frac((t - start) / period) * period;
  return smooth(0, up, p) * (1 - smooth(len - up, len, p));
};
/** +1 toward the open side (away from the cat), in screen px */
const out = (c: SceneCtx) => (c.side < 0 ? 1 : -1);
/** flip so a figure faces away from the cat / toward it */
const away = (c: SceneCtx) => c.side > 0;
const toward = (c: SceneCtx) => c.side < 0;

/** feet on the crest of `card` at authored position xf, shifted by dx px toward the open side */
const on = (c: SceneCtx, card: number, xf: number, dx = 0): [number, number] => {
  const x = c.x(card, xf) + dx * out(c);
  return [x, c.crest(card, x)];
};

/**
 * feet on the near ground in the open band along the bottom of the screen,
 * low enough that a figure `h` px tall clears the cat and its text
 */
const fore = (c: SceneCtx, xf: number, depth = 0, dx = 0, h = 0): [number, number] => {
  const x = c.x(6, xf) + dx * out(c);
  return [x, Math.min(c.H * 0.965, Math.max(c.crest(6, x) + 6, c.floor + h) + depth)];
};

/** colour a figure as a sunlit animal rather than a silhouette (for dark ground) */
const lit = (c: SceneCtx, card: number, shade: number, x?: number, y?: number) => {
  const [r, g, b] = c.sun;
  const m = Math.max(r, g, b, 0.05);
  c.k.ground(card, shade, 1, x, y).tint(0.22, r / m, g / m, b / m);
};

/** a size that grows toward the bottom of the screen, as the ground comes closer */
const near = (c: SceneCtx, y: number, k: number) => Math.max(8, (y - c.horizon) * k);

/** a far-off spot in the open strip between cat and text, on the first of `cards` that nothing nearer hides */
function perch(c: SceneCtx, cards: number[], u: number, need = 8) {
  const x = c.gap(u);
  for (const card of cards) {
    const y = c.crest(card, x);
    if (y < c.H * 0.08 || y > c.H * 0.97) continue;
    if (c.clear(card, x, y - need)) return { x, y, card };
  }
  return null;
}

/** how tall a far-off person is drawn on `card`: small, but never too small to read */
const watcher = (c: SceneCtx, card: number) => Math.max(c.H * 0.017, Math.min(c.H * 0.03, c.unit(card) * 1.2));

/** a herd grazing, drifting slowly, heads coming up now and then; they all look up when the cat calls */
function herd(
  c: SceneCtx,
  spec: QuadSpec,
  place: (dx: number, h: number) => [number, number],
  card: number,
  n: number,
  size: (y: number) => number,
  opts: { spread?: number; speed?: number; seed?: number; shade?: number; lit?: boolean } = {},
) {
  const k = c.k;
  const spread = opts.spread ?? 1.6;
  const seed = opts.seed ?? 0;
  let focus: [number, number] | null = null;
  let alert = 0;
  for (let i = 0; i < n; i++) {
    const h = hash(i + seed * 7.1);
    const wander = c.reduced ? 0 : Math.sin(c.t * (opts.speed ?? 0.05) + h * TAU) * 1.2;
    const guess = size(c.H * 0.9);
    const [x, y] = place((i - (n - 1) / 2) * spread + h * 0.5 + wander, guess * 1.15);
    const s = size(y);
    if (card >= 0 && !c.clear(card, x, y - s * 0.6)) continue;
    const up = Math.max(c.calling ? 1 : 0, pulse(c.t, 9 + h * 6, h * 20, 2.6 + h * 2));
    k.at(x, y, s, (i + seed) % 3 === 0 ? !away(c) : away(c));
    if (opts.lit) lit(c, card, opts.shade ?? 1.3);
    else k.ground(card, opts.shade ?? 0.5);
    quad(k, spec, { phase: c.t * 2.2 + h * 9, stride: c.reduced ? 0 : 0.3 * (1 - up), graze: 1 - up, alert: up });
    k.untint();
    if (!focus || up > alert) {
      alert = Math.max(alert, up);
      focus = [x, y - s * 0.8];
    }
  }
  return { focus, alert };
}

/** a big bird circling high over a point */
function circling(c: SceneCtx, kind: Parameters<typeof soarer>[1], cx: number, cy: number, r: number, size: number, speed: number, phase = 0) {
  const a = (c.reduced ? 1 : c.t) * speed + phase;
  const x = cx + Math.cos(a) * r;
  const y = cy + Math.sin(a) * r * 0.35;
  c.k.at(x, y, size).behind(0.4, 0.9);
  soarer(c.k, kind, Math.sin(a) * 0.8);
  return [x, y] as [number, number];
}

/** a bird crossing the sky once every `period` seconds, from the cat side to the open side */
function crossing(c: SceneCtx, period: number, offset: number, y: number, size: number, draw: (q: number) => void) {
  const q = c.reduced ? 0.45 : frac(c.t / period + offset);
  const x = c.x(4, -0.15 + q * 1.3);
  const fade = smooth(0, 0.06, q) * (1 - smooth(0.94, 1, q));
  c.k.at(x, y, size, away(c)).behind(0.42, fade);
  draw(q);
  return { x, y, q };
}

/* ---------------- the roof of the world ---------------- */

/** above the cloud sea before dawn: a high camp glows on a far ridge, headlamps climb toward a summit */
const hero: Scene = (c) => {
  const k = c.k;
  const [tx, ty] = on(c, 1, 0.8);
  const s = Math.max(10, c.H * 0.016);
  if (ty < c.H * 0.96 && ty > c.H * 0.4) {
    k.at(tx, ty, s).ground(1, 0.5);
    tent(k, 1);
    k.at(tx + s * 1.5, ty + 1, s * 0.9).ground(1, 0.5);
    tent(k, 0.55);
  }
  for (let i = 0; i < 3; i++) {
    const p = c.reduced ? 0.4 : frac(c.t * 0.004 + 0.1 + i * 0.02);
    const [x, y] = on(c, 0, 0.66 + p * 0.05 - i * 0.012);
    k.at(x, y, Math.max(6, c.H * 0.008)).ground(0, 0.4);
    k.glow(0, 0.9, 8, 1.1, 1.5, [1, 0.9, 0.72]);
  }
};

/** first light: blue sheep graze the ridge below the snow leopard, a lammergeier rides the updraft, a rope team climbs far off */
const snowLeopard: Scene = (c) => {
  const k = c.k;
  const size = Math.min(c.H * 0.06, 54);
  const h = herd(c, BHARAL, (dx) => on(c, 6, 0.74, dx * size), 6, 4, () => size, { spread: 1.9, seed: 1, shade: 0.42 });
  c.react(h.focus, Math.max(h.alert * 0.7, 0.3));
  circling(c, "lammergeier", c.x(0, 0.74), c.H * 0.18, c.W * 0.06, Math.max(16, c.H * 0.032), 0.18);
  // a rope team on the far summit ridge, headlamps still on in the first light
  const p = c.reduced ? 0.3 : frac(c.t * 0.004);
  for (let i = 0; i < 3; i++) {
    const spot = perch(c, [0, 1], 0.35 + p * 0.3 - i * 0.04);
    if (!spot) continue;
    k.at(spot.x, spot.y, watcher(c, spot.card), away(c)).ground(spot.card, 0.4);
    human(k, { pose: "pole", phase: c.t * 1.4 + i, pack: true, lamp: 0.85 });
  }
};

/** the salt flat: viscachas sun on a boulder by the cat; a herder walks his llamas across; flamingos skim the brine */
const andeanCat: Scene = (c) => {
  const k = c.k;
  const vs = c.H * 0.045;
  const [bx, by] = fore(c, 0.46, 0, 0, vs * 1.6);
  k.at(bx, by, vs * 1.1).ground(6, 0.55);
  k.ellipse(0, 0.22, 1.15, 0.3).ellipse(0.55, 0.15, 0.6, 0.2).ellipse(-0.5, 0.12, 0.55, 0.18);
  for (let i = 0; i < 2; i++) {
    const alert = c.calling ? 1 : pulse(c.t, 11, i * 4, 3);
    k.at(bx + (i ? 0.62 : -0.3) * vs * out(c), by - vs * 0.42, vs * (i ? 0.85 : 1), i === 0 ? away(c) : !away(c)).ground(6, 0.42, 1, bx, by);
    viscacha(k, alert, c.t + i);
    if (i === 0) c.react([bx, by - vs], 0.35 + alert * 0.5);
  }
  // the caravan: one herder leading his llamas across the far salt
  const p = c.reduced ? 0.5 : frac(c.t * 0.006);
  const lead = perch(c, [4, 3, 5], 0.15 + p * 0.55, 10);
  if (lead) {
    const s = watcher(c, lead.card) * 1.1;
    for (let i = 0; i < 4; i++) {
      const x = lead.x - out(c) * i * s * 1.25;
      const y = c.crest(lead.card, x);
      k.at(x, y, i === 0 ? s : s * 0.85, away(c)).ground(lead.card, 0.42);
      if (i === 0) human(k, { pose: "walk", phase: c.t * 2.6, hat: true, robe: true });
      else quad(k, LLAMA, { phase: c.t * 2.6 + i, stride: c.reduced ? 0 : 0.8 });
    }
  }
  for (let i = 0; i < 5; i++) {
    const q = c.reduced ? 0.4 : frac(c.t * 0.025 + 0.3);
    const x = c.x(5, 1.1 - q * 1.3) + i * c.H * 0.03 * out(c);
    const y = c.horizon - c.H * (0.08 + i * 0.008) + Math.sin(c.t * 0.7 + i) * 3;
    k.at(x, y, c.H * 0.02, toward(c))
      .behind(0.85, smooth(0, 0.08, q) * (1 - smooth(0.85, 1, q)))
      .tint(0.75, 1.0, 0.45, 0.55);
    flyer(k, "flamingo", c.t * 9 + i * 1.7);
    k.untint();
  }
};

/** cold steppe: a pika pops up among the boulders; a ger smokes far off and a rider crosses the plain */
const pallas: Scene = (c) => {
  const k = c.k;
  const size = c.H * 0.035;
  const [px, py] = fore(c, 0.46, 0, 0, size * 1.6);
  k.at(px, py, size * 1.3).ground(6, 0.82).tint(0.45, 0.62, 0.6, 0.56);
  k.ellipse(0.0, 0.3, 1.0, 0.36).ellipse(-0.7, 0.2, 0.5, 0.25).ellipse(0.55, 0.18, 0.45, 0.2);
  k.untint();
  const up = c.calling ? 0.15 : pulse(c.t, 8, 1.5, 4.2, 0.25);
  if (up > 0.02) {
    k.at(px + size * 0.3 * out(c), py - size * 0.62 + size * (1 - up) * 0.75, size, away(c)).ground(6, 0.42, 1, px, py);
    pika(k, up > 0.6 ? 1 : 0, Math.sin(c.t * 2));
  }
  c.react([px, py - size], 0.3 + up * 0.7);
  const gerSpot = perch(c, [3, 4, 2], 0.45);
  if (gerSpot) {
    const gs = watcher(c, gerSpot.card) * 2.2;
    k.at(gerSpot.x, gerSpot.y, gs).ground(gerSpot.card, 1.15).tint(0.8, 1.0, 0.99, 0.95);
    ger(k);
    k.untint();
    k.ground(gerSpot.card, 0.35);
    k.rect(-0.12, 0.0, 0.12, 0.3).rect(-0.82, 0.42, 0.82, 0.47);
    k.at(gerSpot.x + gs * 0.25 * out(c), gerSpot.y - gs * 0.9, gs).behind(1.22, 1, gerSpot.card);
    smoke(k, c.t, c.wind);
  }
  const p = c.reduced ? 0.5 : frac(c.t * 0.008);
  const rs = perch(c, [4, 3], 0.15 + p * 0.7);
  if (rs) {
    const s = watcher(c, rs.card) * 0.95;
    k.at(rs.x, rs.y, s, away(c)).ground(rs.card, 0.45);
    quad(k, HORSE, { phase: c.t * 2.4, stride: c.reduced ? 0 : 0.6 });
    k.at(rs.x - s * 0.05 * out(c), rs.y - s * 0.95, s * 0.75, away(c)).ground(rs.card, 0.45, 1, rs.x, rs.y);
    human(k, { pose: "sit", hat: true });
  }
};

/** Patagonia: guanacos on the slope, a condor overhead; a tracker and a photographer watch from the rocks */
const puma: Scene = (c) => {
  const k = c.k;
  const h = herd(c, GUANACO, (dx, hh) => fore(c, 0.72, 0, dx * 42, hh), 6, 3, () => c.H * 0.065, { spread: 2.0, seed: 4, shade: 0.45 });
  c.react(h.focus, Math.max(0.3, h.alert));
  circling(c, "condor", c.x(0, 0.8), c.H * 0.13, c.W * 0.07, Math.max(20, c.H * 0.04), 0.12, 1);
  const spot = perch(c, [3, 4, 2], 0.5);
  if (spot) {
    const s = watcher(c, spot.card);
    k.at(spot.x, spot.y, s, toward(c)).ground(spot.card, 0.42);
    human(k, { pose: "camera", hat: true });
    const s2 = perch(c, [spot.card], 0.68);
    if (s2) {
      k.at(s2.x, s2.y, s, toward(c)).ground(spot.card, 0.42);
      human(k, { pose: "scope", pack: true });
    }
  }
};

/** taiga: roe deer at the forest edge, a hare frozen in the stone run; a researcher listens for a collar */
const lynx: Scene = (c) => {
  const k = c.k;
  const up = c.calling ? 1 : pulse(c.t, 10, 3, 3.5);
  const ds = c.H * 0.07;
  const [dx, dy] = fore(c, 0.7, 0, 0, ds * 1.4);
  k.at(dx, dy, ds, toward(c)).ground(6, 0.5).tint(0.35, 0.5, 0.32, 0.2);
  quad(k, DEER, { graze: 1 - up, alert: up, phase: c.t });
  k.at(dx + ds * 1.5 * out(c), dy + 4, ds * 0.92, away(c)).ground(6, 0.5).tint(0.35, 0.5, 0.32, 0.2);
  quad(k, DOE, { graze: 1 - up * 0.6, alert: up * 0.6, phase: c.t + 1 });
  k.untint();
  const cyc = c.reduced ? 0 : frac(c.t / 14);
  const run = smooth(0.62, 0.66, cyc) * (1 - smooth(0.82, 0.83, cyc));
  const [hx0, hy0] = on(c, 6, 0.44);
  const hs = c.H * 0.03;
  const hx = hx0 + out(c) * smooth(0.62, 0.82, cyc) * c.W * 0.3;
  if (cyc < 0.82) {
    const hy = Math.max(hy0, c.crest(6, hx));
    k.at(hx, hy, hs, away(c)).ground(6, 0.5, smooth(0, 0.05, cyc));
    hare(k, run, c.t * 14, 1 - run);
    c.react([hx, hy - hs], Math.max(up, 0.4 + run * 0.6));
  } else c.react([dx, dy - ds], up);
  const spot = perch(c, [1, 2, 0], 0.5);
  if (spot) {
    k.at(spot.x, spot.y, watcher(c, spot.card), toward(c)).ground(spot.card, 0.42);
    human(k, { pose: "antenna", phase: c.t, pack: true });
  }
};

/** dry upland: guineafowl pick through the grass until they burst up; a safari truck waits on the track */
const caracal: Scene = (c) => {
  const k = c.k;
  const cyc = c.reduced ? 0.2 : frac(c.t / 13);
  const flush = smooth(0.7, 0.74, cyc);
  let focus: [number, number] | null = null;
  for (let i = 0; i < 7; i++) {
    const r = hash(i + 3);
    const s = c.H * (0.03 + r * 0.008);
    const [x0, y0] = fore(c, 0.5, r * c.H * 0.04, (i - 3) * 34 + r * 16, s * 0.7);
    if (flush < 0.01) {
      k.at(x0, y0, s, r > 0.5 ? away(c) : !away(c)).ground(6, 0.4);
      fowl(k, pulse(c.t + r * 3, 1.6 + r, 0, 0.5, 0.1));
    } else {
      const q = smooth(0.7, 1, cyc);
      const fx = x0 + out(c) * q * c.W * (0.35 + r * 0.3);
      const fy = y0 - q * c.H * (0.3 + r * 0.15) - Math.sin(q * Math.PI) * c.H * 0.05;
      k.at(fx, fy, s * 1.4, away(c)).behind(0.4, 1 - smooth(0.85, 1, cyc));
      flyer(k, "dove", c.t * 22 + i * 2);
      if (i === 3) focus = [fx, fy];
    }
    if (i === 3 && !focus) focus = [x0, y0 - s];
  }
  c.react(focus, flush > 0 ? 1 : 0.35 + smooth(0.55, 0.7, cyc) * 0.5);
  const spot = perch(c, [4, 3, 5], 0.55, 14);
  if (spot) {
    const js = watcher(c, spot.card) * 1.5;
    k.at(spot.x, spot.y, js, toward(c)).ground(spot.card, 0.48).tint(0.4, 0.84, 0.76, 0.56);
    jeep(k, 3, c.t);
    k.untint();
  }
};

/** inside the cloud: hornbills beat through the mist; a camera trap winks on its post */
const cloudedLeopard: Scene = (c) => {
  const k = c.k;
  for (let i = 0; i < 2; i++) {
    const b = crossing(c, 26, i * 0.06, c.H * (0.2 + i * 0.05), c.H * 0.034, () => flyer(k, "hornbill", c.t * 5 + i * 2.1));
    k.st.shade = 0.55;
    if (i === 0) c.react([b.x, b.y], 0.25 + 0.5 * smooth(0.25, 0.5, b.q) * (1 - smooth(0.55, 0.8, b.q)));
  }
  const s = c.H * 0.035;
  const [px, py] = fore(c, 0.5, 0, 0, s * 2.3);
  k.at(px, py, s).ground(6, 0.4);
  k.cap(0, 0, 0, 2.2, 0.07, 0.06);
  k.at(px + s * 0.12 * out(c), py - s * 1.7, s * 0.7, toward(c)).ground(6, 0.35, 1, px, py);
  cameraTrap(k, c.t);
  const flash = c.reduced ? 0 : pulse(c.t, 12.5, 4, 0.22, 0.04);
  if (flash > 0.01) k.glow(0.05, 0.05, 60, 4, 2.2 * flash, [1, 1, 1]);
};

/** montane forest: prayer flags on the ridge, a walker under an umbrella; a kalij pheasant in the undergrowth */
const goldenCat: Scene = (c) => {
  const k = c.k;
  const a = perch(c, [4, 3, 5], 0.2);
  const b = perch(c, [4, 3, 5], 0.85);
  if (a && b && a.card === b.card) {
    const s = watcher(c, a.card) * 1.3;
    k.at(a.x, a.y, s, c.side > 0).ground(a.card, 0.6);
    flags(k, Math.abs(b.x - a.x) / s, (a.y - b.y) / s, c.t, c.wind);
  }
  const p = c.reduced ? 0.5 : frac(c.t * 0.012);
  const wspot = perch(c, [4, 3, 5], 0.25 + p * 0.5);
  if (wspot) {
    k.at(wspot.x, wspot.y, watcher(c, wspot.card), away(c)).ground(wspot.card, 0.45);
    human(k, { pose: "walk", phase: c.t * 2.2, umbrella: true });
  }
  const bs = c.H * 0.04;
  const [bx, by] = fore(c, 0.52, 0, 0, bs * 0.6);
  k.at(bx, by, bs, away(c)).ground(6, 0.4);
  fowl(k, pulse(c.t, 2.3, 0, 0.7, 0.15));
  k.cap(-0.3, 0.38, -0.95, 0.5, 0.06, 0.02);
  c.react([bx, by - bs * 0.5], 0.45);
};

/** savanna under the cloud base: impala graze, a hyena hopes, vultures wait on the air; a truck of photographers keeps its distance */
const leopard: Scene = (c) => {
  const k = c.k;
  const h = herd(c, SPRINGBOK, (dx, hh) => fore(c, 0.76, 0, dx * 36, hh), 6, 4, () => c.H * 0.055, { spread: 1.8, seed: 7, shade: 0.42 });
  const hs = c.H * 0.06;
  const [hx, hy] = fore(c, 0.46, c.H * 0.02, 0, hs);
  const sniff = pulse(c.t, 7, 2, 3);
  k.at(hx, hy, hs, away(c)).ground(6, 0.4);
  quad(k, HYENA, { graze: 0.5 - sniff * 0.5, phase: c.t, alert: sniff });
  c.react(c.calling ? h.focus : [hx, hy - hs * 0.6], 0.35 + h.alert * 0.4);
  for (let i = 0; i < 3; i++) circling(c, "vulture", c.x(0, 0.22 + i * 0.09), c.H * (0.1 + i * 0.03), c.W * (0.025 + i * 0.01), Math.max(20, c.H * 0.03), 0.2 - i * 0.03, i * 2.1);
  const spot = perch(c, [4, 3, 5], 0.55, 14);
  if (spot) {
    const js = watcher(c, spot.card) * 1.5;
    k.at(spot.x, spot.y, js, toward(c)).ground(spot.card, 0.45).tint(0.3, 0.55, 0.62, 0.42);
    jeep(k, 3, c.t);
    k.untint();
    const g = pulse(c.t, 6, 1, 0.5, 0.1);
    if (g > 0.05) k.glow(-0.4, 1.13, 12, 1.3, 1.8 * g, [1, 0.95, 0.8]);
  }
};

/** highland wetland: something rustles in the reeds by the serval; crowned cranes wade; a herder brings the cattle home */
const serval: Scene = (c) => {
  const k = c.k;
  const wl = c.water(6) ?? c.horizon + c.H * 0.06;
  const pop = pulse(c.t, 9, 4.5, 1.6, 0.15);
  const rustle = pulse(c.t, 9, 1, 7.5);
  const ms = c.H * 0.02;
  const [mx, my] = fore(c, 0.47, 0, 0, ms * 3);
  for (let i = 0; i < 6; i++) {
    const sw = Math.sin(c.t * 18 + i) * rustle * 0.18;
    k.at(mx + (i - 2.5) * ms * 0.5, my, ms).ground(6, 0.38);
    k.cap(0, 0, (i - 2.5) * 0.25 + sw, 2.2 + (i % 2) * 0.7, 0.1, 0.025);
  }
  if (pop > 0.02) {
    k.at(mx, my - pop * ms * 0.5, ms, away(c)).ground(6, 0.38, pop, mx, my);
    mouse(k, pop);
  }
  c.react([mx, my - ms * 2], 0.55 + rustle * 0.45);
  for (let i = 0; i < 2; i++) {
    const s = c.H * (0.075 - i * 0.008);
    const [x, y0] = fore(c, 0.7 + i * 0.07, c.H * i * 0.012, 0, s);
    const y = Math.max(y0, wl + c.H * 0.06);
    const peck = pulse(c.t + i * 3, 6, 0, 1.8);
    k.at(x, y, s, i === 0 ? away(c) : !away(c)).ground(6, 0.4, 1, x, y - 8);
    wader(k, "crane", peck, c.t);
    k.at(x, y, s * 0.9, i === 0 ? away(c) : !away(c), true).behind(0.8, 0.35);
    wader(k, "crane", peck, c.t);
  }
  const p = c.reduced ? 0.5 : frac(c.t * 0.006);
  for (let i = 0; i < 4; i++) {
    const spot = perch(c, [3, 4, 2], 0.15 + p * 0.4 + i * 0.12);
    if (!spot) continue;
    const s = watcher(c, spot.card) * (i === 0 ? 1 : 0.85);
    k.at(spot.x, spot.y, s, toward(c)).ground(spot.card, 0.45);
    if (i === 0) human(k, { pose: "pole", phase: c.t * 2, robe: true });
    else quad(k, CATTLE, { phase: c.t * 2 + i, stride: c.reduced ? 0 : 0.5, graze: 0.3 });
  }
};

/** sal forest: chital step between the trunks, a peacock stalks; the forest guard watches from his tower */
const tiger: Scene = (c) => {
  const k = c.k;
  const h = herd(c, DEER, (dx, hh) => fore(c, 0.74, 0, dx * 40, hh), 6, 3, () => c.H * 0.06, { spread: 2.0, seed: 11, shade: 0.5, speed: 0.08 });
  c.react(h.focus, 0.4 + h.alert * 0.6);
  const ps = c.H * 0.06;
  const [px, py] = fore(c, 0.5, c.H * 0.02, 0, ps * 0.8);
  k.at(px, py, ps, away(c)).ground(6, 0.45).tint(0.3, 0.1, 0.35, 0.45);
  peacock(k);
  k.untint();
  const spot = perch(c, [4, 3, 5], 0.5, 20);
  if (spot) {
    k.at(spot.x, spot.y, watcher(c, spot.card) * 1.6, toward(c)).ground(spot.card, 0.42);
    watchtower(k, c.t);
  }
};

/** karst and jungle at dusk: a toucan crosses between towers; people sit on a temple top above the trees, watching the light go */
const ocelot: Scene = (c) => {
  const k = c.k;
  const b = crossing(c, 22, 0, c.H * 0.24, c.H * 0.026, () => flyer(k, "toucan", c.t * 10));
  c.react([b.x, b.y], 0.25 + 0.45 * smooth(0.2, 0.45, b.q) * (1 - smooth(0.5, 0.75, b.q)));
  const spot = perch(c, [2, 1, 3], 0.5, 30);
  if (spot) {
    const ts = watcher(c, spot.card) * 3.4;
    k.at(spot.x, spot.y + ts * 0.2, ts, toward(c)).ground(spot.card, 0.6, 1, spot.x, spot.y);
    temple(k, c.t);
  }
  const p = c.reduced ? 0.3 : frac(c.t / 16);
  const as = c.H * 0.03;
  const [ax, ay] = fore(c, 0.55 + p * 0.3, 0, 0, as);
  k.at(ax, ay, as, away(c)).ground(6, 0.4);
  hare(k, p < 0.6 ? 0.4 : 0, c.t * 10, 0);
};

/** the Karoo: springbok pronk on the plain; a windpump turns; a researcher on the truck roof scans with binoculars */
const blackFooted: Scene = (c) => {
  const k = c.k;
  for (let i = 0; i < 5; i++) {
    const r = hash(i + 41);
    const pr = c.reduced ? 0 : Math.max(0, Math.sin(c.t * 3.4 + i * 1.3)) * pulse(c.t, 12, 2 + r, 4);
    const s = c.H * (0.05 + r * 0.01);
    const [x, y] = fore(c, 0.58 + i * 0.07 + r * 0.03, r * c.H * 0.03, 0, s * 1.2);
    k.at(x, y, s, i % 2 ? away(c) : !away(c)).ground(6, 0.45, 1, x, y + 4);
    quad(k, SPRINGBOK, { graze: pr > 0.05 ? 0 : 0.85, pronk: pr, phase: c.t });
    if (i === 1) c.react([x, y - s], 0.3 + pr * 0.7);
  }
  const lq = c.reduced ? 0 : frac(c.t / 11);
  if (lq > 0.6 && lq < 0.95) {
    const u = (lq - 0.6) / 0.35;
    const x = c.x(6, 0.46 + u * 0.3);
    const y = c.below - u * c.H * 0.3;
    k.at(x, y, c.H * 0.014, away(c)).behind(0.42, 1 - smooth(0.8, 1, u));
    flyer(k, "small", c.t * 30);
    c.react([x, y], 0.9 * (1 - u));
  }
  const pump = perch(c, [4, 3, 5], 0.3, 30);
  if (pump) {
    k.at(pump.x, pump.y, watcher(c, pump.card) * 1.5, toward(c)).ground(pump.card, 0.42);
    windpump(k, c.reduced ? 0 : c.t, c.wind);
  }
  const truck = perch(c, [4, 3, 5], 0.72, 14);
  if (truck) {
    const js = watcher(c, truck.card) * 0.95;
    k.at(truck.x, truck.y, js, toward(c)).ground(truck.card, 0.42);
    jeep(k, 0, c.t);
    k.at(truck.x, truck.y - js * 0.97, js * 0.85, toward(c)).ground(truck.card, 0.42, 1, truck.x, truck.y);
    human(k, { pose: "binoculars", hat: true });
  }
};

/** under the canopy at golden hour: parrots cross the gap; a canopy researcher hangs on her rope, headlamp on */
const margay: Scene = (c) => {
  const k = c.k;
  for (let i = 0; i < 3; i++) {
    const b = crossing(c, 18, i * 0.025, c.H * (0.5 + i * 0.02), c.H * 0.016, () => flyer(k, "small", c.t * 18 + i));
    if (i === 0) c.react([b.x, b.y], 0.3);
  }
  const rx = c.gap(0.55);
  const climb = c.reduced ? 0.5 : 0.5 + Math.sin(c.t * 0.08) * 0.25;
  const ry = c.H * (0.22 + climb * 0.18);
  const rs = c.H * 0.04;
  k.at(rx, ry + rs * 0.5, rs).behind(0.3);
  k.cap(0, 0.6, 0, 14, 0.025);
  k.at(rx, ry + rs * 0.5, rs, toward(c)).behind(0.3);
  human(k, { pose: "sit", lamp: 1, beam: 2.6 });
};

/** the Pantanal at golden hour: a caiman cruises past the jaguar, capybaras graze the far bank; a boat of watchers idles mid-river */
const jaguar: Scene = (c) => {
  const k = c.k;
  const wl = c.water(6) ?? c.horizon + c.H * 0.05;
  const q = c.reduced ? 0.5 : frac(c.t * 0.012);
  const cx = c.x(6, 0.12 + q * 0.6);
  const cy = Math.max(wl + c.H * 0.14, c.floor + c.H * 0.03);
  const cs = c.H * 0.13;
  k.at(cx, cy, cs, away(c)).ground(6, 0.3, 1, cx, cy - 6);
  caiman(k);
  k.at(cx, cy, cs, away(c)).behind(1.3, 0.45);
  for (let i = 1; i < 4; i++) {
    const d = i * 0.3;
    k.cap(-d - 0.1, 0.0, -d - 0.55, -0.05 * i, 0.008, 0.003).cap(-d - 0.1, 0.0, -d - 0.55, 0.04 * i, 0.008, 0.003);
  }
  c.react([cx, cy], 0.55 + (c.calling ? 0.4 : 0));
  for (let i = 0; i < 3; i++) {
    const spot = perch(c, [4, 3, 5], 0.2 + i * 0.22);
    if (!spot) continue;
    const bs = watcher(c, spot.card) * (i === 2 ? 0.45 : 0.7);
    k.at(spot.x, spot.y, bs, i % 2 ? away(c) : !away(c)).ground(spot.card, 0.45);
    quad(k, CAPYBARA, { graze: 0.7, phase: c.t + i });
  }
  const bx = c.gap(0.5) + Math.sin(c.t * 0.1) * 8;
  const by = wl + c.H * 0.02;
  const ls = Math.max(9, c.H * 0.014);
  k.at(bx, by, ls, toward(c)).ground(6, 0.42, 1, bx, by + 6).tint(0.4, 0.9, 0.9, 0.85);
  launch(k, 4, c.t);
  k.untint();
  k.at(bx, by, ls * 0.9, toward(c), true).behind(0.75, 0.35);
  launch(k, 4, c.t);
};

/** misty tea hills at dusk: pickers walk home along the rows, one with a lantern; a moth circles the tiny cat */
const rustySpotted: Scene = (c) => {
  const k = c.k;
  const p = c.reduced ? 0.5 : frac(c.t * 0.008);
  for (let i = 0; i < 3; i++) {
    const spot = perch(c, [4, 5, 3], 0.1 + p * 0.6 + i * 0.09);
    if (!spot) continue;
    const s = watcher(c, spot.card);
    k.at(spot.x, spot.y, s, away(c)).ground(spot.card, 0.42);
    human(k, { pose: "walk", phase: c.t * 2.4 + i * 1.7, basket: true, robe: i !== 1 });
    if (i === 2) k.glow(0.25, 0.42, Math.max(12, s), Math.max(1.5, s * 0.07), 1.6, LAMP);
  }
  if (c.cat) {
    const [x0, y0, w0, h0] = c.cat;
    const a = c.t * 2.1;
    const mx = x0 + w0 * (0.5 + Math.cos(a) * 0.62);
    const my = y0 + h0 * (0.12 + Math.sin(a * 1.7) * 0.12);
    k.at(mx, my, c.H * 0.009).behind(0.55, 0.9);
    flyer(k, "small", c.t * 40);
    k.glow(0, 0, 7, 1, 0.3, [0.9, 1, 0.7]);
    c.react([mx, my], 0.85);
  }
};

/** Saharan dunes at sunset: a jerboa hops across the near dune; a camel caravan walks the far crest against the light */
const sandCat: Scene = (c) => {
  const k = c.k;
  const q = c.reduced ? 0.4 : frac(c.t / 12);
  const js = c.H * 0.032;
  const [jx, jy] = fore(c, 0.45 + q * 0.45, 0, 0, js * 1.6);
  k.at(jx, jy, js, away(c)).ground(6, 0.4);
  jerboa(k, c.t * 7);
  c.react([jx, jy - js], 0.4 + 0.5 * (1 - smooth(0.6, 1, q)));
  for (let i = 1; i < 9; i++) {
    const tx = jx - out(c) * i * js * 1.4;
    k.at(tx, jy + 1, js).ground(6, 0.75, (1 - i / 9));
    k.ellipse(0, 0, 0.12, 0.035).ellipse(0.25, 0.02, 0.12, 0.035);
  }
  const p = c.reduced ? 0.5 : frac(c.t * 0.005);
  const lead = perch(c, [2, 3, 1, 4], 0.1 + p * 0.6, 10);
  if (lead) {
    const s0 = watcher(c, lead.card);
    for (let i = 0; i < 5; i++) {
      const x = lead.x - out(c) * i * s0 * 1.7;
      const y = c.crest(lead.card, x);
      if (!c.clear(lead.card, x, y - 6)) continue;
      k.at(x, y, i === 0 ? s0 : s0 * 1.25, away(c)).ground(lead.card, 0.3);
      if (i === 0) human(k, { pose: "walk", phase: c.t * 2.2, robe: true });
      else quad(k, CAMEL, { phase: c.t * 2.2 + i * 0.7, stride: c.reduced ? 0 : 0.7 });
    }
  }
};

/** a wetland at blue hour: fish rise by the fishing cat, a heron waits; a fisherman's lantern drifts on the water */
const fishingCat: Scene = (c) => {
  const k = c.k;
  const wl = c.water(6) ?? c.horizon + c.H * 0.06;
  for (let i = 0; i < 3; i++) {
    const per = 5 + i * 1.7;
    const ph = c.reduced ? 0.5 : frac(c.t / per + i * 0.3);
    const [x, y0] = fore(c, 0.4 + i * 0.1, c.H * i * 0.02, 0, 6);
    const y = Math.max(y0, wl + c.H * 0.08);
    k.at(x, y, 1).behind(1, (1 - ph) * 0.55);
    k.st.mode = 2;
    k.st.shade = 0.9;
    k.st.rgb = [0.62, 0.68, 0.9];
    k.ring(0, 0, 3 + ph * 34, 1.0, 3.2);
    k.ring(0, 0, ph * 18, 0.8, 3.2);
    if (i === 1) {
      const lp = c.reduced ? 0 : frac(c.t / 7.3);
      if (lp < 0.12) {
        const fs = near(c, y, 0.1);
        k.at(x, y, fs, away(c)).ground(6, 0.5, 1, x, y - 4);
        fish(k, lp / 0.12);
      }
      c.react([x, y], 0.6 + (lp < 0.15 ? 0.4 : 0));
    }
  }
  const hs = c.H * 0.08;
  const [hx, hy0] = fore(c, 0.62, 0, 0, hs);
  const hy = Math.max(hy0, wl + c.H * 0.08);
  k.at(hx, hy, hs, toward(c)).ground(6, 0.35, 1, hx, hy - 8);
  wader(k, "heron", pulse(c.t, 11, 3, 1.2, 0.2), c.t);
  k.at(hx, hy, hs * 0.9, toward(c), true).behind(0.8, 0.3);
  wader(k, "heron", pulse(c.t, 11, 3, 1.2, 0.2), c.t);
  const fx = c.gap(0.5) + Math.sin(c.t * 0.05) * 20;
  const fy = wl + c.H * 0.012;
  const fs2 = Math.max(10, c.H * 0.016);
  k.at(fx, fy, fs2, toward(c)).ground(6, 0.3, 1, fx, fy + 6);
  canoe(k, c.t * 1.2);
  // the lantern, and its long wobbling reflection on the black water
  const fl = 0.85 + Math.sin(c.t * 9) * 0.06 + Math.sin(c.t * 13.7) * 0.05;
  k.glow(-0.7, 0.45, 46, 2.4, 2.4 * fl, WARM);
  k.beam(-0.7, -0.1, -0.7 + Math.sin(c.t * 1.3) * 0.08, -3.4, 2.5, 6, 0.55 * fl, WARM);
  k.at(fx, fy, fs2, toward(c), true).behind(0.7, 0.3);
  canoe(k, c.t * 1.2);
};

/** home, at night: across the valley, in one lit window, someone reads with a cat on the sill */
const ending: Scene = (c) => {
  const k = c.k;
  const [x, y] = on(c, 4, 0.8);
  const s = Math.max(14, c.H * 0.03);
  if (c.clear(4, x, y - s)) {
    k.at(x, y, s).ground(4, 0.25);
    k.rect(-0.9, 0, 0.9, 1.1).tri(-1.05, 1.1, 1.05, 1.1, 0, 1.6);
    k.at(x + s * 0.1, y - s * 0.2, s * 0.9).ground(4, 0.25);
    litWindow(k, c.t);
  }
};

export const SCENES: Record<string, Scene> = {
  hero,
  "hero-dawn": hero,
  "snow-leopard": snowLeopard,
  "andean-mountain-cat": andeanCat,
  "pallass-cat": pallas,
  puma,
  "eurasian-lynx": lynx,
  caracal,
  "clouded-leopard": cloudedLeopard,
  "asian-golden-cat": goldenCat,
  leopard,
  serval,
  tiger,
  ocelot,
  "black-footed-cat": blackFooted,
  margay,
  jaguar,
  "rusty-spotted-cat": rustySpotted,
  "sand-cat": sandCat,
  "fishing-cat": fishingCat,
  ending,
};
