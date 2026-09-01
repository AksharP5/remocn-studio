import type { TuningValue } from "./bridge";
import { allInFibers, hostOf, nearestInFibers } from "./fiber";

type FieldType =
  | "array"
  | "boolean"
  | "color"
  | "enum"
  | "hidden"
  | "number"
  | "rotation-css"
  | "rotation-degrees"
  | "scale"
  | "transform-origin"
  | "translate"
  | "uv-coordinate";

interface SchemaField {
  readonly default?: unknown;
  readonly description?: string;
  // Remotion's own "this belongs in a timeline, not a property list" flag —
  // `from`, `durationInFrames`, `trimBefore` and `freeze` all carry it.
  readonly hiddenFromList?: boolean;
  readonly item?: SchemaField;
  readonly max?: number;
  readonly maxLength?: number;
  readonly min?: number;
  readonly minLength?: number;
  readonly newItemDefault?: unknown;
  readonly step?: number;
  readonly type: FieldType;
  readonly variants?: Record<string, InteractivitySchema> | readonly string[];
}

export type InteractivitySchema = Readonly<Record<string, SchemaField>>;

export interface TuningField {
  readonly arrayItemType: Exclude<FieldType, "hidden"> | null;
  readonly description: string | null;
  readonly group: string;
  readonly label: string;
  readonly max: number | null;
  readonly maxLength: number | null;
  readonly min: number | null;
  readonly minLength: number | null;
  readonly newItemDefault: TuningValue | null;
  readonly options: readonly string[];
  readonly path: string;
  readonly step: number | null;
  // Which `Interactive` in the chain owns this field, since a merged list is
  // edited through as many targets as it was built from.
  readonly targetId: string;
  readonly type: Exclude<FieldType, "hidden">;
  readonly value: TuningValue;
}

export interface TuningTarget {
  readonly componentName: string;
  readonly fields: readonly TuningField[];
  readonly targetId: string;
}

export interface PropStatuses {
  readonly canUpdate: true;
  readonly effects: readonly never[];
  readonly props: Readonly<
    Record<string, { readonly codeValue: TuningValue; readonly status: string }>
  >;
}

export interface OverridePlan {
  readonly overrides: readonly {
    readonly path: string;
    readonly value: TuningValue;
  }[];
  readonly statuses: PropStatuses;
}

export function overridePlan(
  draft: Readonly<Record<string, TuningValue>>
): OverridePlan {
  const entries = Object.entries(draft);

  return {
    overrides: entries.map(([path, value]) => ({ path, value })),
    statuses: {
      canUpdate: true,
      effects: [],
      props: Object.fromEntries(
        entries.map(([path, value]) => [
          path,
          { codeValue: value, status: "static" },
        ])
      ),
    },
  };
}

export interface InteractiveControls {
  readonly componentName: string;
  readonly currentRuntimeValueDotNotation: Readonly<Record<string, unknown>>;
  readonly overrideId: string;
  readonly schema: InteractivitySchema;
}

