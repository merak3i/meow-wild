"use client";

import type { RefObject } from "react";
import type { Biome } from "@/lib/types";
import { BIOME_STOPS } from "@/lib/biomes";
import styles from "./AltitudeHUD.module.css";

export default function AltitudeHUD({
  altRef,
  fillRef,
  markerRef,
  biome,
}: {
  altRef: RefObject<HTMLSpanElement | null>;
  fillRef: RefObject<HTMLDivElement | null>;
  markerRef: RefObject<HTMLDivElement | null>;
  biome: Biome;
}) {
  return (
    <>
      <div className={styles.hud}>
        <span className={styles.label}>Altitude</span>
        <div className={styles.readout}>
          <span ref={altRef} className={styles.value}>
            5,500
          </span>
          <span className={styles.unit}>m</span>
        </div>
        <span className={styles.biome}>{biome.name}</span>
      </div>

      <div className={styles.rail} aria-hidden="true">
        <div className={styles.track}>
          <div ref={fillRef} className={styles.fill} />
          <div ref={markerRef} className={styles.marker} />
          {BIOME_STOPS.slice(1, -1).map((s) => (
            <span key={s.at} className={styles.tick} style={{ top: `${s.at * 100}%` }} />
          ))}
        </div>
      </div>
    </>
  );
}
