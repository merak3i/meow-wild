import type { Rig } from "@/lib/rigs";
import type { CatLight } from "./light";

/**
 * Living photographs.
 *
 * Each cutout is drawn as a warped quad on its own overlay canvas. The warp is a
 * stack of smooth, invertible local transforms evaluated per pixel (backward
 * mapping), driven by a small hand-placed rig per species: breathing, blinks,
 * ear flicks, a head that turns toward the reader, and a tail that sways with a
 * travelling wave and springs when you scroll fast. A depth map from Depth
 * Anything V2 gives parallax and normals, so the photograph can be relit by the
 * sun, sky and lamp of the altitude it stands in.
 */

export interface LiveCat {
  id: string;
  /** image box in CSS px, viewport space */
  rect: [number, number, number, number];
  opacity: number;
  /** bottom fade like the photograph's CSS mask */
  fade: number;
  /** 0: in the wild (cool drop shadow), 1: on the windowsill (lamp glow) */
  sill: number;
  /** something in its landscape it is watching (CSS px), from the story layer */
  focus?: [number, number] | null;
  /** 0..1 how hard it attends: ears forward, tail tip twitching, breath held */
  alert?: number;
  /** 0..1 loudness of its own voice right now: chest and head move with the sound */
  voice?: number;
}

export interface LiveFrame {
  time: number;
  dt: number;
  /** pointer in CSS px, or null when there is none (touch, or left the window) */
  pointer: [number, number] | null;
  /** smoothed scroll velocity, viewport heights per second */
  vel: number;
  /** freeze all motion (prefers-reduced-motion) */
  still: boolean;
  light: CatLight;
  /** the reader has been still for this long, seconds */
  idle: number;
  cats: LiveCat[];
}

