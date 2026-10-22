import type { CSSProperties } from "react";
import Image from "next/image";
import type { Cat } from "@/lib/types";
import { CAT_IMAGES } from "@/lib/catImages";
import { BIOME_BY_ID } from "@/lib/biomes";
import { IUCN_META, IUCN_SCALE, formatLength, formatWeight } from "@/lib/format";
import { INK, PARTICLE_MODE } from "@/lib/world/presets";
import styles from "./CatStation.module.css";

/** Display width of the photograph by real body size: a tiger looms, a rusty-spotted cat is tiny. */
const SIZE_W: Record<Cat["sizeClass"], string> = { big: "100%", medium: "84%", small: "68%", tiny: "52%" };

/**
 * One stop on the descent: a field-guide spread. The photograph materialises
 * out of the weather (particles drawn by the world canvas behind it) and is
 * revealed when they settle; the dossier carries the facts.
 */
export default function CatStation({
  cat,
  index,
  total,
  side,
}: {
  cat: Cat;
  index: number;
  total: number;
  side: "left" | "right";
}) {
  const img = CAT_IMAGES[cat.id];
  const iucn = IUCN_META[cat.iucn];
  const ink = INK[cat.id] ?? "light";
  const photoStyle = {
    "--ar": (img.width / img.height).toFixed(4),
    "--w": SIZE_W[cat.sizeClass],
    "--tint": cat.tint,
  } as CSSProperties;

  return (
    <section
      id={`cat-${cat.id}`}
      className={`${styles.station} ${side === "right" ? styles.right : styles.left}`}
      data-station={cat.id}
      data-world={cat.id}
      data-alt={cat.altitudeM}
      data-mode={PARTICLE_MODE[cat.id] ?? 0}
      data-ink={ink}
      aria-labelledby={`name-${cat.id}`}
    >
      <div className={styles.inner}>
        <figure className={styles.specimen}>
          <span className={styles.numeral} aria-hidden="true">
            {cat.altitudeM.toLocaleString("en-US")}
            <small>m</small>
          </span>
          <div className={styles.photo} data-photo="" style={photoStyle}>
            <span className={styles.halo} aria-hidden="true" />
            <Image
              src={img.src}
              alt={`${cat.name} (${cat.latin})`}
              width={img.width}
              height={img.height}
              sizes="(max-width: 900px) 86vw, 46vw"
              loading={index <= 2 ? "eager" : "lazy"}
            />
          </div>
          <figcaption className={styles.credit}>
            Photo{" "}
            <a href={cat.credit.source} target="_blank" rel="noopener noreferrer">
              {cat.credit.author}
            </a>
            {" · "}
            {cat.credit.licenseUrl ? (
              <a href={cat.credit.licenseUrl} target="_blank" rel="noopener noreferrer license">
                {cat.credit.license}
              </a>
            ) : (
              cat.credit.license
            )}
            {" · background removed"}
          </figcaption>
        </figure>

        <div className={styles.dossier} data-dossier="">
          <p className={styles.index}>
            <b>{String(index).padStart(2, "0")}</b>
            <span>/ {total}</span>
            <span className={styles.zone}>{BIOME_BY_ID[cat.biome].name}</span>
          </p>
          <h2 id={`name-${cat.id}`} className={styles.name} tabIndex={-1}>
            {cat.name}
          </h2>
          <p className={styles.latin}>{cat.latin}</p>
          <p className={styles.fact}>{cat.fact}</p>
          <dl className={styles.data}>
            <dt>Altitude</dt>
            <dd>{cat.altitudeLabel}</dd>
            {cat.altitudeNote && (
              <>
                <dt>On record</dt>
                <dd>{cat.altitudeNote}</dd>
              </>
            )}
            <dt>Head and body</dt>
            <dd>{formatLength(cat.lengthCm)}</dd>
            <dt>Weight</dt>
            <dd>{formatWeight(cat.weightKg)}</dd>
            <dt>Range</dt>
            <dd>{cat.region}</dd>
          </dl>
          <div className={styles.status} style={{ "--c": iucn.color } as CSSProperties}>
            <ol className={styles.scale} aria-hidden="true">
              {IUCN_SCALE.map((code) => (
                <li
                  key={code}
                  data-on={code === cat.iucn ? "" : undefined}
                  style={{ "--k": IUCN_META[code].color } as CSSProperties}
                >
                  <span>{code}</span>
                </li>
              ))}
            </ol>
            <p className={styles.statusLabel}>
              <span className={styles.dot} />
              {iucn.label}
              <span className={styles.src}>IUCN Red List</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
