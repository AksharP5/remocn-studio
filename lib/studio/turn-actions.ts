import { Data, Effect } from "effect";
import type { SoundResult } from "@/shared/ipc";
import { type PromptAsset, promptAssetOf } from "@/shared/library";
import { listAssets } from "./library";

export interface TurnAction {
  assets: readonly PromptAsset[];
  prompt: string;
}

export class TurnActionError extends Data.TaggedError("TurnActionError")<{
  message: string;
}> {}

export function prepareSoundUse(result: SoundResult) {
  return listAssets.pipe(
    Effect.flatMap((assets) => {
      const asset = assets.find(
        (item) =>
          item.source?.provider === "elevenlabs" &&
          item.source.id === result.operationId
      );
      if (asset === undefined) {
        return Effect.fail(
          new TurnActionError({
            message:
              "This sound is no longer in the library. Regenerate it to create a new version.",
          })
        );
      }
      return Effect.succeed({
        assets: [promptAssetOf(asset)],
        prompt:
          result.request.kind === "music"
            ? "Use [Asset #1] as music in this video. Adjust its timing and volume to suit the video."
            : "Use [Asset #1] as a sound effect in this video. Place it where it fits the scene and adjust its timing and volume to suit the video.",
      } satisfies TurnAction);
    })
  );
}

export function regenerateSoundPrompt({ asset, request }: SoundResult): string {
  const connection =
    asset.source?.provider === "elevenlabs"
      ? asset.source.connectionName
      : "ElevenLabs";
  return [
    `Generate a new version of the ${request.kind === "music" ? "music" : "sound effect"} “${request.name}” using my ${connection} connection (ElevenLabs, ${request.connectionId}).`,
    `Description: ${request.text}`,
    `Duration: ${request.durationSeconds === null ? "Automatic" : `${request.durationSeconds} seconds`}`,
    `Format: ${request.format}`,
    ...(request.kind === "music"
      ? [`Instrumental only: ${request.forceInstrumental ? "yes" : "no"}`]
      : []),
  ].join("\n");
}
