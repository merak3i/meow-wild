"use client";

import type { MouseEvent } from "react";
import styles from "./Ending.module.css";

/** Flies back up the whole mountain: the day rewinds from night to blue hour. */
export default function ClimbButton() {
  const climb = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const lenis = (window as unknown as { lenis?: { scrollTo: (t: number, o?: object) => void } }).lenis;
    if (lenis) lenis.scrollTo(0, { duration: 6, easing: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) });
    else window.scrollTo({ top: 0 });
  };
  return (
    <a href="#top" className={styles.up} onClick={climb}>
      Climb back to the top
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 15l7-7 7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}
