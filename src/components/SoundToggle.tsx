"use client";

import { useState } from "react";
import styles from "./SoundToggle.module.css";

export default function SoundToggle() {
  const [on, setOn] = useState(false);
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
