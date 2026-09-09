import { Schema } from "effect";
import { BrandFile, emptyBrand, type ProjectBrand } from "./brand";

export const DesignImport = Schema.Struct({
  colors: Schema.Record(Schema.String, Schema.String),
  document: Schema.Struct({ file: BrandFile, markdown: Schema.String }),
  fonts: Schema.Array(
    Schema.Struct({
      family: Schema.String,
      token: Schema.String,
      weight: Schema.String,
    })
  ),
  name: Schema.optionalKey(Schema.String),
  warnings: Schema.Array(Schema.String),
});
export type DesignImport = typeof DesignImport.Type;
export interface DesignSelection {
  colors: readonly { token: string; role: string; selected: boolean }[];
  fonts: readonly { token: string; role: "display" | "body" | "mono" | "" }[];
  name: boolean;
}

export function initialDesignSelection(
  data: DesignImport,
  current: ProjectBrand | null
): DesignSelection {
  return {
    colors: Object.keys(data.colors).map((token) => ({
      role: token,
      selected: !Object.hasOwn(current?.colors ?? {}, token),
      token,
    })),
    fonts: data.fonts.map(({ token }) => ({ role: "", token })),
    name: !current?.name,
  };
}

export function applyDesignImport(
  current: ProjectBrand | null,
  data: DesignImport,
  selection: DesignSelection
): ProjectBrand {
  const brand = current ?? emptyBrand();
  const colors = { ...brand.colors };
  const typography = { ...brand.typography };
  for (const entry of selection.colors) {
    if (
      entry.selected &&
      entry.role.trim() &&
      Object.hasOwn(data.colors, entry.token)
    ) {
      Object.defineProperty(colors, entry.role.trim(), {
        configurable: true,
        enumerable: true,
        value: data.colors[entry.token],
        writable: true,
      });
    }
  }
  for (const entry of selection.fonts) {
    const font = data.fonts.find(({ token }) => token === entry.token);
    if (entry.role && font) {
      const previous = typography[entry.role];
      typography[entry.role] =
        previous?.family === font.family
          ? previous
          : {
              fallback: "sans-serif",
              family: font.family,
              files: [],
              licenses: [],
            };
    }
  }
  return {
    ...brand,
    ...(selection.name && data.name ? { name: data.name } : {}),
    colors,
    design: data.document,
    provenance: [
      ...brand.provenance.filter((entry) => entry.field !== "design"),
      {
        field: "design",
        importedAt: new Date().toISOString(),
        source: data.document.file.source ?? "DESIGN.md",
      },
    ],
    typography,
  };
}

const ROLE_NAME = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
export function selectionError(selection: DesignSelection): string | null {
  const colors = selection.colors
    .filter((entry) => entry.selected)
    .map((entry) => entry.role.trim());
  if (colors.some((role) => !ROLE_NAME.test(role))) {
    return "Color roles must start with a letter and contain only letters, numbers, underscores or hyphens.";
  }
  const fonts = selection.fonts.map((entry) => entry.role).filter(Boolean);
  if (
    new Set(colors).size !== colors.length ||
    new Set(fonts).size !== fonts.length
  ) {
    return "Choose each destination role only once.";
  }
  return null;
}
