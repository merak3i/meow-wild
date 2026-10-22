import type { CSSProperties } from "react";
import type { Teaser as TeaserData } from "@/lib/teasers";
import styles from "./Teaser.module.css";

/** Pinned cliffhanger: the line lights up word by word as you scroll. */
export default function Teaser({ teaser }: { teaser: TeaserData }) {
  const words = teaser.line.split(" ");
  return (
    <section className={styles.teaser} data-pin="teaser">
      <div className={styles.sticky}>
        <div className={styles.inner}>
          {teaser.kicker && <p className={styles.kicker}>{teaser.kicker}</p>}
          <p className={styles.line} style={{ "--n": words.length } as CSSProperties}>
            {words.map((w, i) => (
              <span key={i} style={{ "--i": i } as CSSProperties}>
                {w}{" "}
              </span>
            ))}
          </p>
        </div>
      </div>
    </section>
  );
}
