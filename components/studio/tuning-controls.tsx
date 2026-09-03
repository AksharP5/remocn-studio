// biome-ignore-all lint/performance/noJsxPropsBind: Every control needs its own path and current value.
// biome-ignore-all lint/suspicious/noArrayIndexKey: Arrays are ordered and do not support reordering.
"use client";

import {
  ColorControl as DialColorControl,
  EasingVisualization as DialEasingVisualization,
  SelectControl as DialSelectControl,
  Slider as DialSlider,
  TextControl as DialTextControl,
  Toggle as DialToggle,
} from "dialkit";
import { MinusIcon, PlusIcon, RotateCcwIcon } from "lucide-react";
import { useCallback, useId } from "react";
import { Button } from "@/components/ui/button";
import {
  NumberField,
  NumberFieldInput,
  NumberFieldScrubArea,
} from "@/components/ui/number-field";
import { Textarea } from "@/components/ui/textarea";
import { type BezierHandle, useBezierDrag } from "@/hooks/use-bezier-drag";
import { useScrubEdit } from "@/hooks/use-scrub-edit";
import {
  axisSliderOf,
  type DialSliderSpec,
  sliderOf,
  valueFromSlider,
} from "@/lib/studio/dialkit";
import {
  BEZIER_PRESETS,
  type Bezier,
  bezierOfValue,
  CURVE_GUIDES,
  CURVE_VIEW,
  cssBezier,
  curvePath,
  type EasingKind,
  easingKindOf,
  matchPresetLabel,
  presetByLabel,
  viewPoint,
  withHandle,
} from "@/lib/studio/easing";
import type { TuningField } from "@/lib/studio/preview";
import {
  type Composite,
  colorValue,
  compositeOf,
  fractionOf,
  fromPercent,
  isPercent,
  toPercent,
  withAxis,
} from "@/lib/studio/tuning";
import { cn } from "@/lib/utils";
import type { TuningValue } from "@/shared/ipc";

export type Change = (path: string, value: TuningValue) => void;

const ROW =
  "grid min-h-7 grid-cols-[minmax(2.5rem,30%)_minmax(0,1fr)_1.25rem] items-center gap-x-2";
const LABEL = "truncate text-muted-foreground text-xs";
// Focus is an outline, not a ring: `control-surface` *is* a box-shadow, and a
// ring utility would replace it and take the elevation with it.
const FOCUS =
  "focus-within:outline-2 focus-within:outline-ring focus-within:outline-offset-1";
const FIELD = `flex h-7 w-full flex-row items-center gap-1.5 overflow-hidden rounded-md control-surface px-2 text-xs ${FOCUS}`;
const VALUE =
  "min-w-0 flex-1 truncate bg-transparent text-left text-foreground text-xs outline-none";
// The letter inside a field is its drag handle, and dragging it is the whole
// point — so it never looks like inert decoration.
const HANDLE =
  "shrink-0 cursor-ew-resize select-none text-2xs text-muted-foreground";
const NUMERIC = new Set(["number", "rotation-degrees", "scale"]);

