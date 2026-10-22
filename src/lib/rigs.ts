/**
 * Hand-placed rigs for the living photographs (see lib/world/living.ts).
 *
 * Points are fractions of the cutout (x right, y down). Radii, widths and
 * amplitudes are in units of the cutout's height, so a rig survives any
 * display size. Each rig was placed by eye on the final cutout.
 */
export type P = [number, number];

export interface Rig {
  /** chest/belly ellipse that breathes: centre x, y, radius x, radius y */
  breath: [number, number, number, number];
  /** expansion at full breath, x and y (fractions) */
  breathAmp?: [number, number];
  /** breaths per second */
  breathRate?: number;
  /** head: neck pivot, head centre, head radius; look = max turn in degrees */
  head?: {
    pivot: P;
    center: P;
    r: number;
    look?: number;
    flip?: boolean;
    facing?: number;
  };
  /** eyes for blinking: centre x, y, radius x, radius y */
  eyes?: [number, number, number, number][];
  /** ears flick about their base */
  ears?: { base: P; tip: P; w: number }[];
  /** ear flicks per second, on average */
  earRate?: number;
  earFlick?: number;
  /** how far the ears fold back when the page rushes past */
  earBack?: number;
  /** tail as a polyline from root to tip; w = half width; amp = sway at the tip */
  tail?: { pts: P[]; w: number; amp: number; rate?: number };
  /** where the body pivots when it sways (usually the feet) */
  pivot?: P;
  sway?: number;
  /** parallax strength from the depth map */
  parallax?: number;
  /** quad margin around the photo, for tails that swing outside it */
  margin?: number;
}

