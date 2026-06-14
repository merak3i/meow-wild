import type { Biome, BiomeId } from "./types";

/** Altitude bands, top of the world to the valley floor. */
export const BIOMES: Biome[] = [
  {
    id: "snowline",
    name: "The Frozen Roof",
    tagline: "Thin air, hard light. Almost nothing lives this high — almost.",
    band: [3800, 5500],
  },
  {
    id: "alpine",
    name: "The High Country",
    tagline: "Below the snow line: bare rock, low scrub, long cold shadows.",
    band: [2400, 3800],
  },
  {
    id: "cloud",
    name: "The Cloud Forest",
    tagline: "Where the mountain breathes mist and the first trees take hold.",
    band: [1400, 2400],
  },
  {
    id: "montane",
    name: "The Mountain Forest",
    tagline: "Dense, green, dripping. The canopy closes overhead.",
    band: [700, 1400],
  },
  {
    id: "rainforest",
    name: "The Deep Forest",
    tagline: "Warm and loud and crowded with life.",
    band: [200, 700],
  },
  {
    id: "floor",
    name: "The Warm Lowlands",
    tagline: "Near sea level — where most cats actually live.",
    band: [0, 200],
  },
];

export const BIOME_BY_ID: Record<BiomeId, Biome> = Object.fromEntries(
  BIOMES.map((b) => [b.id, b]),
) as Record<BiomeId, Biome>;

/** Pick the biome whose band contains the given altitude. */
export function biomeForAltitude(altitudeM: number): Biome {
  for (const b of BIOMES) {
    if (altitudeM >= b.band[0] && altitudeM < b.band[1]) return b;
  }
  return altitudeM >= 3800 ? BIOMES[0] : BIOMES[BIOMES.length - 1];
}

export function biomeIndexForAltitude(altitudeM: number): number {
  const b = biomeForAltitude(altitudeM);
  return BIOMES.findIndex((x) => x.id === b.id);
}

export interface BiomeStop {
  /** scroll progress, 0 (top) → 1 (bottom) */
  at: number;
  skyTop: string;
  skyBottom: string;
  /** atmospheric haze color (rgba) */
  fog: string;
  /** warm/cool accent light */
  light: string;
  /** parallax ridge / foliage silhouette color */
  ridge: string;
}

/**
 * Color anchors for the continuous background wash. The renderer interpolates
 * between adjacent stops by scroll progress, so the world shifts smoothly:
 * icy white → sage → misty teal → forest green → deep emerald → golden dusk.
 */
export const BIOME_STOPS: BiomeStop[] = [
  {
    at: 0.0,
    skyTop: "#e9f1f6",
    skyBottom: "#c2d6e3",
    fog: "rgba(244,250,255,0.55)",
    light: "#cfe0ee",
    ridge: "#aebfce",
  },
  {
    at: 0.16,
    skyTop: "#d4dcd5",
    skyBottom: "#9fb1a3",
    fog: "rgba(228,236,232,0.42)",
    light: "#bccabb",
    ridge: "#8b9d8c",
  },
  {
    at: 0.34,
    skyTop: "#b7ccc5",
    skyBottom: "#82a298",
    fog: "rgba(222,234,230,0.6)",
    light: "#a7c0b4",
    ridge: "#6f9184",
  },
  {
    at: 0.52,
    skyTop: "#7fa06d",
    skyBottom: "#43734a",
    fog: "rgba(180,205,165,0.2)",
    light: "#9cc06f",
    ridge: "#356040",
  },
  {
    at: 0.72,
    skyTop: "#356048",
    skyBottom: "#143726",
    fog: "rgba(140,190,130,0.14)",
    light: "#e9c66a",
    ridge: "#0e2a1c",
  },
  {
    at: 0.88,
    skyTop: "#5d6e3a",
    skyBottom: "#9c7d3f",
    fog: "rgba(230,200,140,0.2)",
    light: "#f0cf78",
    ridge: "#5a4a2a",
  },
  {
    at: 1.0,
    skyTop: "#c89a4e",
    skyBottom: "#6f5230",
    fog: "rgba(240,210,150,0.26)",
    light: "#ffe19a",
    ridge: "#4a3720",
  },
];