export function TuningRow({
  animated,
  field,
  fonts,
  onChange,
  onReset,
  original,
  refusal,
}: {
  animated?: boolean;
  field: TuningField;
  fonts?: readonly string[];
  onChange: Change;
  onReset: (paths: readonly string[]) => void;
  original: TuningValue | undefined;
  refusal: string | null;
}) {
  const changed =
    field.readOnly !== true &&
    original !== undefined &&
    JSON.stringify(original) !== JSON.stringify(field.value);

  return (
    <div className="group/row">
      <FieldControl
        action={
          changed ? (
            <Button
              aria-label={`Reset ${field.label}`}
              className="relative size-5 text-muted-foreground opacity-0 transition-opacity after:absolute after:-inset-2 focus-visible:opacity-100 group-hover/row:opacity-100"
              onClick={() => onReset([field.path])}
              size="icon-xs"
              variant="ghost"
            >
              <RotateCcwIcon />
            </Button>
          ) : (
            <span />
          )
        }
        field={field}
        fonts={fonts}
        onChange={onChange}
        original={original}
      />

      {refusal === null ? null : (
        <p className="px-3 pt-1 text-destructive text-xs" role="alert">
          {refusal}
        </p>
      )}

      {animated === true ? (
        <p className="flex items-center gap-1.5 px-3 pt-1 text-2xs text-muted-foreground">
          <span className="shrink-0 rounded-sm bg-muted px-1 py-px font-medium text-[9px] uppercase tracking-wide">
            animated
          </span>
          a fixed value here replaces the animation
        </p>
      ) : null}

      {/* The sentence a schema wrote lives here, under the control, where it
          has the pane's whole width to wrap in — it is prose, not a label. */}
      {field.description === null ||
      field.description === field.label ? null : (
        <p className="px-3 pt-1 text-2xs text-muted-foreground">
          {field.description}
        </p>
      )}
    </div>
  );
}

function FieldControl({
  action,
  field,
  fonts,
  onChange,
  original,
}: {
  action: React.ReactNode;
  field: TuningField;
  fonts?: readonly string[];
  onChange: Change;
  original: TuningValue | undefined;
}) {
  if (field.readOnly === true) {
    return <ReadOnlyControl action={action} field={field} />;
  }

  if (field.type === "text-content") {
    return (
      <TextContentControl action={action} field={field} onChange={onChange} />
    );
  }

  if (field.type === "font-family") {
    return (
      <FontFamilyControl
        action={action}
        field={field}
        fonts={fonts ?? []}
        onChange={onChange}
      />
    );
  }

  const composite = compositeOf(field);

  if (composite !== null) {
    const originalComposite = compositeOf({
      ...field,
      value: original ?? field.value,
    });

    return (
      <AxesControl
        action={action}
        composite={composite}
        field={field}
        onChange={onChange}
        original={originalComposite ?? composite}
      />
    );
  }

  const easing = easingKindOf(field);

  if (easing !== null) {
    return (
      <EasingControl
        action={action}
        field={field}
        kind={easing}
        onChange={onChange}
      />
    );
  }

  if (field.type === "boolean") {
    return (
      <DialControl action={action} title={field.label}>
        <DialToggle
          checked={field.value === true}
          label={field.label}
          onChange={(checked) => onChange(field.path, checked)}
        />
      </DialControl>
    );
  }

  if (field.type === "enum") {
    return (
      <DialControl action={action} title={field.label}>
        <DialSelectControl
          label={field.label}
          onChange={(value) => onChange(field.path, value)}
          options={[...field.options]}
          value={String(field.value)}
        />
      </DialControl>
    );
  }

  if (field.type === "color") {
    return (
      <DialControl action={action} title={field.label}>
        <DialColorControl
          label={field.label}
          onChange={(value) => onChange(field.path, value)}
          value={colorValue(field.value)}
        />
      </DialControl>
    );
  }

  if (field.type === "array") {
    return (
      <ArrayControl
        action={action}
        field={field}
        onChange={onChange}
        original={original}
      />
    );
  }

  if (NUMERIC.has(field.type) && typeof field.value === "number") {
    const slider = sliderOf(field, original);

    if (slider !== null) {
      return (
        <DialControl action={action} title={field.label}>
          <AccessibleDialSlider
            label={field.label}
            onChange={(value) =>
              onChange(field.path, valueFromSlider(field, value))
            }
            spec={slider}
          />
        </DialControl>
      );
    }

    return <NumberControl action={action} field={field} onChange={onChange} />;
  }

  return (
    <DialControl action={action} title={field.label}>
      <DialTextControl
        label={field.label}
        onChange={(value) => onChange(field.path, value)}
        value={String(field.value)}
      />
    </DialControl>
  );
}

