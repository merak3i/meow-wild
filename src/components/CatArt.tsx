import type { Cat, CoatSpec } from "@/lib/types";

/* deterministic PRNG so server and client render identical markings */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r = (rng: () => number, lo: number, hi: number) => lo + (hi - lo) * rng();

interface Mark {
  kind: "dot" | "ring" | "blob" | "stripe" | "streak";
  x: number;
  y: number;
  rx: number;
  ry: number;
  rot: number;
  inner?: boolean;
  d?: string;
}

/* body bounding region for scattering markings */
const BOX = { x0: 66, x1: 246, y0: 80, y1: 150 };

function buildMarks(coat: CoatSpec, rng: () => number): Mark[] {
  const marks: Mark[] = [];
  const push = (m: Mark) => marks.push(m);
  const within = () => ({
    x: r(rng, BOX.x0, BOX.x1),
    y: r(rng, BOX.y0, BOX.y1),
  });

  switch (coat.markings) {
    case "spot": {
      const n = 26;
      for (let i = 0; i < n; i++) {
        const p = within();
        push({ kind: "dot", ...p, rx: r(rng, 2.4, 4.6), ry: r(rng, 2.2, 4.2), rot: r(rng, -20, 20) });
      }
      break;
    }
    case "rosette": {
      const n = 16;
      for (let i = 0; i < n; i++) {
        const p = within();
        push({
          kind: "ring",
          ...p,
          rx: r(rng, 6, 10),
          ry: r(rng, 5, 8),
          rot: r(rng, -25, 25),
          inner: rng() > 0.45,
        });
      }
      break;
    }
    case "cloud": {
      const n = 8;
      for (let i = 0; i < n; i++) {
        const p = { x: r(rng, BOX.x0 + 6, BOX.x1 - 6), y: r(rng, BOX.y0 + 4, BOX.y1 - 8) };
        push({ kind: "blob", ...p, rx: r(rng, 12, 20), ry: r(rng, 9, 14), rot: r(rng, -18, 18) });
      }
      break;
    }
    case "stripe": {
      const n = 13;
      for (let i = 0; i < n; i++) {
        const x = BOX.x0 + 14 + (i / n) * (BOX.x1 - BOX.x0 - 18) + r(rng, -4, 4);
        const topY = r(rng, 78, 92);
        const len = r(rng, 38, 58);
        const bend = r(rng, -8, 8);
        push({
          kind: "stripe",
          x,
          y: topY,
          rx: r(rng, 3.5, 6.5),
          ry: len,
          rot: 0,
          d: `M ${x} ${topY} q ${bend} ${len * 0.5} ${bend * 0.4} ${len}`,
        });
      }
      break;
    }
    case "tabby": {
      const n = 9;
      for (let i = 0; i < n; i++) {
        const x = 120 + (i / n) * 120 + r(rng, -3, 3);
        const topY = r(rng, 82, 90);
        const len = r(rng, 30, 46);
        push({
          kind: "stripe",
          x,
          y: topY,
          rx: r(rng, 3, 5),
          ry: len,
          rot: 0,
          d: `M ${x} ${topY} q -5 ${len * 0.5} -2 ${len}`,
        });
      }
      break;
    }
    case "dense": {
      const n = 30;
      for (let i = 0; i < n; i++) {
        const p = within();
        push({ kind: "streak", ...p, rx: r(rng, 1.2, 2.2), ry: r(rng, 4, 8), rot: r(rng, -8, 8) });
      }
      break;
    }
    default:
      break;
  }
  return marks;
}

interface BuildParams {
  haunchR: number;
  shoulderR: number;
  legBottom: number;
  legW: number;
  neckLift: number;
}
function buildParams(coat: CoatSpec): BuildParams {
  switch (coat.build) {
    case "stocky":
      return { haunchR: 55, shoulderR: 46, legBottom: 168, legW: 16, neckLift: 0 };
    case "lean":
      return { haunchR: 46, shoulderR: 37, legBottom: 184, legW: 11, neckLift: -6 };
    default:
      return { haunchR: 51, shoulderR: 41, legBottom: 176, legW: 13.5, neckLift: -2 };
  }
}

