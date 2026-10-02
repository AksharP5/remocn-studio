import { describe, expect, it, mock } from "bun:test";
import { deferEmptyMediaMetadata } from "./media-metadata";

function fixture() {
  const host = document.createElement("div");
  const root = host.attachShadow({ mode: "open" });
  const audio = document.createElement("audio");
  root.append(audio);
  const received = mock();
  audio.addEventListener("loadedmetadata", received);
  const stop = deferEmptyMediaMetadata(root);
  const duration = (value: number) =>
    Object.defineProperty(audio, "duration", {
      configurable: true,
      value,
    });
  return { audio, duration, received, stop };
}

describe("deferEmptyMediaMetadata", () => {
  it("defers zero metadata and replays it once when the duration settles", () => {
    const { audio, duration, received, stop } = fixture();
    duration(0);
    audio.dispatchEvent(new Event("loadedmetadata"));
    audio.dispatchEvent(new Event("durationchange"));
    expect(received).not.toHaveBeenCalled();

    duration(2);
    audio.dispatchEvent(new Event("durationchange"));
    audio.dispatchEvent(new Event("durationchange"));
    expect(received).toHaveBeenCalledTimes(1);
    stop();
  });

  it("preserves finite and live metadata and does not replay an already delivered event", () => {
    const { audio, duration, received, stop } = fixture();
    duration(0);
    audio.dispatchEvent(new Event("loadedmetadata"));
    duration(2);
    audio.dispatchEvent(new Event("loadedmetadata"));
    audio.dispatchEvent(new Event("durationchange"));
    duration(Number.POSITIVE_INFINITY);
    audio.dispatchEvent(new Event("loadedmetadata"));
    expect(received).toHaveBeenCalledTimes(2);
    stop();
  });

  it("stops intercepting and replaying metadata when the runtime is disposed", () => {
    const { audio, duration, received, stop } = fixture();
    duration(0);
    audio.dispatchEvent(new Event("loadedmetadata"));
    stop();
    duration(2);
    audio.dispatchEvent(new Event("durationchange"));
    expect(received).not.toHaveBeenCalled();
    duration(0);
    audio.dispatchEvent(new Event("loadedmetadata"));
    expect(received).toHaveBeenCalledTimes(1);
  });
});
