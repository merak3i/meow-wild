/**
 * World presets: one art-directed "world" per stop on the descent.
 *
 * The renderer draws a single procedural landscape and morphs these parameters
 * as you scroll, so each cat gets its own habitat while the descent stays one
 * continuous shot. Elevations are absolute metres; the cloud deck is fixed in
 * world space (1,750 to 2,500 m), so you look down on it from the roof of the
 * world, walk through it in the cloud forest and see its underside below.
 *
 * Time of day (`tod`) runs one day over the descent: blue hour at the summit,
 * first light on the snow leopard, golden hour on the jaguar, night at home.
 */

export interface WorldParams {
  /** 0 pre-dawn → 1 night */
  tod: number;
  /** aerial perspective / humidity, 0 crisp → 1 thick */
  haze: number;
  /** horizon height on screen (0 bottom, 1 top): high = looking down */
  pitch: number;
  wind: number;

  /**
   * Composition, in screen units (fractions of the viewport height):
   * base offset of each card from the horizon and its relief amplitude, for
   * the far range (card 0), the mid ranges (card 3) and the near ground
   * (card 6). Cards in between interpolate. Elevations in metres are derived
   * from these and the camera altitude, so snowline, treeline and the cloud
   * deck stay physical.
   */
  farO: number;
  farA: number;
  midO: number;
  midA: number;
  nearO: number;
  nearA: number;
  /** ridged-ness of far/mid ranges and of near ground, 0 rolling → 1 jagged */
  jagF: number;
  jagN: number;

  snowline: number;
  treeline: number;
  treeD: number;
  /** 0 lush → 1 arid */
  dry: number;

  conifer: number;
  broad: number;
  acacia: number;
  /** tall thin emergent trees (silver oak, sal, rainforest giants) */
  tall: number;

  water: number;
  /** water plane height, as a screen offset measured on the nearest card */
  waterO: number;
  sand: number;
  salt: number;

  /** coverage of the fixed cloud deck */
  cloud: number;
  snow: number;
  rain: number;
  mist: number;

  firefly: number;
  dust: number;
  canopy: number;
  window: number;

  rocks: number;
  reeds: number;
  tea: number;
  mesa: number;

  tower: number;
  rays: number;
  lights: number;
  grass: number;

  dune: number;
  trunks: number;
  stars: number;
  moon: number;
}

export const PARAM_KEYS: (keyof WorldParams)[] = [
  "tod", "haze", "pitch", "wind",
  "farO", "farA", "midO", "midA",
  "nearO", "nearA", "jagF", "jagN",
  "snowline", "treeline", "treeD", "dry",
  "conifer", "broad", "acacia", "tall",
  "water", "waterO", "sand", "salt",
  "cloud", "snow", "rain", "mist",
  "firefly", "dust", "canopy", "window",
  "rocks", "reeds", "tea", "mesa",
  "tower", "rays", "lights", "grass",
  "dune", "trunks", "stars", "moon",
];

export const PARAM_COUNT = PARAM_KEYS.length; // 44 → vec4[11]

/** World cloud deck, fixed in world space (metres). */
export const CLOUD_BASE = 1920;
export const CLOUD_TOP = 2480;

const NO_WATER = -9;

const BASE: WorldParams = {
  tod: 0.5, haze: 0.3, pitch: 0.5, wind: 0.3,
  farO: 0.08, farA: 0.06, midO: 0.0, midA: 0.06,
  nearO: -0.2, nearA: 0.03, jagF: 0.5, jagN: 0.2,
  snowline: 4800, treeline: 3800, treeD: 0, dry: 0.3,
  conifer: 0, broad: 0, acacia: 0, tall: 0,
  water: 0, waterO: NO_WATER, sand: 0, salt: 0,
  cloud: 0.4, snow: 0, rain: 0, mist: 0,
  firefly: 0, dust: 0, canopy: 0, window: 0,
  rocks: 0, reeds: 0, tea: 0, mesa: 0,
  tower: 0, rays: 0, lights: 0, grass: 0,
  dune: 0, trunks: 0, stars: 0, moon: 0,
};

const P = (p: Partial<WorldParams>): WorldParams => ({ ...BASE, ...p });

