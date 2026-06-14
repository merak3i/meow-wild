import { SUMMIT_M } from "@/lib/cats";
import { CATS } from "@/lib/cats";
import styles from "./Hero.module.css";

export default function Hero() {
  return (
    <header className={styles.hero} data-mw-alt={SUMMIT_M} data-mw-scene="hero">
      <div className={styles.inner}>
        <span className={styles.wordmark}>meow.wild</span>
        <span className={styles.eyebrow}>A descent through the world of cats</span>
        <h1 className={styles.title}>
          How high does
          <br />a cat live?
        </h1>
        <p className={styles.sub}>
          Higher than you&rsquo;d think. We start at <strong>5,500 metres</strong> — the frozen
          roof of the world — and walk all the way down to the sea, meeting all {CATS.length} of
          them at the altitude each one calls home.
        </p>

        <div className={styles.cue}>
          <span>Scroll to descend</span>
          <svg viewBox="0 0 24 24" className={styles.chev} aria-hidden="true">
            <path d="M5 9l7 7 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </header>
  );
}
