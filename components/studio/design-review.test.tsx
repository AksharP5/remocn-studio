import { describe, expect, it } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ActivityEntry } from "@/shared/ipc";
import { ActivityLine } from "./activity-line";

function review(
  result: unknown,
  state: ActivityEntry["state"] = "done"
): ActivityEntry {
  return {
    id: "review",
    input: { mode: "full" },
    kind: "activity",
    name: "mcp__remocn-design__design_check",
    result: typeof result === "string" ? result : JSON.stringify(result),
    state,
    verb: null,
  };
}

describe("video review in the transcript", () => {
  it("combines the same finding across frames while keeping its locations", () => {
    const finding = {
      code: "contrast",
      fix: "Inspect the settled frame.",
      message: "Text is faint during entry.",
      severity: "info",
    };
    render(
      <ActivityLine
        cwd={null}
        entry={review({
          composition: "onboarding",
          findings: [
            { ...finding, frames: [1] },
            { ...finding, frames: [2] },
          ],
        })}
      />
    );
    expect(screen.getByText("1 observation")).toBeVisible();
    expect(screen.getByText("(2 occurrences)")).toBeVisible();
    fireEvent.click(screen.getByText("Text is faint during entry."));
    expect(screen.getByText("Frames 1, 2")).toBeVisible();
  });
  it("shows stale reports as needing another review", () => {
    render(
      <ActivityLine
        cwd={null}
        entry={review({
          composition: "onboarding",
          findings: [],
          readiness: { coverage: { complete: true }, stale: true },
        })}
      />
    );
    expect(screen.getByText("Sources changed · recheck needed")).toBeVisible();
    expect(screen.queryByText("Review completed")).toBeNull();
  });

  it("leaves malformed reports available as raw tool output", () => {
    render(<ActivityLine cwd={null} entry={review("{invalid json")} />);
    fireEvent.click(screen.getByRole("button", { name: "Design check" }));
    expect(screen.getByText("{invalid json")).toBeVisible();
    expect(screen.queryByText("Review completed")).toBeNull();
  });
  it("shows generated-video shortcomings as review findings, not tool errors", () => {
    const { container } = render(
      <ActivityLine
        cwd={null}
        entry={review({
          composition: "onboarding",
          findings: [
            {
              code: "motion_contract_target",
              fix: "Connect the title to its motion cue.",
              frames: [30, 60],
              message: "The title is missing its motion target.",
              selector: "#title",
              severity: "error",
            },
          ],
        })}
      />
    );
    expect(screen.getByText("Video review")).toBeVisible();
    expect(screen.getByText("1 improvement")).toBeVisible();
    expect(
      screen.getByText("The title is missing its motion target.")
    ).toBeVisible();
    expect(container.querySelector(".text-destructive")).toBeNull();
    fireEvent.click(
      screen.getByText("The title is missing its motion target.")
    );
    expect(
      screen.getByText("Connect the title to its motion cue.")
    ).toBeVisible();
    expect(screen.getByText("Frames 30, 60")).toBeVisible();
  });

  it("does not claim a clean video when the check was incomplete", () => {
    render(
      <ActivityLine
        cwd={null}
        entry={review({
          composition: "onboarding",
          findings: [],
          readiness: {
            coverage: {
              complete: false,
              limitations: ["Time budget exhausted."],
            },
          },
        })}
      />
    );
    expect(screen.getByText("Review incomplete")).toBeVisible();
    fireEvent.click(screen.getByText("Review limitations"));
    expect(screen.getByText("Time budget exhausted.")).toBeVisible();
    expect(screen.queryByText("No findings in the checked frames.")).toBeNull();
  });

  it("keeps an actual validation failure as a tool failure", () => {
    render(
      <ActivityLine
        cwd={null}
        entry={review(
          "MCP error -32602: frames must contain at most 9 items",
          "failed"
        )}
      />
    );
    expect(screen.queryByText("1 improvement")).toBeNull();
    expect(
      screen.getByText("MCP error -32602: frames must contain at most 9 items")
    ).toHaveClass("text-destructive");
  });
});
