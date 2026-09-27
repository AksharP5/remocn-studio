"use client";

import { useCallback } from "react";
import type { Studio } from "@/components/studio/studio-provider";
import type { ComposerActions } from "@/hooks/use-composer";
import type { OpenTurn } from "@/hooks/use-open-turn";
import {
  prepareSoundUse,
  regenerateSoundPrompt,
} from "@/lib/studio/turn-actions";
import type { SoundResult } from "@/shared/ipc";
import { stillFileOf } from "@/shared/library";
import { useAudioPlayer } from "./use-audio-player";
import { useTurnAction } from "./use-turn-action";

export function useSoundResult(
  result: SoundResult,
  studio: Pick<Studio, "environment" | "openedProject" | "openedVideo"> & {
    composer: Pick<ComposerActions, "write">;
    turn: OpenTurn;
  }
) {
  const { turn, composer, environment, openedProject, openedVideo } = studio;
  const player = useAudioPlayer(stillFileOf(result.asset));
  const locked =
    turn.permission !== null || turn.source !== null || environment.isBlocking;
  const disabled =
    locked ||
    openedProject === null ||
    openedProject.missing ||
    openedVideo === null ||
    openedVideo.missing ||
    player.unavailable ||
    player.url === null;
  const action = useTurnAction(turn, disabled);
  const { run } = action;
  const onUse = useCallback(() => run(prepareSoundUse(result)), [result, run]);
  const { write } = composer;
  const onRegenerate = useCallback(
    () => write(regenerateSoundPrompt(result)),
    [result, write]
  );
  return { action, disabled, locked, onRegenerate, onUse, player };
}
