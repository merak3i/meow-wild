/**
 * GLSL for the meow.wild world.
 *
 * Pass 1 (WORLD_FS, reduced resolution): sky, a 7-card parallax landscape whose
 * composition and materials come from the morphing preset, the fixed cloud
 * deck (a sea of cloud from above, fog inside it, a ceiling below it),
 * vegetation, water with reflections, canopy, trunks, light shafts, mist and
 * weather. Alpha carries "open sky" so the composite pass can lay crisp stars
 * into it.
 *
 * Pass 2 (COMPOSITE_FS, full resolution): upscale with a scroll-velocity blur,
 * stars, the window frame of the final scene, vignette and grain.
 *
 * Pass 3 (POINTS_VS/FS): each cat materialising from particles.
 */

export const FULLSCREEN_VS = /* glsl */ `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const COMMON = /* glsl */ `
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
`;

/* shared GLSL: the world parameters, the card constants and the ridgeline noise,
   used by the world pass and by the story pass (which hides figures behind nearer ridges) */
const PARAM_DEFS = /* glsl */ `#define TOD uP[0].x
#define HAZE uP[0].y
#define PITCH uP[0].z
#define WIND uP[0].w
#define FAR_O uP[1].x
#define FAR_A uP[1].y
#define MID_O uP[1].z
#define MID_A uP[1].w
#define NEAR_O uP[2].x
#define NEAR_A uP[2].y
#define JAG_F uP[2].z
#define JAG_N uP[2].w
#define SNOWLINE uP[3].x
#define TREELINE uP[3].y
#define TREE_D uP[3].z
#define DRY uP[3].w
#define CONIFER uP[4].x
#define BROAD uP[4].y
#define ACACIA uP[4].z
#define TALL uP[4].w
#define WATER uP[5].x
#define WATER_O uP[5].y
#define SAND uP[5].z
#define SALT uP[5].w
#define CLOUD uP[6].x
#define SNOW uP[6].y
#define RAIN uP[6].z
#define MIST uP[6].w
#define FIREFLY uP[7].x
#define DUST uP[7].y
#define CANOPY uP[7].z
#define WINDOW uP[7].w
#define ROCKS uP[8].x
#define REEDS uP[8].y
#define TEA uP[8].z
#define MESA uP[8].w
#define TOWER uP[9].x
#define RAYS uP[9].y
#define LIGHTS uP[9].z
#define GRASS uP[9].w
#define DUNE uP[10].x
#define TRUNKS uP[10].y
#define STARS uP[10].z
#define MOON uP[10].w
`;

const CARD_CONSTS = /* glsl */ `const float CB = 1920.0;
const float CT = 2480.0;
const int NL = 7;
// screen units per metre of elevation for each card (far → near)
const float LS[7] = float[7](1.0 / 14000.0, 1.0 / 8000.0, 1.0 / 4800.0, 1.0 / 2900.0, 1.0 / 1700.0, 1.0 / 950.0, 1.0 / 420.0);
// horizontal feature frequency of each card (cycles per screen height)
const float KX[7] = float[7](1.15, 1.45, 1.8, 2.2, 2.7, 3.3, 4.0);
`;

const GNOISE = /* glsl */ `float gnoise(float x) {
  float i = floor(x);
  float f = fract(x);
  float g0 = hash11(i) * 2.0 - 1.0;
  float g1 = hash11(i + 1.0) * 2.0 - 1.0;
  float u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(g0 * f, g1 * (f - 1.0), u) * 2.0;
}
`;

const TERRAIN = /* glsl */ `float shapeAt(float x, float jag, int oct) {
  float fb = 0.0, rg = 0.0, a = 0.5, n = 0.0, w = 1.0;
  for (int k = 0; k < 6; k++) {
    if (k >= oct) break;
    float v = gnoise(x);
    fb += a * v;
    float r = 1.0 - abs(v);
    r *= r;
    rg += a * r * w;
    w = clamp(r * 1.5, 0.0, 1.0);
    n += a;
    a *= 0.5;
    x = x * 2.03 + 7.13;
  }
  fb = clamp(fb / n * 0.9 + 0.5, 0.0, 1.0);
  rg = clamp(rg / n * 1.1, 0.0, 1.0);
  return mix(fb, rg, jag);
}

float towerAt(float x) {
  float cw = 0.6;
  float c = floor(x / cw);
  float best = 0.0;
  for (int k = -1; k <= 1; k++) {
    float ci = c + float(k);
    float h = hash11(ci * 1.37 + 4.1);
    float cx = (ci + 0.25 + 0.5 * hash11(ci * 2.91)) * cw;
    float hw = cw * (0.13 + 0.18 * hash11(ci * 5.3));
    float d = abs(x - cx) / hw;
    float prof = (0.45 + 0.55 * h) * (1.0 - pow(clamp(d, 0.0, 1.0), 4.0));
    best = max(best, prof);
  }
  return best;
}

float duneAt(float x) {
  float w = gnoise(x * 0.27) * 0.45;
  float y = x * 0.55 + w;
  float f = fract(y);
  float prof = min(smoothstep(0.0, 0.78, f), 1.0 - smoothstep(0.78, 1.0, f));
  float amp = 0.5 + 0.5 * hash11(floor(y) * 1.7 + 3.0);
  return prof * amp + gnoise(x * 3.1) * 0.02;
}

float layerT(int i) { return float(i) / 6.0; }
float layerOff(int i) { float t = layerT(i); return t < 0.5 ? mix(FAR_O, MID_O, t * 2.0) : mix(MID_O, NEAR_O, t * 2.0 - 1.0); }
float layerAmp(int i) { float t = layerT(i); return max(t < 0.5 ? mix(FAR_A, MID_A, t * 2.0) : mix(MID_A, NEAR_A, t * 2.0 - 1.0), 0.0005); }
float layerJ(int i) { return mix(JAG_F, JAG_N, smoothstep(0.3, 0.85, layerT(i))); }
float layerX(int i, float px) { return (px + uDrift * LS[i]) * KX[i] + float(i) * 13.71; }

float shapeFull(int i, float x, int oct) {
  float s = shapeAt(x, layerJ(i), oct);
  if (DUNE > 0.001) s = mix(s, duneAt(x), DUNE);
  if (MESA > 0.001 && i <= 3) s = mix(s, smoothstep(0.5, 0.58, s) * 0.8 + s * 0.2, MESA);
  if (TOWER > 0.001 && i >= 1 && i <= 4) s = mix(s, max(s * 0.3, towerAt(x)), TOWER);
  return s;
}

