import type { IUCN } from "./types";

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** smoothstep that also works with edge0 > edge1 (a falling ramp). */
export function smooth(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function formatMeters(m: number): string {
  return Math.round(m).toLocaleString("en-US");
}

export interface IucnMeta {
  code: IUCN;
  label: string;
  color: string;
  /** IUCN "threatened" categories: VU, EN, CR */
  threatened: boolean;
  /** Near Threatened or worse */
  atRisk: boolean;
}

export const IUCN_META: Record<IUCN, IucnMeta> = {
  LC: { code: "LC", label: "Least Concern", color: "#79b07a", threatened: false, atRisk: false },
  NT: { code: "NT", label: "Near Threatened", color: "#cdb84e", threatened: false, atRisk: true },
  VU: { code: "VU", label: "Vulnerable", color: "#e6a33e", threatened: true, atRisk: true },
  EN: { code: "EN", label: "Endangered", color: "#e57439", threatened: true, atRisk: true },
  CR: { code: "CR", label: "Critically Endangered", color: "#d84a3c", threatened: true, atRisk: true },
  DD: { code: "DD", label: "Data Deficient", color: "#9a9a9a", threatened: false, atRisk: false },
};

/** The categories shown on the scale in each dossier, in order. */
export const IUCN_SCALE: IUCN[] = ["LC", "NT", "VU", "EN", "CR"];

export function formatWeight(weightKg: [number, number]): string {
  const fmt = (n: number) => (n < 10 ? n.toFixed(n % 1 === 0 ? 0 : 1) : Math.round(n).toString());
  return `${fmt(weightKg[0])}–${fmt(weightKg[1])} kg`;
}

export function formatLength(lengthCm: [number, number]): string {
  return `${Math.round(lengthCm[0])}–${Math.round(lengthCm[1])} cm`;
}

/**
 * Air pressure at altitude as a share of sea level (International Standard
 * Atmosphere). At 5,500 m roughly half the air is above you.
 */
export function airShare(altitudeM: number): number {
  const h = clamp(altitudeM, 0, 11000);
  return Math.pow(1 - 2.25577e-5 * h, 5.25588);
}

/* The descent runs one day. These mirror the shader's sun table. */
const TOD_KEYS = [0.0, 0.075, 0.13, 0.2, 0.32, 0.5, 0.66, 0.79, 0.84, 0.88, 0.92, 0.96, 1.0];
const SUN_ELEV = [-9, -3, 3, 11, 26, 55, 36, 9, 4.5, 1.2, -3, -8, -14];
const CLOCK_MIN = [5 * 60 + 5, 5 * 60 + 40, 6 * 60 + 10, 7 * 60 + 5, 9 * 60, 12 * 60 + 20, 14 * 60 + 40, 17 * 60 + 5, 17 * 60 + 40, 18 * 60 + 10, 18 * 60 + 40, 19 * 60 + 15, 20 * 60 + 30];

function piecewise(t: number, ys: number[]): number {
  if (t <= TOD_KEYS[0]) return ys[0];
  for (let i = 0; i < TOD_KEYS.length - 1; i++) {
    if (t <= TOD_KEYS[i + 1]) {
      const k = (t - TOD_KEYS[i]) / (TOD_KEYS[i + 1] - TOD_KEYS[i]);
      return ys[i] + (ys[i + 1] - ys[i]) * k;
    }
  }
  return ys[ys.length - 1];
}

export function sunElevation(tod: number): number {
  return piecewise(tod, SUN_ELEV);
}

/** Clock time of the narrative day, "06:10". */
export function clockAt(tod: number): string {
  const m = Math.round(piecewise(tod, CLOCK_MIN));
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function lightLabel(tod: number): string {
  const se = sunElevation(tod);
  if (se > 45) return "midday";
  if (tod < 0.5) {
    if (se < -6) return "blue hour";
    if (se < 0) return "first light";
    if (se < 6) return "sunrise";
    return "morning";
  }
  if (se > 25) return "afternoon";
  if (se > 6) return "golden hour";
  if (se > -1) return "sunset";
  if (se > -9) return "dusk";
  return "night";
}
