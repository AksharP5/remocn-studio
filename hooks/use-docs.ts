"use client";

import { Effect, Exit } from "effect";
import type { MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { causeMessage } from "@/lib/error-message";
import {
  type DocumentTab,
  documentTabs,
  listDocuments,
  readDocument,
  touches,
} from "@/lib/studio/documents";
import type { ProjectFile, TranscriptEntry } from "@/shared/ipc";

export type PreviewMode = "docs" | "preview";

export interface OpenDocument {
  readonly file: ProjectFile;
  readonly text: string;
}

export interface Docs {
  readonly error: string | null;
  readonly folder: string | null;
  readonly isLoading: boolean;
  readonly mode: PreviewMode;
  readonly onPickMode: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly onPickTab: (value: unknown) => void;
  readonly onReveal: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly open: OpenDocument | null;
  readonly openPath: string | null;
  readonly pickMode: (mode: PreviewMode) => void;
  readonly tabs: readonly DocumentTab[];
}

export interface DocsSettings {
  readonly entries: readonly TranscriptEntry[];
  readonly isTurnRunning: boolean;
  readonly projectId: string | null;
  readonly videoId: string | null;
}

const WRITING = new Set(["create", "edit"]);

// The choice is per video and lives only for the session: switching to
// another video and back lands on the tab that was open, and a relaunch
// starts on the preview. Nothing about it is worth a line in settings.json.
interface Choice {
  readonly mode: PreviewMode;
  readonly path: string | null;
}

const START: Choice = { mode: "preview", path: null };

export function useDocs({
  entries,
  isTurnRunning,
  projectId,
  videoId,
}: DocsSettings): Docs {
  const [choices, setChoices] = useState<ReadonlyMap<string, Choice>>(
    () => new Map()
  );
  const [files, setFiles] = useState<readonly ProjectFile[]>([]);
  const [folder, setFolder] = useState<string | null>(null);
  const [open, setOpen] = useState<OpenDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const choice = (videoId === null ? undefined : choices.get(videoId)) ?? START;

  const choose = useCallback(
    (next: (current: Choice) => Choice) => {
      if (videoId === null) {
        return;
      }

      setChoices((current) => {
        const merged = new Map(current);
        merged.set(videoId, next(current.get(videoId) ?? START));
        return merged;
      });
    },
    [videoId]
  );

  const pickMode = useCallback(
    (mode: PreviewMode) => {
      choose((current) => ({ ...current, mode }));
    },
    [choose]
  );

  const onPickMode = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      pickMode(event.currentTarget.value === "docs" ? "docs" : "preview");
    },
    [pickMode]
  );

  // The stage row in the Video dock is the other way in: it names the file and
  // means "show me this", so it moves the pane as well as the tab.
  const onReveal = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const path = event.currentTarget.value;
      choose(() => ({ mode: "docs", path }));
    },
    [choose]
  );

  const onPickTab = useCallback(
    (value: unknown) => {
      if (typeof value === "string") {
        choose((current) => ({ ...current, path: value }));
      }
    },
    [choose]
  );

  const load = useCallback(() => {
    if (videoId === null) {
      setFiles([]);
      setFolder(null);
      return;
    }

    Effect.runFork(
      listDocuments(videoId).pipe(
        Effect.tap((listing) =>
          Effect.sync(() => {
            setFiles(listing.files);
            setFolder(listing.folder);
          })
        ),
        Effect.catch((failure) => Effect.sync(() => setError(failure.message)))
      )
    );
  }, [videoId]);

  useEffect(load, [load]);
  useReloadWhenTurnsSettle(isTurnRunning, load);

  const tabs = useMemo(() => documentTabs(files), [files]);

  // The pane never shows a tab strip with nothing under it: with no file
  // chosen, or one that has since left the folder, the first tab is open.
  const openPath =
    tabs.find((tab) => tab.file.path === choice.path)?.file.path ??
    tabs[0]?.file.path ??
    null;

  const written = latestWrite(entries, openPath);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `written` is the agent having just written to this file, and a new identity there is the whole signal to read it again — it carries no value the body can use.
  useEffect(() => {
    if (projectId === null || openPath === null) {
      setOpen(null);
      return;
    }

    let live = true;
    setIsLoading(true);

    Effect.runPromiseExit(readDocument(projectId, openPath)).then((exit) => {
      if (!live) {
        return;
      }

      setIsLoading(false);

      if (Exit.isFailure(exit)) {
        setOpen(null);
        setError(causeMessage(exit.cause));
        return;
      }

      setError(null);
      setOpen({
        file: {
          modifiedAt: exit.value.modifiedAt,
          name: nameOf(openPath),
          path: openPath,
        },
        text: exit.value.text,
      });
    });

    return () => {
      live = false;
    };
  }, [openPath, projectId, written]);

  return useMemo(
    () => ({
      error,
      folder,
      isLoading,
      mode: choice.mode,
      onPickMode,
      onPickTab,
      onReveal,
      open,
      openPath,
      pickMode,
      tabs,
    }),
    [
      choice.mode,
      error,
      folder,
      isLoading,
      onPickMode,
      onPickTab,
      onReveal,
      open,
      openPath,
      pickMode,
      tabs,
    ]
  );
}

/**
 * The id of the newest tool call in this turn that wrote to `path`, or null.
 * A watcher would answer the same question, and this one costs nothing: the
 * webview already receives every tool call as it happens.
 */
export function latestWrite(
  entries: readonly TranscriptEntry[],
  path: string | null
): string | null {
  if (path === null) {
    return null;
  }

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];

    if (
      entry !== undefined &&
      entry.kind === "activity" &&
      entry.verb !== null &&
      WRITING.has(entry.verb) &&
      touches(entry.input, path)
    ) {
      return `${entry.id}:${entry.state}`;
    }
  }

  return null;
}

function nameOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function useReloadWhenTurnsSettle(isRunning: boolean, reload: () => void) {
  const was = useRef(isRunning);
  const held = useRef(reload);
  held.current = reload;

  useEffect(() => {
    const settled = was.current && !isRunning;
    was.current = isRunning;

    if (settled) {
      held.current();
    }
  }, [isRunning]);
}
