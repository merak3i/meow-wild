import { Fragment, type CSSProperties } from "react";
import type { Biome } from "@/lib/types";
import { BIOMES } from "@/lib/biomes";
import styles from "./Chapter.module.css";

/** Pinned chapter card: the zone name rises letter by letter as you scroll. */
export default function Chapter({ biome, index }: { biome: Biome; index: number }) {
  const n = String(index + 1).padStart(2, "0");
  const total = String(BIOMES.length).padStart(2, "0");
  return (
    <section className={styles.chapter} data-pin="chapter" data-alt={biome.band[1]} aria-labelledby={`zone-${biome.id}`}>
      <div className={styles.sticky}>
        <div className={styles.inner}>
          <p className={styles.no}>
            Chapter {n}
            <span>/ {total}</span>
          </p>
          <p className={styles.range}>
            {biome.band[1].toLocaleString("en-US")} – {biome.band[0].toLocaleString("en-US")} m
          </p>
          <h2 id={`zone-${biome.id}`} className={styles.name} aria-label={biome.name}>
            {biome.name.split(" ").map((word, wi) => (
              <Fragment key={wi}>
                {/* a real space keeps the copied text right; flex layout ignores it */}
                {wi > 0 && " "}
                <span className={styles.word} aria-hidden="true">
                  {word.split("").map((ch, ci) => (
                    <span key={ci} className={styles.ch} style={{ "--i": wi * 6 + ci } as CSSProperties}>
                      {ch}
                    </span>
                  ))}
                </span>
              </Fragment>
            ))}
          </h2>
          <p className={styles.tagline}>{biome.tagline}</p>
        </div>
      </div>
    </section>
  );
}