/** Station altitude of each preset (metres), used for the camera altitude. */
export const PRESET_ALT: Record<string, number> = {
  hero: 5500, "hero-dawn": 5450, "snow-leopard": 5000, "andean-mountain-cat": 4500, "pallass-cat": 4100,
  puma: 3500, "eurasian-lynx": 3000, caracal: 2780, "clouded-leopard": 2300, "asian-golden-cat": 2000,
  leopard: 1560, serval: 1600, tiger: 1300, ocelot: 1100, "black-footed-cat": 1000, margay: 900,
  jaguar: 650, "rusty-spotted-cat": 500, "sand-cat": 180, "fishing-cat": 150, ending: 0,
};

export const PRESETS: Record<string, WorldParams> = {
  // 5,500 m, blue hour before dawn: peaks piercing a sea of cloud far below
  hero: P({
    tod: 0.0, haze: 0.1, pitch: 0.6, wind: 0.5,
    farO: 0.15, farA: 0.07, midO: -1.86, midA: 0.22, nearO: -0.66, nearA: 0.05, jagF: 1, jagN: 0.6,
    snowline: 2550, treeline: 2400, dry: 0.2,
    cloud: 0.98, snow: 0.18, rocks: 0, stars: 1, moon: 0.6,
  }),
  "hero-dawn": P({
    tod: 0.075, haze: 0.1, pitch: 0.59, wind: 0.55,
    farO: 0.15, farA: 0.07, midO: -1.82, midA: 0.23, nearO: -0.62, nearA: 0.05, jagF: 1, jagN: 0.6,
    snowline: 2550, treeline: 2400, dry: 0.2,
    cloud: 0.98, snow: 0.22, rocks: 0, stars: 0.5, moon: 0.4,
  }),
  // 5,000 m, first light: alpenglow on the summits, spindrift
  "snow-leopard": P({
    tod: 0.13, haze: 0.12, pitch: 0.57, wind: 0.75,
    farO: 0.16, farA: 0.075, midO: -1.45, midA: 0.36, nearO: -0.5, nearA: 0.06, jagF: 1, jagN: 0.45,
    snowline: 2700, treeline: 2500, dry: 0.2,
    cloud: 0.95, snow: 0.55, rocks: 0.25,
  }),
  // 4,500 m, altiplano salt flat under volcanic cones, hard blue sky
  "andean-mountain-cat": P({
    tod: 0.2, haze: 0.07, pitch: 0.5, wind: 0.4,
    farO: 0.06, farA: 0.05, midO: -0.015, midA: 0.012, nearO: -0.03, nearA: 0.003, jagF: 0.32, jagN: 0.1,
    snowline: 5300, treeline: 3300, dry: 0.85,
    salt: 1, cloud: 0.35, dust: 0.12, rocks: 0.05,
  }),
  // 4,100 m, cold bare steppe, boulders, snow on the far range
  "pallass-cat": P({
    tod: 0.26, haze: 0.12, pitch: 0.5, wind: 0.5,
    farO: 0.1, farA: 0.06, midO: 0.0, midA: 0.09, nearO: -0.22, nearA: 0.04, jagF: 0.25, jagN: 0.15,
    snowline: 5000, treeline: 3300, dry: 0.62,
    cloud: 0.7, rocks: 0.7, grass: 0.35,
  }),
  // 3,500 m, Patagonian granite spires over a glacial lake, hard wind
  puma: P({
    tod: 0.32, haze: 0.16, pitch: 0.53, wind: 0.85,
    farO: 0.19, farA: 0.14, midO: -0.14, midA: 0.06, nearO: -0.42, nearA: 0.03, jagF: 1, jagN: 0.25,
    snowline: 4650, treeline: 1200, dry: 0.5,
    water: 0.9, waterO: -0.69, cloud: 0.3, grass: 0.55, rocks: 0.2,
  }),
  // 3,000 m, taiga and a stone run, the cloud sea filling the valleys
  "eurasian-lynx": P({
    tod: 0.38, haze: 0.22, pitch: 0.52, wind: 0.35,
    farO: 0.13, farA: 0.08, midO: -0.12, midA: 0.12, nearO: -0.3, nearA: 0.05, jagF: 0.9, jagN: 0.35,
    snowline: 4000, treeline: 3600, treeD: 0.75, dry: 0.25,
    conifer: 1, cloud: 0.8, rocks: 0.9,
  }),
  // 2,600 m, dry upland with acacias, cloud tops right below your feet
  caracal: P({
    tod: 0.44, haze: 0.28, pitch: 0.5, wind: 0.3,
    farO: 0.07, farA: 0.05, midO: -0.12, midA: 0.06, nearO: -0.19, nearA: 0.03, jagF: 0.5, jagN: 0.2,
    snowline: 5200, treeline: 3200, treeD: 0.28, dry: 0.75,
    acacia: 1, cloud: 0.35, grass: 0.6, dust: 0.15,
  }),
  // 2,300 m, inside the cloud: misty forest silhouettes, drip
  "clouded-leopard": P({
    tod: 0.5, haze: 0.85, pitch: 0.5, wind: 0.25,
    farO: 0.12, farA: 0.06, midO: 0.05, midA: 0.1, nearO: -0.25, nearA: 0.04, jagF: 0.3, jagN: 0.2,
    snowline: 5200, treeline: 3600, treeD: 0.9, dry: 0.08,
    broad: 1, tall: 0.25, cloud: 1, mist: 0.9, rain: 0.25,
  }),
  // 2,000 m, montane forest, still in cloud
  "asian-golden-cat": P({
    tod: 0.54, haze: 0.75, pitch: 0.5, wind: 0.25,
    farO: 0.12, farA: 0.07, midO: 0.04, midA: 0.11, nearO: -0.24, nearA: 0.045, jagF: 0.45, jagN: 0.25,
    snowline: 5200, treeline: 3600, treeD: 0.85, dry: 0.1,
    broad: 0.7, conifer: 0.3, cloud: 1, mist: 0.7, rain: 0.12,
  }),
  // 1,800 m, just under the cloud base: sun breaking through over savanna hills
  leopard: P({
    tod: 0.58, haze: 0.42, pitch: 0.47, wind: 0.3,
    farO: 0.08, farA: 0.07, midO: 0.0, midA: 0.06, nearO: -0.22, nearA: 0.03, jagF: 0.4, jagN: 0.2,
    snowline: 5200, treeline: 3600, treeD: 0.33, dry: 0.5,
    acacia: 0.6, broad: 0.4, cloud: 0.85, grass: 0.5, rays: 0.4,
  }),
  // 1,600 m, highland wetland: pools, reeds, a broken cloud ceiling
  serval: P({
    tod: 0.62, haze: 0.38, pitch: 0.45, wind: 0.35,
    farO: 0.06, farA: 0.06, midO: -0.01, midA: 0.025, nearO: -0.06, nearA: 0.008, jagF: 0.35, jagN: 0.1,
    snowline: 5200, treeline: 3600, treeD: 0.2, dry: 0.3,
    broad: 0.6, water: 0.75, waterO: -0.062, reeds: 0.9, grass: 0.7, cloud: 0.65,
  }),
  // 1,300 m, sal forest: tall trunks, dust in the sunbeams
  tiger: P({
    tod: 0.66, haze: 0.5, pitch: 0.42, wind: 0.2,
    farO: 0.07, farA: 0.07, midO: 0.02, midA: 0.05, nearO: -0.15, nearA: 0.02, jagF: 0.35, jagN: 0.15,
    snowline: 5200, treeline: 3600, treeD: 0.9, dry: 0.58,
    broad: 0.6, tall: 0.6, trunks: 1, canopy: 0.22, rays: 0.85, dust: 0.5, cloud: 0.5,
  }),
  // 1,100 m, karst towers rising out of jungle
  ocelot: P({
    tod: 0.69, haze: 0.55, pitch: 0.44, wind: 0.2,
    farO: 0.1, farA: 0.16, midO: 0.0, midA: 0.1, nearO: -0.2, nearA: 0.03, jagF: 0.6, jagN: 0.2,
    snowline: 5200, treeline: 3600, treeD: 1, dry: 0.1,
    broad: 1, tower: 1, canopy: 0.3, mist: 0.35, cloud: 0.45,
  }),
  // 1,000 m, Karoo: flat red plain, flat-topped koppies, dry tufts
  "black-footed-cat": P({
    tod: 0.72, haze: 0.2, pitch: 0.47, wind: 0.35,
    farO: 0.075, farA: 0.06, midO: 0.012, midA: 0.025, nearO: -0.045, nearA: 0.004, jagF: 0.3, jagN: 0.1,
    snowline: 5200, treeline: 3600, treeD: 0.12, dry: 1,
    acacia: 0.35, sand: 0.45, mesa: 1, grass: 0.45, dust: 0.35, cloud: 0.15,
  }),
  // 900 m, under the rainforest canopy, looking up
  margay: P({
    tod: 0.75, haze: 0.6, pitch: 0.3, wind: 0.15,
    farO: 0.08, farA: 0.06, midO: 0.05, midA: 0.05, nearO: -0.08, nearA: 0.02, jagF: 0.3, jagN: 0.15,
    snowline: 5200, treeline: 3600, treeD: 1, dry: 0.05,
    broad: 1, tall: 0.8, canopy: 1, trunks: 0.55, rays: 0.7, mist: 0.3, cloud: 0.4,
  }),
  // 650 m, Pantanal river at golden hour
  jaguar: P({
    tod: 0.79, haze: 0.5, pitch: 0.46, wind: 0.2,
    farO: 0.03, farA: 0.025, midO: 0.01, midA: 0.01, nearO: -0.05, nearA: 0.006, jagF: 0.2, jagN: 0.1,
    snowline: 5200, treeline: 3600, treeD: 0.9, dry: 0.15,
    broad: 1, tall: 0.4, water: 1, waterO: -0.045, reeds: 0.45, dust: 0.4, cloud: 0.35,
  }),
  // 500 m, misty hill country, tea rows and silver oaks
  "rusty-spotted-cat": P({
    tod: 0.83, haze: 0.6, pitch: 0.47, wind: 0.2,
    farO: 0.09, farA: 0.07, midO: 0.02, midA: 0.06, nearO: -0.18, nearA: 0.035, jagF: 0.25, jagN: 0.1,
    snowline: 5200, treeline: 3600, treeD: 0.3, dry: 0.1,
    tall: 1, tea: 1, mist: 0.45, firefly: 0.15, cloud: 0.4,
  }),
  // 180 m, Saharan dunes at sunset, sand on the wind
  "sand-cat": P({
    tod: 0.88, haze: 0.28, pitch: 0.46, wind: 0.6,
    farO: 0.02, farA: 0.03, midO: -0.01, midA: 0.05, nearO: -0.18, nearA: 0.07, jagF: 0.2, jagN: 0.1,
    snowline: 5200, treeline: 3600, dry: 1,
    dune: 1, sand: 1, dust: 0.6, cloud: 0, moon: 0.4,
  }),
  // 150 m, wetland at blue hour: reflections, fireflies, first stars
  "fishing-cat": P({
    tod: 0.94, haze: 0.5, pitch: 0.47, wind: 0.15,
    farO: 0.02, farA: 0.02, midO: 0.0, midA: 0.01, nearO: -0.05, nearA: 0.005, jagF: 0.2, jagN: 0.1,
    snowline: 5200, treeline: 3600, treeD: 0.4, dry: 0.1,
    broad: 0.5, water: 1, waterO: -0.052, reeds: 0.9, firefly: 0.9, cloud: 0.2, lights: 0.3, stars: 0.6, moon: 0.8,
  }),
  // 0 m, night, home: the whole descent seen through a window
  ending: P({
    tod: 1.0, haze: 0.35, pitch: 0.47, wind: 0.15,
    farO: 0.03, farA: 0.03, midO: 0.005, midA: 0.02, nearO: -0.06, nearA: 0.008, jagF: 0.2, jagN: 0.1,
    snowline: 5200, treeline: 3600, treeD: 0.5, dry: 0.15,
    broad: 0.6, window: 1, lights: 1, firefly: 0.25, cloud: 0.15, stars: 1, moon: 1,
  }),
};

