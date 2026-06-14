"use client";

import { useState } from "react";
import Image from "next/image";
import type { CSSProperties } from "react";
import type { Cat } from "@/lib/types";
import { CAT_IMAGES } from "@/lib/catImages";
import CatArt from "./CatArt";
import styles from "./CatPhoto.module.css";

/**
 * A background-removed species cutout that floats directly in the scene — no
 * box, no frame. A coat-tinted glow lifts it off the backdrop, a soft contact
 * shadow grounds it, and it is scaled by the animal's real size class so a
 * tiger looms and a rusty-spotted cat is tiny. Falls back to <CatArt>.
 */
export default function CatPhoto({
  cat,
  priority = false,
}: {
  cat: Cat;
  priority?: boolean;
}) {
  const img = CAT_IMAGES[cat.id];
  const [loaded, setLoaded] = useState(false);
  const accent = cat.coat.eye || cat.coat.base;
  const style = { "--accent": accent } as CSSProperties;

  if (!img) {
    return (
      <div className={styles.frame} data-size={cat.sizeClass} style={style}>
        <span className={styles.glow} aria-hidden="true" />
        <CatArt cat={cat} className={styles.photo} />
        <span className={styles.shadow} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className={styles.frame} data-size={cat.sizeClass} style={style}>
      <span className={styles.glow} aria-hidden="true" />
      <Image
        className={`${styles.photo} ${loaded ? styles.loaded : ""}`}
        src={img.src}
        alt={cat.name}
        width={img.width}
        height={img.height}
        sizes="(max-width: 860px) 74vw, 42vw"
        priority={priority}
        onLoad={() => setLoaded(true)}
      />
      <span className={styles.shadow} aria-hidden="true" />
    </div>
  );
}
