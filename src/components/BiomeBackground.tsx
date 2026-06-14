import Image from "next/image";
import { SCENES, SCENE_INDEX } from "@/lib/scenes";
import styles from "./BiomeBackground.module.css";

/**
 * Fixed, full-viewport atmosphere. Each cat has its OWN habitat backdrop; the
 * active one (nearest the viewport centre) crossfades in beneath a translucent
 * altitude-tinted veil + fog, so every animal sits in its own world while the
 * descent still reads as one continuous flow. Only the active scene ±1 are
 * mounted, so we never hold more than three large photos at once.
 */
export default function BiomeBackground({ activeScene }: { activeScene: string }) {
  const activeIdx = SCENE_INDEX.get(activeScene) ?? 0;
  return (
    <div className={styles.bg} aria-hidden="true">
      <div className={styles.scenes}>
        {SCENES.map((s, i) => {
          if (Math.abs(i - activeIdx) > 1) return null;
          return (
            <Image
              key={s.id}
              src={s.src}
              alt=""
              fill
              sizes="100vw"
              priority={i === 0}
              className={`${styles.scene} ${s.id === activeScene ? styles.active : ""}`}
            />
          );
        })}
      </div>
      <div className={styles.veil} />
      <div className={styles.fog} />
      <div className={styles.vignette} />
    </div>
  );
}
