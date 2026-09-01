import { describe, expect, it } from "vitest";
import {
  easingFindings,
  easingReport,
  hardcodedEasings,
} from "@/sidecar/tools/tunability";

describe("hardcodedEasings", () => {
  // Exactly what the agent wrote when it followed the vendored skill: a curve
  // nailed shut, which the panel can render and can never edit.
  it("finds a constant easing and says where it is", () => {
    const source = [
      "const value = interpolate(frame, [0, 20], [0, 1], {",
      "  easing: Easing.out(Easing.cubic),",
      "});",
    ].join("\n");

    expect(hardcodedEasings("Lane.tsx", source)).toEqual([
      {
        file: "Lane.tsx",
        line: 2,
        snippet: "easing: Easing.out(Easing.cubic)",
      },
    ]);
  });

  it("finds every shape a constant curve is written in", () => {
    const source = [
      "easing: Easing.linear,",
      "easing: Easing.bezier(0.42, 0, 0.58, 1),",
      "easing: Easing.inOut(Easing.sin),",
    ].join("\n");

    expect(hardcodedEasings("Scene.tsx", source)).toHaveLength(3);
  });

  // The spread is the answer, not the problem — that curve comes from a prop
  // and is what the panel drags.
  it("leaves an easing that comes from a prop alone", () => {
    const source = [
      "easing: Easing.bezier(...easing),",
      "easing: Easing.bezier(...titleEasing),",
    ].join("\n");

    expect(hardcodedEasings("Title.tsx", source)).toEqual([]);
  });

  it("says nothing about code that has no easing at all", () => {
    expect(hardcodedEasings("Plain.tsx", "const a = 1;\n")).toEqual([]);
  });

  it("is not fooled by the word easing on its own", () => {
    expect(
      hardcodedEasings("Notes.tsx", "// pick an easing that settles\n")
    ).toEqual([]);
  });
});

describe("easingReport", () => {
  it("is silent when every curve is tunable", () => {
    expect(easingReport([])).toBeNull();
  });

  it("names each file and line, and how to fix it", () => {
    const report = easingReport(
      easingFindings([
        { path: "a.tsx", source: "easing: Easing.linear,\n" },
        { path: "b.tsx", source: "\n\neasing: Easing.out(Easing.quad),\n" },
      ])
    );

    expect(report).toContain("2 animations hardcode the easing");
    expect(report).toContain("a.tsx:1");
    expect(report).toContain("b.tsx:3");
    expect(report).toContain("Easing.bezier(...easing)");
  });

  it("counts one finding in the singular", () => {
    expect(
      easingReport(
        easingFindings([{ path: "a.tsx", source: "easing: Easing.linear" }])
      )
    ).toContain("1 animation hardcodes the easing");
  });
});
