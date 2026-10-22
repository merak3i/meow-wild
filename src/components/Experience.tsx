"use client";

import { Fragment, useEffect, useRef } from "react";
import Lenis from "lenis";
import { CATS } from "@/lib/cats";
import { BIOMES, biomeForAltitude } from "@/lib/biomes";
import { TEASER_BY_AFTER } from "@/lib/teasers";
import {
  FALLBACK_SKY,
  PARAM_COUNT,
  PRESETS,
  PRESET_ALT,
  lerpParams,
  packParams,
} from "@/lib/world/presets";
import { WorldRenderer, type CatDraw } from "@/lib/world/renderer";
import { LivingLayer, type LiveCat } from "@/lib/world/living";
import { StoryLayer } from "@/lib/world/story/layer";
import { catLight, type CatLight } from "@/lib/world/light";
import { RIGS, type Rig } from "@/lib/rigs";
import { Timeline, type WorldSample } from "@/lib/world/timeline";
import { airShare, clamp, clockAt, formatMeters, lerp, lightLabel, smooth, sunElevation } from "@/lib/format";
import { mixHex } from "@/lib/color";
import Instrument from "./Instrument";
import Hero from "./Hero";
import Chapter from "./Chapter";
import CatStation from "./CatStation";
import Teaser from "./Teaser";
import Ending from "./Ending";
import SoundToggle from "./SoundToggle";
import { Ambience, CALL_GAIN } from "@/lib/audio/ambience";
import { WalkRunner, type WalkState } from "@/lib/walk/runner";
import type { WalkAt } from "@/lib/walkthrough";
import WalkPlayer from "./Walk";
import styles from "./Experience.module.css";

interface StationRef {
  id: string;
  photo: HTMLElement;
  img: HTMLImageElement | null;
  mode: number;
  sticky: boolean;
  progPin: string | null;
  top: number;
  left: number;
  w: number;
  h: number;
  last: number;
  built: boolean;
  listening: boolean;
  live: boolean;
  liveListening: boolean;
  /** when the cat came into full view (ms, 0: not in view), whether it has called this visit, and echoed as you left */
  seen: number;
  called: boolean;
  echoed: boolean;
  /** the text block beside the cat, page coordinates: left, top, width, height */
  text: [number, number, number, number] | null;
}

interface PinRef {
  el: HTMLElement;
  name: string;
  top: number;
  height: number;
  last: number;
  q: number;
}

const WEATHER = [25, 26, 28, 29]; // snow, rain, firefly, dust
/** a cat without a hand-placed rig still breathes and takes the light */
const DEFAULT_RIG: Rig = { breath: [0.5, 0.55, 0.3, 0.22], breathAmp: [0.004, 0.01], breathRate: 0.25 };
const INDEX_BY_ID = new Map(CATS.map((c, i) => [c.id, i + 1]));
/** the world a cat lives in (the house cat's is the ending) */
const worldOf = (id: string) => (id === "domestic-cat" ? "ending" : id);

