import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import { audiomapFrom } from "@/lib/studio/audiomap";
import { Audiomap, audiomapBrief } from "@/shared/audiomap";

const RATE = 22_050;

function seconds(length: number): Float32Array {
  return new Float32Array(Math.round(length * RATE));
}

function clickTrack(length: number, bpm: number): Float32Array {
  const out = seconds(length);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Math.sin(2 * Math.PI * 220 * (i / RATE)) * 0.05;
  }
  const period = 60 / bpm;
  for (let at = 0; at < length; at += period) {
    const start = Math.round(at * RATE);
    for (let i = 0; i < RATE * 0.03; i += 1) {
      const decay = Math.exp(-i / (RATE * 0.005));
      out[start + i] +=
        (Math.sin(i * 0.4) * 0.9 + (Math.random() - 0.5) * 0.4) * decay;
    }
  }
  return out;
}

function swell(length: number): Float32Array {
  const out = seconds(length);
  for (let i = 0; i < out.length; i += 1) {
    const t = i / RATE;
    const envelope =
      0.2 + 0.6 * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / length));
    out[i] = Math.sin(2 * Math.PI * 110 * t) * envelope;
  }
  return out;
}

describe("audiomapFrom", () => {
  it("reads the tempo and the grid off a click track", () => {
    const map = audiomapFrom(clickTrack(12, 120), RATE);

    expect(map.pacing).toBe("beat_cut");
    expect(map.bpm).not.toBeNull();
    expect(Math.abs((map.bpm ?? 0) - 120)).toBeLessThan(3);
    expect(map.beats.length).toBeGreaterThanOrEqual(22);
    expect(map.beats[0] ?? 1).toBeLessThan(0.05);
    expect(map.beats[2]).toBeCloseTo(1, 1);
    expect(map.onsets.length).toBeGreaterThanOrEqual(22);
    expect(map.duration).toBeCloseTo(12, 3);
  });

  it("refuses the grid on a calm swell", () => {
    const map = audiomapFrom(swell(12), RATE);

    expect(map.pacing).toBe("phrase_flow");
    expect(map.beats).toEqual([]);
    expect(map.bpm).toBeNull();
    expect(map.onsets.length).toBeLessThan(3);
    expect(map.phases.length).toBeGreaterThanOrEqual(2);
    expect(map.phases.map((phase) => phase.level)).toContain("high");
  });

  it("finds a silence and the hard stop that opens it", () => {
    const loud = clickTrack(4, 120);
    const out = seconds(10);
    out.set(loud, 0);
    out.set(loud, Math.round(5 * RATE));

    const map = audiomapFrom(out, RATE);

    expect(map.silences.length).toBeGreaterThanOrEqual(1);
    expect(map.silences[0]?.from).toBeCloseTo(4, 0);
    expect(map.silences[0]?.to).toBeCloseTo(5, 0);
    expect(map.hardStops.some((stop) => Math.abs(stop - 4) < 0.1)).toBe(true);
    expect(map.phases.some((phase) => phase.level === "quiet")).toBe(true);
  });

  it("answers an empty map for no samples", () => {
    const map = audiomapFrom(new Float32Array(0), RATE);

    expect(map.duration).toBe(0);
    expect(map.pacing).toBe("phrase_flow");
    expect(map.phases).toEqual([]);
  });

  it("produces a map the schema decodes", () => {
    const map = audiomapFrom(clickTrack(3, 100), RATE);
    const decoded = Schema.decodeUnknownSync(Audiomap)(
      JSON.parse(JSON.stringify(map))
    );

    expect(decoded.version).toBe(1);
  });
});

describe("audiomapBrief", () => {
  it("names the pacing, the stops and the beats", () => {
    const text = audiomapBrief(audiomapFrom(clickTrack(6, 120), RATE));

    expect(text).toContain("beat_cut");
    expect(text).toContain("120 bpm");
    expect(text).toContain("beats (s)");
    expect(text).toContain("fps");
  });

  it("hides the grid when the rhythm is not trusted", () => {
    const text = audiomapBrief(audiomapFrom(swell(6), RATE));

    expect(text).toContain("phrase_flow");
    expect(text).not.toContain("beats (s)");
    expect(text).toContain("energy (s)");
  });
});
