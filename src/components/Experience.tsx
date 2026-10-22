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
import { Ambience } from "@/lib/audio/ambience";
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
const INDEX_BY_ID = new Map(CATS.map((c, i) => [c.id, i + 1]));

export default function Experience() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

    let lenis: Lenis | null = null;
    if (!reduced) {
      lenis = new Lenis({ autoRaf: false, duration: 1.15, wheelMultiplier: 0.9, touchMultiplier: 1.4 });
      (window as unknown as { lenis?: Lenis }).lenis = lenis;
    }

    const ambience = new Ambience();
    const onSound = (e: Event) => {
      const on = (e as CustomEvent<boolean>).detail;
      if (on) ambience.start();
      else ambience.stop();
    };
    window.addEventListener("mw:sound", onSound);

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

    const measure = () => {
      const sy = window.scrollY;
      const prev = new Map(stations.map((s) => [s.id, s]));
      stations = Array.from(root.querySelectorAll<HTMLElement>("[data-station]")).map((el) => {
        const id = el.dataset.station as string;
        const photo = el.querySelector<HTMLElement>("[data-photo]") as HTMLElement;
        const r = photo.getBoundingClientRect();
        const old = prev.get(id);
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
        };
      });
      pins = Array.from(root.querySelectorAll<HTMLElement>("[data-pin]")).map((el) => {
        const r = el.getBoundingClientRect();
        return { el, name: el.dataset.pin as string, top: r.top + sy, height: r.height, last: -1, q: 0 };
      });
      pinByName.clear();
      for (const p of pins) if (!pinByName.has(p.name)) pinByName.set(p.name, p);
      timeline.measure(root);
      trackH = hud.track?.clientHeight ?? 0;
      renderer?.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1);
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
        if (Math.abs(qq - p.last) > 0.0004) {
          p.el.style.setProperty("--q", qq.toFixed(4));
          p.last = qq;
        }
      }

      // ---- cats: particles in, photograph, particles out ----
      cats.length = 0;
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
          continue;
        }
        if (st.img && st.img.loading === "lazy" && o < 3.2) st.img.loading = "eager";
        buildFor(st);
        if (!particles) continue;
        let prog: number;
        let diss: number;
        if (st.progPin) {
          const pin = pinByName.get(st.progPin);
          const pq = pin ? pin.q : 0;
          prog = smooth(0.08, 0.42, pq);
          diss = 0;
        } else {
          prog = 1 - smooth(0.12, 0.64, o);
          diss = smooth(-0.24, -0.66, o);
        }
        const photo = st.built ? smooth(0.84, 0.985, prog) * (1 - smooth(0.0, 0.22, diss)) : smooth(0.3, 0.7, prog) * (1 - smooth(0.0, 0.4, diss));
        if (Math.abs(photo - st.last) > 0.003) {
          st.photo.style.setProperty("--photo", photo.toFixed(3));
          st.last = photo;
        }
        if (st.built && prog > 0.001 && diss < 0.999) {
          cats.push({ id: st.id, rect: [left, top, st.w, st.h], prog, diss, mode: st.mode, photo, fade: st.sticky ? 0 : 1 });
        }
      }

      // ---- sound follows the world ----
      ambience.update(params, alt);

      // ---- draw ----
      if (renderer) {
        frameNo++;
        const throttle = idleFor > 3 && frameNo % 2 === 1;
        if (!throttle) {
          const se = sunElevation(tod);
          renderer.render({
            time: reduced ? 12.5 : (now - t0) / 1000,
            alt: camAlt,
            drift: reduced ? 0 : y * 0.12,
            travel: reduced ? 0 : y / vh,
            vel: reduced ? 0 : vel,
            params,
            starVis: params[42] * smooth(-1, -8, se),
            horizon: params[2],
            window: params[31],
            sill: 0,
            lamp: params[31],
            cats,
          });
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
      document.removeEventListener("visibilitychange", onVis);
      ro.disconnect();
      ambience.dispose();
      lenis?.destroy();
      renderer?.dispose();
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.root}>
      <div ref={skyRef} className={styles.sky} aria-hidden="true" />
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      <Instrument />
      <SoundToggle />

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
