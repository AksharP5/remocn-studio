import { describe, expect, it, mock } from "bun:test";

mock.module("@remotion/player", () => ({
  Player: () => null,
  PlayerInternals: {},
}));
mock.module("remotion", () => ({ Internals: {} }));

const { renderFailure } = await import("./player-runtime");

const FALLBACK =
  "The video could not render. Fix the project, then retry the preview.";

describe("preview failure details", () => {
  it("retains the media error from a Remotion player event", () => {
    const event = {
      detail: {
        error: new Error("The browser could not decode clip.mp4: Code 3"),
      },
    };

    expect(renderFailure(event.detail.error)).toBe(
      `${FALLBACK}\n\nThe browser could not decode clip.mp4: Code 3`
    );
  });

  it("retains a thrown project message even across realms", () => {
    expect(renderFailure({ message: "AudioContext is unavailable" })).toBe(
      `${FALLBACK}\n\nAudioContext is unavailable`
    );
    expect(renderFailure("Cannot read the media duration")).toBe(
      `${FALLBACK}\n\nCannot read the media duration`
    );
  });

  it("keeps the actionable fallback when there is no error message", () => {
    for (const error of [undefined, null, 0, {}, { message: "  " }]) {
      expect(renderFailure(error)).toBe(FALLBACK);
    }
  });
});