/* crest height on screen */
float crestY(int i, float xn, float s) {
  return gYh + layerOff(i) + layerAmp(i) * (s - 0.5) * 2.0;
}
`;

export const WORLD_FS = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform float uAlt;
uniform float uDrift;
uniform float uTravel;
uniform float uVel;
uniform vec4 uP[11];

in vec2 vUv;
out vec4 fragColor;

${PARAM_DEFS}
${CARD_CONSTS}
float gAsp, gPix, gYh, gSe, gDay, gNight, gSunSide, gInCloud, gAbove, gBelow, gLine, gLitLow, gToward;
vec2 gSunP;
vec3 gSunCol, gZen, gAmb, gFog;

${COMMON}

${GNOISE}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm2(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int k = 0; k < 5; k++) { s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
  return s / 0.96875;
}

float fbm3(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int k = 0; k < 3; k++) { s += a * vnoise(p); p = p * 2.07 + vec2(5.3, 1.7); a *= 0.5; }
  return s / 0.875;
}

/* ---------------- sun, sky, light ---------------- */

float sunElev(float t) {
  float T[13] = float[13](0.0, 0.075, 0.13, 0.2, 0.32, 0.5, 0.66, 0.79, 0.84, 0.88, 0.92, 0.96, 1.0);
  float E[13] = float[13](-9.0, -3.0, 3.0, 11.0, 26.0, 55.0, 36.0, 9.0, 4.5, 1.2, -3.0, -8.0, -14.0);
  float e = E[12];
  for (int i = 0; i < 12; i++) {
    if (t >= T[i] && t <= T[i + 1]) { e = mix(E[i], E[i + 1], (t - T[i]) / (T[i + 1] - T[i])); break; }
  }
  return e;
}

vec3 zenithCol(float se) {
  vec3 c = mix(vec3(0.012, 0.018, 0.045), vec3(0.045, 0.075, 0.185), smoothstep(-16.0, -6.0, se));
  c = mix(c, vec3(0.120, 0.210, 0.420), smoothstep(-6.0, 2.0, se));
  c = mix(c, vec3(0.150, 0.350, 0.700), smoothstep(2.0, 22.0, se));
  float hi = smoothstep(2600.0, 5600.0, uAlt) * smoothstep(-4.0, 12.0, se);
  return mix(c, vec3(0.065, 0.170, 0.520), hi * 0.6);
}

vec3 horizonCol(float se, float toward) {
  vec3 night = vec3(0.030, 0.045, 0.095);
  vec3 blue = mix(vec3(0.230, 0.250, 0.430), vec3(0.420, 0.330, 0.430), toward);
  vec3 dawn = mix(vec3(0.560, 0.520, 0.660), vec3(1.000, 0.580, 0.330), toward);
  vec3 day = mix(vec3(0.700, 0.800, 0.900), vec3(0.980, 0.860, 0.660), toward * 0.55);
  vec3 c = mix(night, blue, smoothstep(-16.0, -6.0, se));
  c = mix(c, dawn, smoothstep(-6.0, 1.5, se));
  c = mix(c, day, smoothstep(4.0, 22.0, se));
  return c;
}

vec3 hazeColor(float toward) {
  vec3 h = horizonCol(gSe, toward);
  vec3 wet = mix(h, vec3(dot(h, vec3(0.333))) * 1.06, 0.5);
  return mix(h, wet, HAZE * gDay);
}

vec3 sunColorF(float se) {
  vec3 low = mix(vec3(1.0, 0.52, 0.45), vec3(1.0, 0.42, 0.16), step(0.5, TOD));
  vec3 mid = vec3(1.0, 0.76, 0.52);
  vec3 high = vec3(1.0, 0.95, 0.86);
  vec3 c = mix(low, mid, smoothstep(0.0, 6.0, se));
  c = mix(c, high, smoothstep(5.0, 24.0, se));
  return c * smoothstep(-3.0, 1.5, se) * (1.15 - 0.2 * HAZE);
}

void setup() {
  gAsp = uRes.x / uRes.y;
  gPix = 1.0 / uRes.y;
  float dip = sqrt(max(uAlt, 0.0) * 2.0 / 6.371e6);
  gYh = PITCH - dip * 0.7;
  gSe = sunElev(TOD);
  gDay = smoothstep(-4.0, 6.0, gSe);
  gNight = 1.0 - smoothstep(-12.0, -2.0, gSe);
  float sx = (TOD - 0.5) * 2.0 * min(1.0, gAsp * 0.5) * 0.92;
  gSunP = vec2(sx, gYh + tan(radians(gSe)) * 1.1);
  gSunSide = sx < 0.0 ? -1.0 : 1.0;
  gSunCol = sunColorF(gSe);
  gZen = zenithCol(gSe);
  gAmb = mix(horizonCol(gSe, 0.3), gZen, 0.45) * mix(0.85, 1.05, HAZE) + vec3(0.05, 0.07, 0.12) * MOON * gNight;
  gFog = mix(gAmb * 1.55 + gSunCol * 0.25, vec3(0.88, 0.9, 0.92), 0.4 * gDay);
  gFog = mix(gFog, gAmb * 1.25, gNight);
  gInCloud = CLOUD * smoothstep(CB - 160.0, CB + 70.0, uAlt) * (1.0 - smoothstep(CT - 70.0, CT + 160.0, uAlt));
  gAbove = smoothstep(CT - 40.0, CT + 120.0, uAlt);
  gBelow = 1.0 - smoothstep(CB - 120.0, CB + 40.0, uAlt);
  gLine = mix(8600.0, -900.0, smoothstep(-3.5, 9.0, gSe));
  gLitLow = smoothstep(-2.5, 1.0, gSe);
}

float litAt(float z) {
  return TOD < 0.5 ? smoothstep(gLine - 300.0, gLine + 300.0, z) : gLitLow;
}

/* ---------------- terrain ---------------- */

${TERRAIN}
float elevAt(int i, float y) { return uAlt + (y - gYh) / LS[i]; }

/* ---------------- clouds ---------------- */

float cloudField(vec2 q) {
  return fbm2(q + vec2(uTime * 0.01 * (0.3 + WIND), uTime * 0.003));
}

float coverage(float f) {
  float c = clamp(CLOUD, 0.0, 1.0);
  return smoothstep(1.0 - c - 0.12, 1.0 - c + 0.12, f);
}

vec3 cloudTopCol(float f, float D) {
  float lit = litAt(CT + 150.0 * f);
  float b = smoothstep(0.2, 0.95, f);
  vec3 shade = gAmb * 1.75 + horizonCol(gSe, 0.3) * 0.22;
  vec3 sun = gSunCol * 1.05 * lit + gAmb * 1.25;
  vec3 c = mix(shade, sun, 0.3 + 0.7 * b);
  return mix(c, hazeColor(gToward), 1.0 - exp(-D * 1.4e-5 * (0.45 + HAZE)));
}

vec3 cloudBaseCol(float f, float D, vec2 p) {
  vec3 dark = gAmb * 0.58 + vec3(0.02);
  vec3 lit = gAmb * 1.0 + gSunCol * 0.18;
  float edge = smoothstep(0.3, 0.95, f);
  vec3 c = mix(lit, dark, edge);
  float near = exp(-length(p - gSunP) * 2.5);
  c += gSunCol * near * (1.0 - edge) * 0.5;
  return mix(c, hazeColor(gToward), 1.0 - exp(-D * 1.2e-5 * (0.5 + HAZE)));
}

/* ---------------- sky ---------------- */

vec3 skyColor(vec2 p) {
  float h = max(p.y - gYh, 0.0);
  float span = max(1.0 - gYh, 0.25);
  float tz = clamp(h / span, 0.0, 1.0);
  vec3 hor = horizonCol(gSe, gToward);
  vec3 c = mix(hor, gZen, pow(tz, 0.55));
  c = mix(c, hazeColor(gToward), HAZE * 0.42 * (1.0 - tz) * gDay);
  float r = length(p - gSunP);
  float glow = smoothstep(-10.0, 0.0, gSe);
  c += gSunCol * (0.5 * exp(-r * 9.0) + 0.2 * exp(-r * 2.4) * (1.0 + HAZE)) * glow;
  // twilight band hugging the horizon on the sun side
  float tw = smoothstep(-14.0, -2.0, gSe) * (1.0 - smoothstep(2.0, 10.0, gSe));
  c += vec3(1.0, 0.5, 0.26) * exp(-h * 10.0) * pow(gToward, 0.7) * tw * 0.42;
  // belt of Venus opposite the sun at twilight
  float opp = exp(-pow(p.x + gSunP.x, 2.0) * 1.0) * (1.0 - gToward);
  c += vec3(0.55, 0.32, 0.45) * exp(-pow((h - 0.07) * 12.0, 2.0)) * opp * tw * 0.3;
  // sun disk
  float disk = smoothstep(0.021, 0.016, r);
  c = mix(c, gSunCol * 2.4 + vec3(0.35), disk * smoothstep(-1.2, 0.6, gSe));
  // moon
  if (MOON > 0.001) {
    vec2 mp = vec2(mix(0.3, -0.34, step(0.5, TOD)) * gAsp, gYh + 0.34 + 0.05 * TOD);
    float mr = 0.016;
    float md = length(p - mp);
    float lune = smoothstep(mr, mr * 0.82, md) * (1.0 - smoothstep(mr * 0.95, mr * 0.75, length(p - mp - vec2(0.0075, 0.0045))));
    float vis = MOON * (1.0 - gDay * 0.75);
    c += vec3(0.92, 0.94, 1.0) * lune * vis * 1.3;
    c += vec3(0.5, 0.6, 0.8) * exp(-md * 16.0) * 0.12 * vis;
  }
  // glow of towns on the horizon at night
  c += vec3(0.32, 0.22, 0.14) * exp(-h * 9.0) * LIGHTS * gNight * 0.3;
  // cloud ceiling seen from below the deck
  if (gBelow > 0.001 && CLOUD > 0.001 && h > 0.0) {
    float D = (CB - uAlt) / max(h, 1e-4);
    vec2 q = vec2(p.x * D, D) * 0.00055 + vec2(uDrift * 0.00012, 0.0);
    float f = cloudField(q);
    float cv = coverage(f) * gBelow * (1.0 - smoothstep(60000.0, 140000.0, D));
    c = mix(c, cloudBaseCol(f, D, p), cv);
  }
  return c;
}

vec3 farGround(vec2 p) {
  float d = gYh - p.y;
  vec3 hz = hazeColor(gToward);
  return mix(hz, hz * vec3(0.6, 0.64, 0.7), smoothstep(0.0, 0.07, d));
}

/* ---------------- vegetation ---------------- */

float sdConifer(vec2 q, float H) {
  if (q.y > H) return q.y - H;
  float t = clamp(q.y / H, 0.0, 1.0);
  float tier = 1.0 - 0.34 * fract(t * 5.0 + 0.3);
  float w = (1.0 - t) * H * 0.24 * tier + H * 0.012;
  return abs(q.x) - w;
}
float sdBroad(vec2 q, float H, float seed) {
  float sx = 0.85 + 0.4 * hash11(seed * 3.1);
  vec2 cq = vec2(q.x / sx, q.y);
  float d = length(cq - vec2(0.0, H * 0.68)) - H * 0.29;
  d = min(d, length(cq - vec2(-H * 0.22, H * 0.55)) - H * 0.2);
  d = min(d, length(cq - vec2(H * 0.24, H * 0.57)) - H * 0.19);
  d = min(d, length(cq - vec2(H * 0.06, H * 0.86)) - H * 0.16);
  d += (vnoise(q / H * 9.0 + seed) - 0.5) * H * 0.13;
  float trunk = max(abs(q.x + sin(q.y / H * 5.0 + seed) * H * 0.02) - H * 0.03, q.y - H * 0.52);
  return min(d, trunk);
}
float sdAcacia(vec2 q, float H) {
  vec2 c = (q - vec2(H * 0.08, H * 0.86)) / vec2(0.62 * H, 0.12 * H);
  float canopy = (length(c) - 1.0) * 0.12 * H;
  canopy = max(canopy, q.y - H * 0.94);
  float tx = q.x - q.y * 0.09;
  float trunk = max(abs(tx) - H * 0.03, q.y - H * 0.85);
  float fork = max(abs(q.x + q.y * 0.25 - H * 0.12) - H * 0.022, max(q.y - H * 0.84, H * 0.45 - q.y));
  return min(canopy, min(trunk, fork));
}
float sdTall(vec2 q, float H) {
  float trunk = max(abs(q.x + sin(q.y / H * 4.0) * H * 0.012) - H * 0.016, q.y - H * 0.86);
  float crown = length((q - vec2(0.0, H * 0.9)) / vec2(1.6, 1.0)) - H * 0.1;
  crown = min(crown, length((q - vec2(-H * 0.11, H * 0.84)) / vec2(1.5, 1.0)) - H * 0.075);
  crown = min(crown, length((q - vec2(H * 0.12, H * 0.86)) / vec2(1.5, 1.0)) - H * 0.07);
  crown += (vnoise(q / H * 16.0) - 0.5) * H * 0.05;
  float branch = max(abs(q.x - (q.y - H * 0.62) * 0.5) - H * 0.008, max(q.y - H * 0.86, H * 0.62 - q.y));
  branch = min(branch, max(abs(q.x + (q.y - H * 0.66) * 0.55) - H * 0.008, max(q.y - H * 0.86, H * 0.66 - q.y)));
  return min(min(trunk, crown), branch);
}

float vegetation(int i, vec2 p, float yr, float xn, float Zc, out float kind) {
  kind = 0.0;
  float dy = p.y - yr;
  if (dy < 0.0) return 0.0;
  float s = LS[i];
  float kx = KX[i];
  float cov = 0.0;
  float allow = 1.0 - smoothstep(TREELINE - 140.0, TREELINE + 80.0, Zc);
  float wsum = CONIFER + BROAD + ACACIA + TALL;
  if (TREE_D > 0.001 && wsum > 0.001 && allow > 0.001) {
    float Hs = 26.0 * s * 2.2;
    float forestShare = (CONIFER + BROAD + TALL) / wsum;
    float dense = smoothstep(0.5, 0.9, TREE_D) * forestShare * allow;
    if (dense > 0.01 && dy < Hs * 1.4) {
      float u = (xn / kx) / (Hs * 0.5);
      float cu = floor(u);
      float best = -9.0;
      float coniferShare = CONIFER / wsum;
      for (int k = -1; k <= 1; k++) {
        float cc = cu + float(k);
        float r = hash11(cc * 3.1 + float(i) * 1.7);
        float h = 0.35 + 0.65 * r * r;
        float wv = 0.7 + 0.6 * hash11(cc * 5.9 + float(i));
        float c0 = cc + 0.5 + (hash11(cc * 7.3 + float(i)) - 0.5) * 0.6;
        float dx = (u - c0) / wv;
        float arc = h - dx * dx * 1.3 + (vnoise(vec2(u * 6.0, cc)) - 0.5) * 0.12;
        float spike = h * 1.15 - abs(dx) * 1.6;
        float emer = step(0.93, hash11(cc * 11.7 + float(i))) * TALL;
        arc = max(arc, emer * (1.25 - dx * dx * 6.0));
        best = max(best, mix(arc, spike, coniferShare));
      }
      float lineY = Hs * max(best, 0.0) * (0.6 + 0.4 * dense);
      cov = max(cov, smoothstep(gPix, -gPix, dy - lineY) * step(0.02, dense));
    }
    float sparse = TREE_D * (1.0 - dense * 0.85);
    if (dy < Hs * 2.2 && sparse > 0.01) {
      float cw = Hs * mix(3.4, 1.1, sparse) * kx;
      float c = floor(xn / cw);
      for (int k = -1; k <= 1; k++) {
        float ci = c + float(k);
        float r0 = hash11(ci * 1.13 + float(i) * 7.1);
        if (r0 > sparse * allow) continue;
        float r1 = hash11(ci * 2.71 + float(i) * 3.3);
        float r2 = hash11(ci * 5.17 + float(i) * 1.9);
        float cx = (ci + 0.15 + 0.7 * r1) * cw;
        vec2 q = vec2((xn - cx) / kx, dy);
        float H = Hs * (0.65 + 0.7 * hash11(ci * 9.3 + float(i)));
        float pick = r2 * wsum;
        float sd;
        if (pick < CONIFER) sd = sdConifer(q, H * 1.15);
        else if (pick < CONIFER + BROAD) sd = sdBroad(q, H, ci + float(i) * 5.0);
        else if (pick < CONIFER + BROAD + ACACIA) sd = sdAcacia(q, H * 0.62);
        else sd = sdTall(q, H * 1.8);
        cov = max(cov, smoothstep(gPix, -gPix, sd));
      }
    }
  }
  if (ROCKS > 0.001 && i == 6) {
    float R0 = 0.03;
    float cw = R0 * 3.2 * kx;
    float c = floor(xn / cw);
    for (int k = -1; k <= 1; k++) {
      float ci = c + float(k);
      if (hash11(ci * 3.7 + float(i)) > ROCKS * 0.45) continue;
      float cx = (ci + 0.2 + 0.6 * hash11(ci * 4.9)) * cw;
      float R = R0 * (0.4 + 0.8 * hash11(ci * 8.1));
      vec2 q = vec2((xn - cx) / kx, dy + R * 0.35);
      float sd = length(q / vec2(1.35, 1.0)) - R;
      float a = smoothstep(gPix, -gPix, sd);
      if (a > cov) kind = 1.0;
      cov = max(cov, a);
    }
  }
  if (i == 6 && (REEDS > 0.001 || GRASS > 0.001)) {
    float cw = 0.022;
    float c = floor(xn / cw);
    for (int k = -1; k <= 1; k++) {
      float ci = c + float(k);
      float clump = smoothstep(0.3, 0.75, vnoise(vec2(ci * 0.13, 7.0)));
      float reed = step(hash11(ci * 1.91), REEDS * (0.25 + 0.75 * clump));
      float grass = step(hash11(ci * 4.17), GRASS * (0.5 + 0.5 * clump));
      if (reed + grass < 0.5) continue;
      for (int b = 0; b < 2; b++) {
        float hb = hash11(ci * 2.3 + float(b) * 9.1);
        float H = reed > 0.5 ? (0.03 + 0.09 * hb * hb) * REEDS * (0.6 + 0.6 * clump) : (0.01 + 0.022 * hb) * GRASS;
        float cx = (ci + 0.15 + 0.7 * hash11(ci * 6.1 + float(b) * 3.3)) * cw;
        float lean = (hash11(ci * 8.7 + float(b)) - 0.5) * 0.35;
        float t = clamp(dy / H, 0.0, 1.0);
        float bend = (WIND * 0.02 + 0.003) * t * t * (0.6 + 0.4 * sin(uTime * 1.3 + ci * 1.7 + float(b))) + lean * H * t * t;
        float lx = (xn - cx) / kx - bend;
        float wdt = max((reed > 0.5 ? 0.0022 : 0.0016) * (1.0 - t * 0.9), gPix * 0.8);
        float sd = max(abs(lx) - wdt, dy - H);
        float a = smoothstep(gPix, -gPix, sd);
        if (a > cov) kind = 2.0;
        cov = max(cov, a);
      }
    }
  }
  return cov;
}

/* ---------------- card face ---------------- */

vec3 shadeFace(int i, vec2 p, float xn, float yr, out float zp) {
  float s = LS[i];
  float kx = KX[i];
  float Zp = elevAt(i, p.y);
  zp = Zp;
  float db = yr - p.y;
  float amp = layerAmp(i);
  float nd = db / max(amp * 3.0, 0.012);
  float xs = xn / kx;
  float jag = layerJ(i);
  float tl = layerT(i);
  float flat_ = 1.0 - smoothstep(0.015, 0.08, amp);

  // multi-scale crest slope: fine near the crest, broad massifs deeper down
  float e = mix(0.008, 0.02, tl);
  float xw = xn + gnoise(nd * 0.9 + xs * 1.1 + float(i) * 5.0) * 0.32 * min(nd, 1.6);
  float a0 = shapeFull(i, xn + e, 6) - shapeFull(i, xn - e, 6);
  float a1 = (shapeFull(i, xw + e * 4.0, 3) - shapeFull(i, xw - e * 4.0, 3)) / 4.0;
  float a2 = (shapeFull(i, xw + e * 10.0, 2) - shapeFull(i, xw - e * 10.0, 2)) / 10.0;
  float a3 = (shapeFull(i, xw + e * 24.0, 1) - shapeFull(i, xw - e * 24.0, 1)) / 24.0;
  float toScreen = amp * 2.0 * kx / (2.0 * e);
  float slope = mix(mix(mix(a3, a2, exp(-nd * 0.7)), a1, exp(-nd * 1.6)), a0, exp(-nd * 7.0)) * toScreen;
  float facing = clamp(0.5 - 0.6 * slope * gSunSide, 0.0, 1.0);
  facing = mix(facing, 0.56, mix(smoothstep(0.0, 0.6, nd), 0.82, smoothstep(0.55, 0.2, jag)) * (1.0 - jag * jag));
  float split = mix(0.38, 0.08, jag * jag) + 0.08 * tl;
  float light = mix(0.24, 1.0, smoothstep(0.5 - split, 0.5 + split, facing));
  light *= mix(1.0, 0.84, smoothstep(0.0, 2.0, nd));

  float cf = mix(9.0, 4.0, tl);
  float cs_ = mix(16.0, 7.0, tl);
  float couJ = fbm3(vec2(xs * cs_ + db * cs_ * 0.35, db * cs_ * 0.4 + xs * 1.3 + float(i) * 3.0));
  float couR = fbm3(vec2(xs, db) * cs_ * 0.8 + float(i) * 3.0);
  float cou = mix(couR, couJ, smoothstep(0.35, 0.85, jag));
  float tex = vnoise(vec2(xs * mix(30.0, 12.0, tl), nd * 6.0)) * 0.6 + vnoise(vec2(xs * mix(80.0, 30.0, tl), nd * 18.0)) * 0.4;

  float aboveTree = smoothstep(TREELINE - 180.0, TREELINE + 120.0, Zp);
  vec3 rock = mix(vec3(0.30, 0.29, 0.29), vec3(0.50, 0.40, 0.30), DRY);
  vec3 alp = mix(vec3(0.27, 0.33, 0.20), vec3(0.62, 0.52, 0.33), DRY);
  vec3 forest = mix(vec3(0.055, 0.13, 0.075), vec3(0.50, 0.42, 0.25), DRY * 0.9);
  vec3 alb = mix(forest, mix(alp, rock, smoothstep(0.35, 0.65, cou) * 0.7 + 0.15), aboveTree);
  alb *= 0.93 + 0.14 * tex;

  // perspective ground mapping for flat near ground
  float D = (uAlt - elevAt(i, yr)) / max(gYh - p.y, 1e-4);
  bool ground = flat_ > 0.01 && i >= 4 && p.y < gYh && D > 0.0;
  if (ground && SALT < 0.5) {
    vec2 gp = vec2(p.x * D, D);
    float gn = fbm3(gp * vec2(0.25, 0.6));
    alb *= mix(1.0, 0.88 + 0.24 * gn, (1.0 - smoothstep(60.0, 260.0, D)) * (1.0 - DUNE));
  }
  if (ground && DUNE > 0.001) {
    vec2 gp = vec2(p.x * D, D);
    float rip = sin(gp.x * 1.4 + gp.y * 2.4 + fbm3(gp * 0.3) * 6.0);
    alb *= mix(1.0, 0.93 + 0.07 * rip * (1.0 - smoothstep(25.0, 80.0, D)), DUNE);
  }

  // tea rows along the contours
  if (TEA > 0.001 && i >= 4) {
    float row = fract(db / (26.0 * s * 0.75) + gnoise(xs * 5.0) * 0.35);
    float bush = smoothstep(0.0, 0.3, row) * (1.0 - smoothstep(0.62, 0.92, row));
    vec3 tea = mix(vec3(0.10, 0.20, 0.07), vec3(0.19, 0.37, 0.12), bush);
    alb = mix(alb, tea, TEA * (1.0 - aboveTree) * smoothstep(0.0, 0.004, db));
  }

  alb = mix(alb, mix(vec3(0.58, 0.36, 0.24), vec3(0.88, 0.67, 0.45), DUNE), SAND * (1.0 - 0.5 * aboveTree));

  if (SALT > 0.001 && ground) {
    vec2 gp = vec2(p.x * D, D) * 0.16;
    vec2 cell = floor(gp);
    vec2 f = fract(gp);
    float d1 = 9.0, d2 = 9.0;
    for (int yy = -1; yy <= 1; yy++)
      for (int xx = -1; xx <= 1; xx++) {
        vec2 o = vec2(float(xx), float(yy));
        vec2 r = o + hash22(cell + o) - f;
        float d = dot(r, r);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
      }
    float edge = 1.0 - smoothstep(0.0, 0.1, sqrt(d2) - sqrt(d1));
    edge *= 1.0 - smoothstep(25.0, 120.0, D);
    alb = mix(alb, mix(vec3(0.82, 0.83, 0.84), vec3(0.99, 0.99, 0.98), edge), SALT);
  } else if (SALT > 0.001 && i >= 3) {
    alb = mix(alb, vec3(0.86, 0.86, 0.85), SALT * flat_);
  }

  // snow in crisp shapes, gathered in the couloirs
  float snow = smoothstep(SNOWLINE - 45.0, SNOWLINE + 45.0, Zp + (cou - 0.5) * 680.0);
  snow *= 1.0 - 0.6 * smoothstep(1.2, 2.6, abs(slope));
  // dark rock outcrops breaking the snow on steep ground
  float outcrop = smoothstep(0.62, 0.7, cou) * smoothstep(0.6, 1.6, abs(slope)) * (0.6 + 0.4 * jag);
  outcrop = max(outcrop, smoothstep(0.56, 0.64, cou) * ROCKS * step(5.5, float(i)));
  snow *= 1.0 - outcrop;
  alb = mix(alb, vec3(0.92, 0.94, 0.98) * (0.96 + 0.06 * tex), snow);
  light = mix(light, 0.3 + 0.7 * light, snow);

  float lit = litAt(Zp);
  vec3 col = alb * (gAmb * (1.0 + 0.65 * snow) + gSunCol * light * lit * 1.15);
  float rim = smoothstep(gPix * 2.5, 0.0, db) * smoothstep(0.55, 0.95, gToward) * gDay * (1.0 - flat_);
  col += gSunCol * rim * 0.25;

  if (LIGHTS > 0.001 && i >= 1) {
    float ls = mix(110.0, 45.0, tl);
    vec2 lq = vec2(xs * ls, db * ls * 1.6);
    vec2 lc = floor(lq);
    vec2 lf = fract(lq) - 0.5 - (hash22(lc) - 0.5) * 0.5;
    float on = step(hash12(lc + float(i) * 3.1), 0.045 * LIGHTS) * step(db, amp * 3.0 + 0.06) * smoothstep(0.0, 0.004, db);
    float tw = 0.8 + 0.2 * sin(uTime * 2.0 + hash12(lc) * 30.0);
    col += vec3(1.0, 0.7, 0.36) * on * exp(-dot(lf, lf) * 22.0) * tw * gNight * 2.2;
  }
  return col;
}

vec3 vegColor(float kind, float Zc) {
  vec3 base;
  if (kind > 1.5) base = mix(vec3(0.20, 0.26, 0.10), vec3(0.62, 0.52, 0.30), DRY);
  else if (kind > 0.5) base = mix(vec3(0.34, 0.32, 0.31), vec3(0.50, 0.40, 0.30), DRY) * 1.05;
  else base = mix(vec3(0.045, 0.10, 0.055), vec3(0.28, 0.25, 0.14), DRY * 0.8);
  float lit = litAt(Zc);
  return base * (gAmb * 0.85 + gSunCol * 0.45 * lit);
}

float hazeAmt(int i) {
  float D = 4.0 / LS[i];
  return 1.0 - exp(-D * mix(5.5e-6, 4.0e-5, HAZE));
}

/* water reflections: farther cards mirrored about the water plane W */
vec3 reflScene(vec2 q, int start, float W) {
  for (int i = NL - 1; i >= 0; i--) {
    if (i >= start) continue;
    float xn = layerX(i, q.x);
    float yr = crestY(i, xn, shapeFull(i, xn, i < 2 ? 4 : 5));
    float Zc = elevAt(i, yr);
    if (Zc <= W) continue;
    float yrm = gYh + (2.0 * W - Zc - uAlt) * LS[i];
    float vegH = (i >= 3 && TREE_D > 0.05 && Zc < TREELINE) ? 26.0 * LS[i] * 2.2 * 0.8 * TREE_D : 0.0;
    if (q.y > yrm - vegH) {
      float Zm = 2.0 * W - elevAt(i, q.y);
      float aboveTree = smoothstep(TREELINE - 180.0, TREELINE + 120.0, Zm);
      vec3 alb = mix(mix(vec3(0.06, 0.15, 0.08), vec3(0.42, 0.37, 0.21), DRY), vec3(0.4, 0.37, 0.34), aboveTree);
      alb = mix(alb, vec3(0.9, 0.93, 0.98), smoothstep(SNOWLINE - 60.0, SNOWLINE + 140.0, Zm));
      if (q.y < yrm) alb = vec3(0.04, 0.08, 0.045);
      vec3 col = alb * (gAmb + gSunCol * 0.55 * litAt(Zm));
      return mix(col, hazeColor(gToward), hazeAmt(i));
    }
  }
  return skyColor(vec2(q.x, 2.0 * gYh - q.y));
}

/* ---------------- overlays ---------------- */

float canopyMask(vec2 p, out float edge) {
  float x = p.x + uDrift * 0.0011;
  float yt = 1.0 - p.y;
  float base = 0.03 + 0.24 * CANOPY;
  float e = base + 0.11 * gnoise(x * 2.3) + 0.05 * gnoise(x * 7.0) + 0.03 * abs(gnoise(x * 23.0)) + 0.015 * abs(gnoise(x * 61.0));
  float m = smoothstep(e + 0.006, e - 0.006, yt);
  // hanging fronds and vines
  float cw = 0.045;
  float c = floor(x / cw);
  for (int k = -1; k <= 1; k++) {
    float ci = c + float(k);
    float r = hash11(ci * 2.17);
    if (r > 0.55 * CANOPY) continue;
    float cx = (ci + 0.2 + 0.6 * hash11(ci * 5.3)) * cw;
    float L = (0.04 + 0.22 * hash11(ci * 8.9)) * CANOPY;
    float t = clamp((yt - e) / L, 0.0, 1.0);
    float sway = sin(uTime * 0.6 + ci) * 0.004 * t;
    float w = mix(0.016, 0.002, t) * (0.6 + 0.8 * hash11(ci * 3.9)) * (0.35 + 0.65 * abs(sin(t * 19.0 + ci * 2.0)));
    float sd = max(abs(x - cx - sway) - w, max(yt - e - L, e - 0.01 - yt));
    m = max(m, smoothstep(gPix, -gPix, sd));
  }
  edge = smoothstep(e - 0.05, e, yt) * m;
  return m * smoothstep(0.0, 0.15, CANOPY);
}

void main() {
  setup();
  vec2 p = vec2((vUv.x - 0.5) * gAsp, vUv.y);
  float dxs = p.x - gSunP.x;
  gToward = exp(-dxs * dxs * 1.6);

  vec3 col = vec3(0.0);
  float skyVis = 0.0;
  bool hit = false;
  bool isVeg = false;
  int hl = -1;
  float hxn = 0.0, hyr = 0.0, vkind = 0.0, vcov = 0.0;
  float nearCrest = -1.0;

  for (int i = NL - 1; i >= 0; i--) {
    float xn = layerX(i, p.x);
    float yr = crestY(i, xn, shapeFull(i, xn, i < 2 ? 5 : 6));
    if (p.y < yr) { hit = true; hl = i; hxn = xn; hyr = yr; break; }
    nearCrest = max(nearCrest, yr);
    if (i >= 3) {
      float kd;
      float cv = vegetation(i, p, yr, xn, elevAt(i, yr), kd);
      if (cv > 0.02) { hit = true; isVeg = true; hl = i; hxn = xn; hyr = yr; vkind = kd; vcov = cv; break; }
    }
  }

  vec3 behind = p.y > gYh ? skyColor(p) : farGround(p);

  if (!hit) {
    col = behind;
    skyVis = p.y > gYh ? 1.0 : 0.0;
  } else if (isVeg) {
    vec3 vc = mix(vegColor(vkind, elevAt(hl, hyr)), hazeColor(gToward), hazeAmt(hl));
    col = mix(behind, vc, vcov);
    skyVis = (p.y > gYh ? 1.0 : 0.0) * (1.0 - vcov);
  } else {
    float zp;
    col = shadeFace(hl, p, hxn, hyr, zp);
    float W = uAlt + WATER_O * 420.0;
    if (WATER > 0.001) {
      float yw = gYh + WATER_O * 420.0 * LS[hl];
      if (p.y < yw) {
        float db = yw - p.y;
        // ripple frequency rises toward the shore; capped so no ripple is finer than a few pixels
        float f1 = min(30.0 / (db + 0.03), 0.3 / gPix);
        float f2 = min(80.0 / (db + 0.05), 0.22 / gPix);
        float rip = gnoise(p.x * f1 + uTime * 0.6) * 0.5 + gnoise(p.x * f2 - uTime * 0.9) * 0.25;
        vec2 q = vec2(p.x + rip * 0.003, p.y + rip * db * 0.16);
        vec3 refl = reflScene(q, hl, W);
        float fres = 0.32 + 0.68 * pow(1.0 - clamp(db * 2.2, 0.0, 1.0), 3.0);
        vec3 deep = mix(vec3(0.02, 0.05, 0.06), vec3(0.08, 0.06, 0.03), DRY);
        vec3 wc = mix(deep * (gAmb * 2.0 + 0.1), refl * 0.92, fres);
        float glit = pow(max(0.0, 1.0 - abs(p.x - gSunP.x) * 2.5), 6.0) * step(0.86, vnoise(vec2(p.x * 260.0 + uTime * 1.3, db * 900.0 / (db * 10.0 + 0.2))));
        wc += gSunCol * glit * gDay * 0.7 * fres;
        col = mix(col, wc, WATER * smoothstep(0.0, 0.003, db));
      }
    }
    col = mix(col, hazeColor(gToward), hazeAmt(hl));
    // haze pooling in the valley between this card and the ridge (or cloud sea) in front of it
    if (gAbove > 0.001 && CLOUD > 0.3) nearCrest = max(nearCrest, gYh + (CT - uAlt) * LS[hl]);
    if (nearCrest > -0.5) {
      float gap = max(p.y - nearCrest, 0.0);
      float decay = (gAbove > 0.001 ? 0.055 : 0.03) + 0.09 * HAZE;
      float vh = exp(-gap / decay) * (0.38 + 0.45 * HAZE) * (1.0 - 0.35 * gNight);
      col = mix(col, hazeColor(gToward), vh * (1.0 - float(hl) / 9.0));
    }
  }

  // ---- cloud deck ----
  if (CLOUD > 0.001) {
    float dist = hit ? 1.0 / LS[hl] : 1e9;
    if (gAbove > 0.001 && p.y < gYh) {
      float h0 = max(gYh - p.y, 1e-4);
      float D0 = (uAlt - CT) / h0;
      vec2 q = vec2(p.x * D0, D0) * 0.00018 + vec2(uDrift * 0.00004, 3.1);
      float f = cloudField(q);
      float D = (uAlt - (CT + (f - 0.5) * 520.0)) / h0;
      if (D < dist) {
        float f2 = cloudField(q + vec2(gSunSide * 0.12, -0.08));
        float shade = clamp(0.5 + (f - f2) * 4.5, 0.0, 1.0);
        float cv = smoothstep(1.0 - CLOUD - 0.2, 1.0 - CLOUD + 0.2, f) * gAbove;
        // soft contact where the cloud meets the slopes
        cv *= smoothstep(0.0, 900.0, dist - D);
        vec3 cc = cloudTopCol(f, D);
        cc *= 0.7 + 0.42 * shade;
        cc = mix(cc, cc * vec3(0.78, 0.84, 1.0), (1.0 - smoothstep(0.3, 0.6, f)) * 0.5);
        col = mix(col, cc, cv);
        skyVis *= 1.0 - cv;
      }
    }
    if (gBelow > 0.001 && hit && p.y > gYh) {
      float D = (CB - uAlt) / max(p.y - gYh, 1e-4);
      if (D < dist) {
        vec2 q = vec2(p.x * D, D) * 0.00055 + vec2(uDrift * 0.00012, 0.0);
        float f = cloudField(q);
        float cv = coverage(f) * gBelow;
        col = mix(col, cloudBaseCol(f, D, p), cv);
      }
    }
    if (gInCloud > 0.001) {
      float dc = hit ? 0.4 / LS[hl] : 9000.0;
      float fc = 1.0 - exp(-dc / (230.0 + 120.0 * layerT(hl)));
      col = mix(col, gFog, fc * gInCloud);
      skyVis *= 1.0 - gInCloud;
    }
  }

  // ---- mist banks ----
  if (MIST > 0.001) {
    for (int k = 0; k < 2; k++) {
      float sp = k == 0 ? 0.018 : 0.03;
      float m = fbm3(vec2(p.x * (1.1 + float(k)) + uTime * sp * (0.3 + WIND) + uDrift * 0.0003 * float(k + 1), p.y * (2.6 + float(k)) - uTravel * 0.15 + float(k) * 4.0));
      float band = smoothstep(-0.05, 0.25, p.y) * (1.0 - smoothstep(gYh - 0.05, gYh + 0.4, p.y));
      float a = MIST * smoothstep(0.42, 0.82, m) * band * (k == 0 ? 0.55 : 0.4);
      col = mix(col, gFog, a);
    }
  }

  float occ = 0.0;
  // ---- foreground trunks ----
  if (TRUNKS > 0.001) {
    for (int k = 1; k >= 0; k--) {
      float par = k == 0 ? 0.0021 : 0.0012;
      float cw = k == 0 ? 0.62 : 0.34;
      float x = p.x + uDrift * par + float(k) * 3.1;
      float c = floor(x / cw);
      for (int j = -1; j <= 1; j++) {
        float ci = c + float(j);
        if (hash11(ci * 1.7 + float(k) * 11.0) > TRUNKS * (k == 0 ? 0.75 : 0.9)) continue;
        float cx = (ci + 0.2 + 0.6 * hash11(ci * 3.3 + float(k))) * cw;
        float w = cw * (k == 0 ? 0.075 : 0.05) * (0.7 + 0.6 * hash11(ci * 7.7)) * (1.0 + 0.22 * (1.0 - p.y));
        float lean = (hash11(ci * 4.4 + float(k)) - 0.5) * 0.06;
        float bx = cx + lean * (p.y - 0.2) + gnoise(p.y * 9.0 + ci * 3.0) * w * 0.12;
        float sd = abs(x - bx) - w * (1.0 + 0.06 * gnoise(p.y * 40.0 + ci));
        float a = smoothstep(gPix * 1.5, -gPix * 1.5, sd) * smoothstep(0.0, 0.3, TRUNKS);
        float side = clamp((x - bx) / w * gSunSide, -1.0, 1.0);
        vec3 bark = mix(vec3(0.04, 0.032, 0.028), vec3(0.15, 0.115, 0.085), 0.5 + 0.5 * side);
        bark *= 0.7 + 0.3 * vnoise(vec2(x * 220.0, p.y * 16.0));
        vec3 tc = bark * (gAmb * 0.9 + gSunCol * 0.6 * smoothstep(0.3, 1.0, side) * gDay);
        if (k == 1) tc = mix(tc, hazeColor(gToward), 0.08 + 0.12 * HAZE);
        col = mix(col, tc, a);
        skyVis *= 1.0 - a;
        if (k == 0) occ = max(occ, a);
      }
    }
  }

  // ---- canopy overhead ----
  if (CANOPY > 0.001) {
    float edge;
    float m = canopyMask(p, edge);
    float back = exp(-pow(p.x - gSunP.x, 2.0) * 2.0) * gDay;
    vec3 leaf = mix(vec3(0.015, 0.035, 0.015), vec3(0.06, 0.12, 0.04), vnoise(p * vec2(90.0, 60.0)));
    leaf += vec3(0.35, 0.5, 0.12) * edge * back * 0.6;
    leaf *= gAmb * 1.2 + 0.25;
    col = mix(col, leaf, m);
    skyVis *= 1.0 - m;
    occ = max(occ, m);
  }

  // ---- light shafts ----
  if (RAYS > 0.001) {
    vec2 o = vec2(gSunP.x * 0.6, 1.25);
    vec2 d = p - o;
    float ang = atan(d.x, -d.y);
    float sh = pow(vnoise(vec2(ang * 16.0, uTime * 0.04)), 4.0) + 0.4 * pow(vnoise(vec2(ang * 41.0, uTime * 0.07 + 3.0)), 5.0);
    float fall = smoothstep(1.25, 0.15, length(d) * 0.75) * smoothstep(0.0, 0.5, p.y);
    col += gSunCol * sh * fall * RAYS * 0.3 * gDay * (0.6 + HAZE) * (1.0 - occ * 0.85);
  }

  // ---- weather ----
  if (SNOW > 0.001) {
    for (int k = 0; k < 3; k++) {
      float sc = k == 0 ? 7.0 : (k == 1 ? 13.0 : 22.0);
      float spd = k == 0 ? 0.22 : (k == 1 ? 0.15 : 0.1);
      float trav = k == 0 ? 0.7 : (k == 1 ? 0.42 : 0.25);
      vec2 q = p * sc;
      q.x += uTime * (0.35 + WIND * 1.6) * spd * sc * 0.25 + float(k) * 13.0;
      q.y += uTime * spd * sc - uTravel * trav * sc;
      vec2 ce = floor(q);
      vec2 f = fract(q);
      vec2 r = hash22(ce + float(k) * 7.0);
      float present = step(hash12(ce + 3.3 + float(k)), SNOW * (k == 0 ? 0.16 : 0.42));
      vec2 dd = f - (0.15 + 0.7 * r);
      dd.x += sin(uTime * 1.3 + r.y * 30.0) * 0.08;
      dd.y /= 1.0 + min(abs(uVel), 3.0) * (k == 0 ? 1.4 : 0.8);
      float rad = (k == 0 ? 0.07 : (k == 1 ? 0.055 : 0.045));
      float flake = smoothstep(rad, rad * 0.25, length(dd)) * present;
      col = mix(col, vec3(0.95, 0.97, 1.0) * (gAmb * 1.3 + 0.35 + gSunCol * 0.2), flake * (k == 0 ? 0.75 : 0.65));
    }
  }
  if (RAIN > 0.001) {
    for (int k = 0; k < 2; k++) {
      float sc = k == 0 ? 18.0 : 34.0;
      vec2 q = vec2(p.x * sc + p.y * sc * 0.12, p.y * sc * 0.16);
      q.y += uTime * (k == 0 ? 3.2 : 2.4) - uTravel * 0.4;
      vec2 ce = floor(q);
      vec2 f = fract(q);
      float present = step(hash12(ce + float(k) * 9.0), RAIN * 0.35);
      float x0 = hash12(ce + 1.7);
      float line = smoothstep(0.06, 0.0, abs(f.x - x0)) * smoothstep(0.0, 0.4, f.y) * smoothstep(1.0, 0.6, f.y);
      col = mix(col, gFog * 1.05 + 0.05, line * present * 0.35);
    }
  }
  if (DUST > 0.001) {
    vec2 q = p * 16.0 + vec2(uTime * (0.08 + WIND * 0.25), uTime * 0.05 - uTravel * 3.0);
    vec2 ce = floor(q);
    vec2 f = fract(q);
    vec2 r = hash22(ce + 31.0);
    float present = step(hash12(ce + 8.8), DUST * 0.3);
    float d = length(f - 0.5 - 0.35 * vec2(sin(uTime * 0.6 + r.x * 20.0), cos(uTime * 0.5 + r.y * 20.0)));
    float lit = 0.35 + 1.4 * exp(-length(p - gSunP) * 2.0);
    col += (gSunCol * 0.8 + 0.08) * smoothstep(0.08, 0.0, d) * present * lit * 0.6;
  }
  if (FIREFLY > 0.001) {
    for (int k = 0; k < 2; k++) {
      float sc = k == 0 ? 6.0 : 11.0;
      vec2 q = p * sc + vec2(float(k) * 5.1, -uTravel * 0.6 * sc * (k == 0 ? 0.5 : 0.3));
      vec2 ce = floor(q);
      vec2 f = fract(q);
      vec2 r = hash22(ce + 17.0 + float(k));
      float present = step(hash12(ce + 4.4 + float(k)), FIREFLY * 0.32) * smoothstep(gYh + 0.2, gYh - 0.15, p.y);
      vec2 c = 0.5 + 0.32 * vec2(sin(uTime * 0.45 + r.x * 20.0), cos(uTime * 0.38 + r.y * 20.0));
      float blink = smoothstep(0.55, 1.0, sin(uTime * (0.7 + r.x) + r.y * 30.0) * 0.5 + 0.5);
      float d = length(f - c);
      float g = (exp(-d * d * 900.0) * 1.6 + exp(-d * d * 60.0) * 0.25) * blink * present;
      col += vec3(0.80, 1.0, 0.42) * g * (0.4 + 0.6 * gNight + 0.3);
    }
  }

  col = max(col, 0.0);
  col = mix(col, 1.0 - 0.25 * exp(-(col - 0.75) * 4.0), step(0.75, col));
  fragColor = vec4(col, clamp(skyVis, 0.0, 1.0));
}`;

