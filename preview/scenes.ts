export interface RegisteredSequence {
  readonly displayName: string;
  readonly duration: number;
  readonly from: number;
  readonly id: string;
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

function sceneName(sequence: RegisteredSequence, position: number): string {
  if (sequence.displayName && !GENERATED_NAME.test(sequence.displayName)) {
    return sequence.displayName;
  }
  const component = componentName(sequence.singleChildComponent);
  return component ? readable(component) : `Scene ${position}`;
}

export function scenesOf(
  sequences: readonly RegisteredSequence[],
  durationInFrames: number
): Scene[] {
  const byId = new Map(sequences.map((sequence) => [sequence.id, sequence]));
  const start = (sequence: RegisteredSequence): number => {
    const parent =
      sequence.parent === null ? undefined : byId.get(sequence.parent);
    return sequence.from + (parent ? start(parent) : 0);
  };
  const candidates = sequences.filter(
    (sequence) => sequence.type === "sequence" && sequence.showInTimeline
  );
  const childrenOf = (parent: string | null) =>
    candidates.filter((sequence) => sequence.parent === parent);

  let level = childrenOf(null);
  let [only] = level;
  while (
    level.length === 1 &&
    only !== undefined &&
    start(only) <= 0 &&
    start(only) + only.duration >= durationInFrames
  ) {
    level = childrenOf(only.id);
    [only] = level;
  }
  if (level.length < 2) {
    return [];
  }
  return level
    .map((sequence) => ({ from: start(sequence), sequence }))
    .sort((one, two) => one.from - two.from)
    .map(({ sequence, from }, index) => ({
      duration: sequence.duration,
      from,
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
