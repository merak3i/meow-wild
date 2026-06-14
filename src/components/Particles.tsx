"use client";

import { useEffect, useRef } from "react";
import styles from "./Particles.module.css";

type Mode = "snow" | "frost" | "mist" | "spore" | "firefly" | "dust";

const MODE_BY_BIOME: Mode[] = ["snow", "frost", "mist", "spore", "firefly", "dust"];

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  phase: number;
  blink: number;
}

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

function spawn(mode: Mode, w: number, h: number): P[] {
  const cfg: Record<Mode, { n: number; r: [number, number]; speed: number }> = {
    snow: { n: 120, r: [1.2, 3.4], speed: 1 },
    frost: { n: 80, r: [0.8, 2.2], speed: 1.3 },
    mist: { n: 16, r: [70, 170], speed: 0.4 },
    spore: { n: 70, r: [0.8, 2], speed: 0.5 },
    firefly: { n: 48, r: [1.4, 2.6], speed: 0.5 },
    dust: { n: 90, r: [0.8, 2.2], speed: 0.4 },
  };
  const c = cfg[mode];
  const arr: P[] = [];
  for (let i = 0; i < c.n; i++) {
    arr.push({
      x: rand(0, w),
      y: rand(0, h),
      vx: rand(-0.4, 0.4),
      vy: rand(0.2, 1) * c.speed,
      r: rand(c.r[0], c.r[1]),
      a: rand(0.4, 1),
      phase: rand(0, Math.PI * 2),
      blink: rand(0.6, 1.8),
    });
  }
  return arr;
}

export default function Particles({ biomeIndex }: { biomeIndex: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef<Mode>(MODE_BY_BIOME[0]);
  const fadeRef = useRef(1);

  useEffect(() => {
    const next = MODE_BY_BIOME[Math.min(Math.max(biomeIndex, 0), MODE_BY_BIOME.length - 1)];
    if (next !== modeRef.current) {
      modeRef.current = next;
      fadeRef.current = 0; // fade the new field in
    }
  }, [biomeIndex]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let particles: P[] = spawn(modeRef.current, window.innerWidth, window.innerHeight);
    let activeMode: Mode = modeRef.current;
    let raf = 0;
    let last = performance.now();

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const step = (now: number) => {
      const dt = Math.min((now - last) / 16.67, 3);
      last = now;

      if (modeRef.current !== activeMode && fadeRef.current < 0.02) {
        activeMode = modeRef.current;
        particles = spawn(activeMode, w, h);
      }
      fadeRef.current = Math.min(fadeRef.current + 0.02 * dt, 1);
      const fade = fadeRef.current;

      ctx.clearRect(0, 0, w, h);
      const mode = activeMode;

      for (const p of particles) {
        p.phase += 0.02 * p.blink * dt;

        if (mode === "snow" || mode === "frost") {
          p.y += p.vy * dt;
          p.x += (p.vx + Math.sin(p.phase) * 0.3) * dt;
          if (p.y > h + 6) {
            p.y = -6;
            p.x = rand(0, w);
          }
        } else if (mode === "mist") {
          p.x += p.vx * 0.6 * dt;
          p.y += Math.sin(p.phase) * 0.12 * dt;
          if (p.x > w + p.r) p.x = -p.r;
          if (p.x < -p.r) p.x = w + p.r;
        } else if (mode === "spore") {
          p.y += p.vy * 0.5 * dt;
          p.x += Math.sin(p.phase) * 0.5 * dt;
          if (p.y > h + 4) {
            p.y = -4;
            p.x = rand(0, w);
          }
        } else {
          // firefly + dust drift upward slowly
          p.y -= p.vy * 0.5 * dt;
          p.x += Math.sin(p.phase) * 0.6 * dt;
          if (p.y < -6) {
            p.y = h + 6;
            p.x = rand(0, w);
          }
        }

        if (mode === "mist") {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          g.addColorStop(0, `rgba(248,252,255,${0.07 * p.a * fade})`);
          g.addColorStop(1, "rgba(248,252,255,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        let color = "255,255,255";
        let alpha = p.a * fade;
        if (mode === "spore") color = "206,222,184";
        else if (mode === "firefly") {
          color = "255,228,140";
          alpha = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(p.phase * 2))) * p.a * fade;
        } else if (mode === "dust") {
          color = "241,212,150";
          alpha = p.a * 0.55 * fade;
        } else if (mode === "snow" || mode === "frost") {
          alpha = p.a * 0.85 * fade;
        }

        if (mode === "firefly") {
          ctx.fillStyle = `rgba(${color},${alpha * 0.4})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(${color},${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />;
}