function ReadOnlyControl({
  action,
  field,
}: {
  action: React.ReactNode;
  field: TuningField;
}) {
  return (
    <div className={ROW}>
      <span className={LABEL} title={field.label}>
        {field.label}
      </span>
      <span className={cn(FIELD, "text-muted-foreground")}>
        <span className={cn(VALUE, "cursor-default")}>
          {String(field.value)}
        </span>
      </span>
      {action}
    </div>
  );
}

function TextContentControl({
  action,
  field,
  onChange,
}: {
  action: React.ReactNode;
  field: TuningField;
  onChange: Change;
}) {
  const write = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(
        event.currentTarget.dataset.path ?? "",
        event.currentTarget.value
      );
    },
    [onChange]
  );

  return (
    <DialControl action={action}>
      <div className="dialkit-composite-control">
        <span className="dialkit-composite-label" title={field.label}>
          {field.label}
        </span>
        <Textarea
          aria-label={field.label}
          className="max-h-24 min-h-14 resize-none text-xs"
          data-path={field.path}
          onChange={write}
          rows={2}
          value={String(field.value)}
        />
      </div>
    </DialControl>
  );
}

function FontFamilyControl({
  action,
  field,
  fonts,
  onChange,
}: {
  action: React.ReactNode;
  field: TuningField;
  fonts: readonly string[];
  onChange: Change;
}) {
  const listId = useId();
  const write = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(
        event.currentTarget.dataset.path ?? "",
        event.currentTarget.value
      );
    },
    [onChange]
  );

  return (
    <div className={ROW}>
      <span className={LABEL} title={field.label}>
        {field.label}
      </span>
      <span className={FIELD}>
        <input
          aria-label={field.label}
          className={VALUE}
          data-path={field.path}
          list={listId}
          onChange={write}
          type="text"
          value={String(field.value)}
        />
        <datalist id={listId}>
          {fonts.map((family) => (
            <option key={family} value={family} />
          ))}
        </datalist>
      </span>
      {action}
    </div>
  );
}

function DialControl({
  action,
  children,
  title,
}: {
  action: React.ReactNode;
  children: React.ReactNode;
  /** The label whole, since the one on screen is clipped to a single line. */
  title?: string;
}) {
  return (
    <div className="dialkit-control-with-action" title={title}>
      {children}
      <span className="dialkit-control-action">{action}</span>
    </div>
  );
}

function AccessibleDialSlider({
  label,
  onChange,
  spec,
  visualLabel = label,
}: {
  label: string;
  onChange: (value: number) => void;
  spec: DialSliderSpec;
  visualLabel?: string;
}) {
  const commitKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    const stride = event.shiftKey ? spec.step * 10 : spec.step;

    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      next = spec.value - stride;
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      next = spec.value + stride;
    } else if (event.key === "Home") {
      next = spec.min;
    } else if (event.key === "End") {
      next = spec.max;
    }

    if (next === null) {
      return;
    }

    event.preventDefault();
    onChange(Math.min(spec.max, Math.max(spec.min, next)));
  };

  return (
    <div
      aria-label={label}
      aria-valuemax={spec.max}
      aria-valuemin={spec.min}
      aria-valuenow={spec.value}
      className="dialkit-accessible-slider"
      onKeyDown={commitKey}
      onPointerDownCapture={(event) => event.currentTarget.focus()}
      role="slider"
      tabIndex={0}
    >
      <DialSlider
        label={visualLabel}
        max={spec.max}
        min={spec.min}
        onChange={onChange}
        step={spec.step}
        unit={spec.unit}
        value={spec.value}
      />
    </div>
  );
}

/**
 * The workhorse: one field, three gestures. The whole surface is the scrub
 * area — drag anywhere to change the value, and a click that never moved
 * drops into typing (Base UI focuses the input and re-dispatches the click
 * that pointer lock swallowed). Arrows step, shift by ten, alt finely. A
 * bounded value paints how far along it is as a fill behind the number.
 */
