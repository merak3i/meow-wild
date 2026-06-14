"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import type { Cat } from "@/lib/types";
import { CAT_IMAGES } from "@/lib/catImages";
import CatArt from "./CatArt";
import styles from "./CatPhoto.module.css";

/**
 * A real species photograph, masked into a soft feathered oval that melts into
 * the biome, with a faint glow tinted by the cat's coat accent. Falls back to
 * the parametric <CatArt> if no photo is registered for this id.
 */
export default function CatPhoto({
  cat,
  className,
  priority = false,
}: {
  cat: Cat;
  className?: string;
  priority?: boolean;
}) {
  const img = CAT_IMAGES[cat.id];
  const accent = cat.coat.eye || cat.coat.base;
  const frameStyle = { "--accent": accent } as CSSProperties;

  if (!img) {
    return (
      <div className={`${styles.frame} ${className ?? ""}`} style={frameStyle}>
        <span className={styles.glow} aria-hidden="true" />
        <CatArt cat={cat} className={styles.fallback} />
      </div>
    );
  }

  return (
    <div className={`${styles.frame} ${className ?? ""}`} style={frameStyle}>
      <span className={styles.glow} aria-hidden="true" />
      <Image
        className={styles.photo}
        src={img.src}
        alt={cat.name}
        fill
        sizes="(max-width: 860px) 74vw, 40vw"
        placeholder="blur"
        blurDataURL={img.blurDataURL}
        priority={priority}
      />
    </div>
  );
}