export const COMPOSITE_FS = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D uTex;
uniform sampler2D uStory;
uniform float uStoryOn;
uniform vec2 uRes;
uniform float uTime;
uniform float uVel;
uniform float uStarVis;
uniform float uHorizon;
uniform float uWindow;
uniform float uSill;
uniform float uGrain;
uniform float uLamp;

in vec2 vUv;
out vec4 fragColor;

${COMMON}

vec3 starField(vec2 p) {
  vec3 acc = vec3(0.0);
  for (int k = 0; k < 2; k++) {
    float sc = k == 0 ? 70.0 : 150.0;
    vec2 q = p * sc + float(k) * 19.0;
    vec2 ce = floor(q);
    vec2 f = fract(q);
    vec2 r = hash22(ce);
    float present = step(k == 0 ? 0.88 : 0.8, hash12(ce + 7.7));
    float mag = pow(hash12(ce + 3.1), k == 0 ? 4.0 : 8.0);
    float d = length(f - (0.2 + 0.6 * r));
    float tw = 0.65 + 0.35 * sin(uTime * (1.2 + mag * 4.0) + r.x * 60.0);
    float size = (k == 0 ? 0.08 : 0.06) * (0.6 + mag);
    float s = present * smoothstep(size, 0.0, d) * (0.5 + 2.5 * mag) * tw;
    vec3 tint = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.9, 0.78), hash12(ce + 1.3));
    acc += tint * s;
  }
  float band = exp(-pow((p.y - uHorizon - 0.32 - p.x * 0.3) * 3.2, 2.0));
  vec2 bq = p * 6.0;
  float n = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    vec2 ii = floor(bq), ff = fract(bq);
    vec2 u = ff * ff * (3.0 - 2.0 * ff);
    float v = mix(mix(hash12(ii), hash12(ii + vec2(1.0, 0.0)), u.x), mix(hash12(ii + vec2(0.0, 1.0)), hash12(ii + vec2(1.0, 1.0)), u.x), u.y);
    n += a * v;
    bq = bq * 2.1 + 3.7;
    a *= 0.5;
  }
  acc += vec3(0.55, 0.6, 0.75) * band * smoothstep(0.35, 0.9, n) * 0.16;
  return acc;
}

