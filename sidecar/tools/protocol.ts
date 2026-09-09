import { type Exit, Schema, type SchemaError } from "effect";

export const TOOLS_HOST_FLAG = "--tools-host";
export const TOOLS_SOCKET_ENV = "REMOCN_STUDIO_TOOLS_SOCKET";
export const TOOLS_TURN_ENV = "REMOCN_STUDIO_TOOLS_TURN";

// Both ends of the socket are this bundle, so the frames live here rather
// than in shared/: the webview never sees them. Newline-delimited JSON, the
// same shape discipline the sidecar's own stdio uses.
export const ToolCall = Schema.Struct({
  cancel: Schema.optionalKey(Schema.Boolean),
  id: Schema.NonEmptyString,
  params: Schema.Unknown,
  server: Schema.NonEmptyString,
  tool: Schema.NonEmptyString,
  turn: Schema.NonEmptyString,
  type: Schema.Literal("call"),
});

export const ToolReply = Schema.Struct({
  id: Schema.NonEmptyString,
  isError: Schema.Boolean,
  progress: Schema.optionalKey(
    Schema.Struct({ completed: Schema.Int, total: Schema.Int })
  ),
  text: Schema.String,
  type: Schema.Literals(["reply", "progress"]),
});

export type ToolCall = (typeof ToolCall)["Type"];
export type ToolReply = (typeof ToolReply)["Type"];

type Decoded<A> = Exit.Exit<A, SchemaError.SchemaError>;

export const decodeToolCall: (line: string) => Decoded<ToolCall> =
  Schema.decodeExit(Schema.fromJsonString(ToolCall));

export const decodeToolReply: (line: string) => Decoded<ToolReply> =
  Schema.decodeExit(Schema.fromJsonString(ToolReply));
