"use client";

import { isTauri } from "@tauri-apps/api/core";
import { Effect, Exit, Fiber } from "effect";
import type { MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAsyncAction } from "@/hooks/use-async-action";
import { causeMessage } from "@/lib/error-message";
import { currentPlatform } from "@/lib/studio/platform";
import {
  linuxSetupCommand,
  openTerminalWith,
  setupDataDir,
} from "@/lib/studio/terminal";

export interface Terminal {
  error: string | null;
  isPreparing: boolean;
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
  opened: string | null;
  prepare: (command: string) => string;
}

const CLEAR_AFTER = "4 seconds";

export function useTerminal(): Terminal {
  const [opened, setOpened] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = useRef<Fiber.Fiber<unknown, unknown> | null>(null);
  const needsNodePath = currentPlatform() === "linux" && isTauri();
  const [dataDir, setDataDir] = useState<string | null>();
  const { run, error: pathError } = useAsyncAction();

  useEffect(() => {
    if (!needsNodePath) {
      return;
    }
    let current = true;
    run(setupDataDir).then((directory) => {
      if (current) {
        setDataDir(directory);
      }
    });
    return () => {
      current = false;
    };
  }, [needsNodePath, run]);

  const isPreparing = needsNodePath && dataDir === undefined;
  const prepare = useCallback(
    (command: string) =>
      typeof dataDir === "string"
        ? linuxSetupCommand(command, dataDir)
        : command,
    [dataDir]
  );

  const onOpen = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const command = event.currentTarget.value;

    if (running.current !== null) {
      Effect.runFork(Fiber.interrupt(running.current));
    }

    running.current = Effect.runFork(
      openTerminalWith(command).pipe(
        Effect.onExit((exit) =>
          Effect.sync(() => {
            if (Exit.isSuccess(exit)) {
              setError(null);
              setOpened(command);
              return;
            }
            setError(causeMessage(exit.cause));
          })
        ),
        Effect.andThen(Effect.sleep(CLEAR_AFTER)),
        Effect.andThen(
          Effect.sync(() => {
            setOpened(null);
          })
        ),
        Effect.ignore
      )
    );
  }, []);

  return useMemo(
    () => ({ error: error ?? pathError, isPreparing, onOpen, opened, prepare }),
    [error, pathError, isPreparing, onOpen, opened, prepare]
  );
}
