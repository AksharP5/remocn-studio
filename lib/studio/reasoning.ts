import type { AgentEvent, TranscriptEntry } from "@/shared/ipc";
import type { ToolVerb } from "@/shared/providers";
import { activityTarget, targetText, toolName } from "./activity";
import { runningTime } from "./time";

export type LiveLine =
  | { readonly id: string; readonly kind: "thought"; readonly text: string }
  | { readonly entryId: string; readonly id: string; readonly kind: "step" };

export interface ReasoningLine {
  readonly id: string;
  readonly kind: "step" | "thought";
  readonly text: string;
}

const THOUGHT_LIMIT = 4000;
const SENTENCE_END = /(?<=[.!?…])\s+|\n+/;

const PHRASES: Record<ToolVerb, string | null> = {
  create: "Creating",
  edit: "Editing",
  find: "Finding",
  plan: "Planning",
  read: "Reading",
  run: "Running",
  search: "Searching",
  subagent: "Delegating",
  task: null,
  web: "Browsing",
};

export function appendLive(
  live: readonly LiveLine[],
  event: AgentEvent
): readonly LiveLine[] {
  if (event.type === "thinking") {
    if (event.text === "") {
      return live;
    }
    const last = live.at(-1);
    if (last?.kind === "thought") {
      const text = (last.text + event.text).slice(-THOUGHT_LIMIT);
      return [...live.slice(0, -1), { ...last, text }];
    }
    return [
      ...live,
      { id: `thought-${live.length}`, kind: "thought", text: event.text },
    ];
  }
  if (event.type === "tool_use") {
    return [
      ...live,
      { entryId: event.id, id: `step-${event.id}`, kind: "step" },
    ];
  }
  return live;
}

function stepText(entry: TranscriptEntry, cwd: string | null): string | null {
  if (entry.kind !== "activity") {
    return null;
  }
  const phrase = entry.verb ? PHRASES[entry.verb] : "Using";
  if (phrase === null) {
    return null;
  }
  const target = activityTarget(entry, cwd);
  return target === null
    ? toolName(entry.name)
    : `${phrase} ${targetText(target)}`;
}

function sentences(text: string): string[] {
  return text
    .split(SENTENCE_END)
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

export function reasoningLines(
  live: readonly LiveLine[],
  entries: readonly TranscriptEntry[],
  cwd: string | null,
  max = 3
): ReasoningLine[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const lines = live.flatMap((line): ReasoningLine[] => {
    if (line.kind === "thought") {
      return sentences(line.text).map((sentence, index) => ({
        id: `${line.id}-${index}`,
        kind: "thought",
        text: sentence,
      }));
    }
    const entry = byId.get(line.entryId);
    const text = entry ? stepText(entry, cwd) : null;
    return text === null ? [] : [{ id: line.id, kind: "step", text }];
  });
  return lines.slice(-max);
}

export function workedLabel(durationMs: number | null, steps: number): string {
  if (durationMs !== null) {
    return `Worked for ${runningTime(0, durationMs)}`;
  }
  return `Worked · ${steps} ${steps === 1 ? "step" : "steps"}`;
}
