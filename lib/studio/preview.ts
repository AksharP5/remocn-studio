import { Effect, Schema } from "effect";
import {
  cancelSidecarRequest,
  newRequestId,
  requestSidecar,
  type SidecarError,
} from "@/lib/studio/sidecar";
import {
  CodeNodePath,
  CodePropStatus,
  type PreviewEvent,
  type PreviewParams,
  type PreviewResult,
  PromptElement,
  type StatusParams,
  type StatusResult,
  type Still,
  type StillEvent,
  type StillParams,
  VideoConfigValues,
  type Warmed,
  type WarmParams,
  type WriteParams,
  type WriteResult,
} from "@/shared/ipc";

export const PREVIEW_MESSAGE_SOURCE = "remocn-preview";
export const PREVIEW_COMMAND_SOURCE = "remocn-studio";

export const PreviewPick = Schema.Literals([
  "asked",
  "first",
  "folder",
  "main",
  "missing",
  "none",
]);

export const PreviewRect = Schema.Struct({
  height: Schema.Finite,
  width: Schema.Finite,
  x: Schema.Finite,
  y: Schema.Finite,
});

export const PreviewWindow = Schema.Struct({
  from: Schema.Int,
  until: Schema.Int,
});

export const InspectStatus = Schema.Literals([
  "armed",
  "disarmed",
  "no-canvas",
  "no-grab",
]);

export const SnapshotStatus = Schema.Literals([
  "armed",
  "disarmed",
  "no-canvas",
]);

const from = Schema.Literal(PREVIEW_MESSAGE_SOURCE);

export const TuningValue = Schema.Union([
  Schema.Finite,
  Schema.String,
  Schema.Boolean,
  Schema.Null,
  Schema.Array(
    Schema.Union([Schema.Finite, Schema.String, Schema.Boolean, Schema.Null])
  ),
]);

export const TuningFieldType = Schema.Literals([
  "array",
  "boolean",
  "color",
  "enum",
  "font-family",
  "number",
  "rotation-css",
  "rotation-degrees",
  "scale",
  "text-content",
  "transform-origin",
  "translate",
  "uv-coordinate",
]);

export const TuningField = Schema.Struct({
  arrayItemType: Schema.NullOr(TuningFieldType),
  description: Schema.NullOr(Schema.String),
  group: Schema.String,
  label: Schema.String,
  max: Schema.NullOr(Schema.Finite),
  maxLength: Schema.NullOr(Schema.Int),
  min: Schema.NullOr(Schema.Finite),
  minLength: Schema.NullOr(Schema.Int),
  newItemDefault: Schema.NullOr(TuningValue),
  options: Schema.Array(Schema.String),
  path: Schema.NonEmptyString,
  readOnly: Schema.optionalKey(Schema.Boolean),
  step: Schema.NullOr(Schema.Finite),
  // A merged list is edited through as many targets as it was built from, so
  // the field says which `Interactive` in the chain owns it.
  targetId: Schema.NonEmptyString,
  type: TuningFieldType,
  value: TuningValue,
});

export const TuningWhere = Schema.Struct({
  column: Schema.NullOr(Schema.Int),
  file: Schema.NonEmptyString,
  line: Schema.NullOr(Schema.Int),
});

export const TuningTarget = Schema.Struct({
  componentName: Schema.NonEmptyString,
  fields: Schema.Array(TuningField),
  // Remotion's own identity for the component, and the flattened schema keys a
  // status is asked for. A page from an older build sends neither, and a target
  // with no keys is simply one nothing can be read for.
  identity: Schema.NullOr(Schema.String).pipe(
    Schema.withDecodingDefault(Effect.succeed(null))
  ),
  instanceId: Schema.String.pipe(
    Schema.withDecodingDefault(Effect.succeed(""))
  ),
  instances: Schema.Int.pipe(Schema.withDecodingDefault(Effect.succeed(1))),
  keys: Schema.Array(Schema.String).pipe(
    Schema.withDecodingDefault(Effect.succeed([]))
  ),
  name: Schema.NullOr(Schema.String).pipe(
    Schema.withDecodingDefault(Effect.succeed(null))
  ),
  ordinal: Schema.Int.pipe(Schema.withDecodingDefault(Effect.succeed(1))),
  // The JSX call site, from Remotion's own stack — where a value is written.
  // `where` is a different fact and stays: it is what React Grab resolved for
  // the node, which is the component's own file and the pane's subtitle.
  origin: Schema.NullOr(TuningWhere).pipe(
    Schema.withDecodingDefault(Effect.succeed(null))
  ),
  schema: Schema.optionalKey(Schema.Unknown),
  targetId: Schema.NonEmptyString,
  where: Schema.NullOr(TuningWhere).pipe(
    Schema.withDecodingDefault(Effect.succeed(null))
  ),
});