export default function Experience() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const skyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const sky = skyRef.current;
    if (!root || !canvas || !sky) return;
    const html = document.documentElement;
    const reduced = html.classList.contains("rm") || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: WorldRenderer | null = null;
    if (html.classList.contains("gl")) {
      try {
        const fixed = new URLSearchParams(location.search).get("q");
        renderer = new WorldRenderer(canvas, fixed ? { fixedScale: parseFloat(fixed) } : {});
      } catch (err) {
        console.warn("[meow.wild] world renderer unavailable, using the flat sky", err);
        html.classList.remove("gl");
        renderer = null;
      }
    }
    const particles = !!renderer && !reduced;
    html.classList.toggle("pt", particles);

    // living photographs on their own layer above the page
    let living: LivingLayer | null = null;
    const liveCanvas = liveRef.current;
    if (renderer && liveCanvas && new URLSearchParams(location.search).get("live") !== "0") {
      try {
        living = new LivingLayer(liveCanvas);
        living.boost = Number(new URLSearchParams(location.search).get("rig")) || 1;
        html.classList.add("lp");
      } catch (err) {
        console.warn("[meow.wild] living photographs unavailable", err);
        living = null;
      }
    }
    // small lives in every landscape: prey, companions, and people watching from far off
    const storyParam = new URLSearchParams(location.search).get("story");
    const story = renderer && storyParam !== "0" ? new StoryLayer() : null;
    const storyDebug = storyParam === "lines" || storyParam === "sheet" ? storyParam : null;
    const storyCats = new Map<string, [number, number, number, number]>();
    const storyText = new Map<string, [number, number, number, number]>();
    const light: CatLight = catLight(new Float32Array(PARAM_COUNT), 1);
    const liveCats: LiveCat[] = [];
    let pointer: [number, number] | null = null;
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === "mouse" || e.pointerType === "pen") pointer = [e.clientX, e.clientY];
    };
    const onPointerOut = (e: PointerEvent) => {
      if (!e.relatedTarget) pointer = null;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerout", onPointerOut, { passive: true });

    let lenis: Lenis | null = null;
    if (!reduced) {
      lenis = new Lenis({ autoRaf: false, duration: 1.15, wheelMultiplier: 0.9, touchMultiplier: 1.4 });
      (window as unknown as { lenis?: Lenis }).lenis = lenis;
    }

    const ambience = new Ambience();
    // in development, hand the moving parts to the console for checking
    if (process.env.NODE_ENV !== "production") (window as unknown as { __mw?: unknown }).__mw = { ambience, living, story };
    const onSound = (e: Event) => {
      const on = (e as CustomEvent<boolean>).detail;
      if (on) ambience.start();
      else {
        walk.stop();
        ambience.stop();
      }
    };
    window.addEventListener("mw:sound", onSound);

    // ---- the walk: Vismay takes you down, stop by stop ----
    const stackedNow = () => window.innerWidth <= 900;
    const targetFor = (at: WalkAt): number | null => {
      const vh = window.innerHeight;
      const sy = window.scrollY;
      if (at.kind === "top") return 0;
      if (at.kind === "station") {
        const el = document.getElementById(`cat-${at.id}`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (stackedNow()) {
          // photo above the text: keep the cat in the upper part of the screen
          const ph = el.querySelector<HTMLElement>("[data-photo]")?.getBoundingClientRect();
          if (ph) return Math.max(0, ph.top + sy + ph.height / 2 - vh * 0.36);
        }
        // a little above centre, so the captions at the bottom leave the cat's facts readable
        return Math.max(0, r.top + sy + r.height / 2 - vh * 0.45);
      }
      if (at.kind === "after") {
        const el = root.querySelector<HTMLElement>('[data-walk="after"]');
        return el ? el.getBoundingClientRect().top + sy - vh * 0.08 : null;
      }
      const el = root.querySelectorAll<HTMLElement>(`[data-pin="${at.name}"]`)[at.index ?? 0];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.top + sy + at.q * Math.max(0, r.height - vh);
    };
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const glide = (y: number, seconds: number) =>
      new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve();
        };
        if (!lenis || seconds <= 0) {
          window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
          window.setTimeout(finish, 80);
          return;
        }
        lenis.scrollTo(y, { duration: seconds, easing: ease, onComplete: finish });
        window.setTimeout(finish, seconds * 1000 + 700);
      });
    const walk = new WalkRunner({
      ambience,
      reduced,
      scrollTo: glide,
      targetFor,
      hasCall: (id) => CALL_GAIN[id] !== undefined && id !== "domestic-cat",
      soundOn: () => window.dispatchEvent(new CustomEvent("mw:sound", { detail: true })),
      soundOff: () => window.dispatchEvent(new CustomEvent("mw:sound", { detail: false })),
      emit: (state: WalkState) => window.dispatchEvent(new CustomEvent("mw:walk-state", { detail: state })),
    });
    const onWalk = (e: Event) => {
      const cmd = (e as CustomEvent<string>).detail;
      if (cmd === "start") walk.start();
      else if (cmd === "restart") walk.start(0);
      else if (cmd === "toggle") walk.toggle();
      else if (cmd === "next") walk.next();
      else if (cmd === "prev") walk.prev();
      else if (cmd === "stop") walk.stop();
      else if (cmd === "resume") walk.resume();
    };
    window.addEventListener("mw:walk", onWalk);
    // scrolling by hand while the walk runs: it steps aside
    const onHand = (e: Event) => {
      if (walk.state.mode !== "playing" && walk.state.mode !== "paused") return;
      if ((e.target as Element | null)?.closest?.("[data-walk-ui]")) return;
      if (e.type === "keydown") {
        const k = (e as KeyboardEvent).key;
        if (!["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(k)) return;
      }
      walk.takeover();
    };
    window.addEventListener("wheel", onHand, { passive: true });
    window.addEventListener("touchmove", onHand, { passive: true });
    window.addEventListener("keydown", onHand);
    const onWalkKey = (e: KeyboardEvent) => {
      if (!walk.active || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("input, textarea, [contenteditable]")) return;
      if (e.key === "Escape") walk.stop();
      else if (e.key === " " || e.key === "k") {
        if (target?.closest?.("button, a, summary")) return;
        e.preventDefault();
        walk.toggle();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        walk.next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        walk.prev();
      }
    };
    window.addEventListener("keydown", onWalkKey);

    const timeline = new Timeline();
    const sample: WorldSample = { a: "hero", b: "hero", t: 0, raw: 0 };
    const params = new Float32Array(PARAM_COUNT);
    const target = new Float32Array(PARAM_COUNT);
    packParams(PRESETS.hero, params);
    let camAltR = PRESET_ALT.hero;

    const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel);
    const hud = {
      alt: q<HTMLSpanElement>('[data-hud="alt"]'),
      zone: q<HTMLSpanElement>('[data-hud="zone"]'),
      air: q<HTMLSpanElement>('[data-hud="air"]'),
      clock: q<HTMLSpanElement>('[data-hud="clock"]'),
      needle: q<HTMLDivElement>('[data-hud="needle"]'),
      track: q<HTMLDivElement>('[data-hud="track"]'),
    };
    let trackH = 0;
    let stations: StationRef[] = [];
    let pins: PinRef[] = [];
    const pinByName = new Map<string, PinRef>();
    const voiceAfter = new Map<HTMLElement, string>();
    const boomed = new Set<HTMLElement>();

    const measure = () => {
      const sy = window.scrollY;
      const prev = new Map(stations.map((s) => [s.id, s]));
      stations = Array.from(root.querySelectorAll<HTMLElement>("[data-station]")).map((el) => {
        const id = el.dataset.station as string;
        const photo = el.querySelector<HTMLElement>("[data-photo]") as HTMLElement;
        const r = photo.getBoundingClientRect();
        const old = prev.get(id);
        const dossier = el.querySelector<HTMLElement>("[data-dossier]");
        const dr = dossier?.getBoundingClientRect();
        return {
          id,
          photo,
          img: photo.querySelector("img"),
          mode: Number(el.dataset.mode || 0),
          sticky: el.dataset.sticky === "1",
          progPin: el.dataset.progPin || null,
          top: r.top + sy,
          left: r.left,
          w: r.width,
          h: r.height,
          last: old?.last ?? -1,
          built: renderer?.hasCat(id) ?? false,
          listening: old?.listening ?? false,
          live: living?.has(id) ?? false,
          liveListening: old?.liveListening ?? false,
          seen: old?.seen ?? 0,
          called: old?.called ?? false,
          echoed: old?.echoed ?? false,
          text: dr ? [dr.left, dr.top + sy, dr.width, dr.height] : null,
        };
      });
      pins = Array.from(root.querySelectorAll<HTMLElement>("[data-pin]")).map((el) => {
        const r = el.getBoundingClientRect();
        return { el, name: el.dataset.pin as string, top: r.top + sy, height: r.height, last: -1, q: 0 };
      });
      pinByName.clear();
      for (const p of pins) if (!pinByName.has(p.name)) pinByName.set(p.name, p);
      // the cat each chapter and teaser leads to, if it has a voice of its own (no borrowed voices)
      voiceAfter.clear();
      const byTop = [...stations].filter((s) => !s.sticky).sort((a, b) => a.top - b.top);
      for (const p of pins) {
        if (p.name !== "chapter" && p.name !== "teaser") continue;
        const next = byTop.find((s) => s.top > p.top);
        if (next && CALL_GAIN[next.id] !== undefined) voiceAfter.set(p.el, next.id);
      }
      timeline.measure(root);
      trackH = hud.track?.clientHeight ?? 0;
      renderer?.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1);
      if (living && liveCanvas) living.resize(liveCanvas.clientWidth, liveCanvas.clientHeight, window.devicePixelRatio || 1);
    };

    const liveFor = (st: StationRef) => {
      if (!living || st.live || st.liveListening || !st.img) return;
      const img = st.img;
      st.liveListening = true;
      const go = () => {
        const aux = new Image();
        aux.decoding = "async";
        const done = (auxOk: boolean) => {
          if (!living || !img.naturalWidth) return;
          living.setCat(st.id, img, auxOk ? aux : null, RIGS[st.id] ?? DEFAULT_RIG, img.naturalWidth, img.naturalHeight);
          st.live = living.has(st.id);
          if (st.live) st.photo.dataset.live = "1";
        };
        aux.onload = () => done(true);
        aux.onerror = () => done(false);
        aux.src = `/cats/aux/${st.id}.webp`;
      };
      const ready = () => {
        if (img.decode) img.decode().then(go, go);
        else go();
      };
      if (img.complete && img.naturalWidth) ready();
      else img.addEventListener("load", ready, { once: true });
    };

    const buildFor = (st: StationRef) => {
      if (!renderer || !particles || st.built || st.listening || !st.img) return;
      const img = st.img;
      const go = () => {
        const done = () => {
          if (!renderer) return;
          if (!renderer.hasCat(st.id)) renderer.buildCat(st.id, img);
          st.built = renderer.hasCat(st.id);
        };
        if (img.decode) img.decode().then(done, done);
        else done();
      };
      st.listening = true;
      if (img.complete && img.naturalWidth) go();
      else img.addEventListener("load", go, { once: true });
    };

    const onJump = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const el = document.getElementById(`cat-${id}`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const y = r.top + window.scrollY + r.height / 2 - window.innerHeight / 2;
      if (lenis) lenis.scrollTo(y, { duration: 2.2 });
      else window.scrollTo({ top: y });
      const heading = el.querySelector<HTMLElement>("h2");
      heading?.focus({ preventScroll: true });
    };
    window.addEventListener("mw:jump", onJump);

    measure();
    let rw = window.innerWidth;
    let rh = window.innerHeight;
    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (window.innerWidth !== rw || Math.abs(window.innerHeight - rh) > 120) {
          rw = window.innerWidth;
          rh = window.innerHeight;
          measure();
        } else {
          renderer?.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1);
          if (living && liveCanvas) living.resize(liveCanvas.clientWidth, liveCanvas.clientHeight, window.devicePixelRatio || 1);
        }
      }, 120);
    };
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(() => onResize());
    const main = root.querySelector("main");
    if (main) ro.observe(main);
    document.fonts?.ready.then(() => measure()).catch(() => {});
    const settle = window.setTimeout(measure, 900);

    let raf = 0;
    let lastY = window.scrollY;
    let lastT = performance.now();
    let vel = 0;
    let idleFor = 0;
    let frameNo = 0;
    let shown = false;
    let lastAlt = "";
    let lastZone = "";
    let lastAir = "";
    let lastClock = "";
    let lastSky = "";
    const t0 = performance.now();
    const cats: CatDraw[] = [];

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      lenis?.raf(now);
      const dt = clamp((now - lastT) / 1000, 0.001, 0.1);
      lastT = now;
      const y = window.scrollY;
      const vh = window.innerHeight;
      const stacked = window.innerWidth <= 900;
      // jumps (rail, climb, restore) are teleports, not motion
      const v = Math.abs(y - lastY) > vh * 1.2 ? 0 : clamp((y - lastY) / vh / dt, -4, 4);
      lastY = y;
      vel += (v - vel) * Math.min(1, dt * 7);
      idleFor = Math.abs(v) > 0.01 ? 0 : idleFor + dt;

      // ---- world state ----
      timeline.sampleWorld(y, sample);
      let camAlt: number;
      if (reduced) {
        const id = timeline.nearestWorld(y);
        packParams(PRESETS[id] ?? PRESETS.hero, target);
        const k = 1 - Math.exp(-dt * 4);
        for (let i = 0; i < PARAM_COUNT; i++) params[i] += (target[i] - params[i]) * k;
        for (const w of WEATHER) params[w] = 0;
        camAltR += ((PRESET_ALT[id] ?? 0) - camAltR) * k;
        camAlt = camAltR;
      } else {
        lerpParams(PRESETS[sample.a] ?? PRESETS.hero, PRESETS[sample.b] ?? PRESETS.hero, sample.t, params);
        camAlt = lerp(PRESET_ALT[sample.a] ?? 0, PRESET_ALT[sample.b] ?? 0, sample.t);
      }
      const tod = params[0];
      const alt = timeline.sampleAlt(y);

      // ---- instrument ----
      const altText = formatMeters(Math.round(alt / 5) * 5);
      if (altText !== lastAlt && hud.alt) {
        hud.alt.textContent = altText;
        lastAlt = altText;
      }
      const zone = biomeForAltitude(alt).name;
      if (zone !== lastZone && hud.zone) {
        hud.zone.textContent = zone;
        lastZone = zone;
      }
      const air = `Air ${Math.round(airShare(alt) * 100)}%`;
      if (air !== lastAir && hud.air) {
        hud.air.textContent = air;
        lastAir = air;
      }
      const clock = `${clockAt(tod)} · ${lightLabel(tod)}`;
      if (clock !== lastClock && hud.clock) {
        hud.clock.textContent = clock;
        lastClock = clock;
      }
      if (hud.needle) hud.needle.style.transform = `translate3d(0, ${((1 - alt / 5500) * trackH).toFixed(1)}px, 0)`;

      // ---- pinned sections ----
      for (const p of pins) {
        if (y + vh < p.top - vh * 0.25 || y > p.top + p.height + vh * 0.25) continue;
        const qq = clamp((y - p.top) / Math.max(p.height - vh, 1), 0, 1);
        p.q = qq;
        if (p.name === "chapter") {
          if (qq <= 0 || qq >= 1) boomed.delete(p.el);
          else if (qq > 0.05 && qq < 0.4 && !boomed.has(p.el) && ambience.running) {
            const id = voiceAfter.get(p.el);
            if (id) ambience.boom(id);
            boomed.add(p.el);
          }
        }
        if (Math.abs(qq - p.last) > 0.0004) {
          p.el.style.setProperty("--q", qq.toFixed(4));
          p.last = qq;
        }
      }

      // once the window scene unpins, the room scrolls up with the page
      const endPin = pinByName.get("ending");
      const roomShift = endPin ? clamp((y - (endPin.top + endPin.height - vh)) / vh, 0, 1.5) : 0;

      // ---- cats: particles in, photograph, particles out ----
      cats.length = 0;
      liveCats.length = 0;
      storyCats.clear();
      storyText.clear();
      const voice = ambience.running ? ambience.voice() : null;
      const soundOn = ambience.running;
      for (const st of stations) {
        let top = st.top - y;
        let left = st.left;
        if (st.sticky) {
          const pin = st.progPin ? pinByName.get(st.progPin) : null;
          if (pin && (y + vh < pin.top - vh || y > pin.top + pin.height)) continue;
          const r = st.photo.getBoundingClientRect();
          top = r.top;
          left = r.left;
        }
        const o = (top + st.h / 2 - vh / 2) / vh;
        if (o < 3.2 && o > 1.8 && st.img && st.img.loading === "lazy") st.img.loading = "eager";
        if (o > 1.8 || o < -1.8) {
          if (st.last !== 0 && particles) {
            st.photo.style.setProperty("--photo", "0");
            st.last = 0;
          }
          st.seen = 0;
          st.called = false;
          continue;
        }
        storyCats.set(worldOf(st.id), [left, top, st.w, st.h]);
        if (st.text) storyText.set(worldOf(st.id), [st.text[0], st.text[1] - y, st.text[2], st.text[3]]);
        // a cat calls once per visit, panned to where it stands: its voice swells up as it arrives and
        // lands as its call; if you turn back first the swell falls away; as you leave, it echoes
        const pan = ((left + st.w / 2) / window.innerWidth) * 2 - 1;
        if (soundOn && o < 2.4 && o > -0.6) ambience.prepare(st.id);
        const inView = Math.abs(o) < 0.32 && (st.last > 0.6 || !particles);
        // a cat is only arriving if you are slowing down to it, not rushing past (a jump, a rewind)
        const arriving = Math.abs(o) < 0.42 && (st.last > 0.3 || !particles) && Math.abs(vel) < 2.5;
        if (!inView) st.seen = 0;
        else if (!st.seen) st.seen = now;
        if (Math.abs(o) > 0.9) {
          st.called = false;
          st.echoed = false;
        }
        if (soundOn && st.id !== "domestic-cat") {
          if (!st.called && arriving && ambience.arrive(st.id, pan)) st.called = true;
          else if (!st.called && st.seen && now - st.seen > 700 && Math.abs(vel) < 2.5 && ambience.call(st.id, pan)) st.called = true;
          if (st.called && Math.abs(o) > 0.62 && ambience.cancel(st.id)) st.called = false;
          if (st.called && !st.echoed && Math.abs(o) > 0.55) {
            ambience.depart(st.id, pan);
            st.echoed = true;
          }
        }
        if (st.img && st.img.loading === "lazy" && o < 3.2) st.img.loading = "eager";
        buildFor(st);
        liveFor(st);
        if (!particles) {
          // no particles: the photograph simply stands there, but it can still live and take the light
          if (st.live && o < 1.3 && o > -1.3) liveCats.push({ id: st.id, rect: [left, top, st.w, st.h], opacity: 1, fade: st.sticky ? 0 : 1, sill: st.sticky ? 1 : 0 });
          continue;
        }
        let prog: number;
        let diss: number;
        if (st.progPin) {
          const pin = pinByName.get(st.progPin);
          const pq = pin ? pin.q : 0;
          prog = smooth(0.08, 0.42, pq);
          diss = 0;
        } else {
          // stacked layout (photo above the dossier) holds the cat longer as it rises
          prog = stacked ? 1 - smooth(0.04, 0.5, o) : 1 - smooth(0.12, 0.64, o);
          diss = stacked ? smooth(-0.46, -0.86, o) : smooth(-0.24, -0.66, o);
        }
        const photo = st.built ? smooth(0.84, 0.985, prog) * (1 - smooth(0.0, 0.22, diss)) : smooth(0.3, 0.7, prog) * (1 - smooth(0.0, 0.4, diss));
        if (Math.abs(photo - st.last) > 0.003) {
          st.photo.style.setProperty("--photo", photo.toFixed(3));
          st.last = photo;
        }
        if (st.built && prog > 0.001 && diss < 0.999) {
          cats.push({ id: st.id, rect: [left, top, st.w, st.h], prog, diss, mode: st.mode, photo, fade: st.sticky ? 0 : 1 });
        }
        if (st.live && photo > 0.002) {
          liveCats.push({ id: st.id, rect: [left, top, st.w, st.h], opacity: photo, fade: st.sticky ? 0 : 1, sill: st.sticky ? 1 : 0 });
        }
      }

      // ---- between cats: the next one's voice drifts through the chapter and teaser cards ----
      if (soundOn) {
        let gId: string | null = null;
        let gLevel = 0;
        for (const p of pins) {
          if (p.name !== "chapter" && p.name !== "teaser") continue;
          if (y + vh < p.top || y > p.top + p.height) continue;
          const lv = Math.pow(Math.sin(Math.PI * p.q), 0.6);
          if (lv > gLevel) {
            gLevel = lv;
            gId = voiceAfter.get(p.el) ?? null;
          }
        }
        ambience.ghost(gId, gLevel, Math.min(1, Math.abs(vel) * 0.8));
      }

      // ---- sound follows the world ----
      ambience.update(params, alt);

      // ---- the story layer, and what each cat attends to ----
      const drift = reduced ? 0 : y * 0.12;
      if (story || living) catLight(params, window.innerWidth / Math.max(1, vh), light);
      let storyFrame: ReturnType<StoryLayer["update"]> | undefined;
      if (story) {
        storyFrame = story.update({
          time: (now - t0) / 1000,
          W: window.innerWidth,
          H: vh,
          params,
          alt: camAlt,
          drift,
          a: sample.a,
          b: sample.b,
          t: sample.t,
          anchors: timeline.worldAnchors,
          cats: storyCats,
          texts: storyText,
          reduced,
          sun: light.sun,
          calling: voice && voice.level > 0.25 ? worldOf(voice.id) : null,
          debug: storyDebug,
        });
      }
      for (const lc of liveCats) {
        const r = story?.reactions.get(worldOf(lc.id));
        lc.focus = r?.focus ?? null;
        lc.alert = r?.alert ?? 0;
        lc.voice = voice && voice.id === lc.id ? voice.level : 0;
      }

      // ---- draw ----
      if (renderer) {
        frameNo++;
        const idle = idleFor > 3;
        const throttle = idle && frameNo % 2 === 1;
        if (!throttle) {
          // half-rate idle frames must not read as a slow device to the adaptive resolution
          if (idle) renderer.resetTiming();
          const se = sunElevation(tod);
          renderer.render({
            time: reduced ? 12.5 : (now - t0) / 1000,
            alt: camAlt,
            drift,
            travel: reduced ? 0 : y / vh,
            vel: reduced ? 0 : vel,
            params,
            starVis: params[42] * smooth(-1, -8, se),
            horizon: params[2],
            window: params[31],
            sill: roomShift,
            lamp: params[31],
            cats,
            story: storyFrame,
          });
          if (living) {
            living.render({
              time: (now - t0) / 1000,
              dt: dt * (idle ? 2 : 1),
              pointer,
              vel: reduced ? 0 : vel,
              still: reduced,
              light,
              idle: idleFor,
              cats: liveCats,
            });
          }
          if (!shown) {
            shown = true;
            canvas.classList.add(styles.on);
          }
        }
      } else {
        const a = FALLBACK_SKY[sample.a] ?? FALLBACK_SKY.hero;
        const b = FALLBACK_SKY[sample.b] ?? FALLBACK_SKY.hero;
        const top = mixHex(a[0], b[0], sample.t);
        const bottom = mixHex(a[1], b[1], sample.t);
        const key = top + bottom;
        if (key !== lastSky) {
          sky.style.setProperty("--sky-top", top);
          sky.style.setProperty("--sky-bottom", bottom);
          lastSky = key;
        }
      }
    };
    raf = requestAnimationFrame(frame);

    const onVis = () => {
      if (!document.hidden) renderer?.resetTiming();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(settle);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mw:jump", onJump);
      window.removeEventListener("mw:sound", onSound);
      window.removeEventListener("mw:walk", onWalk);
      window.removeEventListener("wheel", onHand);
      window.removeEventListener("touchmove", onHand);
      window.removeEventListener("keydown", onHand);
      window.removeEventListener("keydown", onWalkKey);
      walk.stop();
      document.removeEventListener("visibilitychange", onVis);
      ro.disconnect();
      ambience.dispose();
      lenis?.destroy();
      renderer?.dispose();
      living?.dispose();
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerout", onPointerOut);
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.root}>
      <div ref={skyRef} className={styles.sky} aria-hidden="true" />
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      <canvas ref={liveRef} className={styles.live} aria-hidden="true" />
      <Instrument />
      <SoundToggle />
      <WalkPlayer />

      <main className={styles.main}>
        <Hero />
        {TEASER_BY_AFTER.hero && <Teaser teaser={TEASER_BY_AFTER.hero} />}
        {BIOMES.map((b, bi) => {
          const group = CATS.filter((c) => c.biome === b.id);
          if (!group.length) return null;
          return (
            <Fragment key={b.id}>
              <Chapter biome={b} index={bi} />
              {group.map((cat) => {
                const index = INDEX_BY_ID.get(cat.id) ?? 0;
                const teaser = TEASER_BY_AFTER[cat.id];
                return (
                  <Fragment key={cat.id}>
                    <CatStation cat={cat} index={index} total={CATS.length} side={index % 2 === 0 ? "right" : "left"} />
                    {teaser && <Teaser teaser={teaser} />}
                  </Fragment>
                );
              })}
            </Fragment>
          );
        })}
        <Ending />
      </main>
    </div>
  );
}
