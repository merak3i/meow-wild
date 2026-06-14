"use client";

import type { Biome } from "@/lib/types";
import { useInView } from "@/lib/hooks";
import styles from "./BiomeBanner.module.css";

export default function BiomeBanner({ biome }: { biome: Biome }) {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.6 });
  return (
    <div
      ref={ref}
      className={`${styles.banner} ${inView ? styles.in : ""}`}
      data-mw-alt={biome.band[1]}
    >
      <span className={styles.range}>
        {biome.band[1].toLocaleString("en-US")} – {biome.band[0].toLocaleString("en-US")} m
      </span>
      <h2 className={styles.name}>{biome.name}</h2>
      <p className={styles.tagline}>{biome.tagline}</p>
    </div>
  );
}
