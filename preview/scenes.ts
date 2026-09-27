export interface RegisteredSequence {
  readonly displayName: string;
  readonly duration: number;
  readonly from: number;
  readonly id: string;
  readonly isInsideSeries?: boolean;
  readonly parent: string | null;
  readonly showInTimeline: boolean;
  readonly singleChildComponent?: unknown;
  readonly type: string;
}

export interface Scene {
  readonly duration: number;
  readonly from: number;
  readonly id: string;
  readonly name: string;
}

function componentName(component: unknown): string | null {
  if (
    (typeof component !== "function" && typeof component !== "object") ||
    component === null
  ) {
    return null;
  }
  const { displayName, name } = component as {
    displayName?: unknown;
    name?: unknown;
  };
  if (typeof displayName === "string" && displayName !== "") {
    return displayName;
  }
  return typeof name === "string" && name !== "" ? name : null;
}

const GENERATED_NAME = /^<[^<>]+>$/;
const SCENE_SUFFIX = /Scene$/;
const WORD_BREAK = /([a-z0-9])([A-Z])/g;

function readable(component: string): string {
  const base = component.replace(SCENE_SUFFIX, "") || component;
  return base.replace(WORD_BREAK, "$1 $2");
}

function named(sequence: RegisteredSequence): boolean {
  return (
    sequence.displayName !== "" && !GENERATED_NAME.test(sequence.displayName)
  );
}

function sceneName(sequence: RegisteredSequence, position: number): string {
  if (named(sequence)) {
    return sequence.displayName;
  }
  const component = componentName(sequence.singleChildComponent);
  return component ? readable(component) : `Scene ${position}`;
}

interface Span {
  readonly end: number;
  readonly index: number;
  readonly sequence: RegisteredSequence;
  readonly start: number;
}

function covered(span: Span, others: readonly Span[]): boolean {
  let reached = span.start;
  const overlapping = others
    .filter((other) => other.start < span.end && other.end > span.start)
    .sort((one, two) => one.start - two.start);
  for (const other of overlapping) {
    if (other.start > reached) {
      return false;
    }
    reached = Math.max(reached, other.end);
  }
  return reached >= span.end;
}

function distinct(spans: readonly Span[]): Span[] {
  const kept = new Set(spans);
  const weakestFirst = [...spans].sort(
    (one, two) =>
      one.end - one.start - (two.end - two.start) ||
      Number(named(one.sequence)) - Number(named(two.sequence)) ||
      two.index - one.index
  );
  for (const span of weakestFirst) {
    kept.delete(span);
    if (!covered(span, [...kept])) {
      kept.add(span);
    }
  }
  return spans.filter((span) => kept.has(span));
}

export function scenesOf(
  sequences: readonly RegisteredSequence[],
  durationInFrames: number
): Scene[] {
  const byId = new Map(sequences.map((sequence) => [sequence.id, sequence]));
  const offset = (sequence: RegisteredSequence): number => {
    const parent =
      sequence.parent === null ? undefined : byId.get(sequence.parent);
    return sequence.from + (parent ? offset(parent) : 0);
  };
  const spans = sequences.flatMap((sequence, index): Span[] => {
    const from = offset(sequence);
    const start = Math.max(0, from);
    const end = Math.min(durationInFrames, from + sequence.duration);
    return sequence.type === "sequence" &&
      sequence.showInTimeline &&
      end > start
      ? [{ end, index, sequence, start }]
      : [];
  });
  const childrenOf = (parent: string) =>
    spans.filter((span) => span.sequence.parent === parent);
  const wholeVideo = (span: Span) =>
    span.start === 0 && span.end >= durationInFrames;

  const scenesIn = (level: readonly Span[]): Span[] => {
    const wrappers = level
      .filter(wholeVideo)
      .map((span) => childrenOf(span.sequence.id))
      .filter((children) => children.length > 0)
      .sort(
        (one, two) =>
          Number(two.some((span) => span.sequence.isInsideSeries)) -
            Number(one.some((span) => span.sequence.isInsideSeries)) ||
          two.length - one.length
      );
    for (const children of wrappers) {
      const inner = scenesIn(children);
      if (inner.length >= 2) {
        return inner;
      }
    }
    return distinct(level.filter((span) => !wholeVideo(span)));
  };

  const scenes = scenesIn(
    spans.filter((span) => span.sequence.parent === null)
  );
  if (scenes.length < 2) {
    return [];
  }
  return scenes
    .sort((one, two) => one.start - two.start)
    .map(({ sequence }, index) => ({
      duration: sequence.duration,
      from: offset(sequence),
      id: sequence.id,
      name: sceneName(sequence, index + 1),
    }));
}

export function sameScenes(
  one: readonly Scene[],
  two: readonly Scene[]
): boolean {
  return (
    one.length === two.length &&
    one.every((scene, index) => {
      const other = two[index];
      return (
        other !== undefined &&
        scene.name === other.name &&
        scene.from === other.from &&
        scene.duration === other.duration
      );
    })
  );
}