/** Text ink for each stop: light text on dark worlds, dark text on bright ones. */
export const INK: Record<string, "light" | "dark"> = {
  hero: "light",
  "hero-dawn": "light",
  "snow-leopard": "light",
  "andean-mountain-cat": "dark",
  "pallass-cat": "dark",
  puma: "dark",
  "eurasian-lynx": "light",
  caracal: "dark",
  "clouded-leopard": "dark",
  "asian-golden-cat": "dark",
  leopard: "light",
  serval: "light",
  tiger: "light",
  ocelot: "light",
  "black-footed-cat": "dark",
  margay: "light",
  jaguar: "light",
  "rusty-spotted-cat": "light",
  "sand-cat": "light",
  "fishing-cat": "light",
  ending: "light",
};

/** Particle source style for the materialisation of each cat. */
export type ParticleMode = 0 | 1 | 2 | 3 | 4 | 5;
// 0 snow (falls from above) · 1 wind (streams from the side) · 2 mist (drifts in from both sides)
// 3 pollen (rises) · 4 firefly (orbits in) · 5 sand (blows in from the right)
export const PARTICLE_MODE: Record<string, ParticleMode> = {
  "snow-leopard": 0,
  "andean-mountain-cat": 1,
  "pallass-cat": 0,
  puma: 1,
  "eurasian-lynx": 0,
  caracal: 5,
  "clouded-leopard": 2,
  "asian-golden-cat": 2,
  leopard: 3,
  serval: 3,
  tiger: 3,
  ocelot: 2,
  "black-footed-cat": 5,
  margay: 3,
  jaguar: 3,
  "rusty-spotted-cat": 4,
  "sand-cat": 5,
  "fishing-cat": 4,
  "domestic-cat": 4,
};

