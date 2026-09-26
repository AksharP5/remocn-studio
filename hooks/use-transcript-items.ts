"use client";

import { useMemo, useRef } from "react";
import {
  extendItems,
  groupActivity,
  reuseItems,
  type TranscriptItem,
} from "@/lib/studio/runs";
import type { TranscriptEntry } from "@/shared/ipc";

interface Grouped {
  entries: readonly TranscriptEntry[];
  items: readonly TranscriptItem[];
}

export function useTranscriptItems(
  entries: readonly TranscriptEntry[]
): readonly TranscriptItem[] {
  const held = useRef<Grouped | null>(null);

  return useMemo(() => {
    const was = held.current;
    const items =
      was === null
        ? groupActivity(entries)
        : (extendItems(was.entries, was.items, entries) ??
          reuseItems(was.items, groupActivity(entries)));
    held.current = { entries, items };
    return items;
  }, [entries]);
}
