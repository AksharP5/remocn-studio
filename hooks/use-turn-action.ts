"use client";

import { Effect, Exit } from "effect";
import { useCallback, useEffect, useRef, useState } from "react";
import { causeMessage, errorMessage } from "@/lib/error-message";
import { type TurnAction, TurnActionError } from "@/lib/studio/turn-actions";
import type { OpenTurn } from "./use-open-turn";

export function useTurnAction(
  turn: Pick<OpenTurn, "send" | "openId" | "isRunning" | "writesBlocked">,
  blocked: boolean
) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "queued">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const latest = useRef({ blocked, turn });
  latest.current = { blocked, turn };
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (action: Effect.Effect<TurnAction, { message: string }>) => {
      if (busy.current || latest.current.blocked) {
        return;
      }
      busy.current = true;
      setState("sending");
      setError(null);
      const origin = latest.current.turn.openId;
      let queued = false;
      const exit = await Effect.runPromiseExit(
        action.pipe(
          Effect.flatMap((input) => {
            const { current } = latest;
            if (
              !mounted.current ||
              current.blocked ||
              current.turn.openId !== origin
            ) {
              return Effect.fail(
                new TurnActionError({
                  message:
                    "The chat changed. Try this action again in the intended video.",
                })
              );
            }
            queued =
              current.turn.isRunning || current.turn.writesBlocked !== null;
            return Effect.tryPromise({
              catch: (cause) =>
                new TurnActionError({ message: errorMessage(cause) }),
              try: () => current.turn.send(input.prompt, [], [], input.assets),
            }).pipe(
              Effect.flatMap((accepted) =>
                accepted
                  ? Effect.void
                  : Effect.fail(
                      new TurnActionError({
                        message:
                          "The request could not be sent. Check that this video is available and try again.",
                      })
                    )
              )
            );
          })
        )
      );
      if (!mounted.current) {
        return;
      }
      if (Exit.isFailure(exit)) {
        busy.current = false;
        setError(causeMessage(exit.cause));
        setState("idle");
      } else {
        setState(queued ? "queued" : "sent");
      }
    },
    []
  );

  return { error, run, state };
}