export function packParams(p: WorldParams, out: Float32Array): Float32Array {
  for (let i = 0; i < PARAM_COUNT; i++) out[i] = p[PARAM_KEYS[i]];
  return out;
}

export function lerpParams(a: WorldParams, b: WorldParams, t: number, out: Float32Array): Float32Array {
  for (let i = 0; i < PARAM_COUNT; i++) {
    const k = PARAM_KEYS[i];
    let va = a[k];
    let vb = b[k];
    // water plane: when one side has no water, slide the level rather than jumping
    if (k === "waterO") {
      if (a.water <= 0) va = b.water > 0 ? vb - 0.08 : NO_WATER;
      if (b.water <= 0) vb = a.water > 0 ? va - 0.08 : NO_WATER;
    }
    out[i] = va + (vb - va) * t;
  }
  return out;
}

/** Flat sky gradient per stop, used when WebGL is unavailable. */
export const FALLBACK_SKY: Record<string, [string, string]> = {
  hero: ["#0b1226", "#2c3360"],
  "hero-dawn": ["#121a3a", "#5b4a6e"],
  "snow-leopard": ["#2a3a6e", "#d9a3a0"],
  "andean-mountain-cat": ["#2c5aa8", "#e9e6e0"],
  "pallass-cat": ["#3566b4", "#c9b48c"],
  puma: ["#3a6ab8", "#9eb0b8"],
  "eurasian-lynx": ["#3e70bd", "#5f7a58"],
  caracal: ["#4677c2", "#a5915c"],
  "clouded-leopard": ["#c9d0d6", "#9aa9a7"],
  "asian-golden-cat": ["#c3cbd1", "#8fa29b"],
  leopard: ["#8c9db0", "#6f7e58"],
  serval: ["#5a7fb8", "#4d5e57"],
  tiger: ["#7d95b4", "#5f5a3e"],
  ocelot: ["#7e97b0", "#3f5a46"],
  "black-footed-cat": ["#4d78bd", "#b38552"],
  margay: ["#9fb3c4", "#24402c"],
  jaguar: ["#5a6c9a", "#e0a777"],
  "rusty-spotted-cat": ["#5c5f86", "#e7b48c"],
  "sand-cat": ["#2d3466", "#e28a4e"],
  "fishing-cat": ["#151a3c", "#4a3a5e"],
  ending: ["#05070f", "#141a2e"],
};
