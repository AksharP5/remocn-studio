import { describe, expect, it } from "vitest";
import type { EnvironmentCheck } from "@/shared/ipc";
import { compositionRow, isBlocked, merged, unresolved } from "./environment";
import { PREVIEW_MESSAGE_SOURCE, type PreviewComposition } from "./preview";

const pick = (over: Partial<PreviewComposition> = {}): PreviewComposition => ({
  compositionId: "Main",
  compositions: ["Main"],
  reason: "main",
  source: PREVIEW_MESSAGE_SOURCE,
  total: 3,
  type: "composition",
  unmeasured: false,
  ...over,
});

const row = (over: Partial<EnvironmentCheck>): EnvironmentCheck => ({
  detail: null,
  fix: null,
  id: "claude",
  state: "ok",
  title: "",
  ...over,
});

describe("compositionRow", () => {
  it("stays pending until the preview has compiled", () => {
    expect(compositionRow(null).state).toBe("pending");
  });

  it("fails when the Root registers nothing", () => {
    const check = compositionRow(
      pick({ compositionId: null, reason: "none", total: 0 })
    );

    expect(check.state).toBe("failed");
  });

  // A project holds many videos now, so "none of them is called Main" is the
  // ordinary case. The one thing worth failing on is a video the pane asked
  // for that the compiled project does not render.
  it("fails when the video that was asked for is not in the code", () => {
    const check = compositionRow(
      pick({ compositionId: "torrens-motherboard", reason: "missing" })
    );

    expect(check.state).toBe("failed");
    expect(check.title).toContain("torrens-motherboard");
    expect(check.detail).toContain("Root.tsx");
  });

  it("passes on the video the pane asked for", () => {
    const check = compositionRow(
      pick({ compositionId: "opening-title", reason: "asked" })
    );

    expect(check.state).toBe("ok");
    expect(check.detail).toContain("opening-title");
  });

  it("says nothing about Main when no video was asked for", () => {
    expect(compositionRow(pick({ reason: "first" })).state).toBe("ok");
    expect(compositionRow(pick({ reason: "folder" })).state).toBe("ok");
  });
});

describe("merged", () => {
  it("replaces the sidecar's pending row with the preview's answer", () => {
    const checks = merged(
      [row({ id: "compositions", state: "pending" })],
      pick()
    );

    expect(checks).toHaveLength(1);
    expect(checks[0].state).toBe("ok");
  });

  it("leaves every other row alone", () => {
    const claude = row({ id: "claude", state: "failed", title: "logged out" });

    expect(merged([claude], pick())[0]).toBe(claude);
  });
});

describe("unresolved", () => {
  it("keeps only what the user has to act on", () => {
    const checks = [
      row({ id: "claude", state: "ok" }),
      row({ id: "runtime", state: "warn" }),
      row({ id: "remotion", state: "failed" }),
      row({ id: "compositions", state: "pending" }),
    ];

    expect(unresolved(checks).map((check) => check.id)).toEqual([
      "runtime",
      "remotion",
    ]);
  });

  it("is empty for a project that only has pending work left", () => {
    expect(unresolved([row({ id: "compositions", state: "pending" })])).toEqual(
      []
    );
  });
});

describe("isBlocked", () => {
  it("blocks on the session's provider failing its login check", () => {
    expect(isBlocked([row({ id: "claude", state: "failed" })], "claude")).toBe(
      true
    );
  });

  it("does not block on a folder that is not a Remotion project", () => {
    expect(
      isBlocked([row({ id: "remotion", state: "failed" })], "claude")
    ).toBe(false);
  });

  it("does not block before the first report arrives", () => {
    expect(isBlocked([], "claude")).toBe(false);
  });
});
