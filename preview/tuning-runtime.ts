import type { PreviewCommand, TuningValue } from "./bridge";
import type { TuningTarget } from "./tuning";

export interface TuningReply {
  readonly error: string | null;
  readonly ok: boolean;
}

export interface TuningRuntime {
  readonly reset: (targetId: string, paths: readonly string[]) => TuningReply;
  readonly set: (
    targetId: string,
    path: string,
    value: TuningValue
  ) => TuningReply;
  readonly targetsOf: (element: Element) => readonly TuningTarget[];
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
