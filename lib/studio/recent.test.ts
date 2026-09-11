import { describe, expect, it } from "bun:test";
import { pushRecent } from "@/lib/studio/recent";

describe("pushRecent", () => {
  it("puts the newest first and keeps eight", () => {
    let ring: readonly string[] = [];
    for (let index = 0; index < 10; index += 1) {
      ring = pushRecent(ring, `id-${index}`);
    }

    expect(ring).toHaveLength(8);
    expect(ring[0]).toBe("id-9");
    expect(ring[7]).toBe("id-2");
  });

  it("moves a reached entry to the front instead of duplicating it", () => {
    const ring = pushRecent(pushRecent(["a", "b", "c"], "c"), "b");

    expect(ring).toEqual(["b", "c", "a"]);
  });
});