export function asControls(value: unknown): InteractiveControls | null {
  if (value === null || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<InteractiveControls>;

  return typeof candidate.overrideId === "string" &&
    candidate.overrideId.length > 0 &&
    typeof candidate.componentName === "string" &&
    typeof candidate.schema === "object" &&
    candidate.schema !== null
    ? (candidate as InteractiveControls)
    : null;
}

/**
 * The controls of the innermost `Interactive` around an element, read off the
 * React tree rather than off `refForOutline`.
 *
 * This is the primary lookup because Remotion resolves a `<Sequence
 * layout="none">`'s outline ref to **null** unless the component passed
 * `outlineRef` itself — so a component that declares a schema, passes its
 * `controls` and animates correctly is still invisible to a DOM-containment
 * search. `controls` is a prop, and a prop is on the fiber whatever the author
 * remembered to wire.
 */
export function controlsAt(element: Element): InteractiveControls | null {
  return nearestInFibers(element, (fiber) =>
    asControls(fiber.memoizedProps?.controls)
  );
}

export interface InteractiveLink {
  readonly controls: InteractiveControls;
  /** Where this `Interactive` is on screen, for the pane to point back at. */
  readonly node: Element | null;
}

/**
 * Every `Interactive` around an element, innermost first.
 *
 * There is always more than one in agent-written markup, because the studio's
 * own conventions ask for both: `Interactive.Div` and its siblings for the
 * markup, so the styles are editable, and `Interactive.withSchema` around the
 * component, so its own parameters are. Only the chain sees both — the nearest
 * alone is Remotion's element primitive, and the component's parameters sit
 * one level out where nothing can ever point at them.
 */
export function controlsChain(element: Element): InteractiveLink[] {
  const seen = new Set<string>();

  return allInFibers(element, (fiber) => {
    const controls = asControls(fiber.memoizedProps?.controls);

    if (controls === null || seen.has(controls.overrideId)) {
      return null;
    }

    seen.add(controls.overrideId);
    return { controls, node: hostOf(fiber) };
  });
}

export interface OutlinedSequence {
  readonly controls: unknown;
  readonly refForOutline: { readonly current: Element | null } | null;
}

export function nearestInteractive<T extends OutlinedSequence>(
  sequences: readonly T[],
  element: Element
): T | null {
  const candidates = sequences.filter((sequence) => {
    const node = sequence.refForOutline?.current;
    return sequence.controls !== null && node?.contains(element) === true;
  });

  let nearest: T | null = null;
  for (const candidate of candidates) {
    const current = nearest?.refForOutline?.current ?? null;
    const candidateNode = candidate.refForOutline?.current ?? null;
    if (
      current === null ||
      candidateNode === null ||
      current.contains(candidateNode)
    ) {
      nearest = candidate;
    }
  }

  return nearest;
}

const SUPPORTED = new Set<Exclude<FieldType, "hidden">>([
  "array",
  "boolean",
  "color",
  "enum",
  "number",
  "rotation-css",
  "rotation-degrees",
  "scale",
  "transform-origin",
  "translate",
  "uv-coordinate",
]);

const TRANSFORMS = new Set([
  "style.rotate",
  "style.scale",
  "style.transformOrigin",
  "style.translate",
]);

const LAYER = new Set(["hidden", "style.mixBlendMode", "style.opacity"]);

const TYPOGRAPHY =
  /^style\.(color|font|letterSpacing|lineHeight|text|whiteSpace)/;
const FILL = /(^fill|background|^style\.background)/i;
const STROKE = /(^stroke|border(?!Radius)|outline)/i;
const TIMING = /(^from$|durationInFrames|premountFor|postmountFor|frame)/i;
const ENTRY = /^(transitionIn\.|entry([A-Z.]|$))/;
const EXIT = /^(transitionOut\.|exit([A-Z.]|$))/;
const EFFECTS = /^effects?([A-Z.]|$)/;
const CAMEL_BOUNDARY = /([a-z])([A-Z])/g;
const FIRST_CHARACTER = /^./;

export function describeTuning({
  componentName,
  schema,
  targetId,
  values,
}: {
  readonly componentName: string;
  readonly schema: InteractivitySchema;
  readonly targetId: string;
  readonly values: Readonly<Record<string, unknown>>;
}): TuningTarget | null {
  const fields = Object.entries(flattenActiveSchema(schema, values))
    .map(([path, field]) => descriptorOf(path, field, values[path], targetId))
    .filter((field): field is TuningField => field !== null);

  return fields.length === 0 ? null : { componentName, fields, targetId };
}

export function fieldAt(
  schema: InteractivitySchema,
  values: Readonly<Record<string, unknown>>,
  path: string
): SchemaField | null {
  return flattenActiveSchema(schema, values)[path] ?? null;
}

export function isFieldValue(
  field: SchemaField,
  value: unknown
): value is TuningValue {
  if (!isTuningValue(value)) {
    return false;
  }

  if (field.type === "array") {
    return (
      Array.isArray(value) &&
      (field.minLength === undefined || value.length >= field.minLength) &&
      (field.maxLength === undefined || value.length <= field.maxLength) &&
      field.item !== undefined &&
      value.every((entry) => isFieldValue(field.item as SchemaField, entry))
    );
  }

  if (field.type === "boolean") {
    return typeof value === "boolean";
  }

  if (field.type === "number" || field.type === "rotation-degrees") {
    return isBoundedNumber(field, value);
  }

  if (field.type === "uv-coordinate") {
    return (
      Array.isArray(value) &&
      value.length === 2 &&
      value.every((entry) => isBoundedNumber(field, entry))
    );
  }

  if (field.type === "scale") {
    return typeof value === "string" || isBoundedNumber(field, value);
  }

  if (field.type === "enum") {
    if (typeof value !== "string" || field.variants === undefined) {
      return false;
    }

    return Array.isArray(field.variants)
      ? field.variants.includes(value)
      : value in field.variants;
  }

  return typeof value === "string";
}

export function isTuningValue(value: unknown): value is TuningValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }

  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        entry === null ||
        typeof entry === "boolean" ||
        typeof entry === "string" ||
        (typeof entry === "number" && Number.isFinite(entry))
    )
  );
}