const VS = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec2 aCorner;
uniform vec4 uRect;
uniform vec2 uCanvas;
uniform vec2 uMargin;
out vec2 vPos;
void main() {
  vec2 uv = mix(-uMargin, 1.0 + uMargin, aCorner);
  vec2 px = uRect.xy + uv * uRect.zw;
  vPos = uv;
  gl_Position = vec4(px.x / uCanvas.x * 2.0 - 1.0, 1.0 - px.y / uCanvas.y * 2.0, 0.0, 1.0);
}`;

const FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vPos;
out vec4 fragColor;

uniform sampler2D uTex;
uniform sampler2D uAux;
uniform float uHasAux;
uniform float uAsp;
uniform float uOpacity;
uniform float uFade;
uniform float uSill;
uniform float uTime;
uniform vec4 uShadow;

uniform vec4 uBreath;
uniform vec2 uBreathK;
uniform vec4 uHead;
uniform vec2 uHeadK;
uniform vec2 uHeadShift;
uniform vec4 uEyeA;
uniform vec4 uEyeB;
uniform float uBlink;
uniform vec4 uEarA;
uniform vec4 uEarB;
uniform vec2 uEarW;
uniform vec2 uEarRot;
uniform vec2 uTailP[8];
uniform vec2 uTailN[8];
uniform float uTailD[8];
uniform int uTailCount;
uniform float uTailW;
uniform vec3 uSway;
uniform vec2 uParallax;

uniform vec3 uLightDir;
uniform vec3 uSunCol;
uniform vec3 uAmb;
uniform vec3 uGrade;
uniform float uExposure;
uniform float uRelight;
uniform float uRim;
uniform vec4 uHaze;
uniform float uLamp;

vec2 A(vec2 p) { return vec2(p.x * uAsp, p.y); }
vec2 U(vec2 a) { return vec2(a.x / uAsp, a.y); }
vec2 rot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

vec2 unSway(vec2 a) {
  if (abs(uSway.z) < 1e-5) return a;
  vec2 pv = A(uSway.xy);
  return pv + rot(a - pv, -uSway.z);
}

vec2 unParallax(vec2 a) {
  if (uHasAux < 0.5) return a;
  float d0 = texture(uAux, U(a)).b;
  vec2 a1 = a - uParallax * (d0 - 0.5);
  float d1 = texture(uAux, U(a1)).b;
  return a - uParallax * (d1 - 0.5);
}

vec2 unTail(vec2 a) {
  if (uTailCount < 2) return a;
  float best = 1e9, bd = 0.0;
  vec2 bn = vec2(0.0);
  for (int i = 0; i < 7; i++) {
    if (i >= uTailCount - 1) break;
    vec2 p0 = A(uTailP[i]);
    vec2 p1 = A(uTailP[i + 1]);
    vec2 e = p1 - p0;
    float t = clamp(dot(a - p0, e) / max(dot(e, e), 1e-8), 0.0, 1.0);
    float d = length(a - (p0 + e * t));
    if (d < best) {
      best = d;
      bn = normalize(mix(uTailN[i], uTailN[i + 1], t));
      bd = mix(uTailD[i], uTailD[i + 1], t);
    }
  }
  float w = 1.0 - smoothstep(uTailW, uTailW * 1.45, best);
  return a - bn * bd * w;
}

vec2 unEar(vec2 a, vec4 ear, float w, float ang) {
  if (w <= 0.0 || abs(ang) < 1e-5) return a;
  vec2 b = A(ear.xy);
  vec2 t = A(ear.zw);
  vec2 e = t - b;
  float u = dot(a - b, e) / max(dot(e, e), 1e-8);
  float d = length(a - (b + e * clamp(u, 0.0, 1.0)));
  float wt = (1.0 - smoothstep(w, w * 1.9, d)) * smoothstep(-0.08, 0.5, u) * (1.0 - smoothstep(1.25, 1.6, u));
  return b + rot(a - b, -ang * wt);
}

vec2 unHead(vec2 a) {
  if (uHeadK.x <= 0.0) return a;
  vec2 pv = A(uHead.xy);
  vec2 c = A(uHead.zw);
  float wt = 1.0 - smoothstep(uHeadK.x * 0.8, uHeadK.x * 1.65, length(a - c));
  vec2 q = a - uHeadShift * wt;
  return pv + rot(q - pv, -uHeadK.y * wt);
}

vec2 unBreath(vec2 a) {
  if (uBreath.z <= 0.0) return a;
  vec2 c = A(uBreath.xy);
  vec2 v = (a - c) / uBreath.zw;
  float wt = 1.0 - smoothstep(0.5, 1.15, length(v));
  return c + (a - c) / (1.0 + uBreathK * wt);
}

vec2 lid(vec2 a, vec4 eye, inout float line) {
  if (eye.z <= 0.0 || uBlink <= 0.002) return a;
  vec2 c = A(eye.xy);
  vec2 v = (a - c) / eye.zw;
  float inside = 1.0 - smoothstep(0.85, 1.2, length(vec2(v.x, v.y * 0.8)));
  if (inside <= 0.0) return a;
  float L = -1.05 + 2.1 * uBlink;
  if (v.y < L) a.y -= (L + 1.05) * eye.w * inside;
  line = max(line, inside * exp(-pow((v.y - L) / 0.16, 2.0)) * smoothstep(0.08, 0.35, uBlink));
  return a;
}

vec4 tex(vec2 uv) {
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
  return texture(uTex, uv);
}

void main() {
  vec2 a = vec2(vPos.x * uAsp, vPos.y);
  a = unSway(a);
  a = unParallax(a);
  a = unTail(a);
  a = unEar(a, uEarA, uEarW.x, uEarRot.x);
  a = unEar(a, uEarB, uEarW.y, uEarRot.y);
  a = unHead(a);
  a = unBreath(a);
  float line = 0.0;
  a = lid(a, uEyeA, line);
  a = lid(a, uEyeB, line);
  vec2 uv = U(a);
  vec4 c = tex(uv);

  // relight: depth normals for form, blurred alpha for the rounded rim
  if (c.a > 0.003) {
    vec3 rgb = c.rgb / c.a;
    vec3 n = vec3(0.0, 0.0, 1.0);
    if (uHasAux > 0.5) {
      vec2 nx = texture(uAux, uv).rg * 2.0 - 1.0;
      n = normalize(vec3(nx, sqrt(max(0.05, 1.0 - dot(nx, nx)))));
    }
    vec3 L = normalize(uLightDir);
    float lam = max(dot(n, L), 0.0);
    vec3 lit = uAmb * 0.9 + uSunCol * lam * 1.15;
    float l0 = dot(lit, vec3(0.299, 0.587, 0.114));
    vec3 shade = mix(vec3(1.0), lit / max(l0, 0.05) * mix(0.82, 1.12, lam), uRelight);
    rgb *= shade * uGrade * uExposure;
    float rim = pow(1.0 - n.z, 2.2) * max(dot(normalize(n.xy + 1e-4), normalize(L.xy + 1e-4)), 0.0);
    rgb += uSunCol * rim * uRim * 0.55;
    // lamp from the left for the windowsill cat
    rgb += vec3(1.0, 0.62, 0.32) * uLamp * uSill * max(dot(n, normalize(vec3(-0.85, 0.15, 0.5))), 0.0) * 0.22;
    rgb *= 1.0 - 0.55 * line;
    rgb = mix(rgb, uHaze.rgb, uHaze.a);
    rgb += (hash(gl_FragCoord.xy + fract(uTime * 7.31) * 93.1) - 0.5) * 0.035;
    c = vec4(max(rgb, 0.0) * c.a, c.a);
  }

  // bottom fade in screen space, like the photograph's mask
  float fade = mix(1.0, smoothstep(0.0, 0.13, 1.0 - vPos.y), uFade);
  c *= fade;

  // soft drop shadow: an offset alpha read from a high mip level, which is a cheap blur
  // past the photograph's edge the blurred alpha would smear outward and end in a hard-edged box at the
  // quad, so it fades out within the margin instead
  float sa = 0.0;
  if (uShadow.w > 0.0) {
    vec2 sp = vPos - vec2(uShadow.x / uAsp, uShadow.y);
    vec2 sq = clamp(sp, 0.0, 1.0);
    float past = max(abs(sp.x - sq.x), abs(sp.y - sq.y));
    sa = textureLod(uTex, sq, uShadow.z).a * (1.0 - smoothstep(0.0, 0.045, past));
    sa *= uShadow.w * fade;
  }
  vec4 o = c + vec4(0.015, 0.02, 0.03, 1.0) * sa * (1.0 - c.a);
  fragColor = o * uOpacity;
}`;

