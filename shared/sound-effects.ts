import { Schema } from "effect";

export const SOUND_FORMATS = ["mp3_44100_128", "mp3_44100_192"] as const;
export const SOUND_MODEL = "eleven_text_to_sound_v2";
export const SoundFormat = Schema.Literals(SOUND_FORMATS);
const text = Schema.String.check(
  Schema.makeFilter((value) => value.trim().length > 0 && value.length <= 5000)
);

export const SoundRequest = Schema.Struct({
  connectionId: Schema.NonEmptyString,
  durationSeconds: Schema.NullOr(
    Schema.Finite.check(Schema.isBetween({ maximum: 30, minimum: 0.5 }))
  ),
  format: SoundFormat,
  kind: Schema.optionalKey(Schema.Literal("sound")),
  name: text,
  text,
});
export type SoundRequest = typeof SoundRequest.Type;

export const MUSIC_MODEL = "music_v1";
export const MusicRequest = Schema.Struct({
  connectionId: Schema.NonEmptyString,
  durationSeconds: Schema.NullOr(
    Schema.Finite.check(Schema.isBetween({ maximum: 600, minimum: 3 }))
  ),
  forceInstrumental: Schema.Boolean,
  format: Schema.Literal("mp3_44100_128"),
  kind: Schema.Literal("music"),
  name: text,
  text: Schema.String.check(
    Schema.makeFilter(
      (value) => value.trim().length > 0 && value.length <= 4100
    )
  ),
});
export type MusicRequest = typeof MusicRequest.Type;
export const AudioRequest = Schema.Union([MusicRequest, SoundRequest]);
export type AudioRequest = typeof AudioRequest.Type;

export const SoundRef = Schema.Struct({ id: Schema.NonEmptyString });
export const SoundOperation = Schema.Struct({
  account: Schema.NullOr(Schema.String),
  connectionName: Schema.NonEmptyString,
  cost: Schema.NullOr(Schema.String),
  createdAt: Schema.Int,
  detail: Schema.NullOr(Schema.String),
  file: Schema.NullOr(Schema.NonEmptyString),
  id: Schema.NonEmptyString,
  providerRequestId: Schema.NullOr(Schema.String),
  request: AudioRequest,
  state: Schema.Literals([
    "prepared",
    "generating",
    "completed",
    "imported",
    "failed",
    "uncertain",
    "cancelled",
  ]),
});
export type SoundOperation = typeof SoundOperation.Type;

export const GeneratedSoundSource = Schema.Struct({
  author: Schema.String,
  authorUrl: Schema.String,
  connectionId: Schema.NonEmptyString,
  connectionName: Schema.NonEmptyString,
  durationSeconds: SoundRequest.fields.durationSeconds,
  format: SoundFormat,
  id: Schema.NonEmptyString,
  model: Schema.Literal(SOUND_MODEL),
  provider: Schema.Literal("elevenlabs"),
  text,
  url: Schema.String,
});

export const GeneratedMusicSource = Schema.Struct({
  ...GeneratedSoundSource.fields,
  durationSeconds: MusicRequest.fields.durationSeconds,
  forceInstrumental: Schema.Boolean,
  format: MusicRequest.fields.format,
  model: Schema.Literal(MUSIC_MODEL),
});

export function soundSummary(operation: SoundOperation): string {
  const { request } = operation;
  return [
    `ElevenLabs · ${operation.connectionName}${operation.account === null ? "" : ` (${operation.account})`}`,
    request.kind === "music"
      ? `Music · ${request.forceInstrumental ? "Instrumental" : "Vocals allowed"}`
      : "Sound effect",
    request.text,
    `Duration: ${request.durationSeconds === null ? "Automatic" : `${request.durationSeconds} seconds`}`,
    `Format: ${request.format}`,
    "This request spends credits on your ElevenLabs account. Send once; no automatic paid retry.",
  ].join("\n");
}
