"use client";

import { useEffect, useState } from "react";
import styles from "./SoundToggle.module.css";

export default function SoundToggle() {
  const [on, setOn] = useState(false);
  // the walk can turn the sound on too: stay in step with whoever switched it
  useEffect(() => {
    const onSound = (e: Event) => setOn(!!(e as CustomEvent<boolean>).detail);
    window.addEventListener("mw:sound", onSound);
    return () => window.removeEventListener("mw:sound", onSound);
  }, []);
  const toggle = () => {
    const next = !on;
    setOn(next);
    window.dispatchEvent(new CustomEvent("mw:sound", { detail: next }));
  };
  return (
    <button
      type="button"
      className={`${styles.btn} ${on ? styles.on : ""}`}
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? "Turn ambient sound off" : "Turn ambient sound on"}
    >
      <span className={styles.bars} aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className={styles.label}>{on ? "Sound on" : "Sound off"}</span>
    </button>
  );
}
