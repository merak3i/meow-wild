"use client";

import { memo } from "react";
import type { CSSProperties } from "react";
import type { Cat } from "@/lib/types";
import { useInView } from "@/lib/hooks";
import { IUCN_META } from "@/lib/format";
import CatPhoto from "./CatPhoto";
import styles from "./CatStation.module.css";

function CatStation({ cat, side }: { cat: Cat; side: "left" | "right" }) {
  const [ref, inView] = useInView<HTMLElement>();
  const iucn = IUCN_META[cat.iucn];

  return (
    <section
      ref={ref}
      data-mw-alt={cat.altitudeM}
      data-mw-scene={cat.id}
      className={`${styles.station} ${styles[side]} ${inView ? styles.in : ""}`}
      aria-label={`${cat.name}, lives around ${cat.altitudeM} metres`}
    >
      <div className={styles.art}>
        <div className={styles.artInner}>
          <CatPhoto cat={cat} />
        </div>
      </div>

      <div className={styles.text}>
        <span className={styles.alt}>{cat.altitudeM.toLocaleString("en-US")} m</span>
        <h2 className={styles.name}>{cat.name}</h2>
        <p className={styles.latin}>{cat.latin}</p>
        <p className={styles.fact}>{cat.fact}</p>
        <span className={styles.iucn} style={{ "--c": iucn.color } as CSSProperties}>
          <span className={styles.dot} />
          {iucn.label}
        </span>
      </div>
    </section>
  );
}

export default memo(CatStation);
