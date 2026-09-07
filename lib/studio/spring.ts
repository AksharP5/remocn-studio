import type { TuningField } from "@/lib/studio/preview";

/**
 * The physics behind a `spring()`, read off the props a component exposes.
 *
 * Remotion's spring and dialkit's visualisation solve the same second-order
 * system, so damping / stiffness / mass map across one for one and the curve
 * is the real response. What does *not* map is the time axis: dialkit plots a
 * fixed two seconds where Remotion runs the spring over the frames the
 * component asks for, so this is a readout of the shape, never of the timing.
 */
export interface SpringReadout {
  readonly damping: number;
  readonly fields: readonly string[];
  readonly label: string;
  readonly mass: number;
  /** Everything before the last segment, so `entry.spring.damping` groups. */
  readonly prefix: string;
  readonly stiffness: number;
}

export interface SpringRow {
  readonly kind: "spring";
  readonly spring: SpringReadout;
}

export interface FieldRow {
  readonly field: TuningField;
  readonly kind: "field";
}

export type PaneRow = FieldRow | SpringRow;

// Remotion's own defaults, for the one member of the triple a component may
// legitimately leave out.
const DEFAULT_MASS = 1;
const AXES = ["damping", "mass", "stiffness"] as const;
const CAMEL_BOUNDARY = /([a-z])([A-Z])/g;

interface Parts {
  damping?: TuningField;
  mass?: TuningField;
  stiffness?: TuningField;
}

/**
 * The rows a section draws: its fields, with a spring's response inserted
 * above the first number of each triple that stands for one.
 *
 * A triple is recognised by shape rather than by name — any group of paths
 * sharing a prefix and ending in `damping` and `stiffness` is a spring,
 * whether it is written `spring.damping`, `entry.spring.damping` or bare —
 * because the conventions ask for the dotted name but an existing component
 * keeps whatever it has.
 */
export function paneRows(fields: readonly TuningField[]): PaneRow[] {
  const springs = springsIn(fields);
  const leading = new Map(
    springs.map((spring) => [spring.fields[0] ?? "", spring])
  );

  return fields.flatMap((field) => {
    const spring = leading.get(field.path);
    const row: FieldRow = { field, kind: "field" };

    return spring === undefined
      ? [row]
      : [{ kind: "spring", spring } as SpringRow, row];
  });
}

export function springsIn(fields: readonly TuningField[]): SpringReadout[] {
  const groups = new Map<string, Parts>();

  for (const field of fields) {
    const axis = AXES.find((name) => leafOf(field.path) === name);

    if (axis === undefined || typeof field.value !== "number") {
      continue;
    }

    const prefix = prefixOf(field.path);
    groups.set(prefix, { ...groups.get(prefix), [axis]: field });
  }

  return [...groups].flatMap(([prefix, parts]) =>
    parts.damping === undefined || parts.stiffness === undefined
      ? []
      : [readout(prefix, parts, fields)]
  );
}

function readout(
  prefix: string,
  parts: Parts,
  fields: readonly TuningField[]
): SpringReadout {
  const members = new Set([parts.damping, parts.stiffness, parts.mass]);

  return {
    damping: numberOf(parts.damping),
    // In the order the pane draws them, so the readout leads the first of the
    // three wherever the schema happened to declare them.
    fields: fields.filter((field) => members.has(field)).map((f) => f.path),
    label: labelOf(prefix),
    mass: parts.mass === undefined ? DEFAULT_MASS : numberOf(parts.mass),
    prefix,
    stiffness: numberOf(parts.stiffness),
  };
}

function numberOf(field: TuningField | undefined): number {
  return typeof field?.value === "number" ? field.value : 0;
}

function leafOf(path: string): string {
  return path.slice(path.lastIndexOf(".") + 1);
}

function prefixOf(path: string): string {
  const at = path.lastIndexOf(".");

  return at === -1 ? "" : path.slice(0, at);
}

function labelOf(prefix: string): string {
  if (prefix.length === 0) {
    return "Spring";
  }

  const words = prefix
    .split(".")
    .flatMap((part) => part.replace(CAMEL_BOUNDARY, "$1 $2").toLowerCase())
    .join(" ");

  return words.endsWith("spring")
    ? sentence(words)
    : sentence(`${words} spring`);
}

function sentence(words: string): string {
  return words.charAt(0).toUpperCase() + words.slice(1);
}