type U = Record<string, WebGLUniformLocation | null>;

const UNIFORMS = [
  "uRect", "uCanvas", "uMargin", "uTex", "uAux", "uHasAux", "uAsp", "uOpacity", "uFade", "uSill", "uTime", "uShadow",
  "uBreath", "uBreathK", "uHead", "uHeadK", "uHeadShift", "uEyeA", "uEyeB", "uBlink", "uEarA", "uEarB", "uEarW", "uEarRot",
  "uTailP", "uTailN", "uTailD", "uTailCount", "uTailW", "uSway", "uParallax",
  "uLightDir", "uSunCol", "uAmb", "uGrade", "uExposure", "uRelight", "uRim", "uHaze", "uLamp",
];

interface Spring {
  x: number;
  v: number;
}

/** critically damped spring step toward a target */
function spring(s: Spring, target: number, freq: number, dt: number) {
  const w = Math.PI * 2 * freq;
  const f = 1 + 2 * dt * w;
  const oo = w * w;
  const hoo = dt * oo;
  const hhoo = dt * hoo;
  const detInv = 1 / (f + hhoo);
  const x = (f * s.x + dt * s.v + hhoo * target) * detInv;
  const v = (s.v + hoo * (target - s.x)) * detInv;
  s.x = x;
  s.v = v;
}

interface CatGL {
  tex: WebGLTexture;
  aux: WebGLTexture | null;
  w: number;
  h: number;
  rig: Rig;
  img: TexImageSource;
  auxImg: TexImageSource | null;
}

interface CatMind {
  seed: number;
  breath: number;
  blink: number;
  blinkAt: number;
  blinkLen: number;
  slow: boolean;
  doubleNext: boolean;
  earAt: [number, number];
  earT: [number, number];
  earDir: [number, number];
  ear: [Spring, Spring];
  look: Spring;
  lookY: Spring;
  glanceAt: number;
  glance: number;
  tailKick: Spring;
  sway: Spring;
  parX: Spring;
  parY: Spring;
  att: Spring;
  voice: Spring;
  last: number;
}

let SEED = 7;
const rand = () => {
  SEED = (SEED * 16807) % 2147483647;
  return (SEED - 1) / 2147483646;
};

