"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { CATS } from "@/lib/cats";
import { BIOMES, biomeIndexForAltitude } from "@/lib/biomes";
import { altitudeAt, buildAltitudeTable, type AltitudeNode } from "@/lib/engine";
import { sampleAtmosphere, formatMeters, clamp } from "@/lib/format";
import { useReducedMotion } from "@/lib/hooks";
import BiomeBackground from "./BiomeBackground";
import Particles from "./Particles";
import AltitudeHUD from "./AltitudeHUD";
import Hero from "./Hero";
import BiomeBanner from "./BiomeBanner";
import CatStation from "./CatStation";
import Ending from "./Ending";
import styles from "./Experience.module.css";

const INDEX_BY_ID = new Map(CATS.map((c, i) => [c.id, i + 1]));

export default function Experience() {
  const reduced = useReducedMotion();
  const [biomeIndex, setBiomeIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const altRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<AltitudeNode[]>([]);
  const biomeRef = useRef(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const rebuild = () => {
      tableRef.current = buildAltitudeTable(root);
    };
    rebuild();
    const settle = window.setTimeout(rebuild, 400);
    window.addEventListener("resize", rebuild);
    window.addEventListener("load", rebuild);

    let raf = 0;
    const frame = () => {
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      const p = docH > 0 ? clamp(window.scrollY / docH, 0, 1) : 0;

      const atm = sampleAtmosphere(p);
      const s = root.style;
      s.setProperty("--mw-sky-top", atm.skyTop);
      s.setProperty("--mw-sky-bottom", atm.skyBottom);
      s.setProperty("--mw-fog", atm.fog);
      s.setProperty("--mw-light", atm.light);
      s.setProperty("--mw-ridge", atm.ridge);
      s.setProperty("--mw-progress", p.toFixed(4));

      const alt = altitudeAt(p, tableRef.current);
      if (altRef.current) altRef.current.textContent = formatMeters(alt);
      const pct = (p * 100).toFixed(2);
      if (fillRef.current) fillRef.current.style.height = `${pct}%`;
      if (markerRef.current) markerRef.current.style.top = `${pct}%`;

      const bi = biomeIndexForAltitude(alt);
      if (bi !== biomeRef.current) {
        biomeRef.current = bi;
        setBiomeIndex(bi);
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(settle);
      window.removeEventListener("resize", rebuild);
      window.removeEventListener("load", rebuild);
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.root}>
      <BiomeBackground />
      {!reduced && <Particles biomeIndex={biomeIndex} />}
      <AltitudeHUD altRef={altRef} fillRef={fillRef} markerRef={markerRef} biome={BIOMES[biomeIndex]} />

      <main className={styles.scroll}>
        <Hero />
        {BIOMES.map((b) => {
          const group = CATS.filter((c) => c.biome === b.id);
          if (group.length === 0) return null;
          return (
            <Fragment key={b.id}>
              <BiomeBanner biome={b} />
              {group.map((cat) => {
                const i = INDEX_BY_ID.get(cat.id) ?? 0;
                return (
                  <CatStation
                    key={cat.id}
                    cat={cat}
                    side={i % 2 === 0 ? "right" : "left"}
                  />
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
