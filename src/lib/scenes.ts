import { CATS, HOUSE_CAT } from "./cats";

export interface Scene {
  id: string;
  src: string;
}

/**
 * Per-animal backdrops, in scroll order. Each cat gets its own habitat photo;
 * the hero opens on the summit panorama. The backdrop crossfades to whichever
 * scene anchor (hero / cat / ending) is nearest the viewport centre.
 */
export const SCENES: Scene[] = [
  { id: "hero", src: "/scenes/snowline.webp" },
  ...CATS.map((c) => ({ id: c.id, src: `/scenes/${c.id}.webp` })),
  { id: HOUSE_CAT.id, src: `/scenes/${HOUSE_CAT.id}.webp` },
];

export const SCENE_INDEX = new Map(SCENES.map((s, i) => [s.id, i]));