function Scrubber({
  ariaLabel,
  fill,
  handle,
  max,
  min,
  onCommit,
  step,
  value,
}: {
  ariaLabel: string;
  fill?: number;
  handle: string;
  max?: number;
  min?: number;
  onCommit: (value: number) => void;
  step?: number;
  value: number;
}) {
  const grain = step ?? 1;
  const scrub = useScrubEdit();

  return (
    <NumberField
      className={cn(FIELD, "relative w-full")}
      largeStep={grain * 10}
      max={max}
      min={min}
      onValueChange={(next) => {
        if (next !== null && Number.isFinite(next)) {
          onCommit(next);
        }
      }}
      smallStep={grain / 10}
      step={grain}
      value={value}
    >
      {fill === undefined ? null : (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 bg-foreground/10"
          data-fill
          style={{ width: `${fill * 100}%` }}
        />
      )}
      {/* The in-flow twin of the overlay's glyph, so the value starts where
          the glyph ends whatever character the glyph is. */}
      <span aria-hidden className="invisible shrink-0 text-2xs">
        {handle}
      </span>
      <NumberFieldInput
        aria-label={ariaLabel}
        className={cn(
          VALUE,
          "relative h-auto rounded-none p-0 tabular-nums leading-none sm:h-auto sm:leading-none"
        )}
        onBlur={scrub.done}
        ref={scrub.ref}
      />
      <NumberFieldScrubArea
        className={cn(
          HANDLE,
          "absolute inset-0 flex items-center px-2",
          "[&>[data-slot=label]]:cursor-ew-resize [&>[data-slot=label]]:font-normal [&>[data-slot=label]]:text-2xs [&>[data-slot=label]]:text-inherit",
          scrub.editing && "pointer-events-none"
        )}
        label={handle}
        onClick={scrub.edit}
      />
    </NumberField>
  );
}

// Two numbers wearing one value: `"0px 12px"`, `"50% 50%"`, `[0.5, 0.5]`.
// Each axis gets its own field, side by side, exactly as a design tool sets
// X and Y.
function AxesControl({
  action,
  composite,
  field,
  onChange,
  original,
}: {
  action: React.ReactNode;
  composite: Composite;
  field: TuningField;
  onChange: Change;
  original: Composite;
}) {
  const sliders = composite.axes.map((axis, index) =>
    axisSliderOf(
      field,
      axis.value,
      original.axes[index]?.value ?? axis.value,
      axis.unit
    )
  );

  if (sliders.every((slider) => slider !== null)) {
    return (
      <DialControl action={action}>
        <div className="dialkit-composite-control">
          <span className="dialkit-composite-label">{field.label}</span>
          <div className="dialkit-composite-axes">
            {composite.axes.map((axis, index) => (
              <AccessibleDialSlider
                key={axis.label}
                label={`${field.label} ${axis.label}`}
                onChange={(next) =>
                  onChange(field.path, withAxis(composite, index, next))
                }
                spec={sliders[index] as DialSliderSpec}
                visualLabel={axis.label}
              />
            ))}
          </div>
        </div>
      </DialControl>
    );
  }

  return (
    <div className={ROW}>
      <span className={LABEL}>{field.label}</span>
      <span
        className={cn(
          "grid min-w-0 gap-1",
          composite.axes.length > 1 ? "grid-cols-2" : "grid-cols-1"
        )}
      >
        {composite.axes.map((axis, index) => (
          <Scrubber
            ariaLabel={`${field.label} ${axis.label}`}
            fill={fractionOf(axis.value, field.min, field.max)}
            handle={axis.label}
            key={axis.label}
            max={field.max ?? undefined}
            min={field.min ?? undefined}
            onCommit={(next) =>
              onChange(field.path, withAxis(composite, index, next))
            }
            step={field.step ?? undefined}
            value={axis.value}
          />
        ))}
      </span>
      {action}
    </div>
  );
}