export const RIGS: Record<string, Rig> = {
  "snow-leopard": {
    breath: [0.46, 0.42, 0.22, 0.15],
    breathAmp: [0.004, 0.012],
    breathRate: 0.22,
    head: { pivot: [0.25, 0.3], center: [0.17, 0.15], r: 0.12, look: 4 },
    eyes: [
      [0.1, 0.123, 0.014, 0.009],
      [0.19, 0.112, 0.014, 0.009],
    ],
    ears: [
      { base: [0.1, 0.06], tip: [0.085, 0.02], w: 0.022 },
      { base: [0.255, 0.07], tip: [0.275, 0.015], w: 0.028 },
    ],
    earRate: 0.12,
    tail: {
      pts: [
        [0.75, 0.45],
        [0.78, 0.6],
        [0.8, 0.75],
        [0.83, 0.88],
        [0.9, 0.97],
      ],
      w: 0.05,
      amp: 0.022,
      rate: 0.18,
    },
    pivot: [0.42, 0.78],
  },
  "andean-mountain-cat": {
    breath: [0.5, 0.38, 0.22, 0.12],
    breathAmp: [0.005, 0.014],
    breathRate: 0.36,
    head: { pivot: [0.25, 0.25], center: [0.13, 0.14], r: 0.11, look: 5 },
    eyes: [
      [0.082, 0.141, 0.011, 0.008],
      [0.172, 0.137, 0.011, 0.008],
    ],
    ears: [
      { base: [0.08, 0.08], tip: [0.03, 0.04], w: 0.026 },
      { base: [0.21, 0.08], tip: [0.24, 0.02], w: 0.026 },
    ],
    earRate: 0.16,
    tail: {
      pts: [
        [0.8, 0.6],
        [0.84, 0.72],
        [0.88, 0.84],
        [0.93, 0.95],
      ],
      w: 0.045,
      amp: 0.02,
      rate: 0.25,
    },
    pivot: [0.6, 0.8],
  },
  "pallass-cat": {
    breath: [0.6, 0.56, 0.32, 0.28],
    breathAmp: [0.005, 0.012],
    breathRate: 0.32,
    head: { pivot: [0.26, 0.42], center: [0.21, 0.2], r: 0.2, look: 4 },
    eyes: [
      [0.152, 0.155, 0.02, 0.013],
      [0.274, 0.161, 0.02, 0.013],
    ],
    pivot: [0.5, 1.0],
  },
  puma: {
    breath: [0.42, 0.56, 0.24, 0.2],
    breathAmp: [0.004, 0.011],
    breathRate: 0.22,
    head: { pivot: [0.63, 0.22], center: [0.73, 0.4], r: 0.19, look: 4 },
    eyes: [
      [0.661, 0.374, 0.014, 0.009],
      [0.824, 0.389, 0.014, 0.009],
    ],
    ears: [
      { base: [0.6, 0.27], tip: [0.56, 0.18], w: 0.035 },
      { base: [0.9, 0.27], tip: [0.95, 0.2], w: 0.035 },
    ],
    earRate: 0.12,
    pivot: [0.6, 0.98],
  },
  "eurasian-lynx": {
    breath: [0.55, 0.42, 0.32, 0.14],
    breathAmp: [0.004, 0.012],
    breathRate: 0.26,
    head: { pivot: [0.25, 0.35], center: [0.13, 0.2], r: 0.15, look: 5 },
    eyes: [
      [0.086, 0.188, 0.015, 0.008],
      [0.167, 0.183, 0.015, 0.008],
    ],
    ears: [
      { base: [0.06, 0.12], tip: [0.03, 0.07], w: 0.032 },
      { base: [0.2, 0.12], tip: [0.23, 0.04], w: 0.035 },
    ],
    earRate: 0.17,
    tail: {
      pts: [
        [0.9, 0.5],
        [0.94, 0.56],
        [0.97, 0.6],
      ],
      w: 0.045,
      amp: 0.012,
      rate: 0.3,
    },
    pivot: [0.5, 0.95],
  },
  caracal: {
    breath: [0.6, 0.48, 0.2, 0.12],
    breathAmp: [0.004, 0.012],
    breathRate: 0.3,
    head: { pivot: [0.25, 0.35], center: [0.13, 0.24], r: 0.11, look: 5 },
    eyes: [
      [0.08, 0.234, 0.016, 0.009],
      [0.183, 0.235, 0.016, 0.009],
    ],
    ears: [
      { base: [0.06, 0.18], tip: [0.03, 0.06], w: 0.03 },
      { base: [0.22, 0.18], tip: [0.26, 0.06], w: 0.03 },
    ],
    earRate: 0.24,
    earFlick: 1.3,
    tail: {
      pts: [
        [0.94, 0.48],
        [0.95, 0.6],
        [0.95, 0.72],
        [0.94, 0.81],
      ],
      w: 0.03,
      amp: 0.012,
      rate: 0.3,
    },
    pivot: [0.5, 0.98],
  },
  "clouded-leopard": {
    breath: [0.5, 0.76, 0.3, 0.17],
    breathAmp: [0.004, 0.01],
    breathRate: 0.26,
    head: { pivot: [0.45, 0.68], center: [0.33, 0.38], r: 0.28, look: 4 },
    eyes: [
      [0.24, 0.356, 0.028, 0.022],
      [0.42, 0.316, 0.028, 0.022],
    ],
    ears: [
      { base: [0.14, 0.2], tip: [0.06, 0.13], w: 0.055 },
      { base: [0.42, 0.14], tip: [0.46, 0.05], w: 0.055 },
    ],
    earRate: 0.15,
    pivot: [0.5, 1.0],
  },
  "asian-golden-cat": {
    breath: [0.4, 0.52, 0.18, 0.12],
    breathAmp: [0.004, 0.012],
    breathRate: 0.28,
    head: { pivot: [0.4, 0.38], center: [0.41, 0.2], r: 0.14, look: 5 },
    eyes: [
      [0.331, 0.205, 0.015, 0.009],
      [0.496, 0.19, 0.015, 0.009],
    ],
    ears: [
      { base: [0.2, 0.13], tip: [0.16, 0.07], w: 0.03 },
      { base: [0.53, 0.1], tip: [0.57, 0.02], w: 0.03 },
    ],
    earRate: 0.14,
    tail: {
      pts: [
        [0.88, 0.7],
        [0.93, 0.6],
        [0.95, 0.53],
      ],
      w: 0.03,
      amp: 0.01,
      rate: 0.3,
    },
    pivot: [0.45, 0.98],
  },
  leopard: {
    breath: [0.5, 0.47, 0.18, 0.1],
    breathAmp: [0.004, 0.012],
    breathRate: 0.2,
    head: { pivot: [0.33, 0.32], center: [0.24, 0.24], r: 0.11, look: 5 },
    eyes: [
      [0.199, 0.232, 0.012, 0.008],
      [0.275, 0.235, 0.012, 0.008],
    ],
    ears: [
      { base: [0.18, 0.19], tip: [0.15, 0.15], w: 0.025 },
      { base: [0.3, 0.19], tip: [0.33, 0.14], w: 0.025 },
    ],
    earRate: 0.12,
    tail: {
      pts: [
        [0.9, 0.44],
        [0.92, 0.6],
        [0.93, 0.78],
        [0.95, 0.95],
      ],
      w: 0.03,
      amp: 0.01,
      rate: 0.16,
    },
    pivot: [0.45, 0.42],
    sway: 0.6,
  },
  serval: {
    breath: [0.45, 0.42, 0.22, 0.1],
    breathAmp: [0.004, 0.012],
    breathRate: 0.32,
    head: { pivot: [0.17, 0.25], center: [0.09, 0.15], r: 0.1, look: 6 },
    eyes: [
      [0.045, 0.152, 0.011, 0.007],
      [0.112, 0.157, 0.011, 0.007],
    ],
    ears: [
      { base: [0.05, 0.1], tip: [0.02, 0.01], w: 0.035 },
      { base: [0.13, 0.1], tip: [0.17, 0.02], w: 0.035 },
    ],
    earRate: 0.3,
    earFlick: 1.35,
    tail: {
      pts: [
        [0.81, 0.47],
        [0.88, 0.52],
        [0.94, 0.49],
        [0.99, 0.46],
      ],
      w: 0.032,
      amp: 0.02,
      rate: 0.34,
    },
    pivot: [0.45, 0.98],
  },
  tiger: {
    breath: [0.4, 0.45, 0.45, 0.22],
    breathAmp: [0.003, 0.01],
    breathRate: 0.18,
    head: { pivot: [0.17, 0.4], center: [0.07, 0.4], r: 0.2, look: 4 },
    eyes: [
      [0.033, 0.323, 0.02, 0.012],
      [0.088, 0.34, 0.02, 0.012],
    ],
    ears: [
      { base: [0.03, 0.2], tip: [0.01, 0.13], w: 0.04 },
      { base: [0.14, 0.21], tip: [0.16, 0.14], w: 0.04 },
    ],
    earRate: 0.12,
    tail: {
      pts: [
        [0.75, 0.25],
        [0.8, 0.45],
        [0.86, 0.6],
        [0.93, 0.62],
        [0.97, 0.52],
      ],
      w: 0.045,
      amp: 0.035,
      rate: 0.2,
    },
    pivot: [0.4, 0.95],
  },
  ocelot: {
    breath: [0.4, 0.45, 0.35, 0.2],
    breathAmp: [0.004, 0.012],
    breathRate: 0.3,
    head: { pivot: [0.78, 0.35], center: [0.86, 0.2], r: 0.2, look: 5 },
    eyes: [
      [0.827, 0.185, 0.017, 0.011],
      [0.916, 0.188, 0.017, 0.011],
    ],
    ears: [
      { base: [0.79, 0.09], tip: [0.76, 0.02], w: 0.05 },
      { base: [0.94, 0.1], tip: [0.98, 0.03], w: 0.05 },
    ],
    earRate: 0.15,
    tail: {
      pts: [
        [0.08, 0.6],
        [0.06, 0.72],
        [0.06, 0.84],
        [0.07, 0.95],
      ],
      w: 0.05,
      amp: 0.02,
      rate: 0.26,
    },
    pivot: [0.3, 0.9],
  },
  "black-footed-cat": {
    breath: [0.45, 0.6, 0.25, 0.22],
    breathAmp: [0.005, 0.013],
    breathRate: 0.42,
    head: { pivot: [0.6, 0.38], center: [0.67, 0.22], r: 0.17, look: 6 },
    eyes: [
      [0.594, 0.199, 0.02, 0.015],
      [0.762, 0.208, 0.02, 0.015],
    ],
    ears: [
      { base: [0.57, 0.1], tip: [0.52, 0.02], w: 0.04 },
      { base: [0.9, 0.13], tip: [0.97, 0.08], w: 0.04 },
    ],
    earRate: 0.2,
    pivot: [0.45, 0.98],
  },
  margay: {
    breath: [0.6, 0.45, 0.12, 0.15],
    breathAmp: [0.012, 0.006],
    breathRate: 0.38,
    head: { pivot: [0.37, 0.18], center: [0.27, 0.08], r: 0.1, look: 6 },
    eyes: [[0.221, 0.059, 0.0105, 0.008]],
    ears: [{ base: [0.37, 0.07], tip: [0.4, 0.01], w: 0.025 }],
    earRate: 0.18,
    pivot: [0.75, 0.98],
  },
  jaguar: {
    breath: [0.45, 0.4, 0.6, 0.22],
    breathAmp: [0.003, 0.01],
    breathRate: 0.2,
    head: { pivot: [0.17, 0.35], center: [0.07, 0.4], r: 0.22, look: 4 },
    eyes: [[0.063, 0.338, 0.02, 0.012]],
    ears: [{ base: [0.06, 0.17], tip: [0.04, 0.1], w: 0.05 }],
    earRate: 0.12,
    tail: {
      pts: [
        [0.75, 0.32],
        [0.83, 0.37],
        [0.9, 0.36],
        [0.98, 0.25],
      ],
      w: 0.05,
      amp: 0.05,
      rate: 0.22,
    },
    pivot: [0.45, 0.95],
  },
  "rusty-spotted-cat": {
    breath: [0.65, 0.5, 0.45, 0.3],
    breathAmp: [0.004, 0.012],
    breathRate: 0.45,
    head: { pivot: [0.32, 0.55], center: [0.17, 0.6], r: 0.35, look: 5 },
    eyes: [
      [0.094, 0.572, 0.037, 0.025],
      [0.21, 0.584, 0.037, 0.025],
    ],
    ears: [
      { base: [0.08, 0.3], tip: [0.03, 0.17], w: 0.07 },
      { base: [0.3, 0.33], tip: [0.35, 0.22], w: 0.07 },
    ],
    earRate: 0.2,
    pivot: [0.5, 1.0],
  },
  "sand-cat": {
    breath: [0.6, 0.55, 0.35, 0.25],
    breathAmp: [0.005, 0.013],
    breathRate: 0.4,
    head: { pivot: [0.32, 0.38], center: [0.2, 0.25], r: 0.25, look: 5 },
    eyes: [
      [0.152, 0.254, 0.0175, 0.012],
      [0.059, 0.264, 0.012, 0.01],
    ],
    ears: [
      { base: [0.31, 0.15], tip: [0.3, 0.02], w: 0.05 },
      { base: [0.08, 0.12], tip: [0.03, 0.07], w: 0.035 },
    ],
    earRate: 0.2,
    pivot: [0.5, 0.95],
  },
  "fishing-cat": {
    breath: [0.3, 0.55, 0.35, 0.22],
    breathAmp: [0.004, 0.012],
    breathRate: 0.3,
    head: { pivot: [0.6, 0.5], center: [0.78, 0.33], r: 0.33, look: 5 },
    eyes: [
      [0.724, 0.257, 0.031, 0.022],
      [0.864, 0.278, 0.031, 0.022],
    ],
    ears: [
      { base: [0.62, 0.12], tip: [0.57, 0.03], w: 0.06 },
      { base: [0.92, 0.17], tip: [0.98, 0.09], w: 0.06 },
    ],
    earRate: 0.14,
    pivot: [0.5, 0.9],
  },
  "domestic-cat": {
    breath: [0.4, 0.42, 0.45, 0.16],
    breathAmp: [0.003, 0.016],
    breathRate: 0.34,
    head: { pivot: [0.64, 0.45], center: [0.73, 0.32], r: 0.28, look: 5 },
    eyes: [
      [0.695, 0.258, 0.028, 0.018],
      [0.763, 0.258, 0.028, 0.018],
    ],
    ears: [
      { base: [0.67, 0.15], tip: [0.645, 0.03], w: 0.05 },
      { base: [0.79, 0.14], tip: [0.82, 0.02], w: 0.05 },
    ],
    earRate: 0.12,
    tail: {
      pts: [
        [0.1, 0.84],
        [0.13, 0.9],
        [0.17, 0.97],
      ],
      w: 0.035,
      amp: 0.014,
      rate: 0.35,
    },
    pivot: [0.5, 0.6],
  },
};
