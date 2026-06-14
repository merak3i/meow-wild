import styles from "./BiomeBackground.module.css";

/**
 * Fixed, full-viewport atmosphere. Colors come from the `--mw-*` custom
 * properties the scroll engine writes on the root each frame, so the whole
 * world shifts hue continuously as you descend.
 */
export default function BiomeBackground() {
  return (
    <div className={styles.bg} aria-hidden="true">
      <div className={styles.sky} />
      <div className={styles.glow} />
      <div className={styles.fog} />

      <svg
        className={`${styles.ridge} ${styles.ridgeFar}`}
        viewBox="0 0 1440 420"
        preserveAspectRatio="xMidYMax slice"
      >
        <path d="M0 420V230l120-70 110 54 150-96 140 70 150-92 160 86 150-70 160 92 150-64v272Z" />
      </svg>
      <svg
        className={`${styles.ridge} ${styles.ridgeMid}`}
        viewBox="0 0 1440 420"
        preserveAspectRatio="xMidYMax slice"
      >
        <path d="M0 420V300l160-90 140 70 170-86 150 80 160-70 170 92 160-72 170 92v176Z" />
      </svg>
      <svg
        className={`${styles.ridge} ${styles.ridgeNear}`}
        viewBox="0 0 1440 360"
        preserveAspectRatio="xMidYMax slice"
      >
        <path d="M0 360V250l180 60 160-48 180 64 170-40 190 70 180-44 180 56v32Z" />
      </svg>

      <div className={styles.vignette} />
    </div>
  );
}