function flattenActiveSchema(
  schema: InteractivitySchema,
  values: Readonly<Record<string, unknown>>
): InteractivitySchema {
  const out: Record<string, SchemaField> = {};

  for (const [path, field] of Object.entries(schema)) {
    if (field.type === "hidden") {
      continue;
    }

    out[path] = field;

    if (field.type !== "enum" || Array.isArray(field.variants)) {
      continue;
    }

    const selected = defaultedValue(field, values[path]);
    const variant =
      typeof selected === "string" ? field.variants?.[selected] : undefined;

    if (variant !== undefined && !Array.isArray(variant)) {
      Object.assign(out, flattenActiveSchema(variant, values));
    }
  }

  return out;
}

function descriptorOf(
  path: string,
  field: SchemaField,
  current: unknown,
  targetId: string
): TuningField | null {
  if (
    field.type === "hidden" ||
    field.hiddenFromList === true ||
    !SUPPORTED.has(field.type)
  ) {
    return null;
  }

  const value = defaultedValue(field, current);
  if (!isFieldValue(field, value)) {
    return null;
  }

  return {
    arrayItemType:
      field.type === "array" &&
      field.item !== undefined &&
      field.item.type !== "hidden" &&
      SUPPORTED.has(field.item.type)
        ? field.item.type
        : null,
    description: field.description ?? null,
    group: groupOf(path),
    label: labelFor(field.description, path),
    max: finiteOrNull(field.max),
    maxLength: integerOrNull(field.maxLength),
    min: finiteOrNull(field.min),
    minLength: integerOrNull(field.minLength),
    newItemDefault:
      field.type === "array" && isTuningValue(field.newItemDefault)
        ? field.newItemDefault
        : null,
    options: optionsOf(field),
    path,
    step: finiteOrNull(field.step),
    targetId,
    type: field.type,
    value,
  };
}

function defaultedValue(field: SchemaField, current: unknown): unknown {
  return current === undefined ? field.default : current;
}

function optionsOf(field: SchemaField): readonly string[] {
  if (field.type === "enum" && field.variants !== undefined) {
    return Array.isArray(field.variants)
      ? field.variants
      : Object.keys(field.variants);
  }

  if (field.type === "array" && field.item?.type === "enum") {
    return optionsOf(field.item);
  }

  return [];
}

function groupOf(path: string): string {
  if (TRANSFORMS.has(path)) {
    return "Transform";
  }

  if (LAYER.has(path)) {
    return "Layer";
  }

  if (TYPOGRAPHY.test(path)) {
    return "Typography";
  }

  if (ENTRY.test(path)) {
    return "Entry";
  }

  if (EXIT.test(path)) {
    return "Exit";
  }

  if (EFFECTS.test(path)) {
    return "Effects";
  }

  if (FILL.test(path)) {
    return "Fill";
  }

  if (STROKE.test(path)) {
    return "Stroke";
  }

  return TIMING.test(path) ? "Timing" : "Parameters";
}

// A label is one clipped line beside its value, and a description is prose
// under the row. Remotion's own built-ins describe themselves in two words
// ("Font size", "Opacity") and read better than the path would, so a short
// description is taken as the label — but a schema written by an agent says
// things like "Frames per drift cycle — kept coprime with the ambient
// periods", and that is not a label whatever the pane does with it.
const LABEL_LIMIT = 24;

export function labelFor(
  description: string | undefined,
  path: string
): string {
  return description !== undefined &&
    description.length > 0 &&
    description.length <= LABEL_LIMIT
    ? description
    : labelOf(path);
}

// Sentence case, because Remotion's own descriptions are ("Font size",
// "Transform origin") and the two sit in one column: Title Case beside them
// would read as two products.
function labelOf(path: string): string {
  const last = path.split(".").at(-1) ?? path;
  return last
    .replace(CAMEL_BOUNDARY, "$1 $2")
    .replaceAll("-", " ")
    .toLowerCase()
    .replace(FIRST_CHARACTER, (letter) => letter.toUpperCase());
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function integerOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function isBoundedNumber(field: SchemaField, value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    (field.min === undefined || value >= field.min) &&
    (field.max === undefined || value <= field.max)
  );
}