function NumberControl({
  action,
  field,
  onChange,
}: {
  action: React.ReactNode;
  field: TuningField;
  onChange: Change;
}) {
  const percent = isPercent(field);
  const raw = typeof field.value === "number" ? field.value : 0;

  return (
    <div className={ROW}>
      <span className={LABEL}>{field.label}</span>
      <Scrubber
        ariaLabel={field.label}
        fill={fractionOf(raw, field.min, field.max)}
        handle={percent ? "%" : "#"}
        max={percent ? 100 : (field.max ?? undefined)}
        min={percent ? 0 : (field.min ?? undefined)}
        onCommit={(next) =>
          onChange(field.path, percent ? fromPercent(next) : next)
        }
        step={percent ? 1 : (field.step ?? undefined)}
        value={percent ? toPercent(raw) : raw}
      />
      {action}
    </div>
  );
}

const BEZIER_AXES: readonly { at: 0 | 1 | 2 | 3; label: string }[] = [
  { at: 0, label: "x1" },
  { at: 1, label: "y1" },
  { at: 2, label: "x2" },
  { at: 3, label: "y2" },
];

/**
 * An interpolation editor over the value the component actually holds: an
 * enum of easing names gets a curve it can read and a preset it can pick,
 * a four-number bezier additionally gets draggable handles and its numbers.
 * A spring is not this — it is ordinary damping/stiffness props, which the
 * panel already shows as numbers.
 */
function EasingControl({
  action,
  field,
  kind,
  onChange,
}: {
  action: React.ReactNode;
  field: TuningField;
  kind: EasingKind;
  onChange: Change;
}) {
  const bezier = bezierOfValue(field.value);
  const editable = kind === "bezier" && bezier !== null;

  // A stack, not a row. Every other control here is a dialkit pill with its
  // label inside it; this one is a canvas, a picker and four numbers, and
  // forcing it into the row grid reserved a label column the pill rows do not
  // have — so the whole block sat in a narrower second column and the pane
  // read as two competing alignments. It shares `dialkit-composite-control`
  // with the X/Y pairs, which had already settled this: label on its own line,
  // everything under it at the pane's own edge.
  return (
    <DialControl action={action}>
      <div className="dialkit-composite-control">
        <span className="dialkit-composite-label" title={field.label}>
          {field.label}
        </span>

        <EasingCurve
          bezier={bezier}
          onHandle={
            editable
              ? (handle, x, y) =>
                  onChange(field.path, withHandle(bezier, handle, x, y))
              : null
          }
        />

        {kind === "enum" ? (
          <DialSelectControl
            label="Curve"
            onChange={(option) => onChange(field.path, option)}
            options={[...field.options]}
            value={String(field.value)}
          />
        ) : (
          <DialSelectControl
            label="Preset"
            onChange={(option) => {
              const preset = presetByLabel(option);
              if (preset !== null) {
                onChange(field.path, [...preset]);
              }
            }}
            options={BEZIER_PRESETS.map((preset) => ({
              label: preset.label,
              value: preset.label,
            }))}
            value={
              (bezier === null ? null : matchPresetLabel(bezier)) ?? "Custom"
            }
          />
        )}

        <p className="text-2xs text-muted-foreground">
          A curve only shows while the element moves. Replay to watch it.
        </p>

        {editable ? (
          <div className="dialkit-easing-handles">
            {BEZIER_AXES.map((axis) => (
              <Scrubber
                ariaLabel={`${field.label} ${axis.label}`}
                handle={axis.label}
                key={axis.label}
                max={axis.at % 2 === 0 ? 1 : 1.5}
                min={axis.at % 2 === 0 ? 0 : -0.5}
                onCommit={(next) => {
                  const draft = [...bezier];
                  draft[axis.at] = next;
                  onChange(field.path, draft);
                }}
                step={0.01}
                value={bezier[axis.at]}
              />
            ))}
          </div>
        ) : null}
      </div>
    </DialControl>
  );
}

