import { relativeTo } from "@/lib/studio/activity";
import type { TuningField, TuningTarget } from "@/lib/studio/preview";
import type { TuningValue } from "@/shared/ipc";

export interface Axis {
  readonly label: string;
  readonly unit: string;
  readonly value: number;
}

export interface Composite {
  readonly axes: readonly Axis[];
  readonly kind: "array" | "number" | "string";
}

export interface TunedCard {
  readonly originals: Readonly<
    Record<string, Readonly<Record<string, TuningValue>>>
  >;
  readonly targets: readonly TuningTarget[];
}

export interface TunedField {
  readonly field: TuningField;
  readonly from: TuningValue;
  readonly target: TuningTarget;
}

const TOKEN = /^(-?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/i;
const WHITESPACE = /\s+/;
const OPACITY = /opacity$/i;
const HASH = /^#/;

// What a bare number means when the value carried no unit of its own. A CSS
// length may drop the unit only when it is zero, so writing one back has to
// supply it or the declaration stops parsing.
const DEFAULT_UNIT: Readonly<Record<string, string>> = {
  "rotation-css": "deg",
  "transform-origin": "%",
  translate: "px",
};

const AXIS_LABELS: Readonly<Record<string, readonly string[]>> = {
  "rotation-css": ["∠"],
  scale: ["W", "H"],
  "transform-origin": ["X", "Y"],
  translate: ["X", "Y"],
  "uv-coordinate": ["X", "Y"],
};

/**
 * The editable axes behind a value that is really two numbers in a trench
 * coat — `"0px 12px"`, `"50% 50%"`, `[0.5, 0.5]`. Answers `null` for anything
 * that is already a single plain number, which has its own control.
 */
export function compositeOf(field: TuningField): Composite | null {
  if (field.type === "uv-coordinate") {
    const pair = Array.isArray(field.value) ? field.value : [];

    return {
      axes: [0, 1].map((index) => ({
        label: labelAt(field.type, index),
        unit: "",
        value: typeof pair[index] === "number" ? pair[index] : 0,
      })),
      kind: "array",
    };
  }

  if (field.type === "scale" && typeof field.value === "number") {
    return null;
  }

  if (!(field.type in AXIS_LABELS) || typeof field.value !== "string") {
    return null;
  }

  const tokens = field.value.trim().split(WHITESPACE).filter(Boolean);
  const parsed = tokens.map((token) => TOKEN.exec(token));

  if (parsed.length === 0 || parsed.some((match) => match === null)) {
    return null;
  }

  const wanted = AXIS_LABELS[field.type]?.length ?? 1;
  const fallback = DEFAULT_UNIT[field.type] ?? "";

  return {
    axes: Array.from({ length: wanted }, (_, index) => {
      const match = parsed[index] ?? null;

      return {
        label: labelAt(field.type, index),
        unit: match?.[2] || unitAt(parsed, fallback),
        value: match === null ? 0 : Number(match[1]),
      };
    }),
    kind: "string",
  };
}

/** The same value with one axis moved, in the shape the field came in. */
export function withAxis(
  composite: Composite,
  index: number,
  value: number
): TuningValue {
  return withAxes(
    composite,
    composite.axes.map((axis, at) => (at === index ? value : axis.value))
  );
}

/** The same value with every axis replaced, in the shape the field came in. */
export function withAxes(
  composite: Composite,
  values: readonly number[]
): TuningValue {
  const axes = composite.axes.map((axis, at) => ({
    ...axis,
    value: values[at] ?? axis.value,
  }));

  if (composite.kind === "array") {
    return axes.map((axis) => axis.value);
  }

  return axes.map((axis) => `${trim(axis.value)}${axis.unit}`).join(" ");
}

/**
 * Opacity reads as a percentage everywhere a person has seen one, and is
 * stored as a fraction. Named rather than inferred from a 0–1 range, or every
 * normalised parameter would silently grow a percent sign.
 */
export function isPercent(field: TuningField): boolean {
  return OPACITY.test(field.path) && field.min === 0 && field.max === 1;
}

export function toPercent(value: number): number {
  return Math.round(value * 100);
}

export function fromPercent(value: number): number {
  return Math.round(value) / 100;
}

/**
 * Which target each path has to be sent to. The panel is one list built from a
 * chain of `Interactive`s, so "reset these paths" is as many commands as there
 * are components behind them.
 */
export function byTarget(
  fields: readonly TuningField[],
  paths: readonly string[]
): Map<string, string[]> {
  const out = new Map<string, string[]>();

  for (const path of paths) {
    const owner = fields.find((field) => field.path === path);

    if (owner !== undefined) {
      out.set(owner.targetId, [...(out.get(owner.targetId) ?? []), path]);
    }
  }

  return out;
}

export function changedPaths(card: TunedCard): Map<string, string[]> {
  const out = new Map<string, string[]>();

  for (const { field, target } of changedFields(card)) {
    out.set(target.targetId, [...(out.get(target.targetId) ?? []), field.path]);
  }

  return out;
}

/** Every field of every target that moved — the pane may have been switched. */
export function changedFields(card: TunedCard): TunedField[] {
  return card.targets.flatMap((target) =>
    target.fields.flatMap((field) => {
      const from = card.originals[target.targetId]?.[field.path];

      return from === undefined || sameTuningValue(from, field.value)
        ? []
        : [{ field, from, target }];
    })
  );
}

export function sameTuningValue(
  first: TuningValue,
  second: TuningValue
): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

export function targetOfPath(
  fields: readonly TuningField[],
  path: string
): string | null {
  return fields.find((field) => field.path === path)?.targetId ?? null;
}

export function fractionOf(
  value: number,
  min: number | null,
  max: number | null
): number | undefined {
  if (min === null || max === null || max <= min) {
    return;
  }

  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/** A hex without its hash, the way a colour reads in a design tool. */
export function hexLabel(value: TuningValue): string {
  return typeof value === "string" ? value.replace(HASH, "") : "";
}

function labelAt(type: string, index: number): string {
  return AXIS_LABELS[type]?.[index] ?? String(index + 1);
}

function unitAt(
  parsed: readonly (RegExpExecArray | null)[],
  fallback: string
): string {
  for (const match of parsed) {
    if (match?.[2]) {
      return match[2];
    }
  }

  return fallback;
}

function trim(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

// Remotion names its markup primitives `<Interactive.Div>`; the brackets and
// the namespace are plumbing, and the switcher has one line to say the name in.
const PRIMITIVE_NAME = /^<Interactive\.(.+)>$/;

export function chainLabel(componentName: string): string {
  return PRIMITIVE_NAME.exec(componentName)?.[1] ?? componentName;
}

export function titleOf(target: TuningTarget): string {
  return target.name ?? chainLabel(target.componentName);
}

export function subtitleOf(
  target: TuningTarget,
  owner: TuningTarget | null,
  cwd: string | null
): string {
  const inside =
    owner === null
      ? null
      : `${chainLabel(target.componentName)} in ${titleOf(owner)}`;
  const where =
    target.where === null
      ? null
      : `${relativeTo(target.where.file, cwd)}${
          target.where.line === null ? "" : `:${target.where.line}`
        }`;
  const parts = [inside, where].filter((part) => part !== null);

  return parts.length === 0 ? "no source" : parts.join(" · ");
}
