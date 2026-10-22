import type { Biome, BiomeId } from "./types";

/** Altitude bands, top of the world to the valley floor. */
export const BIOMES: Biome[] = [
  {
    id: "snowline",
    name: "The Frozen Roof",
    tagline: "Thin air, hard light. Almost nothing lives this high. Almost.",
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
    tagline: "Near sea level, where most cats actually live.",
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
