import {
  AUDIOMAP_VERSION,
  type Audiomap,
  type EnergyLevel,
  type EnergyPhase,
  type Span,
} from "@/shared/audiomap";

const HOP_SECONDS = 0.01;
const ONSET_WINDOW_SECONDS = 0.5;
const ONSET_GAP_SECONDS = 0.05;
const ONSET_THRESHOLD_SIGMAS = 1.5;
const ONSET_FLOOR = 0.15;
const MIN_BPM = 50;
const MAX_BPM = 200;
const BEAT_TOLERANCE_SECONDS = 0.04;
const SILENCE_RMS = 0.005;
const SILENCE_SECONDS = 0.4;
const PHASE_SECONDS = 1;
const DROP_RATIO = 0.35;
const DROP_HOLD_SECONDS = 0.25;
const BEAT_CUT_CONFIDENCE = 2.5;
const BEAT_CUT_COVERAGE = 0.5;
const BEAT_CUT_RATE = 1.5;

export function audiomapFrom(
  samples: ArrayLike<number>,
  sampleRate: number
): Audiomap {
  const duration = samples.length / sampleRate;
  const hop = Math.max(1, Math.round(sampleRate * HOP_SECONDS));
  const rms = frameRms(samples, hop);
  const onsetStrength = strengthOf(rms);
  const onsets = pickOnsets(onsetStrength, hop / sampleRate);
  const silences = silencesOf(rms, hop / sampleRate, duration);
  const grid = tempoOf(onsetStrength, onsets, hop / sampleRate, duration);
  const coverage = coverageOf(grid.beats, onsets);
  const onsetRate = duration > 0 ? onsets.length / duration : 0;
  const phases = phasesOf(rms, hop / sampleRate, duration);
  const hardStops = hardStopsOf(rms, hop / sampleRate, silences);

  const rhythmic =
    grid.bpm !== null &&
    grid.confidence >= BEAT_CUT_CONFIDENCE &&
    coverage >= BEAT_CUT_COVERAGE &&
    onsetRate >= BEAT_CUT_RATE;

  return {
    beats: rhythmic ? grid.beats : [],
    bpm: rhythmic ? grid.bpm : null,
    duration,
    hardStops,
    onsetRate,
    onsets,
    pacing: rhythmic ? "beat_cut" : "phrase_flow",
    phases,
    silences,
    version: AUDIOMAP_VERSION,
  };
}

function frameRms(samples: ArrayLike<number>, hop: number): Float64Array {
  const count = Math.ceil(samples.length / hop);
  const out = new Float64Array(count);

  for (let frame = 0; frame < count; frame += 1) {
    const from = frame * hop;
    const to = Math.min(samples.length, from + hop);
    let sum = 0;
    for (let at = from; at < to; at += 1) {
      const value = samples[at] ?? 0;
      sum += value * value;
    }
    out[frame] = Math.sqrt(sum / Math.max(1, to - from));
  }

  return out;
}

// Half-wave rectified rise of the log energy: a note starting is a jump up,
// and a decay is not an event.
function strengthOf(rms: Float64Array): Float64Array {
  const out = new Float64Array(rms.length);
  let previous = 0;

  for (let frame = 0; frame < rms.length; frame += 1) {
    const level = Math.log1p((rms[frame] ?? 0) * 100);
    out[frame] = Math.max(0, level - previous);
    previous = level;
  }

  return out;
}

function pickOnsets(strength: Float64Array, step: number): number[] {
  const window = Math.max(1, Math.round(ONSET_WINDOW_SECONDS / step));
  const gap = Math.max(1, Math.round(ONSET_GAP_SECONDS / step));
  const onsets: number[] = [];
  let last = -gap;

  for (let frame = 0; frame < strength.length - 1; frame += 1) {
    const value = strength[frame] ?? 0;
    if (value < ONSET_FLOOR) {
      continue;
    }

    const isPeak =
      value >= (frame === 0 ? 0 : (strength[frame - 1] ?? 0)) &&
      value > (strength[frame + 1] ?? 0);
    if (!isPeak || frame - last < gap) {
      continue;
    }

    const from = Math.max(0, frame - window);
    const to = Math.min(strength.length, frame + window);
    let sum = 0;
    let squares = 0;
    for (let at = from; at < to; at += 1) {
      const sample = strength[at] ?? 0;
      sum += sample;
      squares += sample * sample;
    }
    const size = to - from;
    const mean = sum / size;
    const deviation = Math.sqrt(Math.max(0, squares / size - mean * mean));

    if (value >= mean + ONSET_THRESHOLD_SIGMAS * deviation) {
      onsets.push(frame * step);
      last = frame;
    }
  }

  return onsets;
}

interface Grid {
  readonly beats: number[];
  readonly bpm: number | null;
  readonly confidence: number;
}

// Autocorrelation of the onset strength over the tempo range, then the phase
// that puts the most strength on the grid.
function tempoOf(
  strength: Float64Array,
  onsets: readonly number[],
  step: number,
  duration: number
): Grid {
  const coarse = coarsePeriod(strength, step);
  if (coarse === null) {
    return { beats: [], bpm: null, confidence: 0 };
  }

  const period = refinedPeriod(onsets, coarse.period);
  const beats = gridOf(onsets, period, duration);

  return { beats, bpm: 60 / period, confidence: coarse.confidence };
}

interface Coarse {
  readonly confidence: number;
  readonly period: number;
}

