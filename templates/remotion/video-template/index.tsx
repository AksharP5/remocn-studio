import type { CSSProperties, ReactNode } from "react";
import { useRef } from "react";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  type InteractivitySchema,
  interpolate,
  Sequence,
  type SequenceControls,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const meta = {
  durationInFrames: 150,
  fps: 30,
  height: 1080,
  width: 1920,
};

const titleSchema = {
  damping: {
    default: 200,
    description: "Rise damping",
    hiddenFromList: false,
    max: 400,
    min: 1,
    step: 1,
    type: "number",
  },
  easing: {
    default: [0, 0, 0.58, 1],
    description: "Easing",
    item: { max: 1.5, min: -0.5, step: 0.01, type: "number" },
    maxLength: 4,
    minLength: 4,
    newItemDefault: 0,
    type: "array",
  },
  emphasis: {
    default: "none",
    description: "Emphasis",
    type: "enum",
    variants: {
      glow: {
        glowRadius: {
          default: 32,
          description: "Glow radius",
          hiddenFromList: false,
          max: 120,
          min: 0,
          step: 1,
          type: "number",
        },
      },
      none: {},
    },
  },
  riseFrames: {
    default: 30,
    description: "Rise frames",
    hiddenFromList: false,
    max: 90,
    min: 1,
    step: 1,
    type: "number",
  },
  "style.color": {
    default: "#ffffff",
    description: "Color",
    type: "color",
  },
  "style.fontSize": {
    default: 96,
    description: "Font size",
    hiddenFromList: false,
    max: 240,
    min: 12,
    step: 1,
    type: "number",
  },
  "style.fontWeight": {
    default: 600,
    description: "Font weight",
    hiddenFromList: false,
    max: 900,
    min: 100,
    step: 100,
    type: "number",
  },
  "style.letterSpacing": {
    default: 0,
    description: "Tracking in pixels",
    hiddenFromList: false,
    max: 20,
    min: -20,
    step: 0.1,
    type: "number",
  },
  "style.lineHeight": {
    default: 1.1,
    description: "Line height",
    hiddenFromList: false,
    max: 3,
    min: 0.6,
    step: 0.01,
    type: "number",
  },
  "style.translate": {
    default: "0px 0px",
    description: "Offset",
    step: 1,
    type: "translate",
  },
} as const satisfies InteractivitySchema;

/** A cubic-bezier, which is what the studio's timing curve edits. */
type TitleEasing = readonly [number, number, number, number];

interface TitleProps {
  readonly children: ReactNode;
  readonly damping?: number;
  readonly easing?: TitleEasing;
  readonly emphasis?: "glow" | "none";
  readonly from?: number;
  readonly glowRadius?: number;
  readonly name?: string;
  readonly riseFrames?: number;
  readonly style?: CSSProperties;
}

function TitleBase({
  children,
  controls,
  damping = 200,
  easing = [0, 0, 0.58, 1],
  emphasis = "none",
  from = 0,
  glowRadius = 32,
  name,
  riseFrames = 30,
  style,
}: TitleProps & { readonly controls: SequenceControls | undefined }) {
  const outlineRef = useRef<HTMLDivElement>(null);

  return (
    <Sequence
      controls={controls}
      from={from}
      layout="none"
      name={name ?? "Title"}
      outlineRef={outlineRef}
    >
      <div ref={outlineRef} style={{ position: "relative" }}>
        <RisingText
          damping={damping}
          easing={easing}
          emphasis={emphasis}
          glowRadius={glowRadius}
          name={name ?? "Title"}
          riseFrames={riseFrames}
          style={style}
        >
          {children}
        </RisingText>
      </div>
    </Sequence>
  );
}

function RisingText({
  children,
  damping,
  easing,
  emphasis,
  glowRadius,
  name,
  riseFrames,
  style,
}: {
  readonly children: ReactNode;
  readonly damping: number;
  readonly easing: TitleEasing;
  readonly emphasis: "glow" | "none";
  readonly glowRadius: number;
  readonly name: string;
  readonly riseFrames: number;
  readonly style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rise = spring({
    config: { damping },
    durationInFrames: riseFrames,
    fps,
    frame,
  });

  return (
    <Interactive.H1
      data-design-id={name}
      name={name}
      style={{
        color: "#ffffff",
        fontFamily: "system-ui, sans-serif",
        fontSize: 96,
        fontWeight: 600,
        letterSpacing: 0,
        lineHeight: 1.1,
        margin: 0,
        opacity: interpolate(frame, [0, 20], [0, 1], {
          easing: Easing.bezier(...easing),
          extrapolateRight: "clamp",
        }),
        textShadow:
          emphasis === "glow" ? `0 0 ${glowRadius}px currentColor` : "none",
        translate: `${interpolate(rise, [0, 1], [-24, 0])}px 0px`,
        ...style,
      }}
    >
      {children}
    </Interactive.H1>
  );
}

export const Title = Interactive.withSchema<typeof titleSchema, TitleProps>({
  Component: TitleBase,
  componentIdentity: null,
  componentName: "Title",
  schema: titleSchema,
  supportsEffects: false,
});

const backdropSchema = {
  focus: {
    default: [0.5, 0.35],
    description: "Glow center",
    max: 1,
    min: 0,
    step: 0.01,
    type: "uv-coordinate",
  },
  glowStops: {
    default: [0.35, 0.12],
    description: "Glow stops",
    item: { max: 1, min: 0, step: 0.01, type: "number" },
    maxLength: 4,
    minLength: 1,
    newItemDefault: 0.05,
    type: "array",
  },
  tint: {
    default: "#8b7bff",
    description: "Glow tint",
    type: "color",
  },
} as const satisfies InteractivitySchema;

interface BackdropProps {
  readonly focus?: readonly [number, number];
  readonly glowStops?: readonly number[];
  readonly tint?: string;
}

function BackdropBase({
  controls,
  focus = [0.5, 0.35],
  glowStops = [0.35, 0.12],
  tint = "#8b7bff",
}: BackdropProps & { readonly controls: SequenceControls | undefined }) {
  const outlineRef = useRef<HTMLDivElement>(null);

  const stops = glowStops
    .map(
      (alpha, index) =>
        `color-mix(in srgb, ${tint} ${Math.round(alpha * 100)}%, transparent) ${Math.round((index / glowStops.length) * 60)}%`
    )
    .join(", ");

  return (
    <Sequence controls={controls} name="Backdrop" outlineRef={outlineRef}>
      <div
        ref={outlineRef}
        style={{
          background: `radial-gradient(circle at ${focus[0] * 100}% ${focus[1] * 100}%, ${stops}, transparent 80%), #141318`,
          inset: 0,
          position: "absolute",
        }}
      />
    </Sequence>
  );
}

export const Backdrop = Interactive.withSchema<
  typeof backdropSchema,
  BackdropProps
>({
  Component: BackdropBase,
  componentIdentity: null,
  componentName: "Backdrop",
  schema: backdropSchema,
  supportsEffects: false,
});

export default function Video() {
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        flexDirection: "column",
        gap: 24,
        justifyContent: "center",
      }}
    >
      <Backdrop />
      <Title name="Heading">__VIDEO_NAME__</Title>
      <Title
        from={12}
        name="Subtitle"
        style={{ color: "#9a94b8", fontSize: 40, fontWeight: 500 }}
      >
        Point at anything and tune it
      </Title>
    </AbsoluteFill>
  );
}
