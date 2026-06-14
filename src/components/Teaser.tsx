"use client";

import { useInView } from "@/lib/hooks";
import type { Teaser as TeaserData } from "@/lib/teasers";
import styles from "./Teaser.module.css";

export default function Teaser({ teaser }: { teaser: TeaserData }) {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.55 });
  return (
    <div ref={ref} className={`${styles.teaser} ${inView ? styles.in : ""}`}>
      <div className={styles.scrim} aria-hidden="true" />
      <div className={styles.inner}>
        {teaser.kicker && <span className={styles.kicker}>{teaser.kicker}</span>}
        <p className={styles.line}>{teaser.line}</p>
      </div>
    </div>
  );
}