// The chain of `Interactive`s around the picked element, innermost first. A
// page from an older build sends nothing, and an empty chain is the same thing
// as the element having none.
const tuning = Schema.Array(TuningTarget).pipe(
  Schema.withDecodingDefault(Effect.succeed([]))
);

export const PreviewMessage = Schema.Union([
  Schema.Struct({
    compositionId: Schema.NullOr(Schema.String),
    compositions: Schema.Array(Schema.NonEmptyString),
    reason: PreviewPick,
    source: from,
    total: Schema.Int,
    type: Schema.Literal("composition"),
    unmeasured: Schema.Boolean,
  }),
  Schema.Struct({
    element: PromptElement,
    fonts: Schema.Array(Schema.String).pipe(
      Schema.withDecodingDefault(Effect.succeed([]))
    ),
    rect: PreviewRect,
    repeat: Schema.Boolean.pipe(
      Schema.withDecodingDefault(Effect.succeed(false))
    ),
    source: from,
    text: Schema.NullOr(Schema.String).pipe(
      Schema.withDecodingDefault(Effect.succeed(null))
    ),
    tuning,
    type: Schema.Literal("selection"),
    // Only the page knows the composition's numbers, and the codemod needs
    // them to read a prop written as an expression over `fps` or `width`.
    video: Schema.NullOr(VideoConfigValues).pipe(
      Schema.withDecodingDefault(Effect.succeed(null))
    ),
    window: Schema.NullOr(PreviewWindow).pipe(
      Schema.withDecodingDefault(Effect.succeed(null))
    ),
  }),
  Schema.Struct({
    frame: Schema.Int,
    playing: Schema.Boolean,
    source: from,
    type: Schema.Literal("playhead"),
  }),
  Schema.Struct({
    paused: Schema.Boolean,
    source: from,
    status: InspectStatus,
    type: Schema.Literal("inspect"),
  }),
  Schema.Struct({
    paused: Schema.Boolean,
    source: from,
    status: SnapshotStatus,
    type: Schema.Literal("snapshot"),
  }),
  Schema.Struct({
    composition: Schema.NonEmptyString,
    frame: Schema.Int,
    rect: Schema.NullOr(PreviewRect),
    source: from,
    type: Schema.Literal("capture"),
  }),
  Schema.Struct({
    source: from,
    type: Schema.Literal("rebuilt"),
  }),
  Schema.Struct({
    error: Schema.NullOr(Schema.String),
    ok: Schema.Boolean,
    requestId: Schema.NonEmptyString,
    source: from,
    type: Schema.Literal("tune.result"),
  }),
]);

const to = Schema.Literal(PREVIEW_COMMAND_SOURCE);

export const PreviewCommand = Schema.Union([
  Schema.Struct({
    armed: Schema.Boolean,
    source: to,
    type: Schema.Literal("inspect"),
  }),
  Schema.Struct({
    armed: Schema.Boolean,
    source: to,
    type: Schema.Literal("snapshot"),
  }),
  Schema.Struct({
    frame: Schema.Int,
    source: to,
    type: Schema.Literal("seek"),
  }),
  Schema.Struct({
    from: Schema.Int,
    source: to,
    type: Schema.Literal("replay"),
    until: Schema.Int,
  }),
  Schema.Struct({
    source: to,
    type: Schema.Literal("pause"),
  }),
  Schema.Struct({
    source: to,
    targets: Schema.Array(
      Schema.Struct({
        nodePath: Schema.NullOr(CodeNodePath),
        props: Schema.Record(Schema.String, CodePropStatus),
        targetId: Schema.NonEmptyString,
      })
    ),
    type: Schema.Literal("tuning.statuses"),
  }),
  Schema.Struct({
    // Whether anything is open to be highlighted *for*. `targetId: null` on its
    // own used to mean two different things — a card with no chain, which wants
    // the picked element boxed, and no card at all, which wants nothing drawn —
    // and the second read as the first, so Cancel moved the box back onto the
    // picked element and left it there.
    open: Schema.Boolean,
    source: to,
    targetId: Schema.NullOr(Schema.NonEmptyString),
    type: Schema.Literal("highlight"),
  }),
  Schema.Struct({
    path: Schema.NonEmptyString,
    requestId: Schema.NonEmptyString,
    source: to,
    targetId: Schema.NonEmptyString,
    type: Schema.Literal("tune.set"),
    value: TuningValue,
  }),
  Schema.Struct({
    paths: Schema.Array(Schema.NonEmptyString),
    requestId: Schema.NonEmptyString,
    source: to,
    targetId: Schema.NonEmptyString,
    type: Schema.Literal("tune.reset"),
  }),
]);

