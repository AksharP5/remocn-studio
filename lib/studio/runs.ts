import type { ActivityEntry, TranscriptEntry } from "@/shared/ipc";
import { isDesignCheck } from "./design-review";
import { planTasks, type TaskRow } from "./tasks";

export type TranscriptItem =
  | { entry: TranscriptEntry; id: string; kind: "entry" }
  | { entries: readonly ActivityEntry[]; id: string; kind: "run" }
  | { id: string; kind: "tasks"; tasks: readonly TaskRow[] };

const RUN_MINIMUM = 2;

export function groupActivity(
  entries: readonly TranscriptEntry[]
): readonly TranscriptItem[] {
  const plan = planTasks(entries);
  const items: TranscriptItem[] = [];
  let run: ActivityEntry[] = [];

  const settle = () => {
    if (run.length >= RUN_MINIMUM) {
      items.push({ entries: run, id: run[0].id, kind: "run" });
    } else {
      items.push(
        ...run.map(
          (entry): TranscriptItem => ({
            entry,
            id: entry.id,
            kind: "entry",
          })
        )
      );
    }
    run = [];
  };

  for (const entry of entries) {
    const tasks = plan.plans.get(entry.id);

    if (tasks !== undefined) {
      settle();
      items.push({ id: entry.id, kind: "tasks", tasks });
      continue;
    }

    if (plan.consumed.has(entry.id)) {
      continue;
    }

    if (isFoldable(entry)) {
      run.push(entry);
      continue;
    }

    settle();
    if (appendRepeatedFailure(items, entry)) {
      continue;
    }
    items.push({ entry, id: entry.id, kind: "entry" });
  }

  settle();

  return items;
}

function isFoldable(entry: TranscriptEntry): entry is ActivityEntry {
  return (
    entry.kind === "activity" &&
    entry.state !== "failed" &&
    !isDesignCheck(entry.name)
  );
}

function attemptsOf(item: TranscriptItem): readonly ActivityEntry[] {
  if (item.kind === "run") {
    return item.entries;
  }
  if (item.kind === "entry" && item.entry.kind === "activity") {
    return [item.entry];
  }
  return [];
}

function appendRepeatedFailure(
  items: TranscriptItem[],
  entry: TranscriptEntry
): boolean {
  const previous = items.at(-1);
  if (
    !previous ||
    entry.kind !== "activity" ||
    entry.state !== "failed" ||
    !entry.result
  ) {
    return false;
  }
  const attempts = attemptsOf(previous);
  if (
    attempts.length === 0 ||
    !attempts.every(
      (attempt) =>
        attempt.state === "failed" &&
        attempt.name === entry.name &&
        attempt.result === entry.result
    )
  ) {
    return false;
  }
  items[items.length - 1] = {
    entries: [...attempts, entry],
    id: previous.id,
    kind: "run",
  };
  return true;
}
