import type { IUCN } from "./types";
import { BIOME_STOPS, type BiomeStop } from "./biomes";

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseColor(input: string): RGBA {
  const s = input.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    const full =
      hex.length === 3
        ? hex
            .split("")
            .map((c) => c + c)
            .join("")
        : hex;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: 1,
    };
  }
  const m = s.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const parts = m[1].split(",").map((p) => parseFloat(p.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}

function toCss({ r, g, b, a }: RGBA): string {
  const rr = Math.round(r);
  const gg = Math.round(g);
  const bb = Math.round(b);
  return a >= 1 ? `rgb(${rr}, ${gg}, ${bb})` : `rgba(${rr}, ${gg}, ${bb}, ${a.toFixed(3)})`;
}

export function mixColor(a: string, b: string, t: number): string {
  const ca = parseColor(a);
  const cb = parseColor(b);
  return toCss({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
    a: ca.a + (cb.a - ca.a) * t,
  });
}

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export interface Atmosphere {
  skyTop: string;
  skyBottom: string;
  fog: string;
  light: string;
  ridge: string;
}

/** Sample the continuous background wash at a given scroll progress (0–1). */
export function sampleAtmosphere(progress: number): Atmosphere {
  const p = clamp(progress, 0, 1);
  const stops = BIOME_STOPS;
  let lo: BiomeStop = stops[0];
  let hi: BiomeStop = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (p >= stops[i].at && p <= stops[i + 1].at) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const span = hi.at - lo.at || 1;
  const t = clamp((p - lo.at) / span, 0, 1);
  return {
    skyTop: mixColor(lo.skyTop, hi.skyTop, t),
    skyBottom: mixColor(lo.skyBottom, hi.skyBottom, t),
    fog: mixColor(lo.fog, hi.fog, t),
    light: mixColor(lo.light, hi.light, t),
    ridge: mixColor(lo.ridge, hi.ridge, t),
  };
}

export function formatMeters(m: number): string {
  return Math.round(m).toLocaleString("en-US");
}

export interface IucnMeta {
  code: IUCN;
  label: string;
  color: string;
  threatened: boolean;
}

export const IUCN_META: Record<IUCN, IucnMeta> = {
  LC: { code: "LC", label: "Least Concern", color: "#6ea66e", threatened: false },
  NT: { code: "NT", label: "Near Threatened", color: "#c9b24a", threatened: true },
  VU: { code: "VU", label: "Vulnerable", color: "#e0a13c", threatened: true },
  EN: { code: "EN", label: "Endangered", color: "#df7338", threatened: true },
  CR: { code: "CR", label: "Critically Endangered", color: "#d24a3c", threatened: true },
  DD: { code: "DD", label: "Data Deficient", color: "#9a9a9a", threatened: false },
};

/** Average head–body length, in cm. */
export function avgLength(lengthCm: [number, number]): number {
  return (lengthCm[0] + lengthCm[1]) / 2;
}

export function formatWeight(weightKg: [number, number]): string {
  const fmt = (n: number) => (n < 10 ? n.toFixed(n % 1 === 0 ? 0 : 1) : Math.round(n).toString());
  return `${fmt(weightKg[0])}–${fmt(weightKg[1])} kg`;
}

export function formatLength(lengthCm: [number, number]): string {
  return `${Math.round(lengthCm[0])}–${Math.round(lengthCm[1])} cm`;
}
