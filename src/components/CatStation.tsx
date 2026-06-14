"use client";

import { memo } from "react";
import type { CSSProperties } from "react";
import type { Cat } from "@/lib/types";
import { useInView } from "@/lib/hooks";
import { IUCN_META, formatWeight } from "@/lib/format";
import CatPhoto from "./CatPhoto";
import styles from "./CatStation.module.css";

function CatStation({
  cat,
  side,
}: {
  cat: Cat;
  side: "left" | "right";
}) {
  const [ref, inView] = useInView<HTMLElement>();
  const iucn = IUCN_META[cat.iucn];

  return (
    <section
      ref={ref}
      data-mw-alt={cat.altitudeM}
      className={`${styles.station} ${styles[side]} ${inView ? styles.in : ""}`}
      aria-label={`${cat.name}, lives around ${cat.altitudeM} metres`}
    >
      <div className={styles.art}>
        <div className={styles.artInner}>
          <CatPhoto cat={cat} />
        </div>
      </div>

      <article className={styles.card}>
        <span className={styles.altChip}>{cat.altitudeM.toLocaleString("en-US")} m</span>

        <h2 className={styles.name}>{cat.name}</h2>
        <p className={styles.latin}>{cat.latin}</p>

        <p className={styles.fact}>{cat.fact}</p>

        <p className={styles.metaRow}>
          <span className={styles.status} style={{ "--c": iucn.color } as CSSProperties}>
            <span className={styles.dot} />
            {iucn.label}
          </span>
          <span className={styles.sep} aria-hidden="true">
            ·
          </span>
          <span>{formatWeight(cat.weightKg)}</span>
          <span className={styles.sep} aria-hidden="true">
            ·
          </span>
          <span className={styles.range}>{cat.region}</span>
        </p>
      </article>
    </section>
  );
}

export default memo(CatStation);
