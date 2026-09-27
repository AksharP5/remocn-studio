export type BuildOutcome = { message: string; ok: false } | { ok: true };

export interface BuildState {
  readonly compiling: boolean;
  readonly settled: BuildOutcome | null;
}

export const BUILDING: BuildState = { compiling: true, settled: null };

export function started(state: BuildState): BuildState {
  return state.compiling ? state : { ...state, compiling: true };
}

export function compiled(state: BuildState, outcome: BuildOutcome): BuildState {
  return state.compiling || state.settled !== outcome
    ? { compiling: false, settled: outcome }
    : state;
}

export function pinnable(state: BuildState): boolean {
  return state.settled !== null;
}

export function troubleIn(state: BuildState): string | null {
  const outcome = state.settled;

  return outcome === null || outcome.ok ? null : outcome.message;
}

export function percentGate(): (fraction: number) => number | null {
  let last: number | null = null;

  return (fraction) => {
    const whole = Math.round(fraction * 100);

    if (fraction === 0) {
      last = null;
    }

    if (whole === last) {
      return null;
    }

    last = whole;
    return whole;
  };
}

export function recovering(state: BuildState): boolean {
  return state.settled !== null && !state.settled.ok;
}