vec3 windowFrame(vec2 p, vec3 c, float asp) {
  float w = clamp(uWindow, 0.0, 1.0);
  float m = mix(-0.25, 0.055, w);
  vec2 hf = vec2(asp * 0.5 - m, 0.5 - m);
  vec2 q = abs(p - vec2(0.0, 0.5)) - hf;
  float outside = max(q.x, q.y);
  float px = 1.5 / uRes.y;
  float frame = smoothstep(-px, px, outside);
  float mv = abs(p.x) - 0.007;
  float mh = abs(p.y - 0.63) - 0.005;
  float mull = smoothstep(px, -px, min(mv, mh)) * step(outside, 0.0) * smoothstep(0.6, 1.0, w);
  float sill = smoothstep(px, -px, abs(p.y - (0.5 - hf.y) + 0.012) - 0.014) * step(abs(p.x), hf.x + 0.03);
  vec2 lampP = vec2(-asp * 0.55, 0.12);
  float lamp = exp(-length(p - lampP) * 1.7) * uLamp;
  vec3 wall = vec3(0.05, 0.035, 0.03) + vec3(1.0, 0.62, 0.32) * lamp * 0.55;
  vec3 wood = vec3(0.11, 0.075, 0.05) + vec3(1.0, 0.6, 0.3) * lamp * 0.7;
  c += vec3(1.0, 0.6, 0.3) * lamp * 0.05 * w;
  c = mix(c, wood, mull);
  c = mix(c, wall, frame * w);
  c = mix(c, wood * 1.25 + vec3(0.04, 0.025, 0.01), sill * w);
  return c;
}

