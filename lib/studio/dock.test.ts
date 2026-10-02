import { describe, expect, it } from "bun:test";
import { ProgressBarStatus } from "@tauri-apps/api/window";
import {
  badgeCountOf,
  dockProgressOf,
  sameProgress,
  windowTitleOf,
} from "@/lib/studio/dock";
import { IDLE_TURN } from "@/lib/studio/turns";
import type { ExportEvent } from "@/shared/ipc";

function progress(
  rendered: number,
  encoded: number,
  total = 100,
  stage: "encoding" | "muxing" = "encoding"
): ExportEvent {
  return { encoded, percent: 0, rendered, stage, total, type: "progress" };
}

describe("dockProgressOf", () => {
  it("shows an empty bar while the composition is measured", () => {
    expect(dockProgressOf({ event: null, phase: "running" })).toEqual({
      progress: 0,
      status: ProgressBarStatus.Normal,
    });
    expect(
      dockProgressOf({ event: progress(0, 0, 0), phase: "running" })
    ).toEqual({ progress: 0, status: ProgressBarStatus.Normal });
  });

  it("puts half the frames rendered at a quarter of the run", () => {
    expect(
      dockProgressOf({ event: progress(50, 0), phase: "running" })
    ).toEqual({ progress: 25, status: ProgressBarStatus.Normal });
  });

  it("lets encoding continue the bar rather than restart it", () => {
    expect(
      dockProgressOf({ event: progress(100, 20), phase: "running" })
    ).toEqual({ progress: 60, status: ProgressBarStatus.Normal });
  });

  it("holds the bar full while the audio and video are combined", () => {
    expect(
      dockProgressOf({
        event: progress(100, 100, 100, "muxing"),
        phase: "running",
      })
    ).toEqual({ progress: 100, status: ProgressBarStatus.Normal });
  });

  it("hides the bar when the file is written or nothing runs", () => {
    expect(dockProgressOf({ event: null, phase: "done" })).toEqual({
      status: ProgressBarStatus.None,
    });
    expect(dockProgressOf({ event: null, phase: "idle" })).toEqual({
      status: ProgressBarStatus.None,
    });
  });

  it("turns to the error state when the render fails", () => {
    expect(dockProgressOf({ event: null, phase: "failed" })).toEqual({
      status: ProgressBarStatus.Error,
    });
  });

  it("compares two readings by status and progress", () => {
    expect(
      sameProgress(
        { progress: 25, status: ProgressBarStatus.Normal },
        { progress: 25, status: ProgressBarStatus.Normal }
      )
    ).toBe(true);
    expect(
      sameProgress(
        { status: ProgressBarStatus.None },
        { progress: 0, status: ProgressBarStatus.Normal }
      )
    ).toBe(false);
  });
});

describe("badgeCountOf", () => {
  it("counts cards and source questions across every chat", () => {
    const card = {
      askedAt: 1,
      id: "p",
      input: {},
      name: "Bash",
      reason: "bash" as const,
    };
    const source = {
      askedAt: 1,
      attempt: "a",
      id: "q",
      name: "logo",
      source: "x",
    };
    const turns = new Map([
      ["s1", { ...IDLE_TURN, permissions: [card] }],
      ["s2", { ...IDLE_TURN, isRunning: true, sources: [source] }],
      ["s3", { ...IDLE_TURN, isRunning: true }],
    ]);

    expect(badgeCountOf(turns)).toBe(2);
    expect(badgeCountOf(new Map())).toBe(0);
  });
});

describe("windowTitleOf", () => {
  it("names only the studio while idle", () => {
    expect(windowTitleOf({ event: null, phase: "idle" }, 0)).toBe(
      "Remocn Studio"
    );
  });

  it("composes waiting cards with the existing render and encode progress", () => {
    expect(windowTitleOf({ event: progress(50, 0), phase: "running" }, 2)).toBe(
      "Remocn Studio · 2 waiting · Export 25%"
    );
  });

  it("reports an export without claiming progress before it is measured", () => {
    expect(windowTitleOf({ event: null, phase: "running" }, 0)).toBe(
      "Remocn Studio · Exporting"
    );
  });

  it("shows a failed export beside any cards still waiting", () => {
    expect(windowTitleOf({ event: null, phase: "failed" }, 1)).toBe(
      "Remocn Studio · 1 waiting · Export failed"
    );
  });
});
