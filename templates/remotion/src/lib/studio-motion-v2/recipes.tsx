import { useRef } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Interactive,
  type InteractivitySchema,
  Sequence,
  type SequenceControls,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { type Bezier, curveField, sequenceStyleSchema } from "./controls";
import { ease, mixRect, phaseAt, scaleBetween, valueAt } from "./motion";
import type { ImagePlan, MetricPlan, PhrasePlan } from "./plans";
import { MotionReview, useCue } from "./review";
import { MotionText, type Typography } from "./text";
import { checkTiming, progressAt, secondsAt, type Timeline } from "./timing";

export interface SequenceStyle {
  readonly background?: string;
  readonly color?: string;
  readonly entryEasing?: Bezier;
  readonly exitEasing?: Bezier;
  readonly fontFamily?: string;
  readonly fontSize?: number;
  readonly fontWeight?: number;
}

/** Pass an explicit window when this sequence is embedded in a longer film. */
function useSequence(plan: Timeline, availableFrames?: number) {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const issues = checkTiming(plan, availableFrames ?? durationInFrames, fps);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => issue.message).join("; "));
  }
  return {
    height,
    portrait: height > width,
    time: secondsAt(frame, fps),
    width,
  };
}

function typography(
  style: SequenceStyle,
  fontSize: number,
  textAlign: Typography["textAlign"] = "center"
): Typography {
  return {
    fontFamily: style.fontFamily ?? "Arial",
    fontSize: style.fontSize ?? fontSize,
    fontWeight: style.fontWeight ?? 400,
    lineHeight: 1.13,
    minFontSize: Math.min(style.fontSize ?? fontSize, fontSize * 0.46),
    textAlign,
  };
}

export interface PhraseSequenceProps extends SequenceStyle {
  readonly availableFrames?: number;
  readonly effect?: "mask" | "fade" | "rise" | "blur";
  readonly plan: PhrasePlan;
}

/** A quiet typographic sequence; supplied typography and palette define its world. */
function PhraseSequenceBase({
  plan,
  effect = "mask",
  availableFrames,
  controls,
  ...style
}: PhraseSequenceProps & { readonly controls: SequenceControls | undefined }) {
  const { time, width, height, portrait } = useSequence(plan, availableFrames);
  const outlineRef = useRef<HTMLDivElement>(null);
  const box = {
    height: height * 0.44,
    width: width * 0.8,
    x: width * 0.1,
    y: height * 0.28,
  };
  const type = typography(style, width * (portrait ? 0.105 : 0.069));
  return (
    <Sequence controls={controls} layout="none" outlineRef={outlineRef}>
      <AbsoluteFill
        ref={outlineRef}
        style={{ backgroundColor: style.background ?? "#141414" }}
      >
        {plan.phrases.map(({ text, beat }) => (
          <MotionText
            beat={beat}
            box={box}
            color={style.color ?? "#f5f3ef"}
            effect={effect}
            entryEasing={style.entryEasing}
            exitEasing={style.exitEasing}
            key={beat.id}
            split="whole"
            text={text}
            time={time}
            typography={type}
          />
        ))}
      </AbsoluteFill>
    </Sequence>
  );
}

export interface ImageSequenceProps extends SequenceStyle {
  readonly availableFrames?: number;
  readonly objectPosition?: string;
  readonly plan: ImagePlan;
  readonly revealEasing?: Bezier;
  readonly src: string;
}

/** The picture owns the reveal; its caption gets a separate, unobscured reading interval. */
function ImageSequenceBase({
  plan,
  src,
  objectPosition = "50% 50%",
  availableFrames,
  controls,
  revealEasing = [0.65, 0, 0.35, 1],
  ...style
}: ImageSequenceProps & { readonly controls: SequenceControls | undefined }) {
  const { time, width, height, portrait } = useSequence(plan, availableFrames);
  const outlineRef = useRef<HTMLDivElement>(null);
  const imageCue = useCue(plan.imageBeat);
  const reveal = ease(
    progressAt(
      time,
      plan.imageBeat.start,
      plan.imageBeat.settled - plan.imageBeat.start
    ),
    Easing.bezier(...revealEasing)
  );
  const mask = (1 - reveal) * 50;
  const imageHeight = height * (portrait ? 0.62 : 0.72);
  const frame = {
    height: imageHeight,
    width: width * 0.89,
    x: width * 0.055,
    y: height * 0.055,
  };
  return (
    <Sequence controls={controls} layout="none" outlineRef={outlineRef}>
      <AbsoluteFill
        ref={outlineRef}
        style={{ backgroundColor: style.background ?? "#141414" }}
      >
        <MotionText
          beat={plan.titleBeat}
          box={{
            height: height * 0.4,
            width: width * 0.76,
            x: width * 0.12,
            y: height * 0.3,
          }}
          color={style.color ?? "#f5f3ef"}
          effect="fade"
          entryEasing={style.entryEasing}
          exitEasing={style.exitEasing}
          split="whole"
          text={plan.title}
          time={time}
          typography={typography(style, width * (portrait ? 0.1 : 0.067))}
        />
        {time >= plan.imageBeat.start ? (
          <div
            {...imageCue}
            data-design-id="image-reveal"
            data-motion-id="image"
            data-motion-phase={time < plan.imageBeat.settled ? "enter" : "hold"}
            style={{
              clipPath: `inset(0 ${mask}% 0 ${mask}%)`,
              height: frame.height,
              left: frame.x,
              overflow: "hidden",
              position: "absolute",
              top: frame.y,
              width: frame.width,
            }}
          >
            <Img
              src={src}
              style={{
                height: "100%",
                objectFit: "cover",
                objectPosition,
                scale: scaleBetween(1.045, 1, reveal),
                transformOrigin: "50% 50%",
                width: "100%",
              }}
            />
          </div>
        ) : null}
        <MotionText
          beat={plan.captionBeat}
          box={{
            height: height * (portrait ? 0.2 : 0.12),
            width: width * 0.85,
            x: width * 0.075,
            y: frame.y + frame.height + height * 0.045,
          }}
          color={style.color ?? "#f5f3ef"}
          effect="rise"
          entryEasing={style.entryEasing}
          exitEasing={style.exitEasing}
          text={plan.caption}
          time={time}
          typography={typography(
            { ...style, fontSize: undefined },
            width * (portrait ? 0.047 : 0.032),
            "left"
          )}
        />
      </AbsoluteFill>
    </Sequence>
  );
}