void main() {
  float asp = uRes.x / uRes.y;
  vec2 p = vec2((vUv.x - 0.5) * asp, vUv.y);
  float b = clamp(abs(uVel) * 0.0035, 0.0, 0.012);
  vec4 w = texture(uTex, vUv);
  vec4 st = vec4(0.0);
  if (uStoryOn > 0.5) st = texture(uStory, vUv);
  if (b > 0.0006) {
    w = w * 0.4 + texture(uTex, vUv + vec2(0.0, b)) * 0.3 + texture(uTex, vUv - vec2(0.0, b)) * 0.3;
    if (uStoryOn > 0.5) st = st * 0.4 + texture(uStory, vUv + vec2(0.0, b)) * 0.3 + texture(uStory, vUv - vec2(0.0, b)) * 0.3;
  }
  vec3 c = w.rgb;
  if (uStarVis > 0.001) c += starField(p) * w.a * uStarVis;
  // the story layer: figures in front of the sky and the stars, glows added on top
  c = c * (1.0 - st.a) + st.rgb;
  // the sky catches the top edge of every figure: a thin rim of the light above it gives a silhouette its form
  if (st.a > 0.02) {
    float py = 1.0 / uRes.y;
    float above = texture(uStory, vUv + vec2(0.0, 1.6 * py)).a;
    float rim = clamp(st.a - above, 0.0, 1.0);
    vec3 sky = texture(uTex, vUv + vec2(0.0, 4.0 * py)).rgb;
    c = mix(c, max(c, sky * 0.92), rim * 0.55);
  }
  if (uWindow > 0.001) c = windowFrame(p - vec2(0.0, uSill), c, asp);
  vec2 vq = vUv - 0.5;
  c *= 1.0 - 0.42 * dot(vq * vec2(0.9, 1.1), vq * vec2(0.9, 1.1));
  float g = hash12(gl_FragCoord.xy + fract(uTime * 7.3) * 91.7) - 0.5;
  c += g * uGrain;
  fragColor = vec4(c, 1.0);
}`;

/* ---------------- particles: each cat materialises from the weather ---------------- */

export const POINTS_VS = /* glsl */ `#version 300 es
precision highp float;

