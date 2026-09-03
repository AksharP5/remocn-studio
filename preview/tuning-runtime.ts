import type { PreviewCommand, TuningValue } from "./bridge";
import type { TuningTarget } from "./tuning";

export interface TuningReply {
  readonly error: string | null;
  readonly ok: boolean;
}

export interface TuningReading {
  readonly path: string;
  readonly targetId: string;
  readonly value: TuningValue;
}

export interface TuningRuntime {
  readonly clear: () => void;
  readonly reset: (targetId: string, paths: readonly string[]) => TuningReply;
  readonly set: (
    targetId: string,
    path: string,
    value: TuningValue
  ) => TuningReply;
  readonly targetsOf: (element: Element) => readonly TuningTarget[];
  readonly valuesOf: (
    targetId: string
  ) => Readonly<Record<string, unknown>> | null;
}

let active: TuningRuntime | null = null;

export function activate(runtime: TuningRuntime): () => void {
  active = runtime;
  return () => {
    if (active === runtime) {
      active = null;
    }
  };
}

/** The `Interactive`s around an element, innermost first. */
export function targetsOf(element: Element): readonly TuningTarget[] {
  return active?.targetsOf(element) ?? [];
}

export function clearTuning(): void {
  active?.clear();
}

export function tuningValues(
  targetIds: readonly string[]
): readonly TuningReading[] {
  const readings: TuningReading[] = [];

  for (const targetId of targetIds) {
    const values = active?.valuesOf(targetId) ?? null;

    if (values === null) {
      continue;
    }

    for (const [path, value] of Object.entries(values)) {
      if (path.length > 0 && isTuningValue(value)) {
        readings.push({ path, targetId, value });
      }
    }
  }

  return readings;
}

function isTuningValue(value: unknown): value is TuningValue {
  return Array.isArray(value) ? value.every(isPlain) : isPlain(value);
}

function isPlain(value: unknown): boolean {
  return (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  );
}

export function tune(
  command: Extract<PreviewCommand, { type: "tune.set" | "tune.reset" }>
): TuningReply {
  if (active === null) {
    return {
      error: "Interactive controls are unavailable in this preview.",
      ok: false,
    };
  }

  return command.type === "tune.set"
    ? active.set(command.targetId, command.path, command.value)
    : active.reset(command.targetId, command.paths);
}
