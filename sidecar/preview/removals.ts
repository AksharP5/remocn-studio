import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { relative } from "node:path";
import { Data, Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import { escapee, realPathOf } from "../contained";
import { hashBytes } from "../projects/config";
import type { Removal } from "./codemod";

export class RemovalError extends Data.TaggedError("RemovalError")<{
  readonly message: string;
}> {}

export const CHANGED_WHILE_DELETING =
  "The file changed while deleting. Pick the element again and retry.";
export const CHANGED_SINCE =
  "The file changed since the deletion, so it cannot be undone.";
export const NO_LONGER_UNDOABLE = "This deletion can no longer be undone.";

interface Held {
  readonly after: string;
  readonly before: string;
  readonly file: string;
  readonly root: string;
}

const refuse = (message: string) => new RemovalError({ message });

function attempt<A>(work: () => Promise<A>) {
  return Effect.tryPromise({
    catch: (cause) =>
      cause instanceof RemovalError ? cause : refuse(errorMessage(cause)),
    try: work,
  });
}

async function contain(root: string, file: string): Promise<void> {
  const outside = await escapee(root, [], [file]);
  if (outside !== null) {
    throw refuse(
      `${outside} is outside the project folder, so the studio will not touch it.`
    );
  }
}

export const REMOVED_HEADING =
  "Deleted by the studio since your last turn. The person removed these elements themselves and the files already show it. Do not add them back:";

export function makeRemovals() {
  const held = new Map<string, Held>();
  const unreported = new Map<string, Map<string, string>>();

  const report = (root: string, removal: string, note: string) => {
    const pending = unreported.get(root) ?? new Map<string, string>();
    pending.set(removal, note);
    unreported.set(root, pending);
  };

  const commit = (root: string, removed: Removal, component: string) =>
    attempt(async () => {
      await contain(root, removed.file);
      const now = await readFile(removed.file, "utf8");
      if (now !== removed.before) {
        throw refuse(CHANGED_WHILE_DELETING);
      }
      await writeFile(removed.file, removed.after, "utf8");
      const removal = randomUUID();
      const where = relative(
        await realPathOf(root),
        await realPathOf(removed.file)
      );
      held.set(removal, {
        after: hashBytes(removed.after),
        before: removed.before,
        file: removed.file,
        root,
      });
      report(
        root,
        removal,
        `- <${component}> at ${where}${removed.line === null ? "" : `:${removed.line}`}`
      );
      return { file: removed.file, line: removed.line, removal };
    });

  const restore = (root: string, removal: string) =>
    attempt(async () => {
      const entry = held.get(removal);
      if (entry === undefined || entry.root !== root) {
        throw refuse(NO_LONGER_UNDOABLE);
      }
      await contain(root, entry.file);
      const now = await readFile(entry.file, "utf8").catch(() => null);
      if (now === null || hashBytes(now) !== entry.after) {
        held.delete(removal);
        throw refuse(CHANGED_SINCE);
      }
      await writeFile(entry.file, entry.before, "utf8");
      held.delete(removal);
      unreported.get(root)?.delete(removal);
      return { file: entry.file };
    });

  const brief = (root: string): string | null => {
    const notes = [...(unreported.get(root)?.values() ?? [])];
    unreported.delete(root);
    return notes.length === 0 ? null : [REMOVED_HEADING, ...notes].join("\n");
  };

  return { brief, commit, restore };
}

export const removals = makeRemovals();
