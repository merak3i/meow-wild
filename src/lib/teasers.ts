export interface Teaser {
  /** render this teaser immediately after the given cat id, or after the hero */
  afterCatId: string;
  kicker?: string;
  line: string;
}

/** Cliffhangers in the gaps — each teases the cat you're about to meet. */
export const TEASERS: Teaser[] = [
  {
    afterCatId: "hero",
    kicker: "The descent begins",
    line: "Almost nothing survives the roof of the world. You're about to meet what does.",
  },
  {
    afterCatId: "pallass-cat",
    kicker: "Still 4,000 m up",
    line: "One cat lives at every height of this mountain — snow to sea. It's next.",
  },
  {
    afterCatId: "caracal",
    kicker: "Into the clouds",
    line: "Here the trees begin. And the teeth get longer.",
  },
  {
    afterCatId: "serval",
    kicker: "300 m below you",
    line: "Down here stalks the largest cat that has ever lived.",
  },
  {
    afterCatId: "jaguar",
    kicker: "Keep going",
    line: "The next cat could fall asleep in your two cupped hands.",
  },
  {
    afterCatId: "rusty-spotted-cat",
    kicker: "Almost at sea level",
    line: "One of the last cats down here never drinks water at all.",
  },
];

export const TEASER_BY_AFTER: Record<string, Teaser> = Object.fromEntries(
  TEASERS.map((t) => [t.afterCatId, t]),
);
