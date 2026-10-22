import { WALK, type WalkAt, type WalkStep } from "@/lib/walkthrough";
import type { Ambience, Spoken } from "@/lib/audio/ambience";

/**
 * Runs the walk: glides the page from stop to stop, lets each cat call, then
 * plays Vismay's line for it with the caption, over the beat.
 *
 * Every wait is timed on the audio clock, so pausing (which suspends the audio)
 * pauses the walk exactly where it is, mid-sentence included. If the visitor
 * scrolls by hand, the walk steps aside ("away") and can pick up again from
 * the stop it was at.
 */
export type WalkMode = "idle" | "playing" | "paused" | "away" | "done";

export interface WalkState {
  mode: WalkMode;
  index: number;
  total: number;
  caption: string | null;
  /** the line is being spoken right now (for the caption's own fade) */
  speaking: boolean;
}

export interface WalkDeps {
  ambience: Ambience;
  reduced: boolean;
  /** glide the page to y over `seconds` (0: jump); resolves when it is there, or after a timeout */
  scrollTo(y: number, seconds: number): Promise<void>;
  /** where a stop is on the page, or null if it cannot be found */
  targetFor(at: WalkAt): number | null;
  /** does this cat have a recording that will call when it arrives? */
  hasCall(id: string): boolean;
  /** turn the sound on, or back off (keeps the sound toggle in step) */
  soundOn(): void;
  soundOff(): void;
  emit(state: WalkState): void;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class WalkRunner {
  private mode: WalkMode = "idle";
  private index = 0;
  private token = 0;
  private spoken: Spoken | null = null;
  private caption: string | null = null;
  private speaking = false;
  private awayTimer = 0;
  /** the walk switched the sound on, so ending it switches it back off */
  private turnedOn = false;

  constructor(private deps: WalkDeps) {}

  get state(): WalkState {
    return { mode: this.mode, index: this.index, total: WALK.length, caption: this.caption, speaking: this.speaking };
  }

  get active() {
    return this.mode === "playing" || this.mode === "paused" || this.mode === "away";
  }

  private emit() {
    this.deps.emit(this.state);
  }

  /** the first stop at or below where the visitor is now */
  nearest(): number {
    const y = window.scrollY;
    if (y < window.innerHeight * 0.3) return 0;
    for (let i = 0; i < WALK.length; i++) {
      const t = this.deps.targetFor(WALK[i].at);
      if (t !== null && t >= y - window.innerHeight * 0.25) return i;
    }
    return WALK.length - 1;
  }

  start(from?: number) {
    if (this.mode === "playing") return;
    if (this.mode === "paused") {
      this.resume();
      return;
    }
    const i = clamp(from ?? (this.mode === "away" ? this.index : this.nearest()), 0, WALK.length - 1);
    if (this.mode === "idle" || this.mode === "done") this.turnedOn = !this.deps.ambience.running;
    this.deps.soundOn();
    this.deps.ambience.walkMode(true);
    window.clearTimeout(this.awayTimer);
    void this.run(i);
  }

  pause() {
    if (this.mode !== "playing") return;
    this.mode = "paused";
    this.deps.ambience.hold(true);
    this.emit();
  }

  resume() {
    if (this.mode === "paused") {
      this.mode = "playing";
      this.deps.ambience.hold(false);
      this.emit();
    } else if (this.mode === "away") {
      this.start(this.index);
    }
  }

  toggle() {
    if (this.mode === "playing") this.pause();
    else this.resume();
  }

  next() {
    this.jump(this.index + 1);
  }

  prev() {
    this.jump(this.index - 1);
  }

  private jump(i: number) {
    if (!this.active) return;
    if (i >= WALK.length) {
      this.finish();
      return;
    }
    if (this.mode === "paused") this.deps.ambience.hold(false);
    this.hush();
    void this.run(clamp(i, 0, WALK.length - 1));
  }

  /** The visitor took over the scrolling: step aside, keep the beat for a minute in case they come back. */
  takeover() {
    if (this.mode !== "playing" && this.mode !== "paused") return;
    if (this.mode === "paused") this.deps.ambience.hold(false);
    this.token++;
    this.hush();
    this.mode = "away";
    this.emit();
    window.clearTimeout(this.awayTimer);
    this.awayTimer = window.setTimeout(() => {
      if (this.mode === "away") this.deps.ambience.walkMode(false);
    }, 60000);
  }

  stop() {
    if (this.mode === "idle") return;
    if (this.mode === "paused") this.deps.ambience.hold(false);
    this.token++;
    this.hush();
    window.clearTimeout(this.awayTimer);
    this.deps.ambience.walkMode(false);
    this.mode = "idle";
    this.emit();
    if (this.turnedOn && this.deps.ambience.running) {
      this.turnedOn = false;
      this.deps.soundOff();
    }
  }

  private finish() {
    this.token++;
    this.hush();
    this.deps.ambience.walkMode(false);
    this.mode = "done";
    this.emit();
  }

  /** read through a method: the loop checks it after awaits, when the pause button may have changed it */
  private isPaused() {
    return this.mode === "paused";
  }

  private hush() {
    this.spoken?.stop();
    this.spoken = null;
    this.caption = null;
    this.speaking = false;
  }

  /** wait on the audio clock (frozen while paused); false if the walk moved on meanwhile */
  private async waitAudio(seconds: number, tok: number): Promise<boolean> {
    const a = this.deps.ambience;
    const until = a.now + seconds;
    while (a.now < until) {
      if (tok !== this.token) return false;
      await new Promise((r) => window.setTimeout(r, 50));
      // a context that never started (no audio at all) must not hold the walk forever
      if (!a.running && this.mode === "playing") return tok === this.token;
    }
    return tok === this.token;
  }

  private async untilAudio(t: number, tok: number): Promise<boolean> {
    return this.waitAudio(Math.max(0, t - this.deps.ambience.now), tok);
  }

  private preload(i: number) {
    for (let k = i; k < Math.min(WALK.length, i + 3); k++) {
      const id = WALK[k].id;
      if (id) void this.deps.ambience.line(id);
    }
  }

  private async run(start: number) {
    const tok = ++this.token;
    this.mode = "playing";
    const a = this.deps.ambience;
    for (let k = start; k < WALK.length; k++) {
      if (tok !== this.token) return;
      this.index = k;
      this.caption = null;
      this.speaking = false;
      this.emit();
      const step: WalkStep = WALK[k];
      this.preload(k);
      const y = this.deps.targetFor(step.at);
      if (y !== null) {
        const dist = Math.abs(y - window.scrollY) / window.innerHeight;
        const secs = this.deps.reduced ? 0 : clamp(1.5 + dist * 0.42, 1.6, 6.5);
        await this.deps.scrollTo(y, secs);
        if (tok !== this.token) return;
        // a paused walk does not set off the next line
        while (this.isPaused()) {
          if (!(await this.waitAudio(0.1, tok))) return;
        }
      }
      // a cat with a voice calls first, out of its swell; the line follows when it is done
      if (step.at.kind === "station" && this.deps.hasCall(step.at.id)) {
        const id = step.at.id;
        let st = a.callState(id);
        for (let w = 0; w < 40 && st.state === "none"; w++) {
          if (!(await this.waitAudio(0.1, tok))) return;
          st = a.callState(id);
        }
        if (st.state !== "none") {
          if (!(await this.untilAudio(st.end + 0.45, tok))) return;
        }
      }
      if (step.id && step.caption) {
        const buf = await Promise.race([a.line(step.id), new Promise<null>((r) => window.setTimeout(() => r(null), 6000))]);
        if (tok !== this.token) return;
        this.caption = step.caption;
        if (buf) {
          const s = a.speak(buf);
          this.spoken = s;
          this.speaking = true;
          this.emit();
          if (s && !(await this.untilAudio(s.end, tok))) return;
        } else {
          // no voice (the file did not load): leave the caption up long enough to read
          this.speaking = true;
          this.emit();
          if (!(await this.waitAudio(1.2 + step.caption.length / 16, tok))) return;
        }
        this.speaking = false;
        this.spoken = null;
        this.emit();
      }
      if (!(await this.waitAudio(step.hold ?? 0.9, tok))) return;
      this.caption = null;
      this.emit();
    }
    if (tok === this.token) this.finish();
  }
}