layout(location = 0) in vec2 aUv;
layout(location = 1) in vec3 aCol;
layout(location = 2) in float aSeed;

uniform vec2 uCanvas;
uniform vec4 uRect;
uniform float uProg;
uniform float uDiss;
uniform float uTime;
uniform float uMode;
uniform float uSize;
uniform float uPhoto;
uniform float uFade;

out vec3 vCol;
out float vA;
out float vOpaque;

float h1(float x) { return fract(sin(x * 127.1) * 43758.5453); }

void main() {
  float s = aSeed;
  vec2 target = uRect.xy + aUv * uRect.zw;
  float span = max(uRect.z, uRect.w);
  int mode = int(uMode + 0.5);

  float order;
  if (mode == 0) order = aUv.y;
  else if (mode == 3) order = 1.0 - aUv.y;
  else if (mode == 5) order = 1.0 - aUv.x;
  else if (mode == 1) order = aUv.x;
  else order = h1(s * 91.7);
  float delay = order * 0.42 + s * 0.28;
  float t = clamp((uProg - delay) / 0.3, 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);

  float a1 = h1(s * 13.1), a2 = h1(s * 7.7), a3 = h1(s * 3.3);
  vec2 src;
  if (mode == 0) src = vec2(target.x + (a1 - 0.5) * span * 0.9, uRect.y - span * (0.25 + a2 * 0.9));
  else if (mode == 1) src = vec2(uRect.x - span * (0.4 + a1 * 0.9), target.y + (a2 - 0.5) * span * 0.6);
  else if (mode == 2) src = vec2(target.x + (a1 < 0.5 ? -1.0 : 1.0) * span * (0.7 + a2 * 0.8), target.y + (a3 - 0.5) * span * 0.3);
  else if (mode == 3) src = vec2(target.x + (a1 - 0.5) * span * 0.7, uRect.y + uRect.w + span * (0.15 + a2 * 0.7));
  else if (mode == 4) {
    float ang = a1 * 6.2831 + uTime * (0.25 + a2 * 0.4);
    src = target + vec2(cos(ang), sin(ang)) * span * (0.45 + a3 * 0.6);
  } else src = vec2(uRect.x + uRect.z + span * (0.3 + a1 * 0.9), target.y + (a2 - 0.5) * span * 0.25);

  vec2 swirl = vec2(sin(uTime * 1.3 + s * 40.0), cos(uTime * 1.1 + s * 31.0)) * span * 0.035 * (1.0 - t);
  vec2 pos = mix(src, target, t) + swirl;

  float d = clamp((uDiss - s * 0.35 - order * 0.25) / 0.4, 0.0, 1.0);
  d = d * d;
  vec2 exitDir;
  if (mode == 0) exitDir = vec2(0.35 + (a1 - 0.5) * 0.6, 1.1);
  else if (mode == 1) exitDir = vec2(1.4, (a2 - 0.5) * 0.4);
  else if (mode == 2) exitDir = vec2(a1 < 0.5 ? -1.2 : 1.2, -0.1);
  else if (mode == 3) exitDir = vec2((a1 - 0.5) * 0.5, -1.2);
  else if (mode == 4) exitDir = vec2((a1 - 0.5) * 1.6, -0.9 - a2);
  else exitDir = vec2(-1.5, (a2 - 0.5) * 0.3);
  pos += exitDir * d * span * (0.6 + a3 * 0.6) + vec2(sin(uTime + s * 20.0), cos(uTime * 0.8 + s * 17.0)) * span * 0.03 * d;

  vec2 clip = (pos / uCanvas) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);

  float glow = 1.0 - t;
  gl_PointSize = uSize * (1.0 + glow * 1.4 + d * 0.8);
  vCol = aCol * (1.0 + glow * 0.6) + glow * 0.08;
  vA = smoothstep(0.0, 0.25, uProg - delay) * (1.0 - d) * (1.0 - uPhoto * 0.85);
  vA *= mix(1.0, smoothstep(0.0, 0.14, 1.0 - aUv.y), uFade);
  vOpaque = t * (1.0 - d);
}`;

export const POINTS_FS = /* glsl */ `#version 300 es
precision highp float;
in vec3 vCol;
in float vA;
in float vOpaque;
out vec4 fragColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  float m = smoothstep(0.5, 0.18, r);
  float a = m * vA;
  if (a < 0.003) discard;
  fragColor = vec4(vCol * a, a * vOpaque * 0.92);
}`;


/* ---------------- story: figures in the landscape ---------------- */

/*
 * Every figure is a handful of signed-distance primitives (ellipses, tapered
 * capsules, triangles, rings, glows), one instanced quad each. A figure takes
 * its colour from the ground it stands on (the world pass, sampled just under
 * its feet), so a herd on a far ridge carries that ridge's haze and light, and
 * it is hidden wherever a nearer ridge rises in front of it.
 */
export const STORY_VS = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 iA;
layout(location = 2) in vec4 iB;
layout(location = 3) in vec4 iC;
layout(location = 4) in vec4 iD;
layout(location = 5) in vec4 iE;
uniform vec2 uCss;
out vec2 vPos;
flat out vec4 vA;
flat out vec4 vB;
flat out vec4 vC;
flat out vec4 vD;
flat out vec4 vE;
void main() {
  int type = int(iC.x + 0.5);
  vec2 lo, hi;
  if (type == 0) {
    float r = max(iA.z, iA.w);
    lo = iA.xy - r; hi = iA.xy + r;
  } else if (type == 1 || type == 5) {
    float r = max(iB.x, iB.y);
    lo = min(iA.xy, iA.zw) - r; hi = max(iA.xy, iA.zw) + r;
  } else if (type == 2) {
    lo = min(min(iA.xy, iA.zw), iB.xy) - iE.w; hi = max(max(iA.xy, iA.zw), iB.xy) + iE.w;
  } else if (type == 3) {
    lo = iA.xy - iA.z; hi = iA.xy + iA.z;
  } else {
    lo = iA.xy - iA.z - iA.w; hi = iA.xy + iA.z + iA.w;
  }
  lo -= 2.0;
  hi += 2.0;
  vec2 pos = mix(lo, hi, aCorner);
  vPos = pos;
  vA = iA; vB = iB; vC = iC; vD = iD; vE = iE;
  gl_Position = vec4(pos.x / uCss.x * 2.0 - 1.0, 1.0 - pos.y / uCss.y * 2.0, 0.0, 1.0);
}`;

