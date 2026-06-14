export type IUCN = "LC" | "NT" | "VU" | "EN" | "CR" | "DD";

export type BiomeId =
  | "snowline"
  | "alpine"
  | "cloud"
  | "montane"
  | "rainforest"
  | "floor";

export type Markings =
  | "rosette"
  | "stripe"
  | "spot"
  | "plain"
  | "dense"
  | "cloud"
  | "tabby";

export type EarStyle = "round" | "pointed" | "tufted";
export type Build = "stocky" | "standard" | "lean";
export type TailStyle = "short" | "medium" | "long" | "fluffy";
export type SizeClass = "big" | "medium" | "small" | "tiny";

export interface CoatSpec {
  /** main fur color */
  base: string;
  /** lighter underside / muzzle */
  belly: string;
  /** darker shading */
  shade: string;
  markings: Markings;
  markColor: string;
  ear: EarStyle;
  build: Build;
  tail: TailStyle;
  /** iris color */
  eye: string;
}

export interface Cat {
  id: string;
  name: string;
  latin: string;
  /** headline altitude (m) used for ordering + the altitude readout */
  altitudeM: number;
  /** human-readable typical band, e.g. "3,000–5,000 m" */
  altitudeLabel: string;
  /** striking record, e.g. "recorded as high as 5,859 m" */
  altitudeNote?: string;
  biome: BiomeId;
  iucn: IUCN;
  /** head–body length range in cm (tail excluded) */
  lengthCm: [number, number];
  weightKg: [number, number];
  region: string;
  /** the one vivid, true line */
  fact: string;
  sizeClass: SizeClass;
  coat: CoatSpec;
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
