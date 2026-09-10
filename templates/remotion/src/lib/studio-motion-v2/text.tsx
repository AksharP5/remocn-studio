import type { CSSProperties, ReactNode } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  cancelRender,
  continueRender,
  delayRender,
  Easing,
  Interactive,
  type InteractivitySchema,
  Sequence,
  type SequenceControls,
} from "remotion";
import { type Bezier, curveField } from "./controls";
import type { Rect } from "./motion";
import { type RevealState, revealAt } from "./motion";
import { useCue } from "./review";
import { type Beat, positive } from "./timing";

export interface Typography {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly fontWeight?: number;
  /** em, measured and rendered identically. */
  readonly letterSpacing?: number;
  readonly lineHeight?: number;
  readonly minFontSize?: number;
  readonly textAlign?: "left" | "center" | "right";
}

interface Piece {
  readonly index: number | null;
  readonly key: number;
  readonly text: string;
}

const WORD_BOUNDARY = /(\s+)/u;

function piecesOf(text: string, split: "word" | "whole"): Piece[] {
  let index = 0;
  return (split === "whole" ? [text] : text.split(WORD_BOUNDARY))
    .filter(Boolean)
    .map((part, key) => {
      const wordIndex = part.trim().length > 0 ? index : null;
      if (wordIndex !== null) {
        index += 1;
      }
      return { index: wordIndex, key, text: part };
    });
}

const unitStyle: CSSProperties = {
  display: "inline-block",
  maxWidth: "100%",
  overflow: "hidden",
  verticalAlign: "bottom",
};

function fittedSize(
  node: HTMLDivElement,
  box: Rect,
  minFontSize: number,
  fontSize: number,
  text: string
): number {
  const fits = (value: number) => {
    node.style.fontSize = `${value}px`;
    return (
      node.scrollWidth <= box.width + 0.5 &&
      node.getBoundingClientRect().height <= box.height + 0.5
    );
  };
  if (!fits(minFontSize)) {
    throw new Error(
      `Text cannot fit at ${minFontSize}px: ${text.slice(0, 100)}. Shorten the copy or enlarge its box.`
    );
  }
  let low = minFontSize;
  let high = fontSize;
  if (fits(high)) {
    low = high;
  } else {
    for (let iteration = 0; iteration < 14; iteration += 1) {
      const middle = (low + high) / 2;
      if (fits(middle)) {
        low = middle;
      } else {
        high = middle;
      }
    }
  }
  const result = Math.floor(low * 10) / 10;
  node.style.fontSize = `${result}px`;

  return result;
}

/** Measures the same word boxes that are rendered, after their font is loaded. */
function useTextSize(
  text: string,
  box: Rect,
  typography: Typography,
  split: "word" | "whole"
) {
  const ref = useRef<HTMLDivElement>(null);
  const {
    fontFamily,
    fontSize,
    fontWeight = 400,
    minFontSize = 24,
    lineHeight = 1.15,
    letterSpacing = 0,
    textAlign = "center",
  } = typography;
  const [size, setSize] = useState(fontSize);

  // biome-ignore lint/correctness/useExhaustiveDependencies: The measured DOM changes with these layout and splitting props.
  useLayoutEffect(() => {
    positive(box.width, "text width");
    positive(box.height, "text height");
    positive(fontSize, "font size");
    positive(minFontSize, "minimum font size");
    if (minFontSize > fontSize) {
      throw new Error("Minimum font size cannot exceed preferred font size");
    }
    const handle = delayRender(`Fit text: ${text.slice(0, 48)}`);
    let disposed = false;
    const fit = async () => {
      // Loading the selected face explicitly also covers a font not yet used by visible text.
      await document.fonts.load(
        `${fontWeight} ${fontSize}px ${fontFamily}`,
        text
      );
      await document.fonts.ready;
      if (disposed) {
        return;
      }
      const node = ref.current;
      if (!node) {
        throw new Error("Text measurement element is missing");
      }
      const result = fittedSize(node, box, minFontSize, fontSize, text);
      setSize(result);
    };
    fit()
      .catch((error: unknown) => {
        if (!disposed) {
          cancelRender(
            error instanceof Error ? error : new Error(String(error))
          );
        }
      })
      .finally(() => continueRender(handle));
    return () => {
      disposed = true;
      continueRender(handle);
    };
  }, [
    text,
    box.width,
    box.height,
    fontFamily,
    fontSize,
    minFontSize,
    fontWeight,
    lineHeight,
    letterSpacing,
    textAlign,
    split,
  ]);

  return { ref, size };
}

export interface MotionTextProps {
  readonly beat: Beat;
  readonly box: Rect;
  readonly color: string;
  readonly effect?: "mask" | "fade" | "rise" | "blur";
  readonly entryEasing?: Bezier;
  readonly exitEasing?: Bezier;
  readonly name?: string;
  readonly split?: "word" | "whole";
  readonly spread?: number;
  readonly text: string;
  readonly time: number;
  readonly typography: Typography;
}

