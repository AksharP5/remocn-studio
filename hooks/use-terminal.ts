"use client";

import { Effect, Exit, Fiber } from "effect";
import type { MouseEvent } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { causeMessage } from "@/lib/error-message";
import { openTerminalWith } from "@/lib/studio/terminal";

export interface Terminal {
  error: string | null;
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
  opened: string | null;
}

const CLEAR_AFTER = "4 seconds";

export function useTerminal(): Terminal {
  const [opened, setOpened] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = useRef<Fiber.Fiber<unknown, unknown> | null>(null);

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

  return useMemo(() => ({ error, onOpen, opened }), [error, onOpen, opened]);
}