export class LivingLayer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private prog!: WebGLProgram;
  private u: U = {};
  private vao!: WebGLVertexArrayObject;
  private cats = new Map<string, CatGL>();
  private minds = new Map<string, CatMind>();
  private dpr = 1;
  private cssW = 1;
  private cssH = 1;
  private readonly maxDpr: number;
  private tailN = new Float32Array(16);
  private tailP = new Float32Array(16);
  private tailD = new Float32Array(8);
  lost = false;
  /** exaggerates every motion, for checking rigs by eye (?rig=4) */
  boost = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    if (!gl) throw new Error("webgl2 unavailable");
    this.gl = gl;
    const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
    this.maxDpr = coarse ? 1.75 : 2;
    this.init();
    canvas.addEventListener("webglcontextlost", this.onLost, false);
    canvas.addEventListener("webglcontextrestored", this.onRestored, false);
  }

  private onLost = (e: Event) => {
    e.preventDefault();
    this.lost = true;
  };

  private onRestored = () => {
    this.lost = false;
    const old = [...this.cats.entries()];
    this.cats.clear();
    this.init();
    this.resize(this.cssW, this.cssH, this.dpr);
    for (const [id, c] of old) this.setCat(id, c.img, c.auxImg, c.rig, c.w, c.h);
  };

  private init() {
    const gl = this.gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`living shader: ${gl.getShaderInfoLog(s)}`);
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`living link: ${gl.getProgramInfoLog(p)}`);
    this.prog = p;
    this.u = {};
    for (const n of UNIFORMS) this.u[n] = gl.getUniformLocation(p, n);
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const b = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  resize(cssW: number, cssH: number, dpr: number) {
    this.cssW = Math.max(1, cssW);
    this.cssH = Math.max(1, cssH);
    this.dpr = Math.min(Math.max(1, dpr), this.maxDpr);
    const w = Math.round(this.cssW * this.dpr);
    const h = Math.round(this.cssH * this.dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  has(id: string) {
    return this.cats.has(id);
  }

  setCat(id: string, img: TexImageSource, auxImg: TexImageSource | null, rig: Rig, w: number, h: number) {
    if (this.lost) return;
    const gl = this.gl;
    const old = this.cats.get(id);
    if (old) {
      gl.deleteTexture(old.tex);
      if (old.aux) gl.deleteTexture(old.aux);
    }
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    let aux: WebGLTexture | null = null;
    if (auxImg) {
      aux = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, aux);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, auxImg);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL);
    this.cats.set(id, { tex, aux, w, h, rig, img, auxImg });
  }

  private mind(id: string, now: number): CatMind {
    let m = this.minds.get(id);
    if (!m) {
      const sp = (): Spring => ({ x: 0, v: 0 });
      m = {
        seed: rand() * 100,
        breath: rand() * Math.PI * 2,
        blink: 0,
        blinkAt: now + 1.2 + rand() * 3,
        blinkLen: 0.2,
        slow: false,
        doubleNext: false,
        earAt: [now + 2 + rand() * 6, now + 4 + rand() * 8],
        earT: [-1, -1],
        earDir: [1, -1],
        ear: [sp(), sp()],
        look: sp(),
        lookY: sp(),
        glanceAt: now + 2 + rand() * 3,
        glance: 0,
        tailKick: sp(),
        sway: sp(),
        parX: sp(),
        parY: sp(),
        att: sp(),
        voice: sp(),
        last: now,
      };
      this.minds.set(id, m);
    }
    return m;
  }

  render(f: LiveFrame) {
    if (this.lost) return;
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const live = f.cats.filter((c) => c.opacity > 0.002 && this.cats.has(c.id));
    if (!live.length) return;
    gl.useProgram(this.prog);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const u = this.u;
    const d = this.dpr;
    gl.uniform2f(u.uCanvas, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.uTime, f.time);
    const L = f.light;
    gl.uniform3f(u.uSunCol, L.sun[0], L.sun[1], L.sun[2]);
    gl.uniform3f(u.uAmb, L.amb[0], L.amb[1], L.amb[2]);
    gl.uniform3f(u.uGrade, L.grade[0], L.grade[1], L.grade[2]);
    gl.uniform1f(u.uExposure, L.exposure);
    gl.uniform1f(u.uRelight, L.relight);
    gl.uniform1f(u.uRim, L.rim);
    gl.uniform4f(u.uHaze, L.haze[0], L.haze[1], L.haze[2], L.haze[3]);
    gl.uniform1f(u.uLamp, L.lamp);
    gl.uniform1i(u.uTex, 0);
    gl.uniform1i(u.uAux, 1);

    const t = f.time;
    const dt = Math.min(0.1, Math.max(0.001, f.dt));
    for (const c of live) {
      const cat = this.cats.get(c.id)!;
      const rig = cat.rig;
      const m = this.mind(c.id, t);
      const [x, y, w, h] = c.rect;
      const asp = cat.w / cat.h;
      const still = f.still;
      const sill = c.sill > 0.5;

      // ---- behaviour ----
      spring(m.att, still ? 0 : c.alert ?? 0, 0.8, dt);
      spring(m.voice, still ? 0 : c.voice ?? 0, 3.2, dt);
      const att = Math.max(0, Math.min(1, m.att.x));
      const vo = Math.max(0, Math.min(1, m.voice.x));
      // breathing: quicker for small cats, a soft asymmetric curve (in-breath shorter);
      // shallower while it stalks, deeper while it calls or purrs
      const rate = (rig.breathRate ?? 0.28) * (1 - att * 0.45);
      if (!still) m.breath += dt * rate * Math.PI * 2;
      const ph = (Math.sin(m.breath) + 1) / 2;
      const b = still ? 0 : Math.pow(ph, 1.6) * (1 - att * 0.4) + vo * 0.9;
      const ba = rig.breathAmp ?? [0.006, 0.016];

      // blinks: random, sometimes doubled; the house cat slow-blinks at a reader who stays
      if (!still && rig.eyes?.length) {
        if (t >= m.blinkAt && m.blink === 0) {
          m.slow = sill && f.idle > 3.5 && rand() < 0.6;
          m.blinkLen = m.slow ? 1.5 : 0.16 + rand() * 0.06;
          m.blink = 0.0001;
          m.blinkAt = t;
        }
        if (m.blink > 0) {
          const k = (t - m.blinkAt) / m.blinkLen;
          if (k >= 1) {
            m.blink = 0;
            const again = !m.slow && rand() < 0.16;
            m.blinkAt = t + (again ? 0.14 : ((sill ? 2.4 : 2.8) + rand() * 4.5) / this.boost);
          } else {
            const close = m.slow ? 0.35 : 0.38;
            const hold = m.slow ? 0.3 : 0.12;
            m.blink = k < close ? Math.sin((k / close) * Math.PI / 2) : k < close + hold ? 1 : Math.cos(((k - close - hold) / (1 - close - hold)) * Math.PI / 2);
            m.blink = Math.max(0.0001, m.blink);
          }
        }
      }

      // ears: idle flicks, and they fold back a little when you scroll hard past
      const earRot: [number, number] = [0, 0];
      if (rig.ears?.length && !still) {
        for (let k = 0; k < 2; k++) {
          if (t >= m.earAt[k]) {
            m.earT[k] = t;
            m.earDir[k] = rand() < 0.5 ? 1 : -1;
            m.earAt[k] = t + ((rig.earRate ? 1 / rig.earRate : 7) * (0.5 + rand())) / this.boost;
          }
          let target = 0;
          if (m.earT[k] >= 0) {
            const e = (t - m.earT[k]) / 0.32;
            if (e < 1) target = Math.sin(e * Math.PI) * (0.2 + 0.08 * rand()) * m.earDir[k] * (rig.earFlick ?? 1);
            else m.earT[k] = -1;
          }
          target += -Math.min(0.22, Math.abs(f.vel) * 0.07) * (k === 0 ? 1 : -1) * (rig.earBack ?? 1);
          target += att * 0.09 * (k === 0 ? 1 : -1) * (rig.earBack ?? 1);
          spring(m.ear[k], target, 4.2, dt);
          earRot[k] = m.ear[k].x;
        }
      }

      // head: turns toward the pointer, otherwise glances about now and then
      let lookX = 0;
      let lookY = 0;
      if (rig.head && !still) {
        const hc = rig.head.center;
        const hx = x + hc[0] * w;
        const hy = y + hc[1] * h;
        if (f.pointer) {
          const dx = (f.pointer[0] - hx) / Math.max(320, w);
          const dy = (f.pointer[1] - hy) / Math.max(320, h);
          lookX = Math.max(-1, Math.min(1, dx));
          lookY = Math.max(-1, Math.min(1, dy));
        } else {
          if (t >= m.glanceAt) {
            m.glance = (rand() * 2 - 1) * 0.8;
            m.glanceAt = t + 2.5 + rand() * 4;
          }
          lookX = m.glance;
        }
        // something moving in its landscape draws its eye away from the reader
        if (c.focus && att > 0.01) {
          const fx = Math.max(-1, Math.min(1, (c.focus[0] - hx) / Math.max(320, w)));
          const fy = Math.max(-1, Math.min(1, (c.focus[1] - hy) / Math.max(320, h)));
          const k2 = Math.min(1, att * (f.pointer ? 0.85 : 1.1));
          lookX += (fx - lookX) * k2;
          lookY += (fy - lookY) * k2;
        }
      }
      spring(m.look, lookX, 0.55, dt);
      spring(m.lookY, lookY, 0.55, dt);

      // tail: a travelling wave, plus a spring that kicks when the page moves fast
      spring(m.tailKick, Math.max(-1, Math.min(1, f.vel * 0.6)), 1.1, dt);
      spring(m.sway, still ? 0 : Math.max(-1, Math.min(1, -f.vel * 0.35)), 0.9, dt);

      // parallax: pointer across the photo, and a lift from scroll speed
      let px = 0;
      let py = 0;
      if (f.pointer && !still) {
        px = Math.max(-1, Math.min(1, (f.pointer[0] - (x + w / 2)) / (this.cssW * 0.5)));
        py = Math.max(-1, Math.min(1, (f.pointer[1] - (y + h / 2)) / (this.cssH * 0.5)));
      }
      spring(m.parX, px, 0.7, dt);
      spring(m.parY, py + (still ? 0 : Math.max(-1, Math.min(1, f.vel * 0.25))), 0.7, dt);

      // ---- uniforms ----
      const mg = rig.margin ?? 0.06;
      gl.uniform4f(u.uRect, x * d, y * d, w * d, h * d);
      gl.uniform2f(u.uMargin, mg, mg);
      gl.uniform1f(u.uAsp, asp);
      gl.uniform1f(u.uOpacity, c.opacity);
      gl.uniform1f(u.uFade, c.fade);
      gl.uniform1f(u.uSill, c.sill);
      // CSS drop-shadow(0 18px 26px) in the wild, a tighter one on the sill
      const offPx = sill ? 6 : 18;
      const blurPx = sill ? 10 : 26;
      const lod = Math.log2(Math.max(1, (blurPx * cat.h) / Math.max(1, h) * 0.6));
      gl.uniform4f(u.uShadow, 0, offPx / Math.max(1, h), lod, sill ? 0.5 : 0.3);

      gl.uniform4f(u.uBreath, rig.breath[0], rig.breath[1], rig.breath[2], rig.breath[3]);
      gl.uniform2f(u.uBreathK, ba[0] * b * this.boost, ba[1] * b * this.boost);

      if (rig.head) {
        const hd = rig.head;
        const maxA = (((hd.look ?? 5) * Math.PI) / 180) * this.boost;
        const nod = still ? 0 : Math.sin(m.breath + 0.6) * 0.0016;
        gl.uniform4f(u.uHead, hd.pivot[0], hd.pivot[1], hd.center[0], hd.center[1]);
        gl.uniform2f(u.uHeadK, hd.r, -m.look.x * maxA * (hd.flip ? -1 : 1) + m.lookY.x * maxA * 0.35 * (hd.facing ?? 1));
        gl.uniform2f(u.uHeadShift, m.look.x * hd.r * 0.05, m.lookY.x * hd.r * 0.035 + nod - vo * hd.r * 0.03 * this.boost);
      } else {
        gl.uniform2f(u.uHeadK, 0, 0);
      }

      const eyes = rig.eyes ?? [];
      const e0 = eyes[0];
      const e1 = eyes[1];
      gl.uniform4f(u.uEyeA, e0 ? e0[0] : 0, e0 ? e0[1] : 0, e0 ? e0[2] : 0, e0 ? e0[3] : 0);
      gl.uniform4f(u.uEyeB, e1 ? e1[0] : 0, e1 ? e1[1] : 0, e1 ? e1[2] : 0, e1 ? e1[3] : 0);
      gl.uniform1f(u.uBlink, still ? 0 : m.blink);

      const ears = rig.ears ?? [];
      const a0 = ears[0];
      const a1 = ears[1];
      gl.uniform4f(u.uEarA, a0 ? a0.base[0] : 0, a0 ? a0.base[1] : 0, a0 ? a0.tip[0] : 0, a0 ? a0.tip[1] : 0);
      gl.uniform4f(u.uEarB, a1 ? a1.base[0] : 0, a1 ? a1.base[1] : 0, a1 ? a1.tip[0] : 0, a1 ? a1.tip[1] : 0);
      gl.uniform2f(u.uEarW, a0 ? a0.w : 0, a1 ? a1.w : 0);
      gl.uniform2f(u.uEarRot, earRot[0] * this.boost, earRot[1] * this.boost);

      const tail = rig.tail;
      if (tail && tail.pts.length >= 2 && !still) {
        const n = Math.min(8, tail.pts.length);
        const amp = tail.amp * this.boost;
        const om = (tail.rate ?? 0.32) * Math.PI * 2 * (1 + att * 1.6);
        for (let i = 0; i < n; i++) {
          const p = tail.pts[i];
          this.tailP[i * 2] = p[0];
          this.tailP[i * 2 + 1] = p[1];
          const pa = tail.pts[Math.max(0, i - 1)];
          const pb = tail.pts[Math.min(n - 1, i + 1)];
          const tx = (pb[0] - pa[0]) * asp;
          const ty = pb[1] - pa[1];
          const tl = Math.hypot(tx, ty) || 1;
          this.tailN[i * 2] = -ty / tl;
          this.tailN[i * 2 + 1] = tx / tl;
          const s = i / (n - 1);
          const env = Math.pow(s, 1.35);
          const wave = Math.sin(t * om - s * 2.4 + m.seed) * 0.75 + Math.sin(t * om * 0.47 + m.seed * 1.7 - s * 1.3) * 0.25;
          const kick = m.tailKick.x * Math.sin(s * 2.0 + 0.4);
          this.tailD[i] = env * amp * (wave + kick * 1.4);
        }
        gl.uniform2fv(u.uTailP, this.tailP);
        gl.uniform2fv(u.uTailN, this.tailN);
        gl.uniform1fv(u.uTailD, this.tailD);
        gl.uniform1i(u.uTailCount, n);
        gl.uniform1f(u.uTailW, tail.w + Math.abs(amp) * 1.6);
      } else {
        gl.uniform1i(u.uTailCount, 0);
      }

      const pv = rig.pivot ?? [0.5, 1];
      gl.uniform3f(u.uSway, pv[0], pv[1], m.sway.x * 0.012 * (rig.sway ?? 1));
      const pk = still || !cat.aux ? 0 : rig.parallax ?? 0.018;
      gl.uniform2f(u.uParallax, m.parX.x * pk, m.parY.x * pk * 0.6);

      // light from the sun's place on screen relative to this cat
      const cx = (x + w / 2 - this.cssW / 2) / this.cssH;
      const lx = L.lamp > 0.5 && sill ? -0.8 : L.sunX - cx;
      const ly = Math.max(-0.2, Math.sin((Math.max(-6, L.elev) * Math.PI) / 180) * 1.4) + 0.12;
      gl.uniform3f(u.uLightDir, lx, ly, 0.55);
      gl.uniform1f(u.uHasAux, cat.aux ? 1 : 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, cat.tex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, cat.aux ?? cat.tex);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      m.last = t;
    }
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }

  dispose() {
    const gl = this.gl;
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onRestored);
    for (const c of this.cats.values()) {
      gl.deleteTexture(c.tex);
      if (c.aux) gl.deleteTexture(c.aux);
    }
    this.cats.clear();
    gl.deleteProgram(this.prog);
  }
}
