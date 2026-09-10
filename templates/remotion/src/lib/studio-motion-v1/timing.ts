/** Seconds are the authoring clock. Convert to frames only at render boundaries. */
export interface BeatInput {
  readonly enter: number;
  readonly exit: number;
  readonly hold: number;
  readonly id: string;
  /** Overlap with the preceding beat. Defaults to the shared transition window. */
  readonly overlap?: number;
}

export interface Beat {
  readonly end: number;
  readonly exitStart: number;
  readonly id: string;
  readonly settled: number;
  readonly start: number;
}

export interface Timeline {
  readonly beats: readonly Beat[];
  readonly duration: number;
}

const EPSILON = 1e-8;

export function nonNegative(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `${name} must be a finite non-negative number; received ${value}`
    );
  }
  return value;
}

export function positive(value: number, name: string): number {
  nonNegative(value, name);
  if (value === 0) {
    throw new Error(`${name} must be greater than zero`);
  }
  return value;
}

export function secondsAt(frame: number, fps: number): number {
  positive(fps, "fps");
  if (!Number.isFinite(frame)) {
    throw new Error("frame must be finite");
  }
  return frame / fps;
}

export function durationFrames(seconds: number, fps: number): number {
  positive(fps, "fps");
  positive(seconds, "duration");
  return Math.max(1, Math.ceil(seconds * fps - EPSILON));
}

export function progressAt(
  time: number,
  start: number,
  duration: number
): number {
  nonNegative(duration, "duration");
  if (!(Number.isFinite(time) && Number.isFinite(start))) {
    throw new Error("time and start must be finite");
  }
  if (time < start) {
    return 0;
  }
  return duration === 0 ? 1 : Math.min(1, (time - start) / duration);
}

/** Overlaps consume exits/entrances, never the interval reserved for reading. */
export function sequence(inputs: readonly BeatInput[]): Timeline {
  if (inputs.length === 0) {
    throw new Error("A sequence needs at least one beat");
  }
  const ids = new Set<string>();
  const beats: Beat[] = [];
  for (const input of inputs) {
    if (input.id.trim().length === 0 || ids.has(input.id)) {
      throw new Error(`Beat ids must be non-empty and unique: ${input.id}`);
    }
    ids.add(input.id);
    nonNegative(input.enter, `${input.id}.enter`);
    nonNegative(input.hold, `${input.id}.hold`);
    nonNegative(input.exit, `${input.id}.exit`);
    positive(input.enter + input.hold + input.exit, `${input.id}.duration`);
    const previous = beats.at(-1);
    const available = previous
      ? Math.min(previous.end - previous.exitStart, input.enter)
      : 0;
    const overlap = nonNegative(
      input.overlap ?? available,
      `${input.id}.overlap`
    );
    if (overlap > available + EPSILON) {
      throw new Error(
        `${input.id}: overlap ${overlap}s would consume a reading window (maximum ${available}s)`
      );
    }
    const start = previous ? previous.end - overlap : 0;
    const settled = start + input.enter;
    const exitStart = settled + input.hold;
    beats.push({
      end: exitStart + input.exit,
      exitStart,
      id: input.id,
      settled,
      start,
    });
  }
  return { beats, duration: beats.at(-1)?.end ?? 0 };
}

export interface ReadingOptions {
  readonly charactersPerSecond?: number;
  readonly lead?: number;
  readonly locale?: string;
  readonly minimum?: number;
  readonly wordsPerSecond?: number;
}

/** A conservative planning estimate, not a measurement of human comprehension. */
export function readingSeconds(
  text: string,
  options: ReadingOptions = {}
): number {
  const wordsPerSecond = positive(
    options.wordsPerSecond ?? 3.2,
    "wordsPerSecond"
  );
  const charactersPerSecond = positive(
    options.charactersPerSecond ?? 18,
    "charactersPerSecond"
  );
  const lead = nonNegative(options.lead ?? 0.25, "reading lead");
  const minimum = nonNegative(options.minimum ?? 0.8, "minimum reading time");
  const words = [
    ...new Intl.Segmenter(options.locale, { granularity: "word" }).segment(
      text
    ),
  ].filter((part) => part.isWordLike).length;
  const characters = [
    ...new Intl.Segmenter(options.locale, { granularity: "grapheme" }).segment(
      text
    ),
  ].filter((part) => part.segment.trim().length > 0).length;
  if (characters === 0) {
    return 0;
  }
  return Math.max(
    minimum,
    lead + Math.max(words / wordsPerSecond, characters / charactersPerSecond)
  );
}

/** A group's last member settles at the same promised end as a single item. */
export function groupWindow(
  start: number,
  duration: number,
  index: number,
  count: number,
  spread = 0.35
): { readonly start: number; readonly duration: number } {
  nonNegative(duration, "group duration");
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= count
  ) {
    throw new Error(
      "A group needs a positive integer count and an index inside it"
    );
  }
  if (
    !(Number.isFinite(start) && Number.isFinite(spread)) ||
    spread < 0 ||
    spread >= 1
  ) {
    throw new Error(
      "Group start must be finite and spread must be between 0 (inclusive) and 1 (exclusive)"
    );
  }
  const delay = count === 1 ? 0 : (duration * spread * index) / (count - 1);
  return {
    duration: count === 1 ? duration : duration * (1 - spread),
    start: start + delay,
  };
}

export interface TimingIssue {
  readonly beat: string | null;
  readonly code: "truncated" | "reading-window" | "empty-tail";
  readonly message: string;
}

/** Checks an authored plan against its actual enclosing Sequence/composition. */
export function checkTiming(
  timeline: Timeline,
  frames: number,
  fps: number
): TimingIssue[] {
  positive(fps, "fps");
  if (!Number.isInteger(frames) || frames < 1) {
    throw new Error("Render duration must be a positive integer frame count");
  }
  const until = frames / fps;
  const issues: TimingIssue[] = [];
  for (const beat of timeline.beats) {
    if (beat.end > until + EPSILON) {
      issues.push({
        beat: beat.id,
        code: "truncated",
        message: `${beat.id} ends at ${beat.end.toFixed(3)}s, after its ${until.toFixed(3)}s render window`,
      });
    }
    if (
      beat.exitStart > beat.settled &&
      Math.min(beat.exitStart, until) <= beat.settled + EPSILON
    ) {
      issues.push({
        beat: beat.id,
        code: "reading-window",
        message: `${beat.id} has no rendered settled reading interval`,
      });
    }
  }
  if (until - timeline.duration > 1 / fps + EPSILON) {
    issues.push({
      beat: null,
      code: "empty-tail",
      message: `The render continues ${(until - timeline.duration).toFixed(3)}s beyond the sequence; extend the final hold or shorten the render`,
    });
  }
  return issues;
}

/** Exact event neighbours augment regular samples so short transitions are inspected. */
export function reviewFrames(timeline: Timeline, fps: number): number[] {
  const end = durationFrames(timeline.duration, fps) - 1;
  const frames = new Set<number>([0, end]);
  for (const beat of timeline.beats) {
    for (const time of [
      beat.start,
      (beat.start + beat.settled) / 2,
      beat.settled,
      (beat.settled + beat.exitStart) / 2,
      beat.exitStart,
      (beat.exitStart + beat.end) / 2,
      beat.end,
    ]) {
      const at = Math.ceil(time * fps - EPSILON);
      for (const offset of [-1, 0, 1]) {
        frames.add(Math.max(0, Math.min(end, at + offset)));
      }
    }
  }
  return [...frames].sort((a, b) => a - b);
}
