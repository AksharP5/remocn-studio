import { Effect, Semaphore } from "effect";
import type { Asset } from "@/shared/library";
import {
  MUSIC_MODEL,
  SOUND_MODEL,
  type SoundOperation,
} from "@/shared/sound-effects";
import { LibraryError, listAssets, saveAsset } from "./store";

const importing = Semaphore.makeUnsafe(1);

export function importSound(
  operation: SoundOperation
): Effect.Effect<Asset, LibraryError> {
  return importing.withPermits(1)(
    Effect.gen(function* () {
      if (operation.state !== "completed" || operation.file === null) {
        return yield* Effect.fail(
          new LibraryError({
            message:
              "This sound has not completed. Check its operation instead of generating it again.",
          })
        );
      }
      const existing = (yield* listAssets()).find(
        (asset) =>
          asset.source?.provider === "elevenlabs" &&
          asset.source.id === operation.id
      );
      if (existing !== undefined) {
        return existing;
      }
      const { request } = operation;
      return yield* saveAsset({
        audiomap: null,
        dependencies: [],
        description: `Generated with ElevenLabs using ${operation.connectionName}.\n${request.text}\n${request.format} · ${request.durationSeconds ?? "Automatic"} seconds`,
        duration: null,
        files: [operation.file],
        name: request.name,
        preview: null,
        role: null,
        source: {
          ...(request.kind === "music"
            ? {
                forceInstrumental: request.forceInstrumental,
                format: request.format,
                model: MUSIC_MODEL,
              }
            : { format: request.format, model: SOUND_MODEL }),
          author: operation.connectionName,
          authorUrl: "",
          connectionId: request.connectionId,
          connectionName: operation.connectionName,
          durationSeconds: request.durationSeconds,
          id: operation.id,
          provider: "elevenlabs",
          text: request.text,
          url:
            request.kind === "music"
              ? "https://elevenlabs.io/music"
              : "https://elevenlabs.io/sound-effects",
        },
        type: "audio",
      }).pipe(
        Effect.mapError(
          () =>
            new LibraryError({
              message: `The sound was generated but could not be saved to the library. Its download is retained; check operation ${operation.id} to retry the local save without spending more credits.`,
            })
        )
      );
    })
  );
}
