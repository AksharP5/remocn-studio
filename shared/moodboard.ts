import { Effect, Schema } from "effect";
import { AssetSource } from "./library";

export const MOODBOARD_SPEC_FILE = "spec.json";

export const MOODBOARD_WIDTH = 1440;
export const MOODBOARD_HEIGHT = 900;

export const MOODBOARD_IMAGE_ROLES = ["photo", "texture"] as const;

export const MoodboardImageRole = Schema.Literals(MOODBOARD_IMAGE_ROLES);

export type MoodboardImageRole = (typeof MoodboardImageRole)["Type"];

const emptyText = Schema.String.pipe(
  Schema.withDecodingDefault(Effect.succeed(""))
);

const span = (fallback: number) =>
  Schema.Int.pipe(Schema.withDecodingDefault(Effect.succeed(fallback)));

export const MoodboardImage = Schema.Struct({
  columns: span(2),
  file: Schema.NonEmptyString,
  id: Schema.NonEmptyString,
  note: emptyText,
  role: MoodboardImageRole.pipe(
    Schema.withDecodingDefault(Effect.succeed("photo" as const))
  ),
  rows: span(2),
  source: Schema.NullOr(AssetSource).pipe(
    Schema.withDecodingDefault(Effect.succeed(null))
  ),
});

export type MoodboardImage = (typeof MoodboardImage)["Type"];

export const MoodboardSwatch = Schema.Struct({
  hex: Schema.NonEmptyString,
  id: Schema.NonEmptyString,
  name: emptyText,
});

export type MoodboardSwatch = (typeof MoodboardSwatch)["Type"];

export const MoodboardTypography = Schema.Struct({
  body: Schema.NonEmptyString,
  heading: Schema.NonEmptyString,
  id: Schema.NonEmptyString,
  sample: emptyText,
});

export type MoodboardTypography = (typeof MoodboardTypography)["Type"];

const rows = <S extends Schema.Top>(entry: S) =>
  Schema.Array(entry).pipe(Schema.withDecodingDefault(Effect.succeed([])));

export const MoodboardSpec = Schema.Struct({
  images: Schema.Array(MoodboardImage),
  keywords: rows(Schema.NonEmptyString),
  palette: rows(MoodboardSwatch),
  project: Schema.NullOr(Schema.NonEmptyString).pipe(
    Schema.withDecodingDefault(Effect.succeed(null))
  ),
  title: Schema.NonEmptyString,
  typography: rows(MoodboardTypography),
});

export type MoodboardSpec = (typeof MoodboardSpec)["Type"];

export const decodeMoodboardSpec = Schema.decodeUnknownExit(MoodboardSpec);

const HEX = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: string): boolean {
  return HEX.test(value);
}

export function fontFamilies(spec: MoodboardSpec): readonly string[] {
  const families = spec.typography.flatMap((pair) => [pair.heading, pair.body]);
  return [...new Set(families)];
}

export function googleFontsHref(spec: MoodboardSpec): string | null {
  const families = fontFamilies(spec);
  if (families.length === 0) {
    return null;
  }

  const query = families
    .map(
      (family) =>
        `family=${encodeURIComponent(family).replaceAll("%20", "+")}:wght@400;700`
    )
    .join("&");

  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}
