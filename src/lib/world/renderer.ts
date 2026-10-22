import { COMPOSITE_FS, FULLSCREEN_VS, POINTS_FS, POINTS_VS, STORY_FS, STORY_VS, WORLD_FS } from "./shaders";

export interface CatDraw {
  id: string;
  /** photo box in CSS px, viewport space: x, y, w, h */
  rect: [number, number, number, number];
  prog: number;
  diss: number;
  mode: number;
  photo: number;
  /** fade the bottom edge like the photograph's mask (0 for the house cat on the sill) */
  fade?: number;
}

export interface Frame {
  time: number;
  alt: number;
  drift: number;
  /** scroll travel in viewport heights */
  travel: number;
  /** smoothed scroll velocity, viewport heights per second */
  vel: number;
  params: Float32Array;
  starVis: number;
  horizon: number;
  window: number;
  /** how far the window room has scrolled up the screen, in viewport heights */
  sill: number;
  lamp: number;
  cats: CatDraw[];
  /**
   * figures in the landscape: STORY_FLOATS floats per primitive (see story/kit.ts), drawn in
   * groups of [first, count, opacity] (one per world); without groups, all at full opacity
   */
  story?: {
    data: Float32Array;
    count: number;
    mask?: [number, number, number, number] | null;
    groups?: readonly (readonly [number, number, number])[];
  };
}

/** floats per story primitive: five vec4s */
export const STORY_FLOATS = 20;

interface CatCloud {
  vao: WebGLVertexArrayObject;
  buf: WebGLBuffer;
  count: number;
  sampleW: number;
  sampleH: number;
}

type Uniforms = Record<string, WebGLUniformLocation | null>;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`shader compile failed: ${log}`);
  }
  return sh;
}

function program(gl: WebGL2RenderingContext, vs: string, fs: string, names: string[]): { p: WebGLProgram; u: Uniforms } {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`program link failed: ${gl.getProgramInfoLog(p)}`);
  }
  const u: Uniforms = {};
  for (const n of names) u[n] = gl.getUniformLocation(p, n);
  return { p, u };
}

export interface RendererOptions {
  /** fixed world resolution scale (disables adaptive quality) */
  fixedScale?: number;
  maxDpr?: number;
}

/**
 * One WebGL2 context drives the whole descent: a reduced-resolution world pass
 * into a framebuffer, a full-resolution composite, then the particle cats.
 */