export default function CatArt({ cat, className }: { cat: Cat; className?: string }) {
  const coat = cat.coat;
  const rng = mulberry32(hashStr(cat.id));
  const marks = buildMarks(coat, rng);
  const bp = buildParams(coat);
  const uid = cat.id;

  const bodyFill = `url(#mw-body-${uid})`;

  /* ears */
  const earTip = coat.ear === "round" ? 8 : 0;
  const tuft = coat.ear === "tufted";

  /* tail geometry */
  const tailWidth =
    coat.tail === "fluffy" ? 20 : coat.tail === "long" ? 13 : coat.tail === "medium" ? 12 : 11;
  const tailPath =
    coat.tail === "short"
      ? "M 252 124 q 24 4 26 26"
      : coat.tail === "medium"
        ? "M 252 120 q 34 2 40 -28"
        : coat.tail === "fluffy"
          ? "M 250 122 q 44 -2 44 -44 q 0 -16 -10 -24"
          : "M 252 118 q 48 0 50 -46 q 2 -22 -12 -34";

  const headCx = 56;
  const headCy = 56 + bp.neckLift;

  return (
    <svg
      viewBox="0 0 320 210"
      className={className}
      role="img"
      aria-label={`Illustration of a ${cat.name}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`mw-body-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={coat.base} />
          <stop offset="0.62" stopColor={coat.base} />
          <stop offset="1" stopColor={coat.shade} />
        </linearGradient>
        <radialGradient id={`mw-belly-${uid}`} cx="0.5" cy="0.34" r="0.7">
          <stop offset="0" stopColor={coat.belly} stopOpacity="0.9" />
          <stop offset="1" stopColor={coat.belly} stopOpacity="0" />
        </radialGradient>
        <clipPath id={`mw-clip-${uid}`}>
          <path d="M 60 96 C 64 78, 96 70, 120 76 C 150 70, 220 66, 252 86 C 268 98, 268 132, 252 146 C 220 158, 110 158, 78 150 C 60 144, 54 116, 60 96 Z" />
          <ellipse cx="214" cy="112" rx={bp.haunchR} ry={bp.haunchR - 4} />
          <ellipse cx="96" cy="114" rx={bp.shoulderR} ry={bp.shoulderR + 1} />
          <circle cx={headCx} cy={headCy} r="27" />
        </clipPath>
      </defs>

      {/* ground shadow */}
      <ellipse cx="160" cy="190" rx="120" ry="12" fill="rgba(20,30,22,0.16)" />

      <g className="mw-cat-body">
        {/* tail (behind) */}
        <path
          d={tailPath}
          fill="none"
          stroke={coat.shade}
          strokeWidth={tailWidth}
          strokeLinecap="round"
          className="mw-cat-tail"
        />
        {coat.tail === "medium" || coat.tail === "long" ? (
          <path
            d={tailPath}
            fill="none"
            stroke={coat.markColor}
            strokeWidth={tailWidth - 4}
            strokeLinecap="round"
            strokeDasharray="2 14"
            opacity="0.55"
          />
        ) : null}

        {/* back legs */}
        <rect x="196" y="128" width={bp.legW} height={bp.legBottom - 128} rx={bp.legW / 2} fill={coat.shade} />
        <rect x="224" y="130" width={bp.legW} height={bp.legBottom - 130} rx={bp.legW / 2} fill={coat.shade} />
        {/* front legs */}
        <rect x="84" y="130" width={bp.legW} height={bp.legBottom - 130} rx={bp.legW / 2} fill={coat.shade} />
        <rect x="108" y="130" width={bp.legW} height={bp.legBottom - 130} rx={bp.legW / 2} fill={coat.base} />

        {/* haunch + shoulder + torso */}
        <ellipse cx="214" cy="112" rx={bp.haunchR} ry={bp.haunchR - 4} fill={bodyFill} />
        <path
          d="M 60 96 C 64 78, 96 70, 120 76 C 150 70, 220 66, 252 86 C 268 98, 268 132, 252 146 C 220 158, 110 158, 78 150 C 60 144, 54 116, 60 96 Z"
          fill={bodyFill}
        />
        <ellipse cx="96" cy="114" rx={bp.shoulderR} ry={bp.shoulderR + 1} fill={bodyFill} />

        {/* belly highlight */}
        <ellipse cx="150" cy="138" rx="86" ry="22" fill={`url(#mw-belly-${uid})`} />

        {/* markings clipped to body */}
        <g clipPath={`url(#mw-clip-${uid})`}>
          {marks.map((m, i) => {
            if (m.kind === "dot")
              return (
                <ellipse
                  key={i}
                  cx={m.x}
                  cy={m.y}
                  rx={m.rx}
                  ry={m.ry}
                  fill={coat.markColor}
                  transform={`rotate(${m.rot} ${m.x} ${m.y})`}
                />
              );
            if (m.kind === "ring")
              return (
                <g key={i} transform={`rotate(${m.rot} ${m.x} ${m.y})`}>
                  <ellipse
                    cx={m.x}
                    cy={m.y}
                    rx={m.rx}
                    ry={m.ry}
                    fill="none"
                    stroke={coat.markColor}
                    strokeWidth="2.1"
                  />
                  {m.inner && <circle cx={m.x} cy={m.y} r="1.6" fill={coat.markColor} />}
                </g>
              );
            if (m.kind === "blob")
              return (
                <ellipse
                  key={i}
                  cx={m.x}
                  cy={m.y}
                  rx={m.rx}
                  ry={m.ry}
                  fill={coat.markColor}
                  fillOpacity="0.5"
                  stroke={coat.markColor}
                  strokeWidth="1.4"
                  transform={`rotate(${m.rot} ${m.x} ${m.y})`}
                />
              );
            if (m.kind === "streak")
              return (
                <ellipse
                  key={i}
                  cx={m.x}
                  cy={m.y}
                  rx={m.rx}
                  ry={m.ry}
                  fill={coat.markColor}
                  fillOpacity="0.32"
                  transform={`rotate(${m.rot} ${m.x} ${m.y})`}
                />
              );
            return (
              <path
                key={i}
                d={m.d}
                fill="none"
                stroke={coat.markColor}
                strokeWidth={m.rx}
                strokeLinecap="round"
                opacity="0.92"
              />
            );
          })}
        </g>

        {/* neck into head */}
        <path
          d={`M 78 100 Q 58 96 ${headCx - 2} ${headCy + 18} L ${headCx + 18} ${headCy + 20} Q 96 110 104 116 Z`}
          fill={bodyFill}
        />

        {/* ears */}
        <Ear x={headCx - 16} y={headCy - 20} dir={-1} round={earTip} fill={coat.base} inner={coat.shade} tuft={tuft} mark={coat.markColor} />
        <Ear x={headCx + 12} y={headCy - 22} dir={1} round={earTip} fill={coat.base} inner={coat.shade} tuft={tuft} mark={coat.markColor} />

        {/* head */}
        <circle cx={headCx} cy={headCy} r="27" fill={bodyFill} />
        {/* muzzle */}
        <path
          d={`M ${headCx - 26} ${headCy + 4} q -12 2 -14 12 q -1 8 8 10 q 10 2 18 -4`}
          fill={coat.belly}
        />
        {/* tabby forehead M */}
        {coat.markings === "tabby" && (
          <path
            d={`M ${headCx - 10} ${headCy - 16} l 3 12 M ${headCx} ${headCy - 18} l 0 12 M ${headCx + 10} ${headCy - 16} l -3 12`}
            stroke={coat.markColor}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        )}
        {/* nose */}
        <path
          d={`M ${headCx - 38} ${headCy + 14} l 6 -3 l 0 6 Z`}
          fill={coat.markColor}
        />
        {/* mouth */}
        <path
          d={`M ${headCx - 33} ${headCy + 17} q 4 6 12 5`}
          stroke={coat.markColor}
          strokeWidth="1.4"
          fill="none"
          strokeLinecap="round"
          opacity="0.7"
        />
        {/* whiskers */}
        <g stroke={coat.belly} strokeWidth="1" opacity="0.85" strokeLinecap="round">
          <path d={`M ${headCx - 32} ${headCy + 12} q -20 -3 -28 -6`} fill="none" />
          <path d={`M ${headCx - 32} ${headCy + 15} q -20 1 -28 2`} fill="none" />
          <path d={`M ${headCx - 32} ${headCy + 18} q -18 4 -26 8`} fill="none" />
        </g>
        {/* eye */}
        <g className="mw-cat-eye" style={{ transformOrigin: `${headCx - 8}px ${headCy - 2}px` }}>
          <ellipse cx={headCx - 8} cy={headCy - 2} rx="6.5" ry="7.5" fill="#20271f" />
          <ellipse cx={headCx - 8} cy={headCy - 2} rx="4.6" ry="6.4" fill={coat.eye} />
          <ellipse cx={headCx - 8} cy={headCy - 2} rx="1.7" ry="6" fill="#10140e" />
          <circle cx={headCx - 10} cy={headCy - 5} r="1.5" fill="#fff" fillOpacity="0.9" />
        </g>
        {/* brow */}
        <path
          d={`M ${headCx - 16} ${headCy - 10} q 8 -4 16 -1`}
          stroke={coat.shade}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          opacity="0.5"
        />
      </g>
    </svg>
  );
}

function Ear({
  x,
  y,
  dir,
  round,
  fill,
  inner,
  tuft,
  mark,
}: {
  x: number;
  y: number;
  dir: number;
  round: number;
  fill: string;
  inner: string;
  tuft: boolean;
  mark: string;
}) {
  const w = 15;
  const h = 22;
  const tip = `${x} ${y - h}`;
  if (round > 0) {
    return (
      <g>
        <path
          d={`M ${x - w / 2} ${y + 4} Q ${x - w / 2 - 2} ${y - h} ${x + dir * 2} ${y - h + 2} Q ${x + w / 2 + 2} ${y - h} ${x + w / 2} ${y + 4} Z`}
          fill={fill}
        />
        <path
          d={`M ${x - w / 4} ${y} Q ${x} ${y - h + 8} ${x + w / 4} ${y} Z`}
          fill={inner}
          opacity="0.6"
        />
      </g>
    );
  }
  return (
    <g>
      <path d={`M ${x - w / 2} ${y + 4} L ${tip} L ${x + w / 2} ${y + 4} Z`} fill={fill} />
      <path d={`M ${x - w / 4} ${y + 1} L ${x} ${y - h + 8} L ${x + w / 4} ${y + 1} Z`} fill={inner} opacity="0.6" />
      {tuft && (
        <path
          d={`M ${x} ${y - h} l ${dir * 1} -12`}
          stroke={mark}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      )}
    </g>
  );
}
