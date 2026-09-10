import {
  type Beat,
  type ReadingOptions,
  readingSeconds,
  sequence,
  type Timeline,
} from "./timing";

export type Energy = "calm" | "brisk";

const gestures = {
  brisk: { enter: 0.42, exit: 0.28 },
  calm: { enter: 0.64, exit: 0.38 },
} as const;

export interface PlanOptions {
  readonly energy?: Energy;
  readonly reading?: ReadingOptions;
}

function content(text: string, field: string): string {
  if (text.trim().length === 0) {
    throw new Error(`${field} needs non-empty text`);
  }
  return text;
}

export interface PhrasePlan extends Timeline {
  readonly kind: "phrases";
  readonly phrases: readonly { readonly text: string; readonly beat: Beat }[];
}

/** Energy changes the gesture, not the estimated time needed to read the copy. */
export function phrasePlan(
  texts: readonly string[],
  options: PlanOptions = {}
): PhrasePlan {
  const motion = gestures[options.energy ?? "calm"];
  const timeline = sequence(
    texts.map((text, index) => ({
      enter: motion.enter,
      exit: index === texts.length - 1 ? 0 : motion.exit,
      hold: readingSeconds(
        content(text, `phrase ${index + 1}`),
        options.reading
      ),
      id: `phrase-${index + 1}`,
      // Two phrases share one reading position; hand it over after the exit.
      overlap: 0,
    }))
  );
  return {
    ...timeline,
    kind: "phrases",
    phrases: texts.map((text, index) => ({
      beat: timeline.beats[index],
      text,
    })),
  };
}

export interface ImagePlan extends Timeline {
  readonly caption: string;
  readonly captionBeat: Beat;
  readonly imageBeat: Beat;
  readonly kind: "image";
  readonly title: string;
  readonly titleBeat: Beat;
}

export function imagePlan(
  title: string,
  caption: string,
  options: PlanOptions = {}
): ImagePlan {
  const motion = gestures[options.energy ?? "calm"];
  const timeline = sequence([
    {
      enter: motion.enter,
      exit: motion.exit,
      hold: readingSeconds(content(title, "title"), options.reading),
      id: "title",
    },
    // The caption resolves after the image, so its reading time starts later.
    {
      enter: 0.72,
      exit: 0,
      hold:
        0.48 +
        Math.max(
          1.4,
          readingSeconds(content(caption, "caption"), options.reading)
        ),
      id: "image",
    },
  ]);
  const [titleBeat, imageBeat] = timeline.beats;
  const captionBeat = {
    end: imageBeat.end,
    exitStart: imageBeat.end,
    id: "caption",
    settled: imageBeat.settled + 0.48,
    start: imageBeat.settled + 0.12,
  };
  return {
    ...timeline,
    beats: [...timeline.beats, captionBeat],
    caption,
    captionBeat,
    imageBeat,
    kind: "image",
    title,
    titleBeat,
  };
}

export interface MetricPlan extends Timeline {
  readonly kind: "metric";
  readonly label: string;
  readonly metricBeat: Beat;
  readonly statement: string;
  readonly statementBeat: Beat;
  readonly value: number;
}

export function metricPlan(
  value: number,
  label: string,
  statement: string,
  options: PlanOptions = {}
): MetricPlan {
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000) {
    throw new Error(
      "Metric value must be finite and between 0 and 1,000,000,000"
    );
  }
  const timeline = sequence([
    {
      enter: options.energy === "brisk" ? 0.92 : 1.28,
      exit: 0.64,
      hold: Math.max(
        1.2,
        readingSeconds(content(label, "label"), options.reading)
      ),
      id: "metric",
    },
    {
      enter: 0.64,
      exit: 0,
      hold: readingSeconds(content(statement, "statement"), options.reading),
      id: "statement",
      overlap: 0,
    },
  ]);
  return {
    ...timeline,
    kind: "metric",
    label,
    metricBeat: timeline.beats[0],
    statement,
    statementBeat: timeline.beats[1],
    value,
  };
}
