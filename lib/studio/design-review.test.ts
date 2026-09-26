import { describe, expect, it } from "bun:test";
import type { ToolCall } from "./activity";
import { designReview, groupFindings, reviewStatus } from "./design-review";

function call(result: string | null, name = "design_check"): ToolCall {
  return { input: {}, name, result };
}

describe("designReview", () => {
  it("reads a report and fills in what it leaves out", () => {
    const review = designReview(
      call(
        JSON.stringify({
          composition: "Intro",
          extra: true,
          findings: [
            { code: "contrast", message: "Low contrast", severity: "warning" },
          ],
          readiness: { coverage: { complete: true } },
        })
      )
    );

    expect(review).toEqual({
      composition: "Intro",
      findings: [
        {
          code: "contrast",
          frames: [],
          message: "Low contrast",
          severity: "warning",
        },
      ],
      readiness: { coverage: { complete: true, limitations: [] } },
    });
    expect(review === null ? null : reviewStatus(review)).toBe(
      "Review completed"
    );
  });

  it("reads nothing from another tool, a broken reply or a wrong shape", () => {
    const report = JSON.stringify({ composition: "Intro", findings: [] });

    expect(designReview(call(report, "Read"))).toBeNull();
    expect(designReview(call("not json"))).toBeNull();
    expect(designReview(call(JSON.stringify({ findings: [] })))).toBeNull();
    expect(
      designReview(
        call(
          JSON.stringify({
            composition: "Intro",
            findings: [{ code: "x", message: "y", severity: "fatal" }],
          })
        )
      )
    ).toBeNull();
    expect(designReview(call(null))).toBeNull();
  });
});

describe("groupFindings", () => {
  it("counts a repeated finding once with every frame it was seen at", () => {
    const finding = {
      code: "overlap",
      message: "Text overlaps",
      severity: "error" as const,
    };

    const groups = groupFindings([
      { ...finding, frames: [30, 10] },
      { ...finding, frames: [10, 20] },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.occurrences).toBe(2);
    expect(groups[0]?.frames).toEqual([10, 20, 30]);
  });
});
