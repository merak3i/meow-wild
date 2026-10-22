"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { WalkState } from "@/lib/walk/runner";
import styles from "./Walk.module.css";

const send = (cmd: string) => window.dispatchEvent(new CustomEvent("mw:walk", { detail: cmd }));

/** The way in, on the opening screen. */
export function WalkStart() {
  return (
    <button type="button" className={styles.start} onClick={() => send("start")} data-walk-ui="">
      <span className={styles.play} aria-hidden="true" />
      <span className={styles.startText}>
        <span className={styles.startLabel}>Walk down with Vismay</span>
        <span className={styles.startMeta}>About 7 minutes · sound on</span>
      </span>
    </button>
  );
}

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path d={d} fill="currentColor" />
  </svg>
);
const PLAY = "M4 2.5v11l9.5-5.5z";
const PAUSE = "M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z";
const PREV = "M3 2.5h2v11H3zM14 2.5v11L6 8z";
const NEXT = "M11 2.5h2v11h-2zM2 2.5v11L10 8z";
const CLOSE = "M3.4 2 8 6.6 12.6 2 14 3.4 9.4 8l4.6 4.6-1.4 1.4L8 9.4 3.4 14 2 12.6 6.6 8 2 3.4z";

/**
 * The walk's player: Vismay's words as captions while he speaks, where you
 * are on the way down, and pause, skip and stop. Out of the walk, a small
 * launcher next to the sound switch starts it from wherever you are.
 */
export default function WalkPlayer() {
  const [st, setSt] = useState<WalkState | null>(null);
  const [past, setPast] = useState(false);
  // the line stays on screen while it fades out
  const [lastLine, setLastLine] = useState("");

  useEffect(() => {
    const onState = (e: Event) => {
      const s = (e as CustomEvent<WalkState>).detail;
      setSt(s);
      if (s.caption) setLastLine(s.caption);
    };
    const onScroll = () => setPast(window.scrollY > window.innerHeight * 1.2);
    onScroll();
    window.addEventListener("mw:walk-state", onState);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("mw:walk-state", onState);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // after the last stop, a goodbye for a moment, then back to the launcher
  const done = st?.mode === "done";
  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setSt((s) => (s && s.mode === "done" ? { ...s, mode: "idle" } : s)), 9000);
    return () => window.clearTimeout(t);
  }, [done]);

  const mode = st?.mode ?? "idle";
  const active = mode === "playing" || mode === "paused" || mode === "away";

  if (!active && !done) {
    return (
      <button
        type="button"
        className={`${styles.launch} ${past ? styles.launchOn : ""}`}
        onClick={() => send("start")}
        data-walk-ui=""
        tabIndex={past ? 0 : -1}
        aria-hidden={!past}
      >
        <Icon d={PLAY} />
        <span className={styles.launchLabel}>Walk with Vismay</span>
      </button>
    );
  }

  const progress = st ? (st.index + 1) / st.total : 0;
  return (
    <div className={styles.dock} data-walk-ui="" data-mode={mode} role="region" aria-label="The walk with Vismay">
      <div className={styles.progress} style={{ "--p": progress.toFixed(3) } as CSSProperties} aria-hidden="true" />
      {done ? (
        <p className={`${styles.caption} ${styles.shown}`}>
          <span className={styles.who}>End of the walk</span>
          <span className={styles.line}>That&rsquo;s all eighteen. Scroll back up any time, or take the walk again.</span>
        </p>
      ) : (
        <p className={`${styles.caption} ${st?.caption || mode === "away" ? styles.shown : ""}`} aria-live="off">
          <span className={styles.who}>{mode === "away" ? "Walk paused while you look around" : "Vismay"}</span>
          <span className={styles.line}>{mode === "away" ? "Pick it up again from where we stopped." : lastLine || "\u00a0"}</span>
        </p>
      )}
      <div className={styles.controls}>
        {done ? (
          <button type="button" className={styles.wide} onClick={() => send("restart")}>
            <Icon d={PLAY} />
            Walk again
          </button>
        ) : mode === "away" ? (
          <button type="button" className={styles.wide} onClick={() => send("resume")}>
            <Icon d={PLAY} />
            Resume the walk
          </button>
        ) : (
          <>
            <button type="button" className={styles.btn} onClick={() => send("prev")} aria-label="Previous stop">
              <Icon d={PREV} />
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.main}`}
              onClick={() => send("toggle")}
              aria-pressed={mode === "paused"}
              aria-label={mode === "paused" ? "Resume the walk" : "Pause the walk"}
            >
              <Icon d={mode === "paused" ? PLAY : PAUSE} />
            </button>
            <button type="button" className={styles.btn} onClick={() => send("next")} aria-label="Next stop">
              <Icon d={NEXT} />
            </button>
          </>
        )}
        {st && !done && (
          <span className={styles.count}>
            {st.index + 1} / {st.total}
          </span>
        )}
        <button type="button" className={`${styles.btn} ${styles.close}`} onClick={() => send("stop")} aria-label="End the walk">
          <Icon d={CLOSE} />
        </button>
      </div>
    </div>
  );
}
