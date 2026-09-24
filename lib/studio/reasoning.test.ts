import { describe, expect, it } from "bun:test";
import type { TranscriptEntry } from "@/shared/ipc";
import {
  appendLive,
  type LiveLine,
  reasoningLines,
  workedLabel,
} from "./reasoning";

function activity(
  id: string,
  name: string,
  verb: string | null,
  input: unknown
): TranscriptEntry {
  return {
    id,
    input,
    kind: "activity",
    name,
    result: null,
    state: "running",
    verb,
  } as TranscriptEntry;
}

function stream(...events: Parameters<typeof appendLive>[1][]) {
  return events.reduce<readonly LiveLine[]>(appendLive, []);
}

describe("appendLive", () => {
  it("grows one thought until a step interrupts it", () => {
    const live = stream(
      { text: "Reading the ", type: "thinking" },
      { text: "brief.", type: "thinking" },
      { id: "t1", input: {}, name: "Read", type: "tool_use", verb: "read" },
      { text: "Now the scenes.", type: "thinking" }
    );

    expect(live.map((line) => line.kind)).toEqual([
      "thought",
      "step",
      "thought",
    ]);
    expect(live[0]).toMatchObject({ text: "Reading the brief." });
  });

  it("ignores everything else", () => {
    expect(stream({ text: "Done.", type: "text" })).toEqual([]);
  });
});

describe("reasoningLines", () => {
  const entries = [
    activity("t1", "Read", "read", { file_path: "/p/src/Orbit.tsx" }),
    activity("t2", "Bash", "run", { command: "bun run check" }),
    activity("t3", "TodoWrite", "task", { todos: [] }),
    activity("t4", "mcp__remocn-design__design_check", null, {}),
  ];

  it("writes steps as sentences and splits thoughts into sentences", () => {
    const live = stream(
      { text: "The fan starts late. Moving it earlier", type: "thinking" },
      { id: "t1", input: {}, name: "Read", type: "tool_use", verb: "read" },
      { id: "t2", input: {}, name: "Bash", type: "tool_use", verb: "run" },
      {
        id: "t3",
        input: {},
        name: "TodoWrite",
        type: "tool_use",
        verb: "task",
      },
      {
        id: "t4",
        input: {},
        name: "design_check",
        type: "tool_use",
        verb: null,
      }
    );

    expect(
      reasoningLines(live, entries, "/p", 10).map((line) => line.text)
    ).toEqual([
      "The fan starts late.",
      "Moving it earlier",
      "Reading src/Orbit.tsx",
      "Running bun run check",
      "Design check",
    ]);
  });

  it("keeps the latest three with ids that stay put as lines arrive", () => {
    const first = reasoningLines(
      stream({ text: "One. Two. Three.", type: "thinking" }),
      [],
      null
    );
    const next = reasoningLines(
      stream({ text: "One. Two. Three. Four.", type: "thinking" }),
      [],
      null
    );

    expect(first.map((line) => line.text)).toEqual(["One.", "Two.", "Three."]);
    expect(next.map((line) => line.text)).toEqual(["Two.", "Three.", "Four."]);
    expect(next[0]?.id).toBe(first[1]?.id);
  });
});

describe("workedLabel", () => {
  it("names the duration when the session saw it, else the steps", () => {
    expect(workedLabel(134_000, 9)).toBe("Worked for 2m 14s");
    expect(workedLabel(null, 1)).toBe("Worked · 1 step");
    expect(workedLabel(null, 4)).toBe("Worked · 4 steps");
  });
});
