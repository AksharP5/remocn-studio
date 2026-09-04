import { describe, expect, it } from "vitest";
import {
  previewFailure,
  previewRecovery,
  renderFailure,
} from "@/lib/studio/failures";

// Built by encoding rather than typed out: the URL Remotion produces is
// double-encoded, and a fixture written by hand gets that wrong.
const ASSET = "Запись экрана 2026-09-03.mov";

const SRC = encodeURIComponent(
  `http://127.0.0.1:52692/static-531bb9b6a042/library/${encodeURIComponent(ASSET)}`
);

const PROXY_ERROR = `Error: Failed to fetch http://localhost:0/proxy?src=${SRC}&time=0.86&transparent=false`;

const DISK = [
  "This could be caused by Chrome rejecting the request because the disk space",
  " is low. Consider increasing the disk size of your environment.",
].join("");

describe("renderFailure", () => {
  // Remotion's advice is written for a CI container. Measured: the real cause
  // was a proxy port of 0, and the agent — reading this in the transcript —
  // spent a tool call on `df -h` before working that out.
  it("drops the disk-space advice, which is wrong in a desktop app", () => {
    expect(renderFailure(`The frame timed out. ${DISK}`)).toBe(
      "The frame timed out."
    );
  });

  // ~300 characters of percent-encoded URL carrying one useful fact.
  it("says which asset failed instead of printing its URL", () => {
    const said = renderFailure(`${PROXY_ERROR}\n${DISK}`);

    expect(said).toBe(
      `The frame could not be rendered: the video ${ASSET} would not load.`
    );
    expect(said).not.toContain("localhost:0");
    expect(said).not.toContain("%2F");
  });

  it("leaves a message it has nothing to say about alone", () => {
    expect(renderFailure("A delayRender() timed out after 30000ms.")).toBe(
      "A delayRender() timed out after 30000ms."
    );
  });

  it("keeps the original when the advice was the whole message", () => {
    expect(renderFailure(DISK)).toBe(DISK);
  });
});

describe("previewFailure", () => {
  // `cancelled` is the sidecar's own reply frame, printed lowercase and red in
  // an otherwise empty pane. Nobody cancelled anything — the process died.
  it("words the protocol token the sidecar answers with when it dies", () => {
    expect(previewFailure("cancelled")).toBe(
      "The preview stopped when the sidecar restarted."
    );
  });

  it("passes a real failure through untouched", () => {
    expect(previewFailure("no Remotion entry point in /x")).toBe(
      "no Remotion entry point in /x"
    );
  });
});

describe("previewRecovery", () => {
  // The preview's request is long-lived, so a crash correctly fails it — and
  // then nothing re-established it. Every other pane healed itself.
  it("relaunches on the ready edge after the sidecar was lost", () => {
    const crashed = previewRecovery(false, "restarting");
    expect(crashed).toEqual({ lost: true, relaunch: false });

    expect(previewRecovery(crashed.lost, "ready")).toEqual({
      lost: false,
      relaunch: true,
    });
  });

  it("counts a sidecar that went down as lost too", () => {
    expect(previewRecovery(false, "down")).toEqual({
      lost: true,
      relaunch: false,
    });
  });

  // A cold boot is `starting` → `ready`, and re-arming there would launch the
  // preview twice — the effect that opens it has already run.
  it("does not relaunch after an ordinary boot", () => {
    const booting = previewRecovery(false, "starting");
    expect(booting).toEqual({ lost: false, relaunch: false });

    expect(previewRecovery(booting.lost, "ready")).toEqual({
      lost: false,
      relaunch: false,
    });
  });

  it("relaunches once, not on every status after the recovery", () => {
    const back = previewRecovery(true, "ready");
    expect(back.relaunch).toBe(true);

    expect(previewRecovery(back.lost, "ready").relaunch).toBe(false);
  });

  it("stays lost while the sidecar is still coming back", () => {
    expect(previewRecovery(true, "starting")).toEqual({
      lost: true,
      relaunch: false,
    });
  });
});
