// biome-ignore-all lint/performance/noAwaitInLoops: sequential rendering and streaming keep resource use bounded and preserve frame order.
import { open } from "node:fs/promises";
import { makeFinding } from "./readiness-analysis";
import type { ReadinessFinding, ReadinessOptions } from "./readiness-contract";

export interface AudioWindow {
  clipped: number;
  from: number;
  peak: number;
  rms: number;
  to: number;
}
export interface AudioMeasurement {
  channels: number;
  duration: number;
  path: string;
  sampleRate: number;
  windows: AudioWindow[];
}
const db = (value: number) => 20 * Math.log10(Math.max(value, 1e-12));

// Stream PCM in bounded chunks. Retain only 10ms measurements, not the full mix.
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: RIFF chunk and PCM sample parsing share a bounded streaming state machine.
export async function measureWav(
  path: string,
  signal?: AbortSignal
): Promise<AudioMeasurement> {
  const file = await open(path, "r");
  try {
    const header = Buffer.alloc(12);
    await file.read(header, 0, 12, 0);
    if (
      header.toString("ascii", 0, 4) !== "RIFF" ||
      header.toString("ascii", 8, 12) !== "WAVE"
    ) {
      throw new Error("Audio renderer did not produce a RIFF/WAVE PCM mix.");
    }
    let position = 12,
      format = 0,
      channels = 0,
      sampleRate = 0,
      bits = 0,
      dataOffset = 0,
      dataSize = 0;
    const { size } = await file.stat();
    while (position + 8 <= size) {
      signal?.throwIfAborted();
      const chunk = Buffer.alloc(8);
      await file.read(chunk, 0, 8, position);
      const kind = chunk.toString("ascii", 0, 4),
        length = chunk.readUInt32LE(4);
      if (kind === "fmt ") {
        const fmt = Buffer.alloc(Math.min(length, 64));
        await file.read(fmt, 0, fmt.length, position + 8);
        if (fmt.length < 16) {
          throw new Error("Truncated WAV format chunk.");
        }
        format = fmt.readUInt16LE(0);
        channels = fmt.readUInt16LE(2);
        sampleRate = fmt.readUInt32LE(4);
        bits = fmt.readUInt16LE(14);
        if (format === 65_534 && fmt.length >= 40) {
          format = fmt.readUInt16LE(24);
        }
      }
      if (kind === "data") {
        dataOffset = position + 8;
        dataSize = Math.min(length, size - dataOffset);
        break;
      }
      position += 8 + length + (length % 2);
    }
    if (
      !(
        dataOffset &&
        channels &&
        sampleRate &&
        [16, 24, 32].includes(bits) &&
        (format === 1 || (format === 3 && bits === 32))
      )
    ) {
      throw new Error(
        `Unsupported WAV encoding: format=${format}, bits=${bits}.`
      );
    }
    const bytes = bits / 8,
      stride = bytes * channels,
      windowSize = Math.max(1, Math.round(sampleRate * 0.01));
    const capacity = Math.floor((1024 * 1024) / stride) * stride,
      buffer = Buffer.alloc(capacity);
    const windows: AudioWindow[] = [];
    let frames = 0,
      windowFrames = 0,
      sum = 0,
      peak = 0,
      clipped = 0;
    const flush = () => {
      if (windowFrames <= 0) {
        return;
      }
      windows.push({
        clipped,
        from: (frames - windowFrames) / sampleRate,
        peak,
        rms: Math.sqrt(sum / (windowFrames * channels)),
        to: frames / sampleRate,
      });
      windowFrames = 0;
      sum = 0;
      peak = 0;
      clipped = 0;
    };
    for (let offset = 0; offset < dataSize; ) {
      signal?.throwIfAborted();
      const { bytesRead } = await file.read(
        buffer,
        0,
        Math.min(capacity, dataSize - offset),
        dataOffset + offset
      );
      if (!bytesRead) {
        break;
      }
      const usable = bytesRead - (bytesRead % stride);
      if (!usable) {
        throw new Error("Truncated PCM frame.");
      }
      for (let i = 0; i < usable; i += stride) {
        for (let c = 0; c < channels; c += 1) {
          const at = i + c * bytes;
          let value: number;
          if (format === 3) {
            value = buffer.readFloatLE(at);
          } else if (bits === 16) {
            value = buffer.readInt16LE(at) / 32_768;
          } else if (bits === 24) {
            value = buffer.readIntLE(at, 3) / 8_388_608;
          } else {
            value = buffer.readInt32LE(at) / 2_147_483_648;
          }
          if (!Number.isFinite(value)) {
            throw new Error("Non-finite audio sample in rendered mix.");
          }
          peak = Math.max(peak, Math.abs(value));
          sum += value * value;
          if (Math.abs(value) >= 0.9999) {
            clipped += 1;
          }
        }
        frames += 1;
        windowFrames += 1;
        if (windowFrames === windowSize) {
          flush();
        }
      }
      offset += usable;
    }
    flush();
    return {
      channels,
      duration: frames / sampleRate,
      path,
      sampleRate,
      windows,
    };
  } finally {
    await file.close();
  }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: signal evidence and declared intent are evaluated together to prevent unsupported audio claims.
export function analyzeAudio(
  mix: AudioMeasurement,
  fps: number,
  boundaries: readonly number[],
  options: ReadinessOptions,
  stems: readonly {
    role: "speech" | "music" | "sfx";
    measurement: AudioMeasurement;
  }[] = []
): ReadinessFinding[] {
  const audio = options.audio ?? {},
    silence = audio.silenceDb ?? -55,
    peakThreshold = audio.peakDb ?? -1;
  const findings: ReadinessFinding[] = [];
  const expected =
    audio.expectedIntervals ??
    (audio.expected ? [{ from: 0, to: Math.ceil(mix.duration * fps) }] : []);
  const intentional = (from: number, to: number) =>
    audio.silenceIntervals?.some(
      (x) => x.from / fps <= from && x.to / fps >= to
    ) ?? false;
  const lastByCode = new Map<string, number>();
  const emit = (
    code: string,
    from: number,
    to: number,
    message: string,
    measurements: Record<string, number>,
    expectedValue: string,
    confidence: string,
    severity: "error" | "warning" | "info" = "warning",
    conclusion: "measurement" | "heuristic" = "heuristic"
  ) => {
    const row = makeFinding({
      category: "audio",
      code,
      conclusion,
      confidence,
      evidence: [mix.path],
      expected: expectedValue,
      fix: "Inspect the audio interval; adjust gain, fades, track timing or Sequence bounds and render the mix again.",
      from: Math.floor(from * fps),
      measurements,
      message,
      observed: JSON.stringify(measurements),
      severity,
      to: Math.max(Math.floor(from * fps) + 1, Math.ceil(to * fps)),
    });
    const index = lastByCode.get(code);
    const previous = index === undefined ? undefined : findings[index];
    if (previous && row.from <= previous.to) {
      findings[index as number] = makeFinding({
        ...previous,
        frames: [previous.from, Math.max(previous.to, row.to) - 1],
        measurements: {
          ...previous.measurements,
          ...row.measurements,
          ...(code === "audio_clipping"
            ? {
                clippedSamples:
                  (previous.measurements.clippedSamples ?? 0) +
                  (row.measurements.clippedSamples ?? 0),
              }
            : {}),
        },
        to: Math.max(previous.to, row.to),
      });
    } else {
      lastByCode.set(code, findings.length);
      findings.push(row);
    }
  };
  let maxPeak = 0,
    totalClipped = 0;
  for (const window of mix.windows) {
    maxPeak = Math.max(maxPeak, window.peak);
    totalClipped += window.clipped;
  }
  for (const window of mix.windows) {
    if (window.clipped >= 3) {
      emit(
        "audio_clipping",
        window.from,
        window.to,
        "Rendered audio reaches digital full scale repeatedly.",
        { clippedSamples: window.clipped, peakDb: db(window.peak) },
        "No sustained full-scale samples.",
        "Measured PCM sample peaks; this detects saturation risk, not the original pre-limiter waveform.",
        "error",
        "measurement"
      );
    }
  }
  if (db(maxPeak) > peakThreshold && totalClipped < 3) {
    const window = mix.windows.find((x) => x.peak === maxPeak);
    if (window) {
      emit(
        "audio_headroom",
        window.from,
        window.to,
        "Audio has little peak headroom.",
        { peakDb: db(maxPeak), thresholdDb: peakThreshold },
        `Sample peak at or below ${peakThreshold} dBFS.`,
        "Rendered sample peak; intersample true peaks are not measured."
      );
    }
  }
  for (const interval of expected) {
    const windows = mix.windows.filter(
      (x) => x.to > interval.from / fps && x.from < interval.to / fps
    );
    if (
      windows.length &&
      windows.every((x) => db(x.rms) < silence) &&
      !intentional(interval.from / fps, interval.to / fps)
    ) {
      emit(
        "audio_expected_missing",
        interval.from / fps,
        interval.to / fps,
        "Expected audio interval is silent.",
        {
          rmsDb: db(windows.reduce((peak, x) => Math.max(peak, x.rms), 0)),
          silenceDb: silence,
        },
        "Audible content in the explicitly expected interval.",
        "Explicit audio expectation and measured rendered mix; does not identify which source failed.",
        "error",
        "measurement"
      );
    }
  }
  let start = -1;
  for (let i = 0; i <= mix.windows.length; i += 1) {
    const window = mix.windows[i];
    if (window && db(window.rms) < silence) {
      if (start < 0) {
        start = i;
      }
      continue;
    }
    if (start >= 0) {
      const first = mix.windows[start],
        last = mix.windows[i - 1];
      if (
        first &&
        last &&
        start > 0 &&
        i < mix.windows.length &&
        last.to - first.from >= 0.3 &&
        !intentional(first.from, last.to)
      ) {
        emit(
          "audio_silence_gap",
          first.from,
          last.to,
          "An internal silence interrupts audible audio.",
          { seconds: last.to - first.from, silenceDb: silence },
          "The intended sound continuity or a declared pause.",
          "Measured silence flanked by audible samples; a planned pause is valid."
        );
      }
      start = -1;
    }
  }
  for (const frame of [
    ...new Set([...boundaries, Math.round(mix.duration * fps)]),
  ]) {
    const time = frame / fps;
    const before = mix.windows.filter(
      (x) => x.to <= time + 0.001 && x.to > time - 0.04
    );
    const after = mix.windows.filter(
      (x) => x.from >= time - 0.001 && x.from < time + 0.04
    );
    const level = Math.max(...before.map((x) => x.rms), 0),
      afterLevel = Math.max(...after.map((x) => x.rms), 0);
    if (
      db(level) > -35 &&
      (time >= mix.duration - 0.02 || db(afterLevel) < silence) &&
      !intentional(time, time)
    ) {
      const speech = audio.speechIntervals?.some(
        (x) => x.from < frame && x.to >= frame
      );
      emit(
        speech ? "audio_speech_boundary" : "audio_tail_boundary",
        Math.max(0, time - 0.04),
        time,
        speech
          ? "Audio ends while a declared speech interval is active."
          : "An audible signal stops at a scene or composition boundary.",
        {
          afterRmsDb: db(afterLevel),
          beforeRmsDb: db(level),
          thresholdDb: -35,
        },
        "A deliberate ending or a completed fade/tail.",
        speech
          ? "Declared speech interval plus measured signal; no claim that a specific word was cut."
          : "Signal energy near the boundary suggests an abrupt tail; intentional cuts are valid."
      );
    }
  }
  const speech = stems.filter((x) => x.role === "speech"),
    backing = stems.filter((x) => x.role !== "speech");
  if (speech.length && backing.length) {
    for (let i = 0; i < mix.windows.length; i += 1) {
      const window = mix.windows[i];
      if (!window) {
        continue;
      }
      if (
        !audio.speechIntervals?.some(
          (x) => x.from / fps < window.to && x.to / fps > window.from
        )
      ) {
        continue;
      }
      const voice = Math.sqrt(
        speech.reduce(
          (sum, x) => sum + (x.measurement.windows[i]?.rms ?? 0) ** 2,
          0
        )
      );
      const other = Math.sqrt(
        backing.reduce(
          (sum, x) => sum + (x.measurement.windows[i]?.rms ?? 0) ** 2,
          0
        )
      );
      const difference = db(voice) - db(other),
        threshold = audio.maskingDb ?? 6;
      if (
        db(voice) > -45 &&
        db(window.rms) > silence &&
        difference < threshold
      ) {
        emit(
          "audio_speech_masking",
          window.from,
          window.to,
          "Music or effects may mask speech.",
          {
            backingRmsDb: db(other),
            mixRmsDb: db(window.rms),
            speechMarginDb: difference,
            speechRmsDb: db(voice),
            thresholdDb: threshold,
          },
          `Speech at least ${threshold} dB above backing during declared speech.`,
          "Actual mix and separately rendered role stems with declared speech intervals; energy ratio is an intelligibility heuristic."
        );
      }
    }
  }
  for (const [index, stem] of stems.entries()) {
    const roleOptions = {
      ...options,
      audio: {
        ...audio,
        expected: false,
        expectedIntervals: stem.role === "speech" ? audio.speechIntervals : [],
        stems: [],
      },
    };
    const boundariesFound = analyzeAudio(
      stem.measurement,
      fps,
      boundaries,
      roleOptions
    ).filter(
      (row) =>
        row.code === "audio_speech_boundary" ||
        row.code === "audio_tail_boundary" ||
        row.code === "audio_expected_missing"
    );
    findings.push(
      ...boundariesFound.map((row) =>
        makeFinding({
          ...row,
          confidence: `${row.confidence} Measured an isolated ${stem.role} render alongside the actual mix.`,
          evidence: [mix.path, stem.measurement.path],
          message: `${stem.role}: ${row.message}`,
          targetId: `audio:${stem.role}:${index}`,
        })
      )
    );
  }
  return findings;
}
