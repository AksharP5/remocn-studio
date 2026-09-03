import { type Fiber, fiberOf } from "./fiber";

export interface TimeWindow {
  readonly from: number;
  readonly until: number;
}

const FALLBACK_DURATION = 60;

export function windowOf(node: Element): TimeWindow | null {
  let fiber: Fiber | null = fiberOf(node);

  while (fiber !== null) {
    const scope = scopeOf(fiber.memoizedProps);

    if (scope !== null) {
      const from = Math.trunc(scope.from);
      const duration = Math.trunc(scope.duration);

      return {
        from,
        until: from + (duration > 0 ? duration : FALLBACK_DURATION),
      };
    }

    fiber = fiber.return;
  }

  return null;
}

function scopeOf(
  props: Record<string, unknown> | null
): { duration: number; from: number } | null {
  const value = props?.value;

  if (value === null || typeof value !== "object") {
    return null;
  }

  const { cumulatedFrom, durationInFrames, relativeFrom } = value as Record<
    string,
    unknown
  >;

  if (!(finite(cumulatedFrom) && finite(relativeFrom))) {
    return null;
  }

  return {
    duration: finite(durationInFrames)
      ? (durationInFrames as number)
      : FALLBACK_DURATION,
    from: (cumulatedFrom as number) + (relativeFrom as number),
  };
}

function finite(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value);
}
