"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type Command,
  matchCommands,
  SHORTCUTS,
} from "@/lib/studio/command-registry";
import { pushRecent } from "@/lib/studio/recent";

export type PaletteGroupId = "actions" | "projects" | "recent" | "videos";

export interface PaletteGroup {
  readonly id: PaletteGroupId;
  readonly items: readonly Command[];
  readonly label: string;
}

export interface CommandPalette {
  readonly close: () => void;
  readonly commands: readonly Command[];
  readonly groups: readonly PaletteGroup[];
  readonly isOpen: boolean;
  readonly onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  readonly onPick: (event: MouseEvent<HTMLElement>) => void;
  readonly onQueryChange: (value: string) => void;
  readonly query: string;
  readonly run: (id: string) => boolean;
  readonly setOpen: (open: boolean) => void;
  readonly toggle: () => void;
}

export const PALETTE_ID = "palette";

const LABELS: Readonly<Record<PaletteGroupId, string>> = {
  actions: "Actions",
  projects: "Projects",
  recent: "Recent",
  videos: "Videos",
};

export function useCommandPalette(
  base: readonly Command[],
  openedSessionId: string | null
): CommandPalette {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<readonly string[]>([]);

  useEffect(() => {
    if (openedSessionId !== null) {
      setRecent((ring) => pushRecent(ring, `chat:${openedSessionId}`));
    }
  }, [openedSessionId]);

  const setOpen = useCallback((next: boolean) => {
    setIsOpen(next);
    if (next) {
      setQuery("");
    }
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((current) => {
      if (!current) {
        setQuery("");
      }
      return !current;
    });
  }, []);

  const close = useCallback(() => setOpen(false), [setOpen]);

  const commands = useMemo<readonly Command[]>(
    () => [
      {
        enabled: true,
        group: "actions",
        id: PALETTE_ID,
        run: toggle,
        shortcut: SHORTCUTS.palette,
        title: "Search commands",
      },
      ...base,
    ],
    [base, toggle]
  );

  const run = useCallback(
    (id: string) => {
      const command = commands.find((row) => row.id === id);
      if (command === undefined || command.enabled !== true) {
        return false;
      }
      setRecent((ring) => pushRecent(ring, id));
      setIsOpen(false);
      command.run();
      return true;
    },
    [commands]
  );

  const onPick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const target = event.target as HTMLElement | null;
      const id =
        target?.closest<HTMLElement>("[data-command]")?.dataset.command;
      if (id !== undefined) {
        run(id);
      }
    },
    [run]
  );

  const onInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
      }
    },
    []
  );

  const groups = useMemo(() => {
    const listed = base.filter((row) => row.id !== PALETTE_ID);
    const sections: PaletteGroup[] = [];
    const matched = (id: Exclude<PaletteGroupId, "recent">) => {
      const items = matchCommands(
        query,
        listed.filter((row) => row.group === id)
      );
      if (items.length > 0) {
        sections.push({ id, items, label: LABELS[id] });
      }
    };

    if (query.trim().length === 0) {
      const items = recent
        .map((id) => listed.find((row) => row.id === id))
        .filter((row): row is Command => row !== undefined);
      if (items.length > 0) {
        sections.push({ id: "recent", items, label: LABELS.recent });
      }
    }
    matched("actions");
    matched("videos");
    matched("projects");
    return sections;
  }, [base, query, recent]);

  return useMemo(
    () => ({
      close,
      commands,
      groups,
      isOpen,
      onInputKeyDown,
      onPick,
      onQueryChange: setQuery,
      query,
      run,
      setOpen,
      toggle,
    }),
    [
      close,
      commands,
      groups,
      isOpen,
      onInputKeyDown,
      onPick,
      query,
      run,
      setOpen,
      toggle,
    ]
  );
}
