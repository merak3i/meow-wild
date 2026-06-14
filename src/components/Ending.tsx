"use client";

import { HOUSE_CAT } from "@/lib/cats";
import { deriveStats } from "@/lib/engine";
import { useInView } from "@/lib/hooks";
import CatPhoto from "./CatPhoto";
import styles from "./Ending.module.css";

export default function Ending() {
  const stats = deriveStats();
  const [ref, inView] = useInView<HTMLElement>({ threshold: 0.3 });

  const scrollTop = () => {
    const lenis = (window as unknown as { lenis?: { scrollTo: (t: number, o?: object) => void } }).lenis;
    if (lenis) lenis.scrollTo(0, { duration: 2.4 });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section
      ref={ref}
      data-mw-alt={0}
      className={`${styles.ending} ${inView ? styles.in : ""}`}
    >
      <div className={styles.scrim} aria-hidden="true" />
      <div className={styles.inner}>
        <span className={styles.eyebrow}>0 m · Sea level</span>
        <h2 className={styles.title}>And here, at the bottom — the cat that came home.</h2>

        <div className={styles.catWrap}>
          <CatPhoto cat={HOUSE_CAT} />
        </div>

        <p className={styles.fact}>{HOUSE_CAT.fact}</p>
        <p className={styles.kicker}>
          It shares roughly 95% of its DNA with the tiger. Nearly the same animal — one just
          chose the windowsill.
        </p>

        <div className={styles.divider} />

        <p className={styles.reflection}>
          You descended <strong>5,500 metres</strong> past <strong>{stats.total} wild cats</strong>.
          <br />
          <span className={styles.warn}>{stats.threatened} of them are losing their wild.</span>
        </p>
        <p className={styles.coda}>
          The high ones, the small ones, the ones almost nobody has seen — they only get to stay
          wild if the wild does too.
        </p>

        <div className={styles.actions}>
          <button className={styles.up} onClick={scrollTop}>
            Climb back to the top
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 15l7-7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <a className={styles.link} href="https://www.iucnredlist.org/" target="_blank" rel="noopener noreferrer">
            See the Red List →
          </a>
        </div>

        <footer className={styles.footer}>
          meow.wild — every altitude on this page is real.
        </footer>
      </div>
    </section>
  );
}
