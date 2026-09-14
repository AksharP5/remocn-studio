import { describe, expect, it } from "bun:test";
import { Exit, Schema } from "effect";
import { AssetSource } from "./library";
import {
  AudioRequest,
  MusicRequest,
  SoundRequest,
  soundSummary,
} from "./sound-effects";

export const request = {
  connectionId: "cn_test",
  durationSeconds: 2,
  format: "mp3_44100_128" as const,
  name: "Door",
  text: "A wooden door closing",
};
export const operation = {
  account: "Mine",
  connectionName: "My sound account",
  cost: null,
  createdAt: 1,
  detail: null,
  file: null,
  id: "sound_test",
  providerRequestId: null,
  request,
  state: "prepared" as const,
};

describe("sound contracts", () => {
  it("accepts automatic duration and both supported MP3 formats", () => {
    for (const format of ["mp3_44100_128", "mp3_44100_192"]) {
      expect(
        Exit.isSuccess(
          Schema.decodeUnknownExit(SoundRequest)({
            ...request,
            durationSeconds: null,
            format,
          })
        )
      ).toBe(true);
    }
  });
  it("refuses invalid parameters before dispatch", () => {
    for (const patch of [
      { text: " " },
      { durationSeconds: 0.4 },
      { durationSeconds: 31 },
      { durationSeconds: Number.NaN },
      { format: "wav" },
      { text: "a".repeat(5001) },
    ]) {
      expect(
        Exit.isFailure(
          Schema.decodeUnknownExit(SoundRequest)({ ...request, ...patch })
        )
      ).toBe(true);
    }
  });
  it("builds an exact consent summary without requiring model-authored prose", () => {
    const summary = soundSummary(operation);
    for (const value of [
      "My sound account",
      "Mine",
      request.text,
      "2 seconds",
      request.format,
      "spends credits",
    ]) {
      expect(summary).toContain(value);
    }
  });
  it("keeps existing stock sources readable", () => {
    expect(
      Exit.isSuccess(
        Schema.decodeUnknownExit(AssetSource)({
          author: "Artist",
          authorUrl: "",
          id: "1",
          provider: "pexels",
          url: "",
        })
      )
    ).toBe(true);
  });
});

describe("music contracts", () => {
  const music = {
    ...request,
    durationSeconds: 120,
    forceInstrumental: true,
    kind: "music" as const,
  };
  it("accepts music durations without changing old sound contracts", () => {
    expect(Exit.isSuccess(Schema.decodeUnknownExit(AudioRequest)(music))).toBe(
      true
    );
    expect(
      Exit.isSuccess(Schema.decodeUnknownExit(AudioRequest)(request))
    ).toBe(true);
    expect(Exit.isFailure(Schema.decodeUnknownExit(SoundRequest)(music))).toBe(
      true
    );
  });
  it("rejects invalid music rather than decoding it as a sound", () => {
    for (const patch of [
      { durationSeconds: 2 },
      { durationSeconds: 601 },
      { text: "x".repeat(4101) },
      { forceInstrumental: undefined },
      { format: "mp3_44100_192" },
    ]) {
      expect(
        Exit.isFailure(
          Schema.decodeUnknownExit(AudioRequest)({ ...music, ...patch })
        )
      ).toBe(true);
    }
  });
  it("includes music and vocal preference in approval", () => {
    const summary = soundSummary({
      ...operation,
      request: MusicRequest.make(music),
    });
    expect(summary).toContain("Music · Instrumental");
    expect(summary).toContain("120 seconds");
    expect(summary).toContain("spends credits");
  });
});
