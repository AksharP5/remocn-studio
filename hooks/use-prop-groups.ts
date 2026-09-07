"use client";

import { Effect } from "effect";
import { useCallback, useMemo, useState } from "react";
import {
  type StudioSettings,
  saveCollapsedPropGroups,
} from "@/lib/studio/settings";

export interface PropGroups {
  readonly collapsed: readonly string[];
  readonly toggle: (group: string) => void;
}

/**
 * Which sections of the properties pane are folded shut.
 *
 * Kept as the *collapsed* names rather than the open ones, so a group the pane
 * gains later — or one a component happens to be the first to declare — opens
 * with everything else instead of arriving shut. Remembered in
 * `settings.json`, because a pane opens per element and a fold that reset on
 * every pick would be a fold nobody makes twice.
 */
export function usePropGroups(settings: StudioSettings | null): PropGroups {
  const [chosen, setChosen] = useState<readonly string[] | null>(null);
  const collapsed = chosen ?? settings?.collapsedPropGroups ?? [];

  const toggle = useCallback(
    (group: string) => {
      const next = collapsed.includes(group)
        ? collapsed.filter((name) => name !== group)
        : [...collapsed, group];

      setChosen(next);
      Effect.runFork(saveCollapsedPropGroups(next));
    },
    [collapsed]
  );

  return useMemo(() => ({ collapsed, toggle }), [collapsed, toggle]);
}
