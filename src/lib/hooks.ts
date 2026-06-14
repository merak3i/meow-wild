"use client";

import { useEffect, useRef, useState } from "react";

/** True when the user prefers reduced motion. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** Reveal-on-scroll. Returns a ref to attach and whether it has entered view. */
export function useInView<T extends HTMLElement>(
  options: IntersectionObserverInit = { threshold: 0.25, rootMargin: "0px 0px -12% 0px" },
): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setInView(true);
          obs.unobserve(entry.target);
        }
      }
    }, options);
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return [ref, inView];
}
