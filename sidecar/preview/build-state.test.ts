import { describe, expect, it } from "bun:test";
import {
  BUILDING,
  compiled,
  pinnable,
  started,
  troubleIn,
} from "./build-state";

const OK = { ok: true } as const;

describe("the build a render is pinned to", () => {
  it("has nothing to pin before the first compile finishes", () => {
    expect(pinnable(BUILDING)).toBe(false);
    expect(BUILDING.compiling).toBe(true);
  });

  it("becomes pinnable once a compile settles", () => {
    const ready = compiled(BUILDING, OK);

    expect(pinnable(ready)).toBe(true);
    expect(ready.compiling).toBe(false);
    expect(troubleIn(ready)).toBeNull();
  });

  // The ProgressPlugin keeps reporting after a compile is over, so a percent
  // tick must not put a settled build back into "still compiling" — that read
  // as a project that never finishes and refused every export.
  it("stays pinnable when a progress tick arrives after it settled", () => {
    const ready = compiled(BUILDING, OK);

    expect(pinnable(started(ready))).toBe(true);
  });

  it("says a compile is in flight again once one really starts", () => {
    const rebuilding = started(compiled(BUILDING, OK));

    expect(rebuilding.compiling).toBe(true);
    expect(pinnable(rebuilding)).toBe(true);
  });

  it("keeps the compiler's own words when a build fails", () => {
    const broken = compiled(BUILDING, {
      message: "Module not found: ./missing",
      ok: false,
    });

    expect(troubleIn(broken)).toBe("Module not found: ./missing");
    expect(pinnable(broken)).toBe(true);
  });

  it("clears a failure once the next compile succeeds", () => {
    const healed = compiled(
      started(compiled(BUILDING, { message: "broken", ok: false })),
      OK
    );

    expect(troubleIn(healed)).toBeNull();
  });

  it("hands the same state back when nothing moved", () => {
    const ready = compiled(BUILDING, OK);
    const rebuilding = started(ready);

    expect(started(rebuilding)).toBe(rebuilding);
    expect(compiled(ready, ready.settled ?? OK)).toBe(ready);
  });
});
