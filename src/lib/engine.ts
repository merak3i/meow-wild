import { CATS } from "./cats";
import { IUCN_META } from "./format";
import { SUMMIT_M } from "./cats";

export interface AltitudeNode {
  /** scroll progress at which this element sits centered in the viewport */
  p: number;
  /** altitude in metres at that point */
  alt: number;
}

/**
 * Read every `[data-mw-alt]` element in the page and build a lookup of
 * (scroll-progress → altitude). Centred elements read their true altitude;
 * the readout interpolates smoothly between them.
 */
export function buildAltitudeTable(root: HTMLElement): AltitudeNode[] {
  const els = Array.from(root.querySelectorAll<HTMLElement>("[data-mw-alt]"));
  const docH = document.documentElement.scrollHeight - window.innerHeight;
  if (docH <= 0) return [];
  const vh = window.innerHeight;
  const scrollY = window.scrollY;
  const nodes: AltitudeNode[] = els.map((el) => {
    const rect = el.getBoundingClientRect();
    const center = rect.top + scrollY + rect.height / 2;
    const p = (center - vh / 2) / docH;
    return { p: Math.min(Math.max(p, 0), 1), alt: parseFloat(el.dataset.mwAlt || "0") };
  });
  nodes.sort((a, b) => a.p - b.p);
  if (nodes.length === 0 || nodes[0].p > 0.001) nodes.unshift({ p: 0, alt: SUMMIT_M });
  if (nodes[nodes.length - 1].p < 0.999) nodes.push({ p: 1, alt: 0 });
  return nodes;
}

export function altitudeAt(progress: number, table: AltitudeNode[]): number {
  if (table.length === 0) return SUMMIT_M * (1 - progress);
  if (progress <= table[0].p) return table[0].alt;
  if (progress >= table[table.length - 1].p) return table[table.length - 1].alt;
  for (let i = 0; i < table.length - 1; i++) {
    const a = table[i];
    const b = table[i + 1];
    if (progress >= a.p && progress <= b.p) {
      const span = b.p - a.p || 1;
      const t = (progress - a.p) / span;
      return a.alt + (b.alt - a.alt) * t;
    }
  }
  return table[table.length - 1].alt;
}

export interface JourneyStats {
  total: number;
  threatened: number;
  highest: number;
  big: number;
  smallest: string;
}

export function deriveStats(): JourneyStats {
  const threatened = CATS.filter((c) => IUCN_META[c.iucn].threatened).length;
  const big = CATS.filter((c) => c.sizeClass === "big").length;
  const smallest = CATS.reduce((min, c) =>
    c.weightKg[0] < min.weightKg[0] ? c : min,
  );
  return {
    total: CATS.length,
    threatened,
    highest: SUMMIT_M,
    big,
    smallest: smallest.name,
  };
}