export const STORY_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vPos;
flat in vec4 vA;
flat in vec4 vB;
flat in vec4 vC;
flat in vec4 vD;
flat in vec4 vE;
out vec4 fragColor;

uniform sampler2D uWorld;
uniform vec2 uCss;
uniform float uDpr;
uniform float uAlt;
uniform float uDrift;
uniform vec4 uP[11];
/** the text block beside the cat, CSS px (x, y, w, h); figures fade beneath it */
uniform vec4 uMask;
/** this group's opacity: scales colour only; alpha stays coverage (see the renderer's blend) */
uniform float uGroup;

${PARAM_DEFS}
${CARD_CONSTS}
float gYh;
${COMMON}
${GNOISE}
${TERRAIN}

float nearerCrest(int i, float px) {
  float y = -1.0;
  for (int j = 6; j > 0; j--) {
    if (j <= i) break;
    float xn = layerX(j, px);
    y = max(y, crestY(j, xn, shapeFull(j, xn, j < 2 ? 5 : 6)));
  }
  return y;
}

float sdEllipse(vec2 p, vec2 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / max(k1, 1e-5);
}

float cro(vec2 a, vec2 b) { return a.x * b.y - a.y * b.x; }

float sdCapsule(vec2 p, vec2 pa, vec2 pb, float ra, float rb) {
  p -= pa;
  pb -= pa;
  float h = dot(pb, pb);
  if (h < 1e-4) return length(p) - max(ra, rb);
  vec2 q = vec2(dot(p, vec2(pb.y, -pb.x)), dot(p, pb)) / h;
  q.x = abs(q.x);
  float b = ra - rb;
  vec2 c = vec2(sqrt(max(h - b * b, 1e-6)), b);
  float k = cro(c, q);
  float m = dot(c, q);
  float n = dot(q, q);
  if (k < 0.0) return sqrt(h * n) - ra;
  if (k > c.x) return sqrt(h * (n + 1.0 - 2.0 * q.y)) - rb;
  return m - ra;
}