function EasingCurve({
  bezier,
  onHandle,
}: {
  bezier: Bezier | null;
  onHandle: ((handle: BezierHandle, x: number, y: number) => void) | null;
}) {
  const drag = useBezierDrag((handle, x, y) => onHandle?.(handle, x, y));

  if (bezier !== null && onHandle === null) {
    return (
      <div className="dialkit-easing-readout">
        <DialEasingVisualization
          easing={{ duration: 1, ease: [...bezier], type: "easing" }}
        />
      </div>
    );
  }

  const start = viewPoint(0, 0);
  const end = viewPoint(1, 1);
  const first = bezier === null ? null : viewPoint(bezier[0], bezier[1]);
  const second = bezier === null ? null : viewPoint(bezier[2], bezier[3]);

  return (
    <div className="control-surface w-full rounded-md p-2">
      <svg
        aria-hidden="true"
        className="block aspect-square w-full touch-none overflow-visible"
        data-curve
        onPointerCancel={onHandle === null ? undefined : drag.cancel}
        onPointerDown={onHandle === null ? undefined : drag.down}
        onPointerMove={onHandle === null ? undefined : drag.move}
        onPointerUp={onHandle === null ? undefined : drag.up}
        role="presentation"
        viewBox={`0 0 ${CURVE_VIEW} ${CURVE_VIEW}`}
      >
        {CURVE_GUIDES.map((guide) => (
          <line
            className="stroke-border"
            key={guide}
            strokeWidth="1"
            x1="0"
            x2={CURVE_VIEW}
            y1={guide}
            y2={guide}
          />
        ))}
        {bezier === null || first === null || second === null ? null : (
          <>
            <path
              className="fill-none stroke-primary"
              d={curvePath(bezier)}
              strokeLinecap="round"
              strokeWidth="1.5"
            />
            <circle
              className="fill-foreground/60"
              cx={start.x}
              cy={start.y}
              r="2"
            />
            <circle
              className="fill-foreground/60"
              cx={end.x}
              cy={end.y}
              r="2"
            />
            {/* Handles are drawn only where they can be dragged. An enum can
                hold one of its own names and nothing else, so its curve is a
                reading — and a dot that looks grabbable and is not would be
                the panel lying about what it can do. */}
            {onHandle === null ? null : (
              <>
                <line
                  className="stroke-muted-foreground/40"
                  strokeWidth="1"
                  x1={start.x}
                  x2={first.x}
                  y1={start.y}
                  y2={first.y}
                />
                <line
                  className="stroke-muted-foreground/40"
                  strokeWidth="1"
                  x1={end.x}
                  x2={second.x}
                  y1={end.y}
                  y2={second.y}
                />
                <g className="cursor-grab" data-handle="1">
                  <circle
                    className="fill-transparent"
                    cx={first.x}
                    cy={first.y}
                    r="8"
                  />
                  <circle
                    className="fill-primary"
                    cx={first.x}
                    cy={first.y}
                    r="3"
                  />
                </g>
                <g className="cursor-grab" data-handle="2">
                  <circle
                    className="fill-transparent"
                    cx={second.x}
                    cy={second.y}
                    r="8"
                  />
                  <circle
                    className="fill-primary"
                    cx={second.x}
                    cy={second.y}
                    r="3"
                  />
                </g>
              </>
            )}
          </>
        )}
      </svg>
      {bezier === null ? null : (
        <div className="relative mt-1.5 h-3">
          <span
            className="absolute top-1/2 left-0 size-1.5 -translate-y-1/2 rounded-full bg-muted-foreground motion-reduce:hidden"
            key={cssBezier(bezier)}
            style={{
              animationDuration: "1.8s",
              animationIterationCount: "infinite",
              animationName: "easing-preview",
              animationTimingFunction: cssBezier(bezier),
            }}
          />
        </div>
      )}
    </div>
  );
}

