import { Cause, Data, Effect, Exit, FiberMap, Stream } from "effect";
import { errorMessage } from "@/lib/error-message";
import {
  CANCELLED,
  type CoreMethod,
  type CoreParams,
  type CoreResult,
  codecsFor,
  decodeHostFrame,
  decodeMethod,
  SIDECAR_PROTOCOL,
  type SidecarMethod,
  type SidecarParams,
  type SidecarRequestFrame,
  type SidecarResult,
  type SidecarStream,
} from "@/shared/ipc";
import { type SidecarChannel as Channel, SidecarChannel } from "./channel";
import { askCore, type CoreError, settleCoreResult } from "./integrations/core";
import { recoverSounds } from "./integrations/sounds";
import {
  checkProjectAvailable,
  projectActivity,
  serializeBrandTurn,
} from "./projects/activity";

export class HandlerError extends Data.TaggedError("HandlerError")<{
  message: string;
}> {}

export interface HandlerInput<M extends SidecarMethod> {
  ask: <C extends CoreMethod>(
    method: C,
    params: CoreParams<C>
  ) => Effect.Effect<CoreResult<C>, CoreError>;
  emit: (chunk: SidecarStream<M>) => Effect.Effect<void>;
  log: (message: string) => Effect.Effect<void>;
  params: SidecarParams<M>;
}

export type Handler<M extends SidecarMethod, R = never> = (
  input: HandlerInput<M>
) => Effect.Effect<SidecarResult<M>, HandlerError, R>;

export type Handlers<R = never> = { [M in SidecarMethod]: Handler<M, R> };

type ErasedHandler<R> = (input: {
  ask: <C extends CoreMethod>(
    method: C,
    params: CoreParams<C>
  ) => Effect.Effect<CoreResult<C>, CoreError>;
  emit: (chunk: never) => Effect.Effect<void>;
  log: (message: string) => Effect.Effect<void>;
  params: never;
}) => Effect.Effect<unknown, HandlerError, R>;

type Inflight = FiberMap.FiberMap<string>;

export function runHost<R>(handlers: Handlers<R>) {
  return Effect.gen(function* () {
    const channel = yield* SidecarChannel;
    const inflight: Inflight = yield* FiberMap.make<string>();

    yield* channel.send({
      pid: process.pid,
      protocol: SIDECAR_PROTOCOL,
      type: "ready",
    });

    yield* recoverSounds(
      (method, params) =>
        askCore(method, params).pipe(
          Effect.provideService(SidecarChannel, channel)
        ),
      channel.log
    ).pipe(Effect.forkChild);

    yield* Stream.runForEach(channel.lines, (line) =>
      handleLine(handlers, channel, inflight, line)
    );
  });
}

function handleLine<R>(
  handlers: Handlers<R>,
  channel: Channel,
  inflight: Inflight,
  line: string
) {
  return Effect.suspend(() => {
    if (line.trim().length === 0) {
      return Effect.void;
    }

    const frame = decodeHostFrame(line);
    if (Exit.isFailure(frame)) {
      return channel.log(`dropped a frame it could not parse: ${line}`);
    }

    if (frame.value.type === "cancel") {
      return FiberMap.remove(inflight, frame.value.id);
    }

    if (frame.value.type === "result" || frame.value.type === "error") {
      return settleCoreResult(frame.value);
    }

    return dispatch(handlers, channel, inflight, frame.value);
  });
}

function dispatch<R>(
  handlers: Handlers<R>,
  channel: Channel,
  inflight: Inflight,
  frame: SidecarRequestFrame
) {
  return Effect.gen(function* () {
    if (yield* FiberMap.has(inflight, frame.id)) {
      yield* channel.send({
        id: frame.id,
        message: `request ${frame.id} is already in flight`,
        type: "error",
      });
      return;
    }

    const method = decodeMethod(frame.method);
    if (Exit.isFailure(method)) {
      yield* channel.send({
        id: frame.id,
        message: `there is no method called ${frame.method}`,
        type: "error",
      });
      return;
    }

    yield* FiberMap.run(
      inflight,
      frame.id,
      serve(handlers, channel, frame.id, method.value, frame.params)
    );
  });
}

function serve<R>(
  handlers: Handlers<R>,
  channel: Channel,
  id: string,
  method: SidecarMethod,
  params: unknown
) {
  const erased = handlers as unknown as Record<string, ErasedHandler<R>>;

  return Effect.gen(function* () {
    const decoded = yield* codecsFor(method).params(params);

    let operation = erased[method]({
      ask: (asked, asking) =>
        askCore(asked, asking).pipe(
          Effect.provideService(SidecarChannel, channel)
        ),
      emit: (chunk) => channel.send({ data: chunk, id, type: "stream" }),
      log: channel.log,
      params: decoded as never,
    });
    const projectId = (decoded as { projectId?: string } | null)?.projectId;
    if (
      projectId &&
      method === "agent.prompt" &&
      (decoded as { brandRevision?: number }).brandRevision !== undefined
    ) {
      operation = serializeBrandTurn(projectId, operation);
    }
    if (projectId && method === "preview.start") {
      return yield* checkProjectAvailable(projectId).pipe(
        Effect.andThen(operation)
      );
    }
    return yield* projectId &&
    method !== "preview.start" &&
    method !== "project.check" &&
    method !== "project.moveCancel"
      ? projectActivity(projectId, method === "project.move", operation)
      : operation;
  }).pipe(
    Effect.onExit((exit) =>
      channel.send(
        Exit.isSuccess(exit)
          ? { data: exit.value, id, type: "result" }
          : { id, message: replyMessage(exit.cause), type: "error" }
      )
    ),
    Effect.ignore
  );
}

function replyMessage(cause: Cause.Cause<unknown>): string {
  if (Cause.hasInterruptsOnly(cause)) {
    return CANCELLED;
  }
  return errorMessage(Cause.squash(cause));
}