export class WorldRenderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private world!: { p: WebGLProgram; u: Uniforms };
  private comp!: { p: WebGLProgram; u: Uniforms };
  private pts!: { p: WebGLProgram; u: Uniforms };
  private sto!: { p: WebGLProgram; u: Uniforms };
  private storyVao!: WebGLVertexArrayObject;
  private storyBuf!: WebGLBuffer;
  private storyCap = 0;
  private storyFbo!: WebGLFramebuffer;
  private storyTex!: WebGLTexture;
  private storyW = 0;
  private storyH = 0;
  private emptyVao!: WebGLVertexArrayObject;
  private fbo!: WebGLFramebuffer;
  private tex!: WebGLTexture;
  private fboW = 0;
  private fboH = 0;
  private cssW = 0;
  private cssH = 0;
  private dpr = 1;
  private scale: number;
  private readonly minScale: number;
  private readonly maxScale: number;
  private readonly adaptive: boolean;
  private readonly maxDpr: number;
  private cats = new Map<string, CatCloud>();
  private catSources = new Map<string, CanvasImageSource & { width?: number; height?: number }>();
  private frameTimes: number[] = [];
  private lastRender = 0;
  lost = false;

  constructor(canvas: HTMLCanvasElement, opts: RendererOptions = {}) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    if (!gl) throw new Error("webgl2 unavailable");
    this.gl = gl;
    const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
    this.adaptive = opts.fixedScale === undefined;
    this.scale = opts.fixedScale ?? (coarse ? 0.5 : 0.7);
    this.minScale = coarse ? 0.32 : 0.4;
    this.maxScale = coarse ? 0.62 : 0.85;
    this.maxDpr = opts.maxDpr ?? (coarse ? 1.5 : 1.75);
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
    this.cats.clear();
    this.init();
    this.resize(this.cssW, this.cssH, this.dpr);
    for (const [id, src] of this.catSources) this.buildCat(id, src);
  };

  private init() {
    const gl = this.gl;
    this.world = program(gl, FULLSCREEN_VS, WORLD_FS, ["uRes", "uTime", "uAlt", "uDrift", "uTravel", "uVel", "uP"]);
    this.comp = program(gl, FULLSCREEN_VS, COMPOSITE_FS, [
      "uTex", "uStory", "uStoryOn", "uRes", "uTime", "uVel", "uStarVis", "uHorizon", "uWindow", "uSill", "uGrain", "uLamp",
    ]);
    this.sto = program(gl, STORY_VS, STORY_FS, ["uCss", "uWorld", "uDpr", "uAlt", "uDrift", "uP", "uMask", "uGroup"]);
    this.storyVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.storyVao);
    const corners = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, corners);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.storyBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.storyBuf);
    this.storyCap = 0;
    for (let k = 0; k < 5; k++) {
      gl.enableVertexAttribArray(1 + k);
      gl.vertexAttribPointer(1 + k, 4, gl.FLOAT, false, STORY_FLOATS * 4, k * 16);
      gl.vertexAttribDivisor(1 + k, 1);
    }
    gl.bindVertexArray(null);
    this.storyTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.storyTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.storyFbo = gl.createFramebuffer()!;
    this.storyW = 0;
    this.storyH = 0;
    this.pts = program(gl, POINTS_VS, POINTS_FS, ["uCanvas", "uRect", "uProg", "uDiss", "uTime", "uMode", "uSize", "uPhoto", "uFade"]);
    this.emptyVao = gl.createVertexArray()!;
    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.fbo = gl.createFramebuffer()!;
    this.fboW = 0;
    this.fboH = 0;
  }

  resize(cssW: number, cssH: number, dpr: number) {
    this.cssW = Math.max(1, cssW);
    this.cssH = Math.max(1, cssH);
    this.dpr = Math.min(Math.max(dpr, 1), this.maxDpr);
    const cw = Math.round(this.cssW * this.dpr);
    const ch = Math.round(this.cssH * this.dpr);
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
    }
    this.resizeFbo();
    this.resizeStory();
  }

  private resizeStory() {
    const gl = this.gl;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w === this.storyW && h === this.storyH) return;
    this.storyW = w;
    this.storyH = h;
    gl.bindTexture(gl.TEXTURE_2D, this.storyTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.storyFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.storyTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private resizeFbo() {
    const gl = this.gl;
    const w = Math.max(64, Math.round(this.cssW * this.scale));
    const h = Math.max(64, Math.round(this.cssH * this.scale));
    if (w === this.fboW && h === this.fboH) return;
    this.fboW = w;
    this.fboH = h;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  get worldScale() {
    return this.scale;
  }

  private adapt(now: number) {
    if (!this.adaptive) return;
    if (this.lastRender) {
      const dt = now - this.lastRender;
      if (dt < 250) this.frameTimes.push(dt);
    }
    this.lastRender = now;
    const n = this.frameTimes.length;
    if (n >= 45) {
      const avg = this.frameTimes.reduce((a, b) => a + b, 0) / n;
      if (avg > 23 && this.scale > this.minScale) {
        this.scale = Math.max(this.minScale, this.scale * 0.86);
        this.resizeFbo();
        this.frameTimes = [];
      } else if (n >= 160) {
        if (avg < 15.5 && this.scale < this.maxScale) {
          this.scale = Math.min(this.maxScale, this.scale * 1.06);
          this.resizeFbo();
        }
        this.frameTimes = [];
      }
    }
  }

  /** Reset the frame-time history, e.g. after the tab was hidden. */
  resetTiming() {
    this.frameTimes = [];
    this.lastRender = 0;
  }

  hasCat(id: string) {
    return this.cats.has(id);
  }

  /** Sample a cutout into a coloured point cloud (alpha → presence). */
  buildCat(id: string, img: CanvasImageSource & { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number }, maxPts = 11000) {
    if (this.lost) return;
    const gl = this.gl;
    const w0 = (img as HTMLImageElement).naturalWidth || (img.width as number) || 0;
    const h0 = (img as HTMLImageElement).naturalHeight || (img.height as number) || 0;
    if (!w0 || !h0) return;
    const maxDim = 176;
    const k = maxDim / Math.max(w0, h0);
    const w = Math.max(8, Math.round(w0 * k));
    const h = Math.max(8, Math.round(h0 * k));
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, w, h);
    let data: Uint8ClampedArray;
    try {
      data = ctx.getImageData(0, 0, w, h).data;
    } catch {
      return;
    }
    let total = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 150) total++;
    if (!total) return;
    const keep = Math.min(1, maxPts / total);
    const buf = new ArrayBuffer(Math.ceil(total * keep * 1.05 + 16) * 8);
    const u16 = new Uint16Array(buf);
    const u8 = new Uint8Array(buf);
    let n = 0;
    const cap = buf.byteLength / 8;
    let seed = 1234567;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (data[i + 3] <= 150) continue;
        if (keep < 1 && rnd() > keep) continue;
        if (n >= cap) break;
        const u = (x + 0.15 + rnd() * 0.7) / w;
        const v = (y + 0.15 + rnd() * 0.7) / h;
        u16[n * 4] = Math.round(u * 65535);
        u16[n * 4 + 1] = Math.round(v * 65535);
        u8[n * 8 + 4] = data[i];
        u8[n * 8 + 5] = data[i + 1];
        u8[n * 8 + 6] = data[i + 2];
        u8[n * 8 + 7] = Math.floor(rnd() * 255);
        n++;
      }
    }
    const old = this.cats.get(id);
    if (old) {
      gl.deleteBuffer(old.buf);
      gl.deleteVertexArray(old.vao);
    }
    const vao = gl.createVertexArray()!;
    const vbo = gl.createBuffer()!;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(buf, 0, n * 8), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.UNSIGNED_SHORT, true, 8, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.UNSIGNED_BYTE, true, 8, 4);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.UNSIGNED_BYTE, true, 8, 7);
    gl.bindVertexArray(null);
    this.cats.set(id, { vao, buf: vbo, count: n, sampleW: w, sampleH: h });
    this.catSources.set(id, img);
  }

  render(f: Frame) {
    if (this.lost) return;
    const gl = this.gl;
    this.adapt(performance.now());

    // pass 1: world
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.fboW, this.fboH);
    gl.disable(gl.BLEND);
    gl.useProgram(this.world.p);
    const wu = this.world.u;
    gl.uniform2f(wu.uRes, this.fboW, this.fboH);
    gl.uniform1f(wu.uTime, f.time);
    gl.uniform1f(wu.uAlt, f.alt);
    gl.uniform1f(wu.uDrift, f.drift);
    gl.uniform1f(wu.uTravel, f.travel);
    gl.uniform1f(wu.uVel, f.vel);
    gl.uniform4fv(wu.uP, f.params);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // pass 1b: figures in the landscape, at full resolution, coloured by the world under their feet.
    // Each group fades as a whole: the shader scales colour by the group's opacity but returns bare
    // coverage as alpha, so colour is laid "over" by coverage (inside one figure the topmost part
    // simply wins, nothing doubles up), while the blend constant puts coverage x opacity into the
    // stored alpha that the composite lays over the world.
    const story = f.story && f.story.count > 0 ? f.story : null;
    if (story) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.storyFbo);
      gl.viewport(0, 0, this.storyW, this.storyH);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.CONSTANT_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this.sto.p);
      const su = this.sto.u;
      gl.uniform2f(su.uCss, this.cssW, this.cssH);
      gl.uniform1f(su.uDpr, this.storyW / this.cssW);
      gl.uniform1f(su.uAlt, f.alt);
      gl.uniform1f(su.uDrift, f.drift);
      gl.uniform4fv(su.uP, f.params);
      const m = story.mask;
      gl.uniform4f(su.uMask, m ? m[0] : 0, m ? m[1] : 0, m ? m[2] : 0, m ? m[3] : 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.uniform1i(su.uWorld, 0);
      gl.bindVertexArray(this.storyVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.storyBuf);
      const n = story.count * STORY_FLOATS;
      if (n > this.storyCap) {
        this.storyCap = Math.max(n, this.storyCap * 2, 4096);
        gl.bufferData(gl.ARRAY_BUFFER, this.storyCap * 4, gl.DYNAMIC_DRAW);
      }
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, story.data, 0, n);
      const groups = story.groups ?? [[0, story.count, 1] as const];
      for (const [first, count, opacity] of groups) {
        if (count <= 0 || opacity <= 0.002) continue;
        gl.uniform1f(su.uGroup, opacity);
        gl.blendColor(0, 0, 0, opacity);
        // no base instance in WebGL2: start the instance attributes at this group instead
        for (let k = 0; k < 5; k++) gl.vertexAttribPointer(1 + k, 4, gl.FLOAT, false, STORY_FLOATS * 4, (first * STORY_FLOATS + k * 4) * 4);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
      }
      gl.disable(gl.BLEND);
    }

    // pass 2: composite
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.comp.p);
    gl.bindVertexArray(this.emptyVao);
    const cu = this.comp.u;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(cu.uTex, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.storyTex);
    gl.uniform1i(cu.uStory, 1);
    gl.uniform1f(cu.uStoryOn, story ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform2f(cu.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(cu.uTime, f.time);
    gl.uniform1f(cu.uVel, f.vel);
    gl.uniform1f(cu.uStarVis, f.starVis);
    gl.uniform1f(cu.uHorizon, f.horizon);
    gl.uniform1f(cu.uWindow, f.window);
    gl.uniform1f(cu.uSill, f.sill);
    gl.uniform1f(cu.uGrain, 0.045);
    gl.uniform1f(cu.uLamp, f.lamp);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // pass 3: particle cats
    const live = f.cats.filter((c) => this.cats.has(c.id) && c.prog > 0.001 && c.diss < 0.999);
    if (live.length) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this.pts.p);
      const pu = this.pts.u;
      gl.uniform2f(pu.uCanvas, this.canvas.width, this.canvas.height);
      gl.uniform1f(pu.uTime, f.time);
      for (const c of live) {
        const cloud = this.cats.get(c.id)!;
        const d = this.dpr;
        const [x, y, w, h] = c.rect;
        gl.uniform4f(pu.uRect, x * d, y * d, w * d, h * d);
        gl.uniform1f(pu.uProg, c.prog);
        gl.uniform1f(pu.uDiss, c.diss);
        gl.uniform1f(pu.uMode, c.mode);
        gl.uniform1f(pu.uPhoto, c.photo);
        gl.uniform1f(pu.uFade, c.fade ?? 1);
        gl.uniform1f(pu.uSize, Math.max(1.5, ((w * d) / cloud.sampleW) * 1.25));
        gl.bindVertexArray(cloud.vao);
        gl.drawArrays(gl.POINTS, 0, cloud.count);
      }
      gl.disable(gl.BLEND);
    }
    gl.bindVertexArray(null);
  }

  dispose() {
    const gl = this.gl;
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onRestored);
    for (const c of this.cats.values()) {
      gl.deleteBuffer(c.buf);
      gl.deleteVertexArray(c.vao);
    }
    this.cats.clear();
    gl.deleteFramebuffer(this.fbo);
    gl.deleteTexture(this.tex);
    gl.deleteFramebuffer(this.storyFbo);
    gl.deleteTexture(this.storyTex);
    gl.deleteBuffer(this.storyBuf);
    gl.deleteVertexArray(this.storyVao);
    gl.deleteProgram(this.world.p);
    gl.deleteProgram(this.comp.p);
    gl.deleteProgram(this.pts.p);
    gl.deleteProgram(this.sto.p);
  }
}
