/**
 * The walkthrough: Vismay walks you down the mountain, top to bottom.
 *
 * Each step is a place on the page and, usually, a line in his voice
 * (public/sound/walk/<id>.m4a and .webm, generated locally in Voicebox from
 * his own cloned voice). `caption` is what the subtitles show; `say` is what
 * the voice was given, numbers spelled out and pauses written in. At a cat
 * with a recording, its own call plays first and the line follows it.
 */
export type WalkAt =
  | { kind: "top" }
  | { kind: "pin"; name: "hero" | "teaser" | "chapter" | "ending"; index?: number; q: number }
  | { kind: "station"; id: string }
  | { kind: "after" };

export interface WalkStep {
  at: WalkAt;
  /** clip id; no line means the walk just pauses here so the page can be read */
  id?: string;
  caption?: string;
  say?: string;
  /** seconds to stay after the line (or, with no line, to stay at all) */
  hold?: number;
}

export const WALK: WalkStep[] = [
  {
    at: { kind: "top" },
    id: "intro",
    caption: "Hi, I'm Vismay. Put your feet up, I'll do the walking. We start at 5,500 metres, and we walk all the way down to the sea. One cat at every height.",
    say: "Hi... I'm Vismay. Put your feet up. I'll do the walking. We start at five and a half thousand metres... and we walk, all the way down to the sea. One cat, at every height.",
  },
  {
    at: { kind: "pin", name: "hero", q: 0.8 },
    id: "light",
    caption: "The sun's coming up. Up here, every breath is half a breath. Let's go and see who lives like this.",
    say: "The sun's coming up. Up here, every breath is half a breath... Let's go and see who lives like this.",
  },
  { at: { kind: "pin", name: "teaser", index: 0, q: 0.78 }, hold: 3 },
  { at: { kind: "pin", name: "chapter", index: 0, q: 0.52 }, hold: 2.2 },
  {
    at: { kind: "station", id: "snow-leopard" },
    id: "snow-leopard",
    caption: "The snow leopard. When it sleeps, it wraps its long tail over its face, like a scarf. I want a tail like that.",
    say: "The snow leopard. When it sleeps, it wraps its long tail over its face... like a scarf. I want a tail like that.",
  },
  {
    at: { kind: "station", id: "andean-mountain-cat" },
    id: "andean-mountain-cat",
    caption: "The Andean mountain cat. Fewer than 1,500 left, and almost no one has seen one alive. So let's whisper.",
    say: "The Andean mountain cat. Fewer than fifteen hundred left... and almost no one has seen one alive. So... let's whisper.",
  },
  {
    at: { kind: "station", id: "pallass-cat" },
    id: "pallass-cat",
    caption: "Pallas's cat. The densest fur of any cat. It's not grumpy. That's just its face.",
    say: "Pallas's cat. The densest fur of any cat. It's not grumpy... that's just its face.",
  },
  { at: { kind: "pin", name: "teaser", index: 1, q: 0.78 }, hold: 2.6 },
  { at: { kind: "pin", name: "chapter", index: 1, q: 0.52 }, hold: 2 },
  {
    at: { kind: "station", id: "puma" },
    id: "puma",
    caption: "The puma. It lives from the Yukon to the tip of Chile, and it can't roar. It purrs. Like a very large house cat.",
    say: "The puma. It lives from the Yukon, to the tip of Chile... and it can't roar. It purrs. Like a very large house cat.",
  },
  {
    at: { kind: "station", id: "eurasian-lynx" },
    id: "eurasian-lynx",
    caption: "The Eurasian lynx. It brings down deer several times its own weight, then hides the leftovers under the snow. Meal prep.",
    say: "The Eurasian lynx. It brings down deer several times its own weight... then hides the leftovers, under the snow. Meal prep.",
  },
  {
    at: { kind: "station", id: "caracal" },
    id: "caracal",
    caption: "The caracal. It jumps three metres straight up and swats birds out of the sky. Sometimes several at once.",
    say: "The caracal. It jumps three metres, straight up... and swats birds out of the sky. Sometimes, several at once.",
  },
  {
    at: { kind: "pin", name: "teaser", index: 2, q: 0.78 },
    id: "cloud",
    caption: "Into the cloud now. The trees start here, and the teeth get longer.",
    say: "Into the cloud now. The trees start here... and the teeth get longer.",
  },
  { at: { kind: "pin", name: "chapter", index: 2, q: 0.52 }, hold: 2 },
  {
    at: { kind: "station", id: "clouded-leopard" },
    id: "clouded-leopard",
    caption: "The clouded leopard. For its size, the longest fangs of any cat alive, and ankles that let it walk down a tree headfirst.",
    say: "The clouded leopard. For its size, the longest fangs of any cat alive... and ankles that let it walk down a tree, headfirst.",
  },
  {
    at: { kind: "station", id: "asian-golden-cat" },
    id: "asian-golden-cat",
    caption: "The Asian golden cat. Golden, mostly. In the forests of Sikkim, every one ever photographed has been jet black.",
    say: "The Asian golden cat. Golden... mostly. In the forests of Sikkim, every one ever photographed, has been jet black.",
  },
  {
    at: { kind: "station", id: "leopard" },
    id: "leopard",
    caption: "The leopard. It drags prey heavier than itself up a tree, where the lions can only watch. One was found frozen near the top of Kilimanjaro. Nobody knows why it went up.",
    say: "The leopard. It drags prey heavier than itself up a tree, where the lions can only watch. One was found frozen, near the top of Kilimanjaro... Nobody knows why it went up.",
  },
  {
    at: { kind: "station", id: "serval" },
    id: "serval",
    caption: "The serval. The longest legs and biggest ears of any cat, for its size. It leaps up and plucks birds right out of the air.",
    say: "The serval. The longest legs, and the biggest ears, of any cat, for its size. It leaps up... and plucks birds right out of the air.",
  },
  {
    at: { kind: "pin", name: "teaser", index: 3, q: 0.78 },
    id: "big",
    caption: "Something very big lives a little further down.",
    say: "Something very big... lives a little further down.",
  },
  { at: { kind: "pin", name: "chapter", index: 3, q: 0.52 }, hold: 2 },
  {
    at: { kind: "station", id: "tiger" },
    id: "tiger",
    caption: "The tiger. The largest cat alive. Its stripes are in the skin too, so a shaved tiger is still striped. Please don't shave a tiger.",
    say: "The tiger. The largest cat alive. Its stripes are in the skin too, so a shaved tiger... is still striped. Please don't shave a tiger.",
  },
  {
    at: { kind: "station", id: "ocelot" },
    id: "ocelot",
    caption: "The ocelot. No two coats are alike. Researchers tell them apart from camera-trap photos, like fingerprints.",
    say: "The ocelot. No two coats are alike. Researchers tell them apart from camera trap photos... like fingerprints.",
  },
  {
    at: { kind: "station", id: "black-footed-cat" },
    id: "black-footed-cat",
    caption: "The black-footed cat. Africa's smallest cat, and its deadliest. Up to fourteen catches in one night. Tiny. Terrifying.",
    say: "The black-footed cat. Africa's smallest cat... and its deadliest. Up to fourteen catches, in one night. Tiny. Terrifying.",
  },
  {
    at: { kind: "station", id: "margay" },
    id: "margay",
    caption: "The margay. It turns its ankles right round and runs down trees headfirst. Like a squirrel with a plan.",
    say: "The margay. It turns its ankles right round, and runs down trees headfirst. Like a squirrel... with a plan.",
  },
  {
    at: { kind: "pin", name: "chapter", index: 4, q: 0.52 },
    id: "warm",
    caption: "Warmer now. And louder.",
    say: "Warmer now... and louder.",
  },
  {
    at: { kind: "station", id: "jaguar" },
    id: "jaguar",
    caption: "The jaguar. It bites straight through the skull, which other big cats rarely do. And it loves the water.",
    say: "The jaguar. It bites straight through the skull, which other big cats rarely do... And it loves the water.",
  },
  { at: { kind: "pin", name: "teaser", index: 4, q: 0.78 }, hold: 2.6 },
  {
    at: { kind: "station", id: "rusty-spotted-cat" },
    id: "rusty-spotted-cat",
    caption: "The rusty-spotted cat. Under a kilo. It could fall asleep in your two cupped hands. It won't. But it could.",
    say: "The rusty spotted cat. Under a kilo. It could fall asleep in your two cupped hands... It won't. But it could.",
  },
  { at: { kind: "pin", name: "teaser", index: 5, q: 0.78 }, hold: 2.6 },
  { at: { kind: "pin", name: "chapter", index: 5, q: 0.52 }, hold: 2 },
  {
    at: { kind: "station", id: "sand-cat" },
    id: "sand-cat",
    caption: "The sand cat. The only cat of the true desert. Furry soles, almost no tracks, and it hunts horned vipers. On purpose.",
    say: "The sand cat. The only cat of the true desert. Furry soles... almost no tracks... and it hunts horned vipers... on purpose.",
  },
  {
    at: { kind: "station", id: "fishing-cat" },
    id: "fishing-cat",
    caption: "The fishing cat. It taps the water with a paw, pretending to be a bug, and when the fish come up, it dives in after them.",
    say: "The fishing cat. It taps the water with a paw, pretending to be a bug... and when the fish come up, it dives in after them.",
  },
  {
    at: { kind: "pin", name: "ending", q: 0.62 },
    id: "home",
    caption: "And here we are. Sea level. The one that came home with us. Nobody really bred it. It found our grain stores, and stayed.",
    say: "And here we are. Sea level. The one that came home with us... Nobody really bred it. It found our grain stores... and stayed.",
    hold: 3,
  },
  {
    at: { kind: "after" },
    id: "outro",
    caption: "Five and a half thousand metres. Eighteen wild cats. Eleven of them are losing their wild. Thanks for walking down with me. If there's a cat near you, tell it I said hi.",
    say: "Five and a half thousand metres. Eighteen wild cats... Eleven of them, are losing their wild. Thanks for walking down with me. And if there's a cat near you... tell it I said hi.",
  },
];

/** every line, for the voice generator and the loader */
export const WALK_LINES = WALK.filter((s): s is WalkStep & { id: string; say: string; caption: string } => !!(s.id && s.say && s.caption));