float sdTriangle(vec2 p, vec2 p0, vec2 p1, vec2 p2) {
  vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2;
  vec2 v0 = p - p0, v1 = p - p1, v2 = p - p2;
  vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / max(dot(e0, e0), 1e-6), 0.0, 1.0);
  vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / max(dot(e1, e1), 1e-6), 0.0, 1.0);
  vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / max(dot(e2, e2), 1e-6), 0.0, 1.0);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)),
                   vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))),
                   vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}

void main() {
  int type = int(vC.x + 0.5);
  int mode = int(vC.y + 0.5);
  vec2 p = vPos;
  float aa = 1.0 / uDpr;
  float cov = 0.0;
  float glow = 0.0;
  float sd = 1e3;
  if (type == 0) {
    vec2 q = p - vA.xy;
    float c = cos(vB.x), s = sin(vB.x);
    q = vec2(c * q.x + s * q.y, -s * q.x + c * q.y);
    sd = sdEllipse(q, max(vA.zw, vec2(0.05)));
    cov = clamp(0.5 - sd / aa, 0.0, 1.0);
  } else if (type == 1) {
    sd = sdCapsule(p, vA.xy, vA.zw, vB.x, vB.y);
    cov = clamp(0.5 - sd / aa, 0.0, 1.0);
  } else if (type == 2) {
    sd = sdTriangle(p, vA.xy, vA.zw, vB.xy) - vE.w;
    cov = clamp(0.5 - sd / aa, 0.0, 1.0);
  } else if (type == 3) {
    float r = length(p - vA.xy);
    float core = max(vA.w, 0.3);
    glow = exp(-r * r / (core * core)) + 0.35 * exp(-r * r / (vA.z * vA.z * 0.18));
    glow *= 1.0 - smoothstep(vA.z * 0.8, vA.z, r);
  } else if (type == 4) {
    cov = clamp(0.5 - (abs(length((p - vA.xy) * vec2(1.0, vB.x)) - vA.z) - vA.w) / aa, 0.0, 1.0);
  } else {
    // light beam: a soft cone fading along its length
    vec2 ab = vA.zw - vA.xy;
    float t = clamp(dot(p - vA.xy, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
    float d = sdCapsule(p, vA.xy, vA.zw, vB.x, vB.y);
    glow = smoothstep(max(vB.y, 1.0) * 0.6, -max(vB.y, 1.0) * 0.4, d) * pow(1.0 - t, 1.6);
  }
  if (cov <= 0.0 && glow <= 0.0) discard;

  // never compete with the words: fade under the text block
  if (uMask.z > 0.0) {
    vec2 d = max(uMask.xy - 12.0 - p, p - (uMask.xy + uMask.zw + 12.0));
    float m = 1.0 - 0.88 * smoothstep(10.0, -10.0, max(d.x, d.y));
    cov *= m;
    glow *= m;
  }

  // hidden behind any nearer ridge
  if (vD.z > -0.5 && vD.z < 5.5) {
    gYh = PITCH - sqrt(max(uAlt, 0.0) * 2.0 / 6.371e6) * 0.7;
    float px = (p.x - uCss.x * 0.5) / uCss.y;
    float py = 1.0 - p.y / uCss.y;
    float ny = nearerCrest(int(vD.z + 0.5), px);
    float e = 0.8 / uCss.y;
    float vis = smoothstep(ny - e, ny + e, py);
    cov *= vis;
    glow *= vis;
    if (cov <= 0.0 && glow <= 0.0) discard;
  }

  if (glow > 0.0) {
    fragColor = vec4(vE.rgb * glow * vC.z * vC.w * uGroup, 0.0);
    return;
  }
  if (mode == 2) {
    float a = cov * vC.w;
    fragColor = vec4(vE.rgb * vC.z * a * uGroup, a);
    return;
  }
  vec2 uv = mode == 1 ? vec2(p.x / uCss.x, 1.0 - p.y / uCss.y) : vec2(vD.x / uCss.x, 1.0 - (vD.y + 3.0) / uCss.y);
  vec3 w = texture(uWorld, clamp(uv, 0.001, 0.999)).rgb;
  vec3 col = w * vC.z;
  if (vD.w > 0.0) col = mix(col, vE.rgb * (dot(w, vec3(0.299, 0.587, 0.114)) * 1.4 + 0.02), vD.w);
  // a figure on the ground reads as a figure: never lighter than what is behind it
  vec3 back = texture(uWorld, vec2(p.x / uCss.x, 1.0 - p.y / uCss.y)).rgb;
  if (mode == 0 && vC.z < 1.0) col = min(col, back * 0.9);

  float a = cov * vC.w;
  fragColor = vec4(col * a * uGroup, a);
}`;