export type InspectStatus = (typeof InspectStatus)["Type"];
export type SnapshotStatus = (typeof SnapshotStatus)["Type"];
export type PreviewRect = (typeof PreviewRect)["Type"];
export type PreviewMessage = (typeof PreviewMessage)["Type"];
export type PreviewInspect = Extract<PreviewMessage, { type: "inspect" }>;
export type PreviewSnapshot = Extract<PreviewMessage, { type: "snapshot" }>;
export type PreviewCapture = Extract<PreviewMessage, { type: "capture" }>;
export type PreviewTuneResult = Extract<
  PreviewMessage,
  { type: "tune.result" }
>;
export type PreviewCommand = (typeof PreviewCommand)["Type"];
export type PreviewComposition = Extract<
  PreviewMessage,
  { type: "composition" }
>;
export type PreviewSelection = Extract<PreviewMessage, { type: "selection" }>;
export type PreviewPlayhead = Extract<PreviewMessage, { type: "playhead" }>;
export type PreviewWindow = (typeof PreviewWindow)["Type"];
export type TuningField = (typeof TuningField)["Type"];
export type TuningTarget = (typeof TuningTarget)["Type"];
export type TuningWhere = (typeof TuningWhere)["Type"];
export type TuningValue = (typeof TuningValue)["Type"];
export type TuningStatuses = Extract<
  PreviewCommand,
  { type: "tuning.statuses" }
>["targets"][number];

export const decodePreviewMessage = Schema.decodeUnknownExit(PreviewMessage);
export const decodePreviewCommand = Schema.decodeUnknownExit(PreviewCommand);

export function inspectCommand(armed: boolean): PreviewCommand {
  return { armed, source: PREVIEW_COMMAND_SOURCE, type: "inspect" };
}

export function snapshotCommand(armed: boolean): PreviewCommand {
  return { armed, source: PREVIEW_COMMAND_SOURCE, type: "snapshot" };
}

/** Point at one `Interactive` of the open selection, or at none. */
export function highlightCommand(
  targetId: string | null,
  open: boolean
): PreviewCommand {
  return { open, source: PREVIEW_COMMAND_SOURCE, targetId, type: "highlight" };
}

export function seekCommand(frame: number): PreviewCommand {
  return { frame, source: PREVIEW_COMMAND_SOURCE, type: "seek" };
}

export function replayCommand(span: PreviewWindow): PreviewCommand {
  return {
    from: span.from,
    source: PREVIEW_COMMAND_SOURCE,
    type: "replay",
    until: span.until,
  };
}

export function pauseCommand(): PreviewCommand {
  return { source: PREVIEW_COMMAND_SOURCE, type: "pause" };
}

export function tuningStatusesCommand(
  targets: readonly TuningStatuses[]
): PreviewCommand {
  return {
    source: PREVIEW_COMMAND_SOURCE,
    targets: [...targets],
    type: "tuning.statuses",
  };
}

export function tuneSetCommand(
  requestId: string,
  targetId: string,
  path: string,
  value: TuningValue
): PreviewCommand {
  return {
    path,
    requestId,
    source: PREVIEW_COMMAND_SOURCE,
    targetId,
    type: "tune.set",
    value,
  };
}

export function tuneResetCommand(
  requestId: string,
  targetId: string,
  paths: readonly string[]
): PreviewCommand {
  return {
    paths: [...paths],
    requestId,
    source: PREVIEW_COMMAND_SOURCE,
    targetId,
    type: "tune.reset",
  };
}

export function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function startPreview(
  params: PreviewParams,
  onEvent: (event: PreviewEvent) => void
): Effect.Effect<PreviewResult, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "preview.start",
      onStream: onEvent,
      params,
    }).pipe(Effect.onInterrupt(() => Effect.ignore(cancelSidecarRequest(id))));
  });
}

export function warmComposition(
  params: WarmParams
): Effect.Effect<Warmed, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({ id, method: "preview.warm", params }).pipe(
      Effect.onInterrupt(() => Effect.ignore(cancelSidecarRequest(id)))
    );
  });
}

export function readCodeStatuses(
  params: StatusParams
): Effect.Effect<StatusResult, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({ id, method: "preview.status", params }).pipe(
      Effect.onInterrupt(() => Effect.ignore(cancelSidecarRequest(id)))
    );
  });
}

export function writeCode(
  params: WriteParams
): Effect.Effect<WriteResult, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({ id, method: "preview.write", params }).pipe(
      Effect.onInterrupt(() => Effect.ignore(cancelSidecarRequest(id)))
    );
  });
}

export function renderStill(
  params: StillParams,
  onEvent: (event: StillEvent) => void
): Effect.Effect<Still, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "preview.still",
      onStream: onEvent,
      params,
    }).pipe(Effect.onInterrupt(() => Effect.ignore(cancelSidecarRequest(id))));
  });
}
