import { describe, expect, it } from "vitest";
import { elementsOf } from "./prompt";

const ELEMENT = {
  column: 7,
  component: "HeroScene",
  composition: "Main",
  file: "/Users/me/video/src/HeroScene.tsx",
  fps: 30,
  frame: 42,
  html: "<h1>Hello</h1>",
  line: 12,
  scene: null,
  stack: [],
};

describe("elementsOf", () => {
  it("includes structured tuning changes without runtime target identity", () => {
    expect(
      elementsOf([
        {
          ...ELEMENT,
          tuningChanges: [
            { from: 12, path: "amount", to: 20 },
            { from: "0px 0px", path: "style.translate", to: "0px 24px" },
          ],
        },
      ])
    ).toContain(
      'Requested changes:\n- amount: 12 → 20\n- style.translate: "0px 0px" → "0px 24px"'
    );
  });
});
