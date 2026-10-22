import type { CSSProperties } from "react";
import { CATS } from "@/lib/cats";
import { IUCN_META, IUCN_SCALE } from "@/lib/format";
import styles from "./DescentChart.module.css";

const W = 1000;
const H = 460;
const PAD = { l: 58, r: 26, t: 26, b: 112 };
const MAX = 6000;

const x = (i: number) => PAD.l + (i / (CATS.length - 1)) * (W - PAD.l - PAD.r);
const y = (m: number) => PAD.t + (1 - m / MAX) * (H - PAD.t - PAD.b);

/**
 * The whole descent as one line: where we met each cat, the highest each has
 * been recorded (dashed), and its Red List status.
 */
export default function DescentChart() {
  const atRisk = CATS.filter((c) => IUCN_META[c.iucn].atRisk).length;
  const path = CATS.map((c, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(c.altitudeM).toFixed(1)}`).join(" ");
  const area = `${path} L${x(CATS.length - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`;

  return (
    <figure className={styles.chart}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="descent-title descent-desc" className={styles.svg}>
        <title id="descent-title">Every cat on the descent, by altitude and Red List status</title>
        <desc id="descent-desc">
          {CATS.map((c) => `${c.name}, met at ${c.altitudeM} metres, ${IUCN_META[c.iucn].label}`).join(". ")}.
        </desc>
        <defs>
          <linearGradient id="descent-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(242,182,109,0.22)" />
            <stop offset="100%" stopColor="rgba(242,182,109,0)" />
          </linearGradient>
        </defs>

        {[0, 1000, 2000, 3000, 4000, 5000, 6000].map((m) => (
          <g key={m}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(m)} y2={y(m)} className={styles.grid} />
            <text x={PAD.l - 12} y={y(m) + 4} className={styles.axis} textAnchor="end">
              {m === 0 ? "0 m" : `${m / 1000}k`}
            </text>
          </g>
        ))}

        <path d={area} fill="url(#descent-fill)" />
        {CATS.map((c, i) =>
          c.reachM && c.reachM > c.altitudeM ? (
            <line
              key={`r-${c.id}`}
              x1={x(i)}
              x2={x(i)}
              y1={y(c.altitudeM) - 8}
              y2={y(c.reachM)}
              className={styles.reach}
            />
          ) : null,
        )}
        <path d={path} className={styles.line} />

        {CATS.map((c, i) => {
          const meta = IUCN_META[c.iucn];
          return (
            <g key={c.id} className={styles.pt} style={{ "--c": meta.color } as CSSProperties}>
              <title>{`${c.name}: ${c.altitudeM.toLocaleString("en-US")} m, ${meta.label}`}</title>
              {meta.atRisk && <circle cx={x(i)} cy={y(c.altitudeM)} r={10} className={styles.ring} />}
              <circle cx={x(i)} cy={y(c.altitudeM)} r={5.5} className={styles.dot} />
              {c.reachM && c.reachM > c.altitudeM && <circle cx={x(i)} cy={y(c.reachM)} r={2.4} className={styles.cap} />}
              <text
                x={x(i)}
                y={y(0) + 18}
                transform={`rotate(-48 ${x(i)} ${y(0) + 18})`}
                className={styles.name}
                textAnchor="end"
              >
                {c.name}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className={styles.caption}>
        <span>
          <b>{atRisk}</b> of {CATS.length} are Near Threatened or worse on the IUCN Red List. The line is where we met each
          one; dashed lines rise to the highest altitude each has been recorded.
        </span>
        <span className={styles.legend} aria-hidden="true">
          {IUCN_SCALE.slice(0, 4).map((code) => (
            <span key={code} style={{ "--c": IUCN_META[code].color } as CSSProperties}>
              <i />
              {IUCN_META[code].label}
            </span>
          ))}
        </span>
      </figcaption>
    </figure>
  );
}
