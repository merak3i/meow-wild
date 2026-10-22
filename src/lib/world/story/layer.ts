import { Kit } from "./kit";
import { LS, Terrain } from "../terrain";
import { SCENES } from "./scenes";
import { gallery } from "./gallery";

/**
 * The story layer: small lives in each landscape. Prey and companions for each
 * cat, and, somewhere far off, the people who watch them without coming close.
 *
 * Each world has a scene function that draws figures with the kit, standing on
 * the shader's own ridgelines (via Terrain) and sliding with their card's
 * parallax. Scenes fade with their world's share of the blend, and may tell
 * their cat where to look.
 */

export interface StoryInput {
  time: number;
  W: number;
  H: number;
  params: Float32Array;
  alt: number;
  drift: number;
  a: string;
  b: string;
  t: number;
  anchors: readonly { y: number; id: string }[];
  /** cat photo boxes on screen, CSS px, by world id */
  cats: Map<string, [number, number, number, number]>;
  /** the text block beside each cat, CSS px, by world id */
  texts: Map<string, [number, number, number, number]>;
  reduced: boolean;
  sun: [number, number, number];
  /** a cat is calling right now (its world id), so its prey can react */
  calling: string | null;
  /** lines: draw every card's computed ridgeline (?story=lines) · sheet: every figure on a grid (?story=sheet) */
  debug?: "lines" | "sheet" | null;
}

export interface Reaction {
  /** where the cat should look, CSS px */
  focus: [number, number] | null;
  /** 0..1: how hard it attends (ears up, tail tip twitching, breath held) */
  alert: number;
}

export interface SceneCtx {
  k: Kit;
  T: Terrain;
  W: number;
  H: number;
  /** clock in seconds (frozen under reduced motion) */
  t: number;
  reduced: boolean;
  /** -1: the cat stands on the left of the screen, 1: on the right */
  side: number;
  cat: [number, number, number, number] | null;
  /** the text block, CSS px */
  text: [number, number, number, number] | null;
  /**
   * x (CSS px) in the open strip between the cat and its text, u from 0 (cat
   * side) to 1 (text side); where there is no such strip, beyond the cat's
   * outer edge instead. Far-off people stand here so nothing covers them.
   */
  gap(u: number): number;
  /** just under the text block (CSS px from the top): the open foreground on the text's side */
  below: number;
  /** the top of the open band along the bottom of the screen, under both the cat and its text */
  floor: number;
  /** sunlight colour on the figures (for lit, not silhouetted, animals) */
  sun: [number, number, number];
  wind: number;
  /** this cat is calling right now */
  calling: boolean;
  /** screen x (CSS px) of a point fixed on `card`, authored at xf (0..1 of the width, mirrored to the open side) */
  x(card: number, xf: number): number;
  /** crest of `card` at screen x, CSS px from the top */
  crest(card: number, x: number): number;
  /** horizon, CSS px from the top */
  horizon: number;
  /** water line seen at the distance of `card`, CSS px, or null */
  water(card: number): number | null;
  /** a person's height in px standing on `card` */
  unit(card: number): number;
  /** is the point (x, y) clear of every nearer ridge than `card`? */
  clear(card: number, x: number, y: number): boolean;
  react(focus: [number, number] | null, alert: number): void;
}

export type Scene = (c: SceneCtx) => void;

/**
 * A run of primitives drawn at one opacity: [first, count, opacity]. Each world's
 * scene is one group, so a figure fading out with its world fades as a whole,
 * without its overlapping parts darkening each other (see the renderer).
 */
export type StoryGroup = [number, number, number];

export class StoryLayer {
  readonly kit = new Kit();
  readonly terrain = new Terrain();
  readonly reactions = new Map<string, Reaction>();
  private anchorY = new Map<string, number>();
  private groups: StoryGroup[] = [];

