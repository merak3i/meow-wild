"use client";

import type { CSSProperties } from "react";
import { CATS, SUMMIT_M } from "@/lib/cats";
import { CLOUD_BASE, CLOUD_TOP } from "@/lib/world/presets";
import { IUCN_META } from "@/lib/format";
import styles from "./Instrument.module.css";

const pct = (m: number) => `${((1 - m / SUMMIT_M) * 100).toFixed(3)}%`;
const TICKS = [5500, 5000, 4500, 4000, 3500, 3000, 2500, 2000, 1500, 1000, 500, 0];

/**
 * The altimeter: a readout in the corner and a rail down the right edge with
 * every cat at its altitude. Dots are buttons that fly you to that cat.
 */
export default function Instrument() {
  const jump = (id: string) => window.dispatchEvent(new CustomEvent("mw:jump", { detail: id }));

  return (
    <>
      <div className={styles.hud} aria-hidden="true">
        <span className={styles.label}>Altitude</span>
        <div className={styles.readout}>
          <span data-hud="alt" className={styles.value}>
            5,500
          </span>
          <span className={styles.unit}>m</span>
        </div>
        <span data-hud="zone" className={styles.zone}>
          The Frozen Roof
        </span>
        <span className={styles.meta}>
          <span data-hud="air">Air 50%</span>
          <span className={styles.dotSep} />
          <span data-hud="clock">05:05 · blue hour</span>
        </span>
      </div>

      <nav className={styles.rail} aria-label="Jump to a cat by altitude">
        <div className={styles.track} data-hud="track">
          <span
            className={styles.cloud}
            style={{ top: pct(CLOUD_TOP), height: `${(((CLOUD_TOP - CLOUD_BASE) / SUMMIT_M) * 100).toFixed(3)}%` }}
            title="Cloud deck, 1,920 to 2,480 m"
            aria-hidden="true"
          />
          {TICKS.map((m) => (
            <span key={m} className={m % 1000 === 0 ? styles.tickMajor : styles.tick} style={{ top: pct(m) }} aria-hidden="true">
              {m % 1000 === 0 && <span className={styles.tickLabel}>{m === 0 ? "0" : `${m / 1000}k`}</span>}
            </span>
          ))}
          <div className={styles.needle} data-hud="needle" aria-hidden="true">
            <span />
          </div>
          <ol className={styles.dots}>
            {CATS.map((c, i) => (
              <li key={c.id} style={{ top: pct(c.altitudeM) }}>
                <button
                  type="button"
                  className={`${styles.dot} ${i % 2 ? styles.alt : ""}`}
                  style={{ "--c": IUCN_META[c.iucn].color } as CSSProperties}
                  onClick={() => jump(c.id)}
                  aria-label={`${c.name}, ${c.altitudeM.toLocaleString("en-US")} metres`}
                >
                  <span className={styles.tip} aria-hidden="true">
                    {c.name}
                    <em>{c.altitudeM.toLocaleString("en-US")} m</em>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </nav>
    </>
  );
}
