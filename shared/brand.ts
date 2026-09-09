import { Schema } from "effect";

export const BrandFile = Schema.Struct({
  font: Schema.optionalKey(
    Schema.Struct({
      axes: Schema.Record(
        Schema.String,
        Schema.Tuple([Schema.Finite, Schema.Finite])
      ),
      coverage: Schema.Array(Schema.Tuple([Schema.Int, Schema.Int])),
      family: Schema.String,
      style: Schema.Literals(["normal", "italic"]),
      weight: Schema.String,
    })
  ),
  hash: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  path: Schema.NonEmptyString,
  source: Schema.optionalKey(Schema.String),
});
export type BrandFile = typeof BrandFile.Type;

export const BrandFont = Schema.Struct({
  fallback: Schema.String,
  family: Schema.NonEmptyString,
  files: Schema.Array(
    Schema.Struct({
      ...BrandFile.fields,
      axes: Schema.optionalKey(
        Schema.Record(
          Schema.String,
          Schema.Tuple([Schema.Finite, Schema.Finite])
        )
      ),
      style: Schema.Literals(["normal", "italic", "oblique"]),
      unicodeRange: Schema.optionalKey(Schema.String),
      weight: Schema.String,
    })
  ),
  licenses: Schema.Array(BrandFile),
  sources: Schema.optionalKey(Schema.Array(BrandFile)),
});

export const ProjectBrand = Schema.Struct({
  colors: Schema.Record(
    Schema.String,
    Schema.String.check(Schema.isPattern(/^#[a-fA-F0-9]{6}([a-fA-F0-9]{2})?$/))
  ),
  design: Schema.optionalKey(
    Schema.Struct({ file: BrandFile, markdown: Schema.String })
  ),
  logoRules: Schema.optionalKey(Schema.String),
  logos: Schema.Struct({
    mark: Schema.optionalKey(BrandFile),
    onDark: Schema.optionalKey(BrandFile),
    onLight: Schema.optionalKey(BrandFile),
  }),
  motion: Schema.optionalKey(Schema.String),
  name: Schema.optionalKey(Schema.String),
  provenance: Schema.Array(
    Schema.Struct({
      field: Schema.String,
      importedAt: Schema.String,
      source: Schema.String,
    })
  ),
  tone: Schema.Struct({
    avoided: Schema.String,
    description: Schema.String,
    preferred: Schema.String,
  }),
  typography: Schema.Struct({
    body: Schema.optionalKey(BrandFont),
    display: Schema.optionalKey(BrandFont),
    mono: Schema.optionalKey(BrandFont),
  }),
});
export type ProjectBrand = typeof ProjectBrand.Type;

export function emptyBrand(): ProjectBrand {
  return {
    colors: {},
    logos: {},
    provenance: [],
    tone: { avoided: "", description: "", preferred: "" },
    typography: {},
  };
}

export function brandFiles(brand: ProjectBrand | null): readonly BrandFile[] {
  if (brand === null) {
    return [];
  }
  return [
    ...(brand.design ? [brand.design.file] : []),
    ...Object.values(brand.logos),
    ...Object.values(brand.typography).flatMap((font) => [
      ...font.files,
      ...font.licenses,
      ...(font.sources ?? []),
    ]),
  ];
}

export const ProjectBrandSnapshot = Schema.Struct({
  brand: Schema.NullOr(ProjectBrand),
  exceptions: Schema.String,
  hash: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  projectId: Schema.NonEmptyString,
  revision: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  schemaVersion: Schema.Literal(1),
});
export type ProjectBrandSnapshot = typeof ProjectBrandSnapshot.Type;

// Imports are proposals. A repeated import only fills fields the user has not
// supplied; callers must present any replacement as an explicit edit.
export const ProjectBrandDraft = Schema.Struct({
  brand: ProjectBrand,
  source: Schema.String,
  verifiedLogos: Schema.optionalKey(
    Schema.Array(Schema.Literals(["onLight", "onDark", "mark"]))
  ),
});
export function mergeBrandDraft(
  current: ProjectBrand,
  incoming: ProjectBrand
): ProjectBrand {
  return {
    ...incoming,
    ...current,
    ...(current.name || incoming.name
      ? { name: current.name || incoming.name }
      : {}),
    colors: { ...incoming.colors, ...current.colors },
    logos: { ...incoming.logos, ...current.logos },
    provenance: [...current.provenance, ...incoming.provenance],
    tone: {
      avoided: current.tone.avoided || incoming.tone.avoided,
      description: current.tone.description || incoming.tone.description,
      preferred: current.tone.preferred || incoming.tone.preferred,
    },
    typography: { ...incoming.typography, ...current.typography },
  };
}

export function brandDiff(
  previous: ProjectBrand | null,
  target: ProjectBrand | null
): readonly string[] {
  const keys = [
    "name",
    "design",
    "colors",
    "typography",
    "logos",
    "tone",
    "logoRules",
    "motion",
  ] as const;
  return keys.filter(
    (key) => JSON.stringify(previous?.[key]) !== JSON.stringify(target?.[key])
  );
}

export const ProjectBrandApplication = Schema.Struct({
  historyId: Schema.optionalKey(Schema.String),
  previous: Schema.NullOr(ProjectBrandSnapshot),
  status: Schema.Literals([
    "running",
    "failed",
    "awaiting-review",
    "confirmed",
  ]),
  target: ProjectBrandSnapshot,
});
export type ProjectBrandApplication = typeof ProjectBrandApplication.Type;

export function normalizeBrandDraft(
  draft: typeof ProjectBrandDraft.Type,
  current: ProjectBrand | null
) {
  const logos: { onLight?: BrandFile; onDark?: BrandFile; mark?: BrandFile } =
    {};
  for (const role of draft.verifiedLogos ?? []) {
    const logo = draft.brand.logos[role];
    if (logo) {
      logos[role] = logo;
    }
  }
  // A favicon/OG image is a candidate, never an implicitly verified logo.
  return mergeBrandDraft(current ?? emptyBrand(), { ...draft.brand, logos });
}