  update(inp: StoryInput) {
    const k = this.kit;
    k.reset();
    this.reactions.clear();
    const groups = this.groups;
    groups.length = 0;
    if (inp.debug === "sheet") {
      gallery(k, inp.W, inp.H, inp.time);
      groups.push([0, k.count, 1]);
      return { data: k.data, count: k.count, mask: null, groups };
    }
    for (const a of inp.anchors) this.anchorY.set(a.id, a.y);
    const T = this.terrain;
    T.set(inp.params, inp.alt, inp.drift);
    const { W, H } = inp;
    const worlds: [string, number][] = inp.a === inp.b ? [[inp.a, 1]] : [
      [inp.a, 1 - inp.t],
      [inp.b, inp.t],
    ];
    for (const [id, w] of worlds) {
      if (w < 0.02) continue;
      const scene = SCENES[id];
      if (!scene) continue;
      const anchor = this.anchorY.get(id) ?? 0;
      const dd = inp.reduced ? 0 : inp.drift - anchor * 0.12;
      const cat = inp.cats.get(id) ?? null;
      const text = inp.texts.get(id) ?? null;
      const side = cat ? (cat[0] + cat[2] / 2 < W / 2 ? -1 : 1) : -1;
      const gap = (u: number) => {
        if (cat && text) {
          // side by side: the strip between the photo's inner edge and the text
          const inner = side < 0 ? cat[0] + cat[2] * 0.9 : cat[0] + cat[2] * 0.1;
          const tEdge = side < 0 ? text[0] : text[0] + text[2];
          const a = Math.min(inner, tEdge);
          const b = Math.max(inner, tEdge);
          if (b - a > 70 && text[1] < H * 0.6) return side < 0 ? a + (b - a) * u : b - (b - a) * u;
          // stacked (phones): beside the text block is all open
        }
        if (cat) {
          // beyond the cat's outer edge
          const outer = side < 0 ? cat[0] + cat[2] * 0.12 : cat[0] + cat[2] * 0.88;
          return side < 0 ? outer * (1 - u * 0.8) : outer + (W - outer) * u * 0.8;
        }
        return W * (0.5 + side * 0.2);
      };
      const ctx: SceneCtx = {
        k,
        T,
        W,
        H,
        t: inp.reduced ? 12 : inp.time,
        reduced: inp.reduced,
        side,
        cat,
        text,
        gap,
        below: text && text[1] < H * 0.6 ? Math.min(H * 0.93, text[1] + text[3] + 8) : H * 0.8,
        floor: Math.min(
          H * 0.88,
          Math.max(text && text[1] < H * 0.6 ? text[1] + text[3] : 0, cat ? cat[1] + cat[3] * 0.96 : H * 0.75) + 6,
        ),
        sun: inp.sun,
        wind: inp.params[3],
        calling: inp.calling === id,
        horizon: (1 - T.yh) * H,
        x: (card, xf) => (side < 0 ? xf : 1 - xf) * W - dd * LS[card] * H,
        crest: (card, x) => (1 - T.crest(card, (x - W / 2) / H)) * H,
        water: (card) => {
          const y = T.water(card);
          return y === null ? null : (1 - y) * H;
        },
        unit: (card) => Math.max(6, H * LS[card] * 30),
        clear: (card, x, y) => (1 - T.nearer(card, (x - W / 2) / H)) * H > y,
        react: (focus, alert) => {
          const prev = this.reactions.get(id);
          if (!prev || alert >= prev.alert) this.reactions.set(id, { focus, alert: alert * w });
        },
      };
      const first = k.count;
      scene(ctx);
      if (k.count > first) groups.push([first, k.count - first, w]);
    }
    // the text of whichever world dominates: figures fade beneath it
    const main = inp.t < 0.5 ? inp.a : inp.b;
    const mask = inp.texts.get(main) ?? null;
    if (inp.debug === "lines") {
      const first = k.count;
      const cols: [number, number, number][] = [
        [1, 0, 0],
        [1, 0.5, 0],
        [1, 1, 0],
        [0, 1, 0],
        [0, 1, 1],
        [0.3, 0.4, 1],
        [1, 0, 1],
      ];
      for (let i = 0; i < 7; i++) {
        let px = -1;
        let py = 0;
        for (let x = 0; x <= W; x += 10) {
          const y = (1 - T.crest(i, (x - W / 2) / H)) * H;
          if (px >= 0) {
            k.at(0, 0, 1).ground(-1, 1, 1);
            k.st.mode = 2;
            k.st.rgb = cols[i];
            k.cap(px, -py, x, -y, 0.7);
          }
          px = x;
          py = y;
        }
      }
      groups.push([first, k.count - first, 1]);
    }
    return { data: k.data, count: k.count, mask, groups };
  }
}
