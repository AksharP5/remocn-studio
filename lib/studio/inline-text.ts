import type { StudioDefinition, StudioObject } from "@/shared/studio-document";

export function inlineTextField(
  object: StudioObject,
  definition: StudioDefinition,
  candidates: readonly { field: string | null; text: string }[]
) {
  const matches = candidates.flatMap((candidate, index) =>
    definition.fields
      .filter(
        (field) =>
          field.type === "text" &&
          typeof object.values[field.id] === "string" &&
          (candidate.field === null
            ? object.values[field.id] === candidate.text
            : field.id === candidate.field)
      )
      .map((field) => ({ candidate: index, field }))
  );
  // Repeated wrappers can carry the same text; different matching fields cannot
  // be distinguished safely without an explicit binding.
  if (new Set(matches.map(({ field }) => field.id)).size !== 1) {
    return null;
  }
  return matches[0] ?? null;
}
