import type { Kit } from "./kit";
import * as F from "./figures";

/**
 * Every figure in a grid on a plain ground, for drawing them well (?story=sheet).
 * Not part of the page.
 */
export function gallery(k: Kit, W: number, H: number, t: number) {
  const cell = Math.min(W / 10, H / 7.2);
  let i = 0;
  const next = (scale: number, draw: () => void, label?: string) => {
    const col = i % 10;
    const row = Math.floor(i / 10);
    i++;
    const x = W * 0.02 + cell * (col + 0.5);
    const y = cell * (row + 0.85);
    // a plate to stand on
    k.at(x, y, cell).ground(-1, 1, 1);
    k.st.mode = 2;
    k.st.shade = 1;
    k.st.rgb = [0.82, 0.8, 0.74];
    k.rect(-0.48, -0.13, 0.48, 0.0);
    k.st.rgb = [0.12, 0.12, 0.13];
    k.at(x, y, cell * scale);
    draw();
    void label;
  };
  const q = (sp: F.QuadSpec, st: F.QuadState) => () => F.quad(k, sp, st);
  next(0.42, q(F.BHARAL, { graze: 1 }));
  next(0.42, q(F.BHARAL, { graze: 0, alert: 1 }));
  next(0.42, q(F.BHARAL, { phase: t * 3, stride: 1, graze: 0.2 }));
  next(0.36, q(F.GUANACO, { graze: 1 }));
  next(0.36, q(F.GUANACO, { graze: 0, alert: 0.6, phase: t * 3, stride: 0.8 }));
  next(0.4, q(F.DEER, { graze: 0, alert: 1 }));
  next(0.4, q(F.DOE, { graze: 1 }));
  next(0.42, q(F.SPRINGBOK, { graze: 0.9 }));
  next(0.42, q(F.SPRINGBOK, { pronk: Math.max(0, Math.sin(t * 3)) }));
  next(0.34, q(F.CATTLE, { graze: 0.3, phase: t * 2, stride: 0.5 }));
  next(0.3, q(F.CAMEL, { phase: t * 2.2, stride: 0.7 }));
  next(0.4, q(F.HYENA, { graze: 0.4 }));
  next(0.32, q(F.CAPYBARA, { graze: 0.7 }));
  next(0.36, q(F.HORSE, { phase: t * 2.4, stride: 0.6 }));
  next(0.36, q(F.LLAMA, { phase: t * 2.4, stride: 0.8 }));
  const poses: F.Pose[] = ["stand", "walk", "binoculars", "camera", "scope", "antenna", "pole", "wave", "sit", "point"];
  for (const p of poses) next(0.75, () => F.human(k, { pose: p, phase: t * 2.5, pack: p === "pole", hat: p === "binoculars" }));
  next(0.75, () => F.human(k, { pose: "walk", phase: t * 2.5, basket: true, robe: true }));
  next(0.75, () => F.human(k, { pose: "walk", phase: t * 2.5, umbrella: true }));
  next(0.75, () => F.human(k, { pose: "stand", lamp: 1, beam: 1.5 }));
  for (const kind of ["small", "dove", "hornbill", "flamingo", "toucan"] as const) next(0.22, () => {
    k.at(k.ox, k.oy - cell * 0.4, k.s);
    F.flyer(k, kind, t * 8);
  });
  for (const kind of ["condor", "vulture", "lammergeier", "eagle"] as const) next(0.3, () => {
    k.at(k.ox, k.oy - cell * 0.4, k.s);
    F.soarer(k, kind, Math.sin(t * 0.5) * 0.8);
  });
  next(0.22, () => F.pika(k, Math.sin(t) > 0 ? 1 : 0, Math.sin(t * 2)));
  next(0.24, () => F.viscacha(k, Math.max(0, Math.sin(t)), t));
  next(0.22, () => F.hare(k, 0, 0, 1));
  next(0.22, () => F.hare(k, 1, t * 12, 0));
  next(0.24, () => F.jerboa(k, t * 7));
  next(0.2, () => F.mouse(k, Math.max(0, Math.sin(t))));
  next(0.6, () => F.wader(k, "crane", Math.max(0, Math.sin(t)), t));
  next(0.6, () => F.wader(k, "heron", 0, t));
  next(0.42, () => F.peacock(k));
  next(0.3, () => F.fowl(k, Math.max(0, Math.sin(t * 3))));
  next(0.3, () => F.fish(k, (t * 0.4) % 1));
  next(0.42, () => F.caiman(k));
  next(0.28, () => F.jeep(k, 3, t));
  next(0.18, () => F.launch(k, 4, t));
  next(0.22, () => F.canoe(k, t));
  next(0.36, () => F.tent(k, 1));
  next(0.36, () => F.ger(k));
  next(0.3, () => F.watchtower(k, t));
  next(0.3, () => F.windpump(k, t, 0.4));
  next(0.3, () => F.temple(k, t));
  next(0.5, () => F.cameraTrap(k, t));
  next(0.3, () => F.flags(k, 2.6, 0.3, t, 0.4));
  next(0.5, () => F.litWindow(k, t));
}
