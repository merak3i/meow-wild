export type IUCN = "LC" | "NT" | "VU" | "EN" | "CR" | "DD";

export type BiomeId =
  | "snowline"
  | "alpine"
  | "cloud"
  | "montane"
  | "rainforest"
  | "floor";

export type SizeClass = "big" | "medium" | "small" | "tiny";

export interface PhotoCredit {
  author: string;
  license: string;
  licenseUrl?: string;
  /** Wikimedia Commons file page */
  source: string;
}

export interface Cat {
  id: string;
  name: string;
  latin: string;
  /** headline altitude (m) used for ordering and the altitude readout */
  altitudeM: number;
  /** human-readable typical band, e.g. "3,000–5,000 m" */
  altitudeLabel: string;
  /** striking record or note, e.g. "tracked at 5,859 m" */
  altitudeNote?: string;
  /** highest altitude named in the label or note, when one is stated */
  reachM?: number;
  biome: BiomeId;
  iucn: IUCN;
  /** head–body length range in cm (tail excluded) */
  lengthCm: [number, number];
  weightKg: [number, number];
  region: string;
  /** the one vivid, true line */
  fact: string;
  sizeClass: SizeClass;
  /** coat tint, used for the halo behind the photograph */
  tint: string;
  credit: PhotoCredit;
}

export interface Biome {
  id: BiomeId;
  /** chapter name */
  name: string;
  /** one-line atmosphere */
  tagline: string;
  /** altitude band [low, high] in m */
  band: [number, number];
}
