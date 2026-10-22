import type { CSSProperties } from "react";
import Image from "next/image";
import { ALL_CATS, HOUSE_CAT } from "@/lib/cats";
import { CAT_IMAGES } from "@/lib/catImages";
import { deriveStats } from "@/lib/engine";
import { SOUND_CREDITS } from "@/lib/sounds";
import DescentChart from "./DescentChart";
import ClimbButton from "./ClimbButton";
import styles from "./Ending.module.css";

/**
 * Sea level, night. The window frame closes in around the whole descent and
 * the last cat settles on the sill, assembled from fireflies.
 */
export default function Ending() {
  const stats = deriveStats();
  const img = CAT_IMAGES[HOUSE_CAT.id];
  const nameOf = new Map(ALL_CATS.map((c) => [c.id, c.name]));

  return (
    <section className={styles.ending} aria-labelledby="ending-title">
      <div className={styles.pin} data-pin="ending" data-world="ending" data-alt={0}>
        <div className={styles.sticky}>
          <div className={styles.head}>
            <p className={styles.eyebrow}>0 m · Sea level</p>
            <h2 id="ending-title" className={styles.title}>
              And here, at the bottom: the cat that came home.
            </h2>
          </div>
          <div className={styles.foot}>
            <p className={styles.fact}>{HOUSE_CAT.fact}</p>
            <p className={styles.kicker}>
              It shares roughly 95% of its DNA with the tiger. Nearly the same animal. One just chose the windowsill.
            </p>
          </div>
          <div
            className={styles.sill}
            data-station={HOUSE_CAT.id}
            data-mode="4"
            data-sticky="1"
            data-prog-pin="ending"
          >
            <div
              className={styles.photo}
              data-photo=""
              style={{ "--ar": (img.width / img.height).toFixed(4) } as CSSProperties}
            >
              <Image src={img.src} alt="A tabby house cat stretched out on the windowsill" width={img.width} height={img.height} sizes="(max-width: 760px) 80vw, 560px" loading="lazy" />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.after}>
        <p className={styles.reflection}>
          You descended <strong>5,500 metres</strong> past <strong>{stats.total} wild cats</strong>.
          <br />
          <span className={styles.warn}>{stats.atRisk} of them are losing their wild.</span>
        </p>

        <DescentChart />

        <p className={styles.coda}>
          The high ones, the small ones, the ones almost nobody has seen: they only get to stay wild if the wild does too.
        </p>

        <div className={styles.actions}>
          <ClimbButton />
          <a className={styles.link} href="https://www.iucnredlist.org/" target="_blank" rel="noopener noreferrer">
            See the IUCN Red List ↗
          </a>
        </div>

        <details className={styles.credits}>
          <summary>Photo credits</summary>
          <ul>
            {ALL_CATS.map((c) => (
              <li key={c.id}>
                <span className={styles.cn}>{c.name}</span>
                <span>
                  <a href={c.credit.source} target="_blank" rel="noopener noreferrer">
                    {c.credit.author}
                  </a>
                  {", "}
                  {c.credit.licenseUrl ? (
                    <a href={c.credit.licenseUrl} target="_blank" rel="noopener noreferrer license">
                      {c.credit.license}
                    </a>
                  ) : (
                    c.credit.license
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p>
            Photographs from Wikimedia Commons, with their backgrounds removed for this page. The landscapes are not
            photographs: they are drawn live in your browser, one world per cat, as you scroll.
          </p>
        </details>

        <details className={styles.credits}>
          <summary>Sound credits</summary>
          <ul>
            {SOUND_CREDITS.map((s) => (
              <li key={s.id}>
                <span className={styles.cn}>{s.id === "music" ? "Music" : nameOf.get(s.id) ?? s.id}</span>
                <span>
                  {s.what}
                  {", "}
                  <a href={s.source} target="_blank" rel="noopener noreferrer">
                    {s.author}
                  </a>
                  {`, ${s.via}, `}
                  {s.licenseUrl ? (
                    <a href={s.licenseUrl} target="_blank" rel="noopener noreferrer license">
                      {s.license}
                    </a>
                  ) : (
                    s.license
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p>
            Every recording was trimmed, cleaned and levelled for this page, and the leopard&apos;s sawing call is
            built from a single recorded cough. Edits of share-alike recordings are shared under the same licence.
            The Andean cat, the black-footed cat and the rusty-spotted cat have no recording free to use, so they
            stay silent. Wind, rain, insects, birds, water and frogs are not recordings: your browser synthesises
            them, following the same landscape you see.
          </p>
        </details>

        <footer className={styles.footer}>
          <span>meow.wild · Every altitude on this page is real.</span>
          <span>
            A scroll story by{" "}
            <a href="https://meowcreativehaus.xyz" target="_blank" rel="noopener noreferrer">
              Meow Creative Haus
            </a>
          </span>
        </footer>
      </div>
    </section>
  );
}
