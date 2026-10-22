import { smooth, sunElevation } from "@/lib/format";

/**
 * The light a cat should be standing in, read from the same world parameters
 * the landscape shader uses: sun colour and height, sky ambient, haze, forest
 * shade, and the lamp at the window. The photographs were all shot in daylight;
 * this is what lets a fishing cat at dusk or a house cat by lamplight belong to
 * the scene around it.
 */
export interface CatLight {
  /** sun position on screen, x in viewport heights from centre */
  sunX: number;
  /** sun elevation, degrees */
  elev: number;
  /** direct light colour (already scaled by intensity) */
  sun: [number, number, number];
  /** sky ambient colour */
  amb: [number, number, number];
  /** colour grade multiplier applied to the photograph */
  grade: [number, number, number];
  /** overall exposure of the photograph */
  exposure: number;
  /** strength of the depth-based relighting (0 keeps the photo's own light) */
  relight: number;
  /** strength of the rim light where the sun grazes the silhouette */
  rim: number;
  /** atmospheric veil: colour and amount */
  haze: [number, number, number, number];
  /** lamp light from the left (the window scene) */
  lamp: number;
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mix3 = (a: number[], b: number[], t: number): [number, number, number] => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

function sunColour(se: number, tod: number, haze: number): [number, number, number] {
  const low = tod < 0.5 ? [1.0, 0.52, 0.45] : [1.0, 0.42, 0.16];
  let c = mix3(low, [1.0, 0.76, 0.52], smooth(0, 6, se));
  c = mix3(c, [1.0, 0.95, 0.86], smooth(5, 24, se));
  const k = smooth(-3, 1.5, se) * (1.15 - 0.2 * haze);
  return [c[0] * k, c[1] * k, c[2] * k];
}

function skyAmbient(se: number): [number, number, number] {
  let c = mix3([0.03, 0.045, 0.095], [0.23, 0.25, 0.43], smooth(-16, -6, se));
  c = mix3(c, [0.62, 0.52, 0.58], smooth(-6, 1.5, se));
  c = mix3(c, [0.72, 0.8, 0.9], smooth(4, 22, se));
  return c;
}

export function catLight(p: Float32Array, aspect: number, out?: CatLight): CatLight {
  const tod = p[0];
  const haze = p[1];
  const cloud = p[24];
  const mist = p[27];
  const canopy = p[30];
  const win = p[31];
  const moon = p[43];
  const se = sunElevation(tod);
  const day = smooth(-4, 6, se);
  const night = 1 - smooth(-12, -2, se);
  const sun = sunColour(se, tod, haze);
  const shade = 1 - 0.55 * canopy;
  const amb = skyAmbient(se);
  // forest floor: the ambient goes green and dim under a canopy
  const ambC = mix3(amb, [amb[0] * 0.7, amb[1] * 0.9, amb[2] * 0.62], canopy * 0.8);
  // moonlight lifts the night a little
  const lift = 0.08 * moon * night;

  // exposure: daylight photographs sink toward the light they now stand in
  const exposure = mix(mix(0.5, 0.82, smooth(-12, -2, se)), 1.0, day) * mix(1, 0.86, canopy * 0.6) + lift;

  // grade: a gentle push toward the ambient and sun colour, stronger when the light is coloured
  const tint = [ambC[0] * 0.55 + sun[0] * 0.55, ambC[1] * 0.55 + sun[1] * 0.55, ambC[2] * 0.55 + sun[2] * 0.55];
  const lum = Math.max(1e-3, tint[0] * 0.299 + tint[1] * 0.587 + tint[2] * 0.114);
  const norm = [tint[0] / lum, tint[1] / lum, tint[2] / lum];
  const gk = mix(0.1, 0.42, 1 - day) * (1 - 0.4 * win);
  const grade = mix3([1, 1, 1], norm, gk);

  const veil = Math.min(0.14, 0.05 * haze + 0.08 * mist + 0.03 * cloud);
  const hz = mix3(ambC, [0.86, 0.88, 0.9], 0.45 * day);

  const res: CatLight = out ?? {
    sunX: 0,
    elev: 0,
    sun: [0, 0, 0],
    amb: [0, 0, 0],
    grade: [1, 1, 1],
    exposure: 1,
    relight: 0,
    rim: 0,
    haze: [0, 0, 0, 0],
    lamp: 0,
  };
  res.sunX = (tod - 0.5) * 2 * Math.min(1, aspect * 0.5) * 0.92;
  res.elev = se;
  res.sun = [sun[0] * shade, sun[1] * shade, sun[2] * shade];
  res.amb = ambC;
  res.grade = grade;
  res.exposure = exposure;
  // relight harder when the sun is low and coloured, gently at noon, barely at night
  res.relight = mix(0.1, 0.34, smooth(40, 4, se)) * day * shade + 0.08 * night;
  res.rim = smooth(28, 2, se) * smooth(-3, 1, se) * shade * 0.9;
  res.haze = [hz[0], hz[1], hz[2], veil];
  res.lamp = win;
  return res;
}
