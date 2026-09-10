import { type Beat, groupWindow, positive, progressAt } from "./timing";

export type Curve =
  | "settle"
  | "travel"
  | "accelerate"
  | "linear"
  | ((progress: number) => number);

/** Bounded curves have exact endpoints; a settled object stays settled. */
export function ease(progress: number, curve: Curve = "settle"): number {
  if (!Number.isFinite(progress)) {
    throw new Error("Motion progress must be finite");
  }
  const t = Math.max(0, Math.min(1, progress));
  if (typeof curve === "function") {
    return t === 0 || t === 1 ? t : curve(t);
  }
  switch (curve) {
    case "settle":
      return 1 - (1 - t) ** 4;
    case "travel":
      return t * t * t * (10 + t * (-15 + 6 * t));
    case "accelerate":
      return t ** 3;
    case "linear":
      return t;
    default:
      throw new Error(`Unknown motion curve: ${curve}`);
  }
}

export interface RevealOptions {
  readonly count?: number;
  readonly entryCurve?: Curve;
  readonly exitCurve?: Curve;
  readonly index?: number;
  readonly spread?: number;
}

export interface RevealState {
  readonly enter: number;
  readonly exit: number;
  readonly opacity: number;
  readonly phase: "before" | "enter" | "hold" | "exit" | "after";
  readonly visible: boolean;
}

export function phaseAt(time: number, beat: Beat): RevealState["phase"] {
  if (time < beat.start) {
    return "before";
  }
  if (time < beat.settled) {
    return "enter";
  }
  if (time < beat.exitStart) {
    return "hold";
  }
  if (time < beat.end) {
    return "exit";
  }
  return "after";
}

/** One clock for a whole phrase. Geometry belongs to the caller. */
export function revealAt(
  time: number,
  beat: Beat,
  options: RevealOptions = {}
): RevealState {
  const window = groupWindow(
    beat.start,
    beat.settled - beat.start,
    options.index ?? 0,
    options.count ?? 1,
    options.spread
  );
  const entryProgress = progressAt(time, window.start, window.duration);
  const exitProgress = progressAt(
    time,
    beat.exitStart,
    beat.end - beat.exitStart
  );
  const enter = ease(entryProgress, options.entryCurve ?? "settle");
  const exit = ease(exitProgress, options.exitCurve ?? "accelerate");
  const visible = time >= beat.start && time < beat.end;
  return {
    enter,
    exit,
    // Opacity resolves earlier than travel, but stays inside the group's budget.
    opacity: visible
      ? ease(entryProgress / 0.55, options.entryCurve ?? "settle") *
        (1 - ease(exitProgress / 0.9, options.exitCurve ?? "accelerate"))
      : 0,
    phase: phaseAt(time, beat),
    visible,
  };
}

export interface Rect {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

/** Shared-object handoffs use one rectangle, not two independently faded copies. */
export function mixRect(from: Rect, to: Rect, progress: number): Rect {
  const p = Math.max(0, Math.min(1, progress));
  return {
    height: from.height + (to.height - from.height) * p,
    width: from.width + (to.width - from.width) * p,
    x: from.x + (to.x - from.x) * p,
    y: from.y + (to.y - from.y) * p,
  };
}

/** A multiplicative change covers equal ratios in equal portions of the gesture. */
export function scaleBetween(
  from: number,
  to: number,
  progress: number
): number {
  positive(from, "initial scale");
  positive(to, "final scale");
  const p = Math.max(0, Math.min(1, progress));
  return Math.exp(Math.log(from) + (Math.log(to) - Math.log(from)) * p);
}

export function valueAt(
  time: number,
  start: number,
  duration: number,
  from: number,
  to: number,
  curve: Curve = "travel"
): number {
  return from + (to - from) * ease(progressAt(time, start, duration), curve);
}