export interface MetricSequenceProps extends SequenceStyle {
  readonly accent?: string;
  readonly availableFrames?: number;
  readonly handoffEasing?: Bezier;
  /** Denominator of the graphic; 82 of 100 occupies 82% of its track. */
  readonly maximum?: number;
  readonly plan: MetricPlan;
  readonly resultColor?: string;
  readonly suffix?: string;
  readonly valueEasing?: Bezier;
}

/** One progress drives the number and line. The same line becomes the next frame. */
function MetricSequenceBase({
  plan,
  suffix = "%",
  maximum = 100,
  accent = "#ed5525",
  resultColor = "#fff8ed",
  valueEasing = [0.22, 1, 0.36, 1],
  handoffEasing = [0.65, 0, 0.35, 1],
  availableFrames,
  controls,
  ...style
}: MetricSequenceProps & { readonly controls: SequenceControls | undefined }) {
  const { time, width, height, portrait } = useSequence(plan, availableFrames);
  const outlineRef = useRef<HTMLDivElement>(null);
  if (!Number.isFinite(maximum) || maximum <= 0 || plan.value > maximum) {
    throw new Error(
      "Metric maximum must be positive, finite and at least the value"
    );
  }
  const beat = plan.metricBeat;
  const progress = valueAt(
    time,
    beat.start,
    beat.settled - beat.start,
    0,
    1,
    Easing.bezier(...valueEasing)
  );
  const value = Math.round(plan.value * progress);
  const handoff = ease(
    progressAt(time, beat.exitStart, beat.end - beat.exitStart),
    Easing.bezier(...handoffEasing)
  );
  const numberSize = Math.min(
    height * 0.27,
    width * (portrait ? 0.28 : 0.21),
    (width * 0.7) /
      Math.max(1.5, String(plan.value).length * 0.65 + suffix.length * 0.6)
  );
  const numberTop = height * 0.25;
  const labelTop = numberTop + numberSize + height * 0.04;
  const bar = {
    height: Math.min(width, height) * 0.014,
    width: width * 0.76 * (plan.value / maximum) * progress,
    x: width * 0.12,
    y: labelTop + height * 0.145,
  };
  const rect = mixRect(bar, { height, width, x: 0, y: 0 }, handoff);
  const ink = style.color ?? "#28231f";
  const labelBeat = { ...beat, settled: beat.start + 0.3 };
  const { statementBeat } = plan;
  return (
    <Sequence controls={controls} layout="none" outlineRef={outlineRef}>
      <AbsoluteFill
        ref={outlineRef}
        style={{ backgroundColor: style.background ?? "#f4efe6" }}
      >
        {time < beat.end ? (
          <>
            <div
              data-design-id="metric-value"
              data-motion-id="metric-value"
              data-motion-phase={time < beat.settled ? "enter" : "hold"}
              data-motion-progress={progress}
              data-motion-value={value}
              style={{
                color: ink,
                fontFamily: style.fontFamily ?? "Arial",
                fontSize: numberSize,
                fontVariantNumeric: "tabular-nums",
                fontWeight: style.fontWeight ?? 400,
                left: width * 0.12,
                lineHeight: 1,
                opacity: Math.min(1, progressAt(time, beat.start, 0.18)),
                position: "absolute",
                top: numberTop,
              }}
            >
              {value}
              <span style={{ fontSize: "0.45em", marginLeft: "0.06em" }}>
                {suffix}
              </span>
            </div>
            <MotionText
              beat={labelBeat}
              box={{
                height: height * 0.11,
                width: width * 0.7,
                x: width * 0.125,
                y: labelTop,
              }}
              color={ink}
              effect="fade"
              entryEasing={style.entryEasing}
              exitEasing={style.exitEasing}
              split="whole"
              text={plan.label}
              time={time}
              typography={typography(
                { ...style, fontSize: undefined },
                width * (portrait ? 0.05 : 0.035),
                "left"
              )}
            />
          </>
        ) : null}
        <div
          data-design-id="metric-shape"
          data-motion-id="metric-shape"
          data-motion-phase={time < beat.end ? phaseAt(time, beat) : "hold"}
          data-motion-progress={progress}
          style={{
            backgroundColor: accent,
            height: rect.height,
            left: rect.x,
            position: "absolute",
            top: rect.y,
            width: rect.width,
          }}
        />
        <MotionText
          beat={statementBeat}
          box={{
            height: height * 0.5,
            width: width * 0.76,
            x: width * 0.12,
            y: height * 0.25,
          }}
          color={resultColor}
          effect="mask"
          entryEasing={style.entryEasing}
          exitEasing={style.exitEasing}
          split="whole"
          text={plan.statement}
          time={time}
          typography={typography(style, width * (portrait ? 0.11 : 0.085))}
        />
      </AbsoluteFill>
    </Sequence>
  );
}

