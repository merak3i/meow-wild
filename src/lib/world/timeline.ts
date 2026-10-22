import { clamp, smooth } from "../format";
import { SUMMIT_M } from "../cats";

interface WorldAnchor {
  y: number;
  id: string;
}

interface AltAnchor {
  y: number;
  alt: number;
}

export interface WorldSample {
  a: string;
  b: string;
  /** eased blend, held near each anchor so every cat's world is stable while you read */
  t: number;
  /** raw linear progress between the two anchors */
  raw: number;
}

/** scroll position at which an element's centre sits at the viewport centre */
function centreY(el: HTMLElement, scrollY: number, vh: number, max: number): number {
  const r = el.getBoundingClientRect();
  return clamp(r.top + scrollY + r.height / 2 - vh / 2, 0, max);
}

/**
 * Maps scroll position to the world: which two presets to blend and how far,
 * and the altitude readout. Anchors come from `[data-world]` and `[data-alt]`
 * elements in the page, so layout changes re-time the whole descent.
 */
export class Timeline {
  private world: WorldAnchor[] = [];
  private alt: AltAnchor[] = [];

  measure(root: HTMLElement) {
    const vh = window.innerHeight;
    const scrollY = window.scrollY;
    const max = Math.max(0, document.documentElement.scrollHeight - vh);
    this.world = Array.from(root.querySelectorAll<HTMLElement>("[data-world]"))
      .map((el) => ({ y: centreY(el, scrollY, vh, max), id: el.dataset.world as string }))
      .sort((a, b) => a.y - b.y);
    this.alt = Array.from(root.querySelectorAll<HTMLElement>("[data-alt]"))
      .map((el) => ({ y: centreY(el, scrollY, vh, max), alt: parseFloat(el.dataset.alt || "0") }))
      .sort((a, b) => a.y - b.y);
    if (!this.alt.length || this.alt[0].y > 1) this.alt.unshift({ y: 0, alt: SUMMIT_M });
    if (this.alt[this.alt.length - 1].y < max - 1) this.alt.push({ y: max, alt: 0 });
  }

  get worldAnchors(): readonly WorldAnchor[] {
    return this.world;
  }

  sampleWorld(y: number, out: WorldSample): WorldSample {
    const w = this.world;
    if (!w.length) {
      out.a = out.b = "hero";
      out.t = out.raw = 0;
      return out;
    }
    if (y <= w[0].y) {
      out.a = out.b = w[0].id;
      out.t = out.raw = 0;
      return out;
    }
    for (let i = 0; i < w.length - 1; i++) {
      const A = w[i];
      const B = w[i + 1];
      if (y <= B.y) {
        const raw = (y - A.y) / Math.max(B.y - A.y, 1);
        out.a = A.id;
        out.b = B.id;
        out.raw = raw;
        out.t = smooth(0.16, 0.84, raw);
        return out;
      }
    }
    const last = w[w.length - 1];
    out.a = out.b = last.id;
    out.t = out.raw = 0;
    return out;
  }

  /** Nearest world anchor id to a scroll position (reduced-motion snapping). */
  nearestWorld(y: number): string {
    let best = this.world[0]?.id ?? "hero";
    let d = Infinity;
    for (const a of this.world) {
      const dd = Math.abs(a.y - y);
      if (dd < d) {
        d = dd;
        best = a.id;
      }
    }
    return best;
  }

  sampleAlt(y: number): number {
    const t = this.alt;
    if (!t.length) return SUMMIT_M;
    if (y <= t[0].y) return t[0].alt;
    for (let i = 0; i < t.length - 1; i++) {
      const A = t[i];
      const B = t[i + 1];
      if (y <= B.y) {
        const k = (y - A.y) / Math.max(B.y - A.y, 1);
        return A.alt + (B.alt - A.alt) * k;
      }
    }
    return t[t.length - 1].alt;
  }
}
