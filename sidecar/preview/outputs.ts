import { createHash } from "node:crypto";
import { readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Effect } from "effect";
import { DATA_DIR_ENV } from "@/shared/ipc";

const OUTPUT = /^([0-9a-f]{16})(-native)?$/;

const STILLS = "stills";

const STILL_LIFETIME_MS = 24 * 60 * 60 * 1000;

export function previewRoot(): string {
  return path.join(process.env[DATA_DIR_ENV] ?? tmpdir(), "preview");
}

export function previewKeyOf(folder: string): string {
  return createHash("sha256").update(folder).digest("hex").slice(0, 16);
}

export function prunePreviewOutputs(input: {
  known: readonly string[];
  now: number;
  root: string;
}): Effect.Effect<readonly string[]> {
  return Effect.promise(async () => {
    const keep = new Set(input.known.map(previewKeyOf));
    const entries = await readdir(input.root).catch(() => [] as string[]);

    const orphans = entries.filter((name) => {
      const key = OUTPUT.exec(name)?.[1];
      return key !== undefined && !keep.has(key);
    });

    const stillsDir = path.join(input.root, STILLS);
    const stills = await readdir(stillsDir).catch(() => [] as string[]);
    const stale = (
      await Promise.all(
        stills.map(async (name) => {
          const found = await stat(path.join(stillsDir, name)).catch(
            () => null
          );
          return found !== null && input.now - found.mtimeMs > STILL_LIFETIME_MS
            ? path.join(STILLS, name)
            : null;
        })
      )
    ).filter((name): name is string => name !== null);

    const removed = [...orphans, ...stale];

    await Promise.all(
      removed.map((name) =>
        rm(path.join(input.root, name), { force: true, recursive: true }).catch(
          () => undefined
        )
      )
    );

    return removed;
  });
}
