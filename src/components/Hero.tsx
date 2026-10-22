import { CATS, SUMMIT_M } from "@/lib/cats";
import { WalkStart } from "./Walk";
import styles from "./Hero.module.css";

/**
 * Pinned opening. While it holds, the world runs from blue hour to first light:
 * the first sunlight touches the highest summits as you scroll.
 */
export default function Hero() {
  return (
    <header className={styles.hero} data-pin="hero" data-alt={SUMMIT_M}>
      <span className={styles.markTop} data-world="hero" aria-hidden="true" />
      <span className={styles.markEnd} data-world="hero-dawn" aria-hidden="true" />
      <div className={styles.sticky}>
        <div className={styles.inner}>
          <p className={styles.wordmark}>meow.wild</p>
          <p className={styles.eyebrow}>A descent through the world of cats</p>
          <h1 className={styles.title}>
            <span className={styles.l1}>How high does </span>
            <span className={styles.l2}>
              a cat <em>live?</em>
            </span>
          </h1>
          <p className={styles.lede}>
            Higher than you&rsquo;d think. We start at <strong>5,500 metres</strong>, on the frozen roof of the
            world, and walk all the way down to the sea, meeting all {CATS.length} of them at the altitude each
            one calls home.
          </p>
          <WalkStart />
          <div className={styles.cue} aria-hidden="true">
            <span>Scroll to descend</span>
            <i />
          </div>
        </div>
        <p className={styles.dawn} aria-hidden="true">
          First light reaches the summits
        </p>
      </div>
    </header>
  );
}
