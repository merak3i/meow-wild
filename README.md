# meow.wild

How high does a cat live? A scroll down one mountain, from the snow leopard at 5,000 m to the house cat asleep on a windowsill at sea level, meeting 18 wild cats at the altitude each one calls home. Every landscape is drawn live as you descend.

A [Meow Creative Haus](https://meowcreativehaus.xyz) piece. Live at [meow-wild.vercel.app](https://meow-wild.vercel.app).

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

Next.js 16 (App Router), React 19, Lenis for scroll. No other runtime dependencies: the world is one WebGL2 context, the sound is WebAudio.

## How it works

**Scroll is the clock.** `lib/world/timeline.ts` reads the `[data-world]` and `[data-alt]` anchors in the page and maps scroll position to two neighbouring worlds and a blend between them, held still near each cat so its world is stable while you read. Each world is a preset of about forty numbers in `lib/world/presets.ts`: time of day, haze, ridgeline heights and jaggedness, snowline and treeline, water, cloud sea, weather, which trees grow.

**The world** (`lib/world/renderer.ts`, `lib/world/shaders.ts`) is a single fullscreen shader that draws the sky and seven parallax ridgeline cards, far to near, with snow, rock, forest, water and its reflections, mist and weather, at reduced resolution with adaptive quality. A second pass composites it at full resolution with stars, motion blur from scroll speed, the window frame of the ending, vignette and grain.

**The story layer** (`lib/world/story/`) puts small lives into each landscape: the cat's prey and neighbours, and somewhere far off, people watching without coming close. `lib/world/terrain.ts` is the shader's ridgeline noise ported to JavaScript step for step, so a herd can graze on the exact ridge the GPU draws. Figures are built from signed-distance primitives (`kit.ts`), coloured by the ground under their feet, hidden behind nearer ridges, faded under text, and drawn instanced in one pass, each world's figures fading as a whole. When something moves in its world, the cat turns to look.

**The cats** assemble from particles of their own photograph, then come alive (`lib/world/living.ts`): each cutout has a hand-placed rig (`lib/rigs.ts`) for breathing, blinking, ear flicks, a tail wave and a head that follows the pointer or whatever its world is doing, and a relief map that relights it with its world's sun.

**Sound** (`lib/audio/ambience.ts`), off until you turn it on: wind, drip, birds, cicadas, frogs, crickets and running water, all synthesized and mixed by each world's numbers, a music bed that darkens as you descend, and each cat's real call, once per visit, as it arrives. The house cat purrs.

**The crossings between cats** are scored like a film, from the same recordings, processed in the browser. As a cat arrives, its voice swells up out of a long reverb (the first moments of its call, reversed, reverberated and reversed back, rendered once in an `OfflineAudioContext`) and the call lands on the swell's peak, with its own voice an octave down for weight while the landscape holds its breath. Turn back before it calls and the swell falls away. As you leave, the call comes back once, slower and darker, down the valley. While a chapter or teaser holds the screen, the next cat's voice drifts through it in slowed grains, and each chapter title lands on a low boom made from that voice. Cats without a recording stay silent: no voice is borrowed.

**The walk** (`lib/walkthrough.ts`, `lib/walk/runner.ts`, `components/Walk.tsx`): Vismay takes you down, stop by stop, in a calm ElevenLabs narrator voice over an ambient beat that takes the music bed's place. Each cat calls first, then he speaks; captions follow him. Space pauses, the arrows skip, Escape ends it, and scrolling by hand steps the walk aside until you pick it up again. Everything waits on the audio clock, so a pause stops the walk mid-sentence and it carries on from the same word.

**The cursor** is a paw, drawn by `scripts/cursor/paw.py` (`public/cursor`), with pink beans over anything you can press.

**Fallbacks.** Without WebGL2 the page keeps a flat painted sky and plain photographs. With reduced motion there are no particles or scroll effects and every world holds still. Without JavaScript it is a long, readable page.

## Debugging

| Query | Effect |
| --- | --- |
| `?story=lines` | draws every ridgeline the story layer computes, to check it against the shader |
| `?story=sheet` | every story figure on one grid |
| `?story=0` | story layer off |
| `?live=0` | living photographs off |
| `?rig=3` | exaggerates every rig's motion three times |
| `?q=0.5` | fixed world resolution scale (no adaptive quality) |

In development, `window.__mw` exposes the ambience, living and story layers in the console.

## Assets

- Photographs: Wikimedia Commons, credited in `public/cats/CREDITS.md` and on the page. How they became cutouts: [`scripts/cutouts/`](scripts/cutouts/README.md).
- Sound: credited in `src/lib/sounds.ts` and on the page. How the clips were edited: [`scripts/audio/`](scripts/audio/README.md). Some recordings and the music are licensed for non-commercial use only.
- The walk: narration voiced with ElevenLabs (Eleven v4, Kiaan) as one take of the whole script, split into the 25 lines on its pauses and levelled to -19 LUFS (an earlier Voicebox take of Vismay's own voice is in git history, `scripts/audio/walk.py`); the beat, "a slow way down", is synthesized from nothing by `scripts/audio/beats.py`.
- Fonts: Instrument Serif, Instrument Sans and JetBrains Mono, self-hosted under the SIL Open Font License (`src/app/fonts/OFL.txt`).
