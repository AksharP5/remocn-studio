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

export function reuseItems(
  previous: readonly TranscriptItem[],
  next: readonly TranscriptItem[]
): readonly TranscriptItem[] {
  const kept = new Map(previous.map((item) => [item.id, item]));
  const shared = next.map((item) => {
    const was = kept.get(item.id);
    return was !== undefined && sameItem(was, item) ? was : item;
  });

  return sameList(previous, shared) ? previous : shared;
}

export function extendItems(
  before: readonly TranscriptEntry[],
  items: readonly TranscriptItem[],
  after: readonly TranscriptEntry[]
): readonly TranscriptItem[] | null {
  const was = before.at(-1);
  const now = after.at(-1);
  const tail = items.at(-1);

  if (
    before.length !== after.length ||
    was?.kind !== "assistant" ||
    now?.kind !== "assistant" ||
    was.id !== now.id ||
    tail?.kind !== "entry" ||
    tail.entry !== was ||
    !before.every(
      (entry, index) => index === before.length - 1 || entry === after[index]
    )
  ) {
    return null;
  }

  return [...items.slice(0, -1), { entry: now, id: tail.id, kind: "entry" }];
}

function sameItem(left: TranscriptItem, right: TranscriptItem): boolean {
  if (left.kind === "entry" && right.kind === "entry") {
    return left.entry === right.entry;
  }
  if (left.kind === "run" && right.kind === "run") {
    return sameList(left.entries, right.entries);
  }
  if (left.kind === "tasks" && right.kind === "tasks") {
    return (
      left.tasks.length === right.tasks.length &&
      left.tasks.every((task, index) => sameTask(task, right.tasks[index]))
    );
  }
  return false;
}

function sameTask(left: TaskRow, right: TaskRow | undefined): boolean {
  return (
    right !== undefined &&
    left.id === right.id &&
    left.status === right.status &&
    left.subject === right.subject &&
    left.activeForm === right.activeForm &&
    left.description === right.description
  );
}

function sameList<T>(left: readonly T[], right: readonly T[]): boolean {
  return (
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
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
