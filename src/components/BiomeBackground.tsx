import Image from "next/image";
import { BIOMES } from "@/lib/biomes";
import styles from "./BiomeBackground.module.css";

/**
 * Fixed, full-viewport atmosphere. Real CC landscape photographs crossfade as
 * you change biome, beneath a translucent gradient veil + fog driven by the
 * engine's `--mw-*` vars — so the photography and the flowing color read as one
 * continuous descent.
 */
export default function BiomeBackground({ biomeIndex }: { biomeIndex: number }) {
  return (
    <div className={styles.bg} aria-hidden="true">
      <div className={styles.scenes}>
        {BIOMES.map((b, i) => (
          <Image
            key={b.id}
            src={`/scenes/${b.id}.webp`}
            alt=""
            fill
            sizes="100vw"
            priority={i === 0}
            className={`${styles.scene} ${i === biomeIndex ? styles.active : ""}`}
          />
        ))}
      </div>
      <div className={styles.veil} />
      <div className={styles.fog} />
      <div className={styles.vignette} />
    </div>
  );
}
