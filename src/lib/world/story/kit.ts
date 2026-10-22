import { STORY_FLOATS } from "../renderer";

/**
 * A tiny vector puppet kit for the story layer.
 *
 * Figures are drawn in local units with the origin at their feet and y up; one
 * unit is `s` CSS pixels and `fx` mirrors them. Each call appends one signed
 * distance primitive to an instance buffer that the renderer draws in a single
 * instanced pass (see STORY_FS).
 */

export const PRIM = { ellipse: 0, capsule: 1, tri: 2, glow: 3, ring: 4, beam: 5 } as const;
/** ground: take the colour of the ground under the feet · behind: darken what is behind · light: a fixed colour */
export const MODE = { ground: 0, behind: 1, light: 2 } as const;

export interface Style {
  mode: number;
  /** multiplier on the sampled colour (ground/behind), intensity for light */
  shade: number;
  alpha: number;
  /** point the ground colour is read from, CSS px */
  footX: number;
  footY: number;
  /** card the figure stands on, for occlusion by nearer ridges (-1: never hidden) */
  card: number;
  /** 0..1 blend toward `rgb` lit by the ground's brightness */
  tint: number;
  rgb: [number, number, number];
}

export class Kit {
  data = new Float32Array(STORY_FLOATS * 1024);
  count = 0;
  ox = 0;
  oy = 0;
  s = 1;
  fx = 1;
  /** -1 draws the figure upside down about its feet: a reflection in still water */
  my = 1;
  st: Style = { mode: 0, shade: 0.8, alpha: 1, footX: 0, footY: 0, card: -1, tint: 0, rgb: [1, 1, 1] };

  reset() {
    this.count = 0;
  }

  /** place a figure: feet at (x, y) CSS px, `s` px per unit, mirrored when flip, upside down when reflected */
  at(x: number, y: number, s: number, flip = false, reflected = false) {
    this.ox = x;
    this.oy = y;
    this.s = Math.abs(s);
    this.fx = flip ? -1 : 1;
    this.my = reflected ? -1 : 1;
    return this;
  }

  /** ground-coloured figure standing on `card`, its colour read just under (x, y) */
  ground(card: number, shade = 0.78, alpha = 1, footX = this.ox, footY = this.oy) {
    const st = this.st;
    st.mode = MODE.ground;
    st.shade = shade;
    st.alpha = alpha;
    st.footX = footX;
    st.footY = footY;
    st.card = card;
    st.tint = 0;
    return this;
  }

  /** a silhouette darkening whatever is behind it (birds against the sky) */
  behind(shade = 0.35, alpha = 1, card = -1) {
    const st = this.st;
    st.mode = MODE.behind;
    st.shade = shade;
    st.alpha = alpha;
    st.card = card;
    st.tint = 0;
    return this;
  }

  /** keep the current mode but pull the colour toward rgb (a pink flamingo, a white tent) */
  tint(amount: number, r: number, g: number, b: number) {
    this.st.tint = amount;
    this.st.rgb = [r, g, b];
    return this;
  }

  untint() {
    this.st.tint = 0;
    return this;
  }

  private X(x: number) {
    return this.ox + this.fx * x * this.s;
  }

  private Y(y: number) {
    return this.oy - this.my * y * this.s;
  }

  private push(a0: number, a1: number, a2: number, a3: number, b0: number, b1: number, b2: number, b3: number, type: number, mode: number, shade: number, alpha: number, extra: number, rgb: [number, number, number]) {
    if (alpha <= 0.002) return;
    if ((this.count + 1) * STORY_FLOATS > this.data.length) {
      const next = new Float32Array(this.data.length * 2);
      next.set(this.data);
      this.data = next;
    }
    const d = this.data;
    const o = this.count * STORY_FLOATS;
    const st = this.st;
    d[o] = a0;
    d[o + 1] = a1;
    d[o + 2] = a2;
    d[o + 3] = a3;
    d[o + 4] = b0;
    d[o + 5] = b1;
    d[o + 6] = b2;
    d[o + 7] = b3;
    d[o + 8] = type;
    d[o + 9] = mode;
    d[o + 10] = shade;
    d[o + 11] = alpha;
    d[o + 12] = st.footX;
    d[o + 13] = st.footY;
    d[o + 14] = st.card;
    d[o + 15] = st.tint;
    d[o + 16] = rgb[0];
    d[o + 17] = rgb[1];
    d[o + 18] = rgb[2];
    d[o + 19] = extra;
    this.count++;
  }

  ellipse(x: number, y: number, rx: number, ry: number, ang = 0) {
    const st = this.st;
    this.push(this.X(x), this.Y(y), Math.abs(rx * this.s), Math.abs(ry * this.s), -this.fx * this.my * ang, 0, 0, 0, PRIM.ellipse, st.mode, st.shade, st.alpha, 0, st.rgb);
    return this;
  }

  /** a capsule from (x0, y0) to (x1, y1), radius r0 tapering to r1 */
  cap(x0: number, y0: number, x1: number, y1: number, r0: number, r1 = r0) {
    const st = this.st;
    const m = 0.35 / Math.max(this.s, 0.01);
    this.push(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), Math.max(r0, m) * this.s, Math.max(r1, m) * this.s, 0, 0, PRIM.capsule, st.mode, st.shade, st.alpha, 0, st.rgb);
    return this;
  }

  tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, round = 0) {
    const st = this.st;
    this.push(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), this.X(x2), this.Y(y2), 0, 0, PRIM.tri, st.mode, st.shade, st.alpha, round * this.s, st.rgb);
    return this;
  }

  /** a rectangle from two triangles */
  rect(x0: number, y0: number, x1: number, y1: number) {
    this.tri(x0, y0, x1, y0, x1, y1);
    this.tri(x0, y0, x1, y1, x0, y1);
    return this;
  }

  /** an additive light: radius and core in px */
  glow(x: number, y: number, radius: number, core: number, intensity: number, rgb: [number, number, number], alpha = this.st.alpha) {
    this.push(this.X(x), this.Y(y), radius, core, 0, 0, 0, 0, PRIM.glow, MODE.light, intensity, alpha, 0, rgb);
    return this;
  }

  /** a solid light-coloured shape: a lit window, a lamp */
  lightRect(x0: number, y0: number, x1: number, y1: number, rgb: [number, number, number], intensity = 1) {
    const st = this.st;
    const keep = [st.mode, st.shade] as const;
    st.mode = MODE.light;
    st.shade = intensity;
    const old = st.rgb;
    st.rgb = rgb;
    this.rect(x0, y0, x1, y1);
    st.rgb = old;
    st.mode = keep[0];
    st.shade = keep[1];
    return this;
  }

  /** a ring in px, squashed vertically (water seen at a glance) */
  ring(x: number, y: number, r: number, thick: number, squash = 1) {
    const st = this.st;
    this.push(this.X(x), this.Y(y), r, thick, squash, 0, 0, 0, PRIM.ring, st.mode, st.shade, st.alpha, 0, st.rgb);
    return this;
  }

  /** a soft additive cone of light from (x0, y0) to (x1, y1); radii in px */
  beam(x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, intensity: number, rgb: [number, number, number]) {
    this.push(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), r0, r1, 0, 0, PRIM.beam, MODE.light, intensity, this.st.alpha, 0, rgb);
    return this;
  }
}
