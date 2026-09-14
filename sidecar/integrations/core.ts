import { Data, Deferred, type Duration, Effect, Exit } from "effect";
import {
  type CoreAnswerFrame,
  type CoreMethod,
  type CoreParams,
  type CoreResult,
  coreCodecsFor,
} from "@/shared/ipc";
import { SidecarChannel } from "../channel";

export class CoreError extends Data.TaggedError("CoreError")<{
  message: string;
}> {}

export const ASK_TIMEOUT = "10 seconds";

const NO_ANSWER =
  "The studio did not answer in time, so this could not be checked.";

const pending = new Map<string, Deferred.Deferred<unknown, CoreError>>();

let counter = 0;

function nextId(): string {
  counter += 1;
  return `core-${process.pid}-${counter}`;
}

export function settleCoreResult(
  frame: CoreAnswerFrame
): Effect.Effect<boolean> {
  return Effect.suspend(() => {
    const waiting = pending.get(frame.id);
    if (waiting === undefined) {
      return Effect.succeed(false);
    }

    pending.delete(frame.id);

    const settled =
      frame.type === "result"
        ? Deferred.succeed(waiting, frame.data)
        : Deferred.fail(waiting, new CoreError({ message: frame.message }));

    return Effect.as(settled, true);
  });
}

export function askCore<M extends CoreMethod>(
  method: M,
  params: CoreParams<M>,
  patience: Duration.Input = ASK_TIMEOUT
): Effect.Effect<CoreResult<M>, CoreError, SidecarChannel> {
  return Effect.gen(function* () {
    const channel = yield* SidecarChannel;
    const id = nextId();
    const waiting = yield* Deferred.make<unknown, CoreError>();

    pending.set(id, waiting);

    const answer = yield* Effect.onExit(
      Effect.gen(function* () {
        yield* channel.send({ id, method, params, type: "request" });

        return yield* Deferred.await(waiting).pipe(
          Effect.timeoutOrElse({
            duration: patience,
            orElse: () => Effect.fail(new CoreError({ message: NO_ANSWER })),
          })
        );
      }),
      () => Effect.sync(() => pending.delete(id))
    );

    const decoded = coreCodecsFor(method).result(answer);

    if (Exit.isFailure(decoded)) {
      return yield* Effect.fail(
        new CoreError({
          message: `The studio answered about ${method} in a shape this version cannot read.`,
        })
      );
    }

    return decoded.value;
  });
}

export function forgetPending(): void {
  pending.clear();
}