const textMotionSchema = {
  ...sequenceStyleSchema,
  entryEasing: curveField([0.22, 1, 0.36, 1], "Text entry"),
  exitEasing: curveField([0.64, 0, 0.78, 0], "Text exit"),
} as const satisfies InteractivitySchema;
const phraseSchema = {
  ...textMotionSchema,
  effect: {
    default: "mask",
    description: "Text reveal",
    type: "enum",
    variants: { blur: {}, fade: {}, mask: {}, rise: {} },
  },
} as const satisfies InteractivitySchema;
const imageSchema = {
  ...textMotionSchema,
  objectPosition: {
    default: "50% 50%",
    description: "Image crop position",
    type: "text-content",
  },
  revealEasing: curveField([0.65, 0, 0.35, 1], "Image reveal"),
  src: { default: "", description: "Image", type: "asset" },
} as const satisfies InteractivitySchema;
const metricSchema = {
  ...textMotionSchema,
  accent: {
    default: "#ed5525",
    description: "Graphic and next scene",
    type: "color",
  },
  background: { default: "#f4efe6", description: "Background", type: "color" },
  color: { default: "#28231f", description: "Text", type: "color" },
  handoffEasing: curveField(
    [0.65, 0, 0.35, 1],
    "Graphic becomes the next scene"
  ),
  maximum: {
    default: 100,
    description: "Graphic maximum",
    hiddenFromList: false,
    max: 1_000_000_000,
    min: 1,
    step: 1,
    type: "number",
  },
  resultColor: {
    default: "#fff8ed",
    description: "Result text",
    type: "color",
  },
  suffix: { default: "%", description: "Number suffix", type: "text-content" },
  valueEasing: curveField(
    [0.22, 1, 0.36, 1],
    "Shared number and graphic progress"
  ),
} as const satisfies InteractivitySchema;

function ReviewedPhraseSequence(
  props: PhraseSequenceProps & {
    readonly controls: SequenceControls | undefined;
  }
) {
  return (
    <MotionReview availableFrames={props.availableFrames} plan={props.plan}>
      <PhraseSequenceBase {...props} />
    </MotionReview>
  );
}

export const PhraseSequence = Interactive.withSchema<
  typeof phraseSchema,
  PhraseSequenceProps
>({
  Component: ReviewedPhraseSequence,
  componentIdentity: null,
  componentName: "PhraseSequence",
  schema: phraseSchema,
  supportsEffects: false,
});
function ReviewedImageSequence(
  props: ImageSequenceProps & {
    readonly controls: SequenceControls | undefined;
  }
) {
  return (
    <MotionReview availableFrames={props.availableFrames} plan={props.plan}>
      <ImageSequenceBase {...props} />
    </MotionReview>
  );
}

export const ImageSequence = Interactive.withSchema<
  typeof imageSchema,
  ImageSequenceProps
>({
  Component: ReviewedImageSequence,
  componentIdentity: null,
  componentName: "ImageSequence",
  schema: imageSchema,
  supportsEffects: false,
});
function ReviewedMetricSequence(
  props: MetricSequenceProps & {
    readonly controls: SequenceControls | undefined;
  }
) {
  return (
    <MotionReview availableFrames={props.availableFrames} plan={props.plan}>
      <MetricSequenceBase {...props} />
    </MotionReview>
  );
}

export const MetricSequence = Interactive.withSchema<
  typeof metricSchema,
  MetricSequenceProps
>({
  Component: ReviewedMetricSequence,
  componentIdentity: null,
  componentName: "MetricSequence",
  schema: metricSchema,
  supportsEffects: false,
});
