import { useRef } from "react";
import {
  AbsoluteFill,
  Img,
  Interactive,
  type InteractivitySchema,
  Sequence,
  type SequenceControls,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CardsPlan, DetailsPlan } from "./combination-plans";
import { sequenceStyleSchema } from "./controls";
import { mixRect, revealAt } from "./motion";
import { MotionReview, useCue } from "./review";
import { MotionText } from "./text";
import { checkTiming, progressAt, type Timeline } from "./timing";

interface CombinationStyle {
  readonly availableFrames?: number;
  readonly background?: string;
  readonly color?: string;
  readonly fontFamily?: string;
  readonly fontSize?: number;
  readonly fontWeight?: number;
}
export interface DetailsSequenceProps extends CombinationStyle {
  readonly plan: DetailsPlan;
}
export interface CardsSequenceProps extends CombinationStyle {
  readonly plan: CardsPlan;
}

function useCombination(plan: Timeline, availableFrames?: number) {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const time = useCurrentFrame() / fps;
  const issues = checkTiming(plan, availableFrames ?? durationInFrames, fps);
  if (issues.length) {
    throw new Error(issues.map((issue) => issue.message).join("; "));
  }
  return { height, portrait: height > width, time, width };
}

function DetailsContent({
  plan,
  controls,
  background = "#f1f1f1",
  color = "#1d1d1d",
  fontFamily = "Arial",
  fontSize,
  fontWeight = 400,
  availableFrames,
}: DetailsSequenceProps & { readonly controls: SequenceControls | undefined }) {
  const { width, height, time, portrait } = useCombination(
    plan,
    availableFrames
  );
  const ref = useRef<HTMLDivElement>(null);
  const cue = useCue(plan.group);
  const columns = Math.min(plan.details.length, portrait ? 2 : 4);
  const rows = Math.ceil(plan.details.length / columns);
  const cellWidth = (width * 0.82) / columns;
  const cellHeight = (height * 0.33) / rows;
  const type = {
    fontFamily,
    fontSize: fontSize ?? width * (portrait ? 0.085 : 0.065),
    fontWeight,
    minFontSize: Math.min(fontSize ?? Number.POSITIVE_INFINITY, width * 0.045),
    textAlign: "left" as const,
  };
  return (
    <Sequence controls={controls} layout="none" outlineRef={ref}>
      <AbsoluteFill ref={ref} style={{ backgroundColor: background }}>
        <MotionText
          beat={plan.heading}
          box={{
            height: height * 0.3,
            width: width * 0.82,
            x: width * 0.09,
            y: height * 0.12,
          }}
          color={color}
          text={plan.title}
          time={time}
          typography={type}
        />
        <div
          {...cue}
          style={{
            inset: 0,
            position: "absolute",
            visibility:
              time >= plan.group.start && time < plan.group.end
                ? "visible"
                : "hidden",
          }}
        >
          {plan.details.map((item, index) => (
            <MotionText
              beat={item.beat}
              box={{
                height: cellHeight * 0.85,
                width: cellWidth * 0.9,
                x: width * 0.09 + (index % columns) * cellWidth,
                y: height * 0.51 + Math.floor(index / columns) * cellHeight,
              }}
              color={color}
              effect="rise"
              key={item.beat.id}
              text={item.text}
              time={time}
              typography={{
                ...type,
                fontSize: width * (portrait ? 0.044 : 0.025),
                minFontSize: width * (portrait ? 0.035 : 0.02),
              }}
            />
          ))}
        </div>
      </AbsoluteFill>
    </Sequence>
  );
}

function gridRect(
  index: number,
  count: number,
  width: number,
  height: number,
  portrait: boolean
) {
  const columns = portrait ? 2 : Math.min(3, count);
  const rows = Math.ceil(count / columns);
  const cellWidth = (width * 0.86) / columns;
  const cellHeight = (height * 0.76) / rows;
  return {
    height: cellHeight * 0.74,
    width: cellWidth * 0.94,
    x: width * 0.07 + (index % columns) * cellWidth,
    y: height * 0.1 + Math.floor(index / columns) * cellHeight,
  };
}

