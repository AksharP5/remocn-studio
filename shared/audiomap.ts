import { Schema } from "effect";

export const AUDIOMAP_VERSION = 1;

export const PACINGS = ["beat_cut", "phrase_flow"] as const;

export const Pacing = Schema.Literals(PACINGS);

export type Pacing = (typeof Pacing)["Type"];

export const ENERGY_LEVELS = ["quiet", "low", "mid", "high"] as const;

export const EnergyLevel = Schema.Literals(ENERGY_LEVELS);

export type EnergyLevel = (typeof EnergyLevel)["Type"];

export const Span = Schema.Struct({
  from: Schema.Finite,
  to: Schema.Finite,
});

export type Span = (typeof Span)["Type"];

export const EnergyPhase = Schema.Struct({
  from: Schema.Finite,
  level: EnergyLevel,
  to: Schema.Finite,
});

export type EnergyPhase = (typeof EnergyPhase)["Type"];

export const Audiomap = Schema.Struct({
  beats: Schema.Array(Schema.Finite),
  bpm: Schema.NullOr(Schema.Finite),
  duration: Schema.Finite,
  hardStops: Schema.Array(Schema.Finite),
  onsetRate: Schema.Finite,
  onsets: Schema.Array(Schema.Finite),
  pacing: Pacing,
  phases: Schema.Array(EnergyPhase),
  silences: Schema.Array(Span),
  version: Schema.Int,
});

export type Audiomap = (typeof Audiomap)["Type"];

const seconds = (value: number): string => value.toFixed(2);

const list = (values: readonly number[], cap: number): string => {
  const shown = values.slice(0, cap).map(seconds).join(", ");
  return values.length > cap ? `${shown} … (${values.length} in all)` : shown;
};

export function audiomapBrief(map: Audiomap): string {
  const lines: string[] = [];

  lines.push(
    map.pacing === "beat_cut"
      ? `pacing: beat_cut — the rhythm is clear${map.bpm === null ? "" : ` (about ${Math.round(map.bpm)} bpm)`}; scene changes may sit on beats, but cut on the hard stops and energy jumps below, never on every beat.`
      : "pacing: phrase_flow — the rhythm is weak or absent, so the beat grid is not to be trusted; pace scenes by the energy phases and the silences below, with slow changes rather than hard cuts."
  );

  if (map.hardStops.length > 0) {
    lines.push(`hard stops (s): ${list(map.hardStops, 12)}`);
  }

  if (map.silences.length > 0) {
    lines.push(
      `silences (s): ${map.silences
        .slice(0, 8)
        .map((span) => `${seconds(span.from)}–${seconds(span.to)}`)
        .join(", ")}`
    );
  }

  if (map.phases.length > 0) {
    lines.push(
      `energy (s): ${map.phases
        .map(
          (phase) =>
            `${seconds(phase.from)}–${seconds(phase.to)} ${phase.level}`
        )
        .join(", ")}`
    );
  }

  if (map.pacing === "beat_cut" && map.beats.length > 0) {
    lines.push(`beats (s): ${list(map.beats, 24)}`);
  }

  lines.push(
    "All times are seconds from the start of the file; multiply by the composition's fps for frames."
  );

  return lines.join("\n");
}