function coarsePeriod(strength: Float64Array, step: number): Coarse | null {
  const minLag = Math.round(60 / MAX_BPM / step);
  const maxLag = Math.min(
    Math.round(60 / MIN_BPM / step),
    Math.floor(strength.length / 2)
  );

  if (minLag <= 0 || maxLag <= minLag) {
    return null;
  }

  let bestLag = 0;
  let best = 0;
  let total = 0;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let sum = 0;
    for (let frame = lag; frame < strength.length; frame += 1) {
      sum += (strength[frame] ?? 0) * (strength[frame - lag] ?? 0);
    }
    total += sum;
    if (sum > best) {
      best = sum;
      bestLag = lag;
    }
  }

  const mean = total / (maxLag - minLag + 1);
  return bestLag === 0 || mean <= 0
    ? null
    : { confidence: best / mean, period: bestLag * step };
}

// The autocorrelation lag is a whole number of hops; the gaps between the
// onsets it found carry the fraction.
function refinedPeriod(onsets: readonly number[], coarse: number): number {
  const gaps: number[] = [];
  for (let at = 1; at < onsets.length; at += 1) {
    const gap = (onsets[at] ?? 0) - (onsets[at - 1] ?? 0);
    if (Math.abs(gap - coarse) < coarse * 0.2) {
      gaps.push(gap);
    }
  }
  return gaps.length === 0 ? coarse : median(gaps);
}

function gridOf(
  onsets: readonly number[],
  period: number,
  duration: number
): number[] {
  let beats: number[] = [];
  let bestCoverage = -1;
  const phases =
    onsets.length === 0
      ? [0]
      : onsets.slice(0, 8).map((onset) => onset % period);

  for (const phase of phases) {
    const grid: number[] = [];
    for (let at = phase; at < duration; at += period) {
      grid.push(Number(at.toFixed(3)));
    }
    const covered = coverageOf(grid, onsets);
    if (covered > bestCoverage) {
      bestCoverage = covered;
      beats = grid;
    }
  }

  return beats;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

function coverageOf(
  beats: readonly number[],
  onsets: readonly number[]
): number {
  if (beats.length === 0) {
    return 0;
  }

  let hit = 0;
  let cursor = 0;
  for (const beat of beats) {
    while (
      cursor < onsets.length &&
      (onsets[cursor] ?? 0) < beat - BEAT_TOLERANCE_SECONDS
    ) {
      cursor += 1;
    }
    const onset = onsets[cursor];
    if (
      onset !== undefined &&
      Math.abs(onset - beat) <= BEAT_TOLERANCE_SECONDS
    ) {
      hit += 1;
    }
  }

  return hit / beats.length;
}

function silencesOf(rms: Float64Array, step: number, duration: number): Span[] {
  const minimum = Math.max(1, Math.round(SILENCE_SECONDS / step));
  const spans: Span[] = [];
  let start: number | null = null;

  for (let frame = 0; frame <= rms.length; frame += 1) {
    const quiet = frame < rms.length && (rms[frame] ?? 0) < SILENCE_RMS;

    if (quiet && start === null) {
      start = frame;
    } else if (!quiet && start !== null) {
      if (frame - start >= minimum) {
        spans.push({
          from: Number((start * step).toFixed(3)),
          to: Number(Math.min(duration, frame * step).toFixed(3)),
        });
      }
      start = null;
    }
  }

  return spans;
}

function levelOf(ratio: number): EnergyLevel {
  if (ratio < 0.08) {
    return "quiet";
  }
  if (ratio < 0.3) {
    return "low";
  }
  if (ratio < 0.65) {
    return "mid";
  }
  return "high";
}

// One-second windows of energy, quantised and merged, so a track reads as a
// handful of phases rather than a thousand numbers.
function phasesOf(
  rms: Float64Array,
  step: number,
  duration: number
): EnergyPhase[] {
  const size = Math.max(1, Math.round(PHASE_SECONDS / step));
  const windows: number[] = [];

  for (let from = 0; from < rms.length; from += size) {
    let sum = 0;
    const to = Math.min(rms.length, from + size);
    for (let at = from; at < to; at += 1) {
      sum += rms[at] ?? 0;
    }
    windows.push(sum / (to - from));
  }

  const loudest = Math.max(0, ...windows);
  if (loudest === 0) {
    return duration > 0 ? [{ from: 0, level: "quiet", to: duration }] : [];
  }

  const phases: EnergyPhase[] = [];
  for (const [index, energy] of windows.entries()) {
    const level = levelOf(energy / loudest);
    const from = index * PHASE_SECONDS;
    const to = Math.min(duration, (index + 1) * PHASE_SECONDS);
    const last = phases.at(-1);

    if (last !== undefined && last.level === level) {
      phases[phases.length - 1] = { ...last, to };
    } else {
      phases.push({ from, level, to });
    }
  }

  return phases;
}

// A hard stop is loud, then not: the energy falls to a fraction of what it was
// within a frame and stays there. The start of every silence counts too.
function hardStopsOf(
  rms: Float64Array,
  step: number,
  silences: readonly Span[]
): number[] {
  const hold = Math.max(1, Math.round(DROP_HOLD_SECONDS / step));
  const before = Math.max(1, Math.round(0.1 / step));
  const stops = silences
    .filter((span) => span.from > 0)
    .map((span) => span.from);

  for (let frame = before; frame + hold < rms.length; frame += 1) {
    let peak = 0;
    for (let at = frame - before; at < frame; at += 1) {
      peak = Math.max(peak, rms[at] ?? 0);
    }
    if (peak < SILENCE_RMS * 4) {
      continue;
    }

    let held = true;
    for (let at = frame; at < frame + hold; at += 1) {
      if ((rms[at] ?? 0) > peak * DROP_RATIO) {
        held = false;
        break;
      }
    }

    if (held) {
      const time = Number((frame * step).toFixed(3));
      const near = stops.some(
        (stop) => Math.abs(stop - time) < DROP_HOLD_SECONDS
      );
      if (!near) {
        stops.push(time);
      }
      frame += hold;
    }
  }

  return stops.sort((a, b) => a - b);
}