function Card({
  item,
  index,
  plan,
  width,
  height,
  time,
  portrait,
  color,
  fontFamily,
  fontSize,
  fontWeight,
}: {
  readonly item: CardsPlan["cards"][number];
  readonly index: number;
  readonly plan: CardsPlan;
  readonly width: number;
  readonly height: number;
  readonly time: number;
  readonly portrait: boolean;
  readonly color: string;
  readonly fontFamily: string;
  readonly fontSize?: number;
  readonly fontWeight: number;
}) {
  const cue = useCue(item.beat);
  const entering = revealAt(time, item.beat).enter;
  const depth = plan.cards
    .slice(index + 1)
    .reduce((sum, other) => sum + revealAt(time, other.beat).enter, 0);
  const grid = progressAt(
    time,
    plan.grid.start,
    plan.gridMoveEnd - plan.grid.start
  );
  const eased = grid * grid * (3 - 2 * grid);
  const cardWidth = width * 0.82;
  const cardHeight = height * (portrait ? 0.48 : 0.62);
  const scale = 1 - depth * 0.045;
  const from = {
    height: cardHeight * scale,
    width: cardWidth * scale,
    x: (width - cardWidth * scale) / 2,
    y: height * 0.14 - depth * height * 0.015,
  };
  const target = gridRect(index, plan.cards.length, width, height, portrait);
  const rect = mixRect(from, target, eased);
  const typography = {
    fontFamily,
    fontSize: fontSize ?? width * (portrait ? 0.04 : 0.026),
    fontWeight,
    minFontSize: Math.min(
      fontSize ?? Number.POSITIVE_INFINITY,
      width * (portrait ? 0.032 : 0.02)
    ),
    textAlign: "left" as const,
  };
  return (
    <>
      <div
        {...cue}
        data-design-id={`card-${item.content.id}`}
        style={{
          borderRadius: Math.min(width, height) * 0.012,
          height: rect.height,
          left: rect.x,
          opacity: entering * (1 - Math.min(0.5, depth * 0.17) * (1 - eased)),
          overflow: "hidden",
          position: "absolute",
          scale: String(1 + 0.12 * (1 - entering)),
          top: rect.y,
          visibility: time >= item.beat.start ? "visible" : "hidden",
          width: rect.width,
        }}
      >
        <Img
          src={item.content.src}
          style={{ height: "100%", objectFit: "cover", width: "100%" }}
        />
      </div>
      <MotionText
        beat={item.caption}
        box={{
          height: height * 0.14,
          width: width * 0.82,
          x: width * 0.09,
          y: height * (portrait ? 0.65 : 0.79),
        }}
        color={color}
        effect="fade"
        text={item.content.title}
        time={time}
        typography={typography}
      />
    </>
  );
}

function CardsContent({
  plan,
  controls,
  background = "#f1f1f1",
  color = "#1d1d1d",
  fontFamily = "Arial",
  fontSize,
  fontWeight = 400,
  availableFrames,
}: CardsSequenceProps & { readonly controls: SequenceControls | undefined }) {
  const { width, height, time, portrait } = useCombination(
    plan,
    availableFrames
  );
  const ref = useRef<HTMLDivElement>(null);
  const cue = useCue(plan.grid);
  const labels = progressAt(
    time,
    plan.gridMoveEnd,
    plan.grid.settled - plan.gridMoveEnd
  );
  return (
    <Sequence controls={controls} layout="none" outlineRef={ref}>
      <AbsoluteFill ref={ref} style={{ backgroundColor: background }}>
        {plan.cards.map((item, index) => (
          <Card
            color={color}
            fontFamily={fontFamily}
            fontSize={fontSize}
            fontWeight={fontWeight}
            height={height}
            index={index}
            item={item}
            key={item.content.id}
            plan={plan}
            portrait={portrait}
            time={time}
            width={width}
          />
        ))}
        <div
          {...cue}
          style={{
            inset: 0,
            opacity: labels,
            pointerEvents: "none",
            position: "absolute",
            visibility: labels > 0 ? "visible" : "hidden",
          }}
        >
          {plan.cards.map((item, index) => {
            const target = gridRect(
              index,
              plan.cards.length,
              width,
              height,
              portrait
            );
            return (
              <div
                data-design-id={`grid-label-${item.content.id}`}
                key={item.content.id}
                style={{
                  color,
                  fontFamily,
                  fontSize: width * (portrait ? 0.033 : 0.019),
                  fontWeight,
                  left: target.x,
                  lineHeight: 1.15,
                  position: "absolute",
                  top: target.y + target.height + height * 0.015,
                  width: target.width,
                }}
              >
                {item.content.label}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </Sequence>
  );
}

function ReviewedDetails(
  props: DetailsSequenceProps & {
    readonly controls: SequenceControls | undefined;
  }
) {
  return (
    <MotionReview availableFrames={props.availableFrames} plan={props.plan}>
      <DetailsContent {...props} />
    </MotionReview>
  );
}
function ReviewedCards(
  props: CardsSequenceProps & {
    readonly controls: SequenceControls | undefined;
  }
) {
  return (
    <MotionReview availableFrames={props.availableFrames} plan={props.plan}>
      <CardsContent {...props} />
    </MotionReview>
  );
}
const styleSchema = {
  ...sequenceStyleSchema,
  background: { default: "#f1f1f1", description: "Background", type: "color" },
  color: { default: "#1d1d1d", description: "Text", type: "color" },
} as const satisfies InteractivitySchema;
export const DetailsSequence = Interactive.withSchema<
  typeof styleSchema,
  DetailsSequenceProps
>({
  Component: ReviewedDetails,
  componentIdentity: null,
  componentName: "DetailsSequence",
  schema: styleSchema,
  supportsEffects: false,
});
export const CardsSequence = Interactive.withSchema<
  typeof styleSchema,
  CardsSequenceProps
>({
  Component: ReviewedCards,
  componentIdentity: null,
  componentName: "CardsSequence",
  schema: styleSchema,
  supportsEffects: false,
});