function unitMotion(
  motion: RevealState | null,
  effect: NonNullable<MotionTextProps["effect"]>
): CSSProperties {
  const distance = { blur: 0, fade: 0, mask: 1.2, rise: 0.22 }[effect];
  const travel = motion ? 1 - motion.enter - motion.exit : 0;
  return {
    display: "inline-block",
    filter:
      effect === "blur" && motion
        ? `blur(${(1 - motion.enter + motion.exit) * 0.12}em)`
        : undefined,
    maxWidth: "100%",
    opacity: motion && effect !== "mask" ? motion.opacity : 1,
    translate:
      effect === "mask" ? `0px ${travel * 105}%` : `0px ${travel * distance}em`,
  };
}

/** Layout stays fixed throughout the gesture. Splitting never cuts a grapheme. */
function MotionTextBase({
  text,
  time,
  beat,
  box,
  typography,
  color,
  controls,
  effect = "mask",
  split = "word",
  name = beat.id,
  entryEasing = [0.22, 1, 0.36, 1],
  exitEasing = [0.64, 0, 0.78, 0],
  spread = 0.35,
}: MotionTextProps & { readonly controls: SequenceControls | undefined }) {
  const outlineRef = useRef<HTMLDivElement>(null);
  const pieces = useMemo(() => piecesOf(text, split), [text, split]);
  const count = pieces.filter((piece) => piece.index !== null).length;
  const { ref, size } = useTextSize(text, box, typography, split);
  const state = revealAt(time, beat);
  const cue = useCue(beat);
  const style: CSSProperties = {
    fontFamily: typography.fontFamily,
    fontSize: size,
    fontWeight: typography.fontWeight ?? 400,
    letterSpacing: `${typography.letterSpacing ?? 0}em`,
    lineHeight: typography.lineHeight ?? 1.15,
    overflowWrap: "anywhere",
    textAlign: typography.textAlign ?? "center",
    whiteSpace: "pre-wrap",
    width: box.width,
  };
  const units = (animated: boolean): ReactNode =>
    pieces.map((piece) => {
      if (piece.index === null) {
        return piece.text;
      }
      const motion = animated
        ? revealAt(time, beat, {
            count,
            entryCurve: Easing.bezier(...entryEasing),
            exitCurve: Easing.bezier(...exitEasing),
            index: piece.index,
            spread,
          })
        : null;
      return (
        <span
          data-motion-mask={
            animated && effect === "mask" ? "reveal" : undefined
          }
          key={piece.key}
          style={unitStyle}
        >
          <span
            data-motion-unit={animated ? "text" : undefined}
            style={unitMotion(motion, effect)}
          >
            {piece.text}
          </span>
        </span>
      );
    });

  return (
    <Sequence
      controls={controls}
      layout="none"
      name={name}
      outlineRef={outlineRef}
    >
      <div
        aria-hidden="true"
        ref={ref}
        style={{
          ...style,
          fontSize: typography.fontSize,
          left: -100_000,
          pointerEvents: "none",
          position: "absolute",
          top: 0,
          visibility: "hidden",
        }}
      >
        {units(false)}
      </div>
      <div
        {...cue}
        data-design-id={name}
        data-motion-font-size={size}
        data-motion-id={name}
        data-motion-phase={state.phase}
        ref={outlineRef}
        style={{
          alignItems: "center",
          color,
          display: "flex",
          height: box.height,
          left: box.x,
          position: "absolute",
          top: box.y,
          visibility: state.visible ? "visible" : "hidden",
          width: box.width,
        }}
      >
        <div style={style}>{units(true)}</div>
      </div>
    </Sequence>
  );
}

const textSchema = {
  color: { default: "#f5f3ef", description: "Text color", type: "color" },
  effect: {
    default: "mask",
    description: "Reveal",
    type: "enum",
    variants: { blur: {}, fade: {}, mask: {}, rise: {} },
  },
  entryEasing: curveField(
    [0.22, 1, 0.36, 1],
    "Entry curve, sampled from beat.start to beat.settled"
  ),
  exitEasing: curveField(
    [0.64, 0, 0.78, 0],
    "Exit curve, sampled from beat.exitStart to beat.end"
  ),
  spread: {
    default: 0.35,
    description: "Group stagger within the entry budget",
    hiddenFromList: false,
    max: 0.8,
    min: 0,
    step: 0.01,
    type: "number",
  },
  text: {
    default: "Your text",
    description: "Whole text, including line breaks",
    type: "text-content",
  },
  "typography.fontFamily": {
    default: "Arial",
    description: "Typeface",
    type: "font-family",
  },
  "typography.fontSize": {
    default: 88,
    description: "Preferred size",
    hiddenFromList: false,
    max: 400,
    min: 12,
    step: 1,
    type: "number",
  },
  "typography.fontWeight": {
    default: 400,
    description: "Type weight",
    hiddenFromList: false,
    max: 900,
    min: 100,
    step: 100,
    type: "number",
  },
  "typography.lineHeight": {
    default: 1.15,
    description: "Line height",
    hiddenFromList: false,
    max: 2,
    min: 0.9,
    step: 0.01,
    type: "number",
  },
} as const satisfies InteractivitySchema;

export const MotionText = Interactive.withSchema<
  typeof textSchema,
  MotionTextProps
>({
  Component: MotionTextBase,
  componentIdentity: null,
  componentName: "MotionText",
  schema: textSchema,
  supportsEffects: false,
});
