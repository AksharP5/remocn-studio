import { Effect } from "effect";
import type { AgentEvent } from "@/shared/ipc";
import type { Asset } from "@/shared/library";
import {
  type AudioRequest,
  type SoundOperation,
  soundSummary,
} from "@/shared/sound-effects";
import type { PermissionGate } from "../agent/gate";
import type { HandlerInput } from "../host";
import { importSound } from "../library/sounds";
import { listAssets } from "../library/store";
import { CoreError } from "./core";

export interface SoundContext {
  ask: HandlerInput<"agent.prompt">["ask"];
  emit: (event: AgentEvent) => Effect.Effect<void>;
  gate: PermissionGate;
  turnId: string;
}

export function soundStatus(
  ask: SoundContext["ask"],
  id: string,
  emit: SoundContext["emit"] = () => Effect.void
) {
  return ask("sounds.status", { id }).pipe(
    Effect.flatMap((operation) => describeResult(ask, operation, emit))
  );
}

function describeResult(
  ask: SoundContext["ask"],
  operation: SoundOperation,
  emit: SoundContext["emit"]
) {
  const publish = (asset: Asset) =>
    emit({
      result: {
        asset,
        operationId: operation.id,
        request: operation.request,
      },
      type: "sound_result",
    });
  if (operation.state === "imported") {
    return listAssets().pipe(
      Effect.flatMap((assets) => {
        const asset =
          assets.find(
            (item) =>
              item.source?.provider === "elevenlabs" &&
              item.source.id === operation.id
          ) ?? null;
        return (asset === null ? Effect.void : publish(asset)).pipe(
          Effect.as(
            JSON.stringify({
              asset,
              message:
                "This sound was saved previously. If it was deleted from the library, recovery will not recreate it.",
              operationId: operation.id,
              state: operation.state,
            })
          )
        );
      })
    );
  }
  if (operation.state === "completed") {
    return importSound(operation).pipe(
      Effect.tap(publish),
      Effect.tap(() => ask("sounds.imported", { id: operation.id })),
      Effect.map((asset) =>
        JSON.stringify({
          asset: { name: asset.name, path: asset.path, slug: asset.slug },
          message:
            "Saved to the library. The person can listen locally and explicitly attach this asset to a Project or Video. Do not change project files unless requested.",
          operationId: operation.id,
          state: operation.state,
        })
      )
    );
  }
  return Effect.succeed(
    JSON.stringify({
      detail: operation.detail,
      operationId: operation.id,
      state: operation.state,
    })
  );
}

export function generateSound(request: AudioRequest, context: SoundContext) {
  return Effect.gen(function* () {
    const operation = yield* context.ask("sounds.prepare", request);
    const { id } = operation;
    return yield* Effect.gen(function* () {
      const answer = yield* context.gate.wait({
        id,
        onReady: () =>
          context.emit({
            id,
            input: { description: soundSummary(operation) },
            name:
              request.kind === "music"
                ? "Generate music"
                : "Generate sound effect",
            reason: "outward",
            type: "permission",
          }),
        rememberable: false,
        signature: `sound:${id}`,
        turnId: context.turnId,
      });
      if (answer.decision !== "allow") {
        return yield* Effect.fail(
          new CoreError({
            message:
              "The person declined this sound generation. Nothing was sent; do not repeat the request.",
          })
        );
      }
      yield* context.emit({
        message: `Generating ${request.kind === "music" ? "music" : "sound"} with ElevenLabs. Operation: ${id}. If waiting stops, check this operation; do not generate again automatically.`,
        type: "notice",
      });
      let current = yield* context.ask("sounds.commit", { id });
      while (current.state === "generating") {
        yield* Effect.sleep("1 second");
        current = yield* context.ask("sounds.status", { id });
      }
      return yield* describeResult(context.ask, current, context.emit);
    }).pipe(
      Effect.ensuring(context.ask("sounds.cancel", { id }).pipe(Effect.ignore))
    );
  });
}

export function recoverSounds(
  ask: SoundContext["ask"],
  notice: (message: string) => Effect.Effect<void>
) {
  return ask("sounds.recover", null).pipe(
    Effect.flatMap((operations) =>
      Effect.forEach(
        operations.filter((operation) => operation.state === "completed"),
        (operation) =>
          importSound(operation).pipe(
            Effect.tap(() => ask("sounds.imported", { id: operation.id })),
            Effect.catch((failure) => notice(failure.message))
          ),
        { discard: true }
      )
    ),
    Effect.catch((failure) => notice(failure.message))
  );
}
