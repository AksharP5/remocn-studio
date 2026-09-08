import { describe, expect, it } from "bun:test";
import { BUNDLE_FLAGS } from "./bundling";

describe("BUNDLE_FLAGS", () => {
  // Remotion turns this into a webpack filesystem cache that lands inside the
  // person's project at node_modules/.cache/webpack — 9 GB across four
  // projects, corrupt on nearly every run because stopping the preview kills
  // the host mid-write, and measured to save no compile time at all.
  it("never writes a webpack cache into the person's project", () => {
    expect(BUNDLE_FLAGS.enableCaching).toBe(false);
  });

  it("compiles for the Player, not for a render", () => {
    expect(BUNDLE_FLAGS.environment).toBe("development");
  });
});
