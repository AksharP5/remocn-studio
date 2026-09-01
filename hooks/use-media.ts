"use client";

import { Effect } from "effect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAsyncAction } from "@/hooks/use-async-action";
import { isPlayable, mediaOf, previewUrl } from "@/lib/studio/attachments";
import { pickPlayable } from "@/lib/studio/shell";
import { audiomapOf } from "@/lib/studio/thumbnail";
import type { PromptMedia } from "@/shared/ipc";

export interface Media {
  add: () => Promise<number>;
  attach: (paths: readonly string[]) => number;
  clear: () => void;
  error: string | null;
  items: PromptMedia[];
  removeAt: (index: number) => void;
  restore: (items: readonly PromptMedia[]) => void;
}

export function useMedia(): Media {
  const [items, setItems] = useState<PromptMedia[]>([]);
  const held = useRef<PromptMedia[]>([]);
  const { error, run } = useAsyncAction();

  const commit = useCallback((next: PromptMedia[]) => {
    held.current = next;
    setItems(next);
  }, []);

  const attach = useCallback(
    (paths: readonly string[]) => {
      const added = arriving(held.current, paths);
      if (added.length > 0) {
        commit([...held.current, ...added]);
      }
      return added.length;
    },
    [commit]
  );

  const add = useCallback(async () => {
    const found = await run(pickPlayable());
    return found === null ? 0 : attach(found);
  }, [attach, run]);

  const removeAt = useCallback(
    (index: number) => {
      commit(held.current.filter((_, at) => at !== index));
    },
    [commit]
  );

  const clear = useCallback(() => commit([]), [commit]);

  useAnalysedAudio(items, commit, held);

  const restore = useCallback(
    (next: readonly PromptMedia[]) => commit([...next]),
    [commit]
  );

  return useMemo(
    () => ({ add, attach, clear, error, items, removeAt, restore }),
    [add, attach, clear, error, items, removeAt, restore]
  );
}

// An attached sound is analysed once it lands, so the turn can carry its
// audiomap; a message sent before the decode finishes simply goes without.
function useAnalysedAudio(
  items: readonly PromptMedia[],
  commit: (next: PromptMedia[]) => void,
  held: { current: PromptMedia[] }
) {
  const analysed = useRef(new Set<string>());

  useEffect(() => {
    const pending = items.filter(
      (item) =>
        item.mediaType.startsWith("audio/") &&
        (item.audiomap ?? null) === null &&
        !analysed.current.has(item.path)
    );

    for (const item of pending) {
      analysed.current.add(item.path);
      const url = previewUrl(item.path);
      if (url === null) {
        continue;
      }

      Effect.runFork(
        audiomapOf(url, item.name).pipe(
          Effect.tap((audiomap) =>
            Effect.sync(() => {
              if (held.current.some((entry) => entry.path === item.path)) {
                commit(
                  held.current.map((entry) =>
                    entry.path === item.path ? { ...entry, audiomap } : entry
                  )
                );
              }
            })
          ),
          Effect.ignore
        )
      );
    }
  }, [items, commit, held]);
}

function arriving(
  held: readonly PromptMedia[],
  paths: readonly string[]
): PromptMedia[] {
  const known = new Set(held.map((item) => item.path));

  return paths
    .map(mediaOf)
    .filter((item): item is PromptMedia => item !== null)
    .filter((item) => isPlayable(item.mediaType))
    .filter((item) => {
      const seen = known.has(item.path);
      known.add(item.path);
      return !seen;
    });
}