function ArrayControl({
  action,
  field,
  onChange,
  original,
}: {
  action: React.ReactNode;
  field: TuningField;
  onChange: Change;
  original: TuningValue | undefined;
}) {
  const values = Array.isArray(field.value) ? field.value : [];
  const originals = Array.isArray(original) ? original : values;
  const canAdd = field.maxLength === null || values.length < field.maxLength;
  const canRemove = field.minLength === null || values.length > field.minLength;

  return (
    <div>
      <div className={ROW}>
        <span className={LABEL}>{field.label}</span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {values.length}
        </span>
        {action}
      </div>

      <div className="flex flex-col gap-1" data-slot="array-items">
        {values.map((value, index) => (
          <ArrayItemControl
            action={
              <Button
                aria-label={`Remove ${field.label} ${index + 1}`}
                className="relative size-5 text-muted-foreground after:absolute after:-inset-2"
                disabled={!canRemove}
                onClick={() =>
                  onChange(
                    field.path,
                    values.filter((_, at) => at !== index)
                  )
                }
                size="icon-xs"
                variant="ghost"
              >
                <MinusIcon />
              </Button>
            }
            field={field}
            index={index}
            key={`${field.path}:${index}`}
            onChange={(next) =>
              onChange(
                field.path,
                values.map((entry, at) => (at === index ? next : entry))
              )
            }
            original={originals[index]}
            value={value}
          />
        ))}
      </div>

      <div className={ROW}>
        <span />
        <Button
          aria-label={`Add ${field.label}`}
          className="h-7 justify-start px-2 text-muted-foreground"
          disabled={!canAdd || field.newItemDefault === null}
          onClick={() =>
            field.newItemDefault === null
              ? undefined
              : onChange(field.path, [...values, field.newItemDefault])
          }
          size="xs"
          variant="ghost"
        >
          <PlusIcon />
          Add
        </Button>
        <span />
      </div>
    </div>
  );
}

function ArrayItemControl({
  action,
  field,
  index,
  onChange,
  original,
  value,
}: {
  action: React.ReactNode;
  field: TuningField;
  index: number;
  onChange: (value: TuningValue) => void;
  original: TuningValue | undefined;
  value: TuningValue;
}) {
  const label = `${field.label} ${index + 1}`;

  if (typeof value === "number") {
    const itemField = {
      ...field,
      type: field.arrayItemType ?? "number",
      value,
    };
    const slider = sliderOf(itemField, original);

    if (slider !== null) {
      return (
        <DialControl action={action}>
          <AccessibleDialSlider
            label={label}
            onChange={(next) => onChange(valueFromSlider(itemField, next))}
            spec={slider}
            visualLabel={String(index + 1)}
          />
        </DialControl>
      );
    }

    return (
      <div className={ROW}>
        <span />
        <Scrubber
          ariaLabel={label}
          handle={String(index + 1)}
          onCommit={onChange}
          value={value}
        />
        {action}
      </div>
    );
  }

  if (typeof value === "boolean") {
    return (
      <DialControl action={action}>
        <DialToggle
          checked={value}
          label={String(index + 1)}
          onChange={onChange}
        />
      </DialControl>
    );
  }

  if (typeof value === "string" && field.arrayItemType === "color") {
    return (
      <DialControl action={action}>
        <DialColorControl
          label={String(index + 1)}
          onChange={onChange}
          value={colorValue(value)}
        />
      </DialControl>
    );
  }

  if (typeof value === "string" && field.arrayItemType === "enum") {
    return (
      <DialControl action={action}>
        <DialSelectControl
          label={String(index + 1)}
          onChange={onChange}
          options={[...field.options]}
          value={value}
        />
      </DialControl>
    );
  }

  if (typeof value === "string") {
    return (
      <DialControl action={action}>
        <DialTextControl
          label={String(index + 1)}
          onChange={onChange}
          value={value}
        />
      </DialControl>
    );
  }

  return (
    <div className={ROW}>
      <span />
      <span className={FIELD}>{String(value)}</span>
      {action}
    </div>
  );
}
