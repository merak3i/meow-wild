import styles from "./MchMark.module.css";

/** The studio's mark, pinned top right while the mountain scrolls past: back to meowcreativehaus.xyz. */
export default function MchMark() {
  return (
    <a
      className={styles.mark}
      href="https://meowcreativehaus.xyz"
      target="_blank"
      rel="noopener"
      data-walk-ui=""
      aria-label="Made by Meow Creative Haus. Opens meowcreativehaus.xyz in a new tab"
    >
      <span className={styles.logo} aria-hidden="true">
        MCH<span className={styles.dot}>.</span>
      </span>
      <span className={styles.by} aria-hidden="true">
        Meow Creative Haus
      </span>
    </a>
  );
}
