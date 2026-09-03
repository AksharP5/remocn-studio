# Tunable text

Answers "what shape does a run of text take so the person can edit it without
reading code". Read before writing any component that puts words on screen.

The studio's properties pane edits the props the markup hands it, at runtime.
It cannot rewrite your source, so a value nailed shut in the body is a value
nobody will ever change. Three consequences shape every text component:

1. **One run of text is one named `Interactive.*` text element** whose direct
   child is the string. `Interactive.H1`, `Interactive.P`, `Interactive.Span`.
2. **Typography is literals in that element's own `style`** — font size, weight,
   colour, letter spacing (a number, in px) and line height — so the pane can
   read them, show them, and write them back.
3. **The `name` is unique in the frame and equals the `data-design-id`.** Two
   elements sharing a name are one row in the pane, and the person cannot tell
   which of them they are editing.

## The worked example

`Headline` is the whole shape: one string, one named element, literal
typography, an entry curve as a bounded four-number array, and an exit that
only exists when the enum variant that owns it is chosen.

```tsx
import { useRef } from "react";
import {
  Easing,
  Interactive,
  type InteractivitySchema,
  interpolate,
  Sequence,
  type SequenceControls,
  useCurrentFrame,
} from "remotion";

const headlineSchema = {
  entryEasing: {
    default: [0.33, 1, 0.68, 1],
    description: "Curve the headline arrives on",
    item: { max: 1.5, min: -0.5, step: 0.01, type: "number" },
    maxLength: 4,
    minLength: 4,
    newItemDefault: 0,
    type: "array",
  },
  entryFrames: {
    default: 18,
    description: "Frames the entry takes",
    hiddenFromList: false,
    max: 90,
    min: 1,
    step: 1,
    type: "number",
  },
  exit: {
    default: "none",
    description: "How the headline leaves",
    type: "enum",
    variants: {
      fade: {
        exitAt: {
          default: 90,
          description: "Frame the exit starts",
          hiddenFromList: false,
          max: 600,
          min: 1,
          step: 1,
          type: "number",
        },
        exitEasing: {
          default: [0.64, 0, 0.78, 0],
          description: "Curve the exit accelerates on",
          item: { max: 1.5, min: -0.5, step: 0.01, type: "number" },
          maxLength: 4,
          minLength: 4,
          newItemDefault: 0,
          type: "array",
        },
        exitFrames: {
          default: 10,
          description: "Frames the exit takes",
          hiddenFromList: false,
          max: 120,
          min: 1,
          step: 1,
          type: "number",
        },
      },
      none: {},
    },
  },
  slideFrom: {
    default: -96,
    description: "Horizontal travel the headline arrives over, in pixels",
    hiddenFromList: false,
    max: 960,
    min: -960,
    step: 2,
    type: "number",
  },
  "style.color": {
    default: "#f6f3ee",
    description: "Text color",
    type: "color",
  },
  "style.fontSize": {
    default: 96,
    description: "Type size in pixels",
    hiddenFromList: false,
    max: 400,
    min: 24,
    step: 2,
    type: "number",
  },
  "style.fontWeight": {
    default: 700,
    description: "Type weight",
    hiddenFromList: false,
    max: 900,
    min: 100,
    step: 100,
    type: "number",
  },
  "style.letterSpacing": {
    default: -1.5,
    description: "Tracking in pixels",
    hiddenFromList: false,
    max: 20,
    min: -20,
    step: 0.1,
    type: "number",
  },
  "style.lineHeight": {
    default: 0.95,
    description: "Line height",
    hiddenFromList: false,
    max: 3,
    min: 0.6,
    step: 0.01,
    type: "number",
  },
} as const satisfies InteractivitySchema;

type Bezier = readonly [number, number, number, number];

interface HeadlineProps {
  readonly entryEasing?: Bezier;
  readonly entryFrames?: number;
  readonly exit?: "fade" | "none";
  readonly exitAt?: number;
  readonly exitEasing?: Bezier;
  readonly exitFrames?: number;
  readonly from?: number;
  readonly name: string;
  readonly slideFrom?: number;
  readonly text: string;
}

function HeadlineBase({
  controls,
  entryEasing = [0.33, 1, 0.68, 1],
  entryFrames = 18,
  exit = "none",
  exitAt = 90,
  exitEasing = [0.64, 0, 0.78, 0],
  exitFrames = 10,
  from = 0,
  name,
  slideFrom = -96,
  text,
}: HeadlineProps & { readonly controls: SequenceControls | undefined }) {
  const outlineRef = useRef<HTMLDivElement>(null);
  const frame = useCurrentFrame();

  const arrive = interpolate(frame, [0, entryFrames], [0, 1], {
    easing: Easing.bezier(...entryEasing),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const leave = interpolate(frame, [exitAt, exitAt + exitFrames], [0, 1], {
    easing: Easing.bezier(...exitEasing),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const gone = exit === "fade" ? leave : 0;

  return (
    <Sequence
      controls={controls}
      from={from}
      layout="none"
      name={name}
      outlineRef={outlineRef}
    >
      <div ref={outlineRef} style={{ position: "relative" }}>
        <Interactive.H1
          data-design-id={name}
          name={name}
          style={{
            color: "#f6f3ee",
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: -1.5,
            lineHeight: 0.95,
            margin: 0,
            opacity: Math.max(
              0,
              interpolate(frame, [0, 8], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }) *
                (1 - gone)
            ),
            translate: `${interpolate(arrive, [0, 1], [slideFrom, 0])}px 0px`,
          }}
        >
          {text}
        </Interactive.H1>
      </div>
    </Sequence>
  );
}

export const Headline = Interactive.withSchema<
  typeof headlineSchema,
  HeadlineProps
>({
  Component: HeadlineBase,
  componentIdentity: null,
  componentName: "Headline",
  schema: headlineSchema,
  supportsEffects: false,
});
```

Four things in that file are the whole lesson:

- **The travel is on X.** `translate: "…px 0px"`, never a Y offset and never
  `transform: translateY(…)` — `video-lessons` §2: text on Y snaps its glyph
  baselines. Panels and images may travel on Y; words may not.
- **Opacity and the travel do not share a range.** The fade runs `[0, 8]`, the
  travel runs over `entryFrames`.
- **`exitEasing` lives inside the `fade` variant.** A curve exists only where it
  is sampled: with `exit: "none"` there is nothing to tune, so the pane offers
  nothing — where a top-level `exitEasing` beside an `exitAt` that defaults to 0
  is a control that moves nothing, and `design_check` reports it as
  `tunability_inert_easing`.
- **The literals in `style` equal the schema defaults.** The pane reads the
  rendered value; a literal that disagrees with the declared default shows the
  person a number their reset button will not restore.

## Several lines are several named components, not a `.map()`

A `.map()` over lines gives every instance the same `name`, and Remotion keys
one `overrideId` per JSX call site — so the pane sees one element where the
frame has three, and an edit to any of them moves all of them.

```tsx
export function Stack() {
  return (
    <>
      <Headline from={0} name="Claim line 1" text="Sponsor the film" />
      <Headline from={6} name="Claim line 2" text="Not the channel" />
      <Headline from={12} name="Claim line 3" text="One take, one cut" />
    </>
  );
}
```

If the content genuinely has to come from an array, the name carries the index
or the content — `name={`Claim line ${index + 1}`}` — never one literal string
for the whole map. `design_check` reports the literal as
`tunability_mapped_primitive_name`.

## Splitting a run into words

A stagger needs the words apart; the person still needs the sentence whole. So
the split lives **inside** the component and the whole string arrives as one
`text` prop. The spans it renders are plain, because they are already inside
the named primitive the pane opens on.

```tsx
function WordsBody({
  color,
  fontSize,
  stagger,
  text,
  wordEasing,
}: {
  readonly color: string;
  readonly fontSize: number;
  readonly stagger: number;
  readonly text: string;
  readonly wordEasing: Bezier;
}) {
  const frame = useCurrentFrame();
  const words = text.trim().split(/\s+/).filter(Boolean);

  return (
    <Interactive.Span
      data-design-id="Words"
      name="Words"
      style={{
        color: "#f6f3ee",
        display: "inline-block",
        fontSize: 72,
        fontWeight: 600,
        letterSpacing: -1,
        lineHeight: 1.05,
      }}
    >
      {words.map((word, index) => (
        <span
          key={word + String(index)}
          style={{
            display: "inline-block",
            marginRight: "0.24em",
            opacity: interpolate(frame, [index * stagger, index * stagger + 6], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            translate: `${
              interpolate(frame, [index * stagger, index * stagger + 12], [1, 0], {
                easing: Easing.bezier(...wordEasing),
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }) * fontSize
            }px 0px`,
            whiteSpace: "pre",
          }}
        >
          {word}
        </span>
      ))}
    </Interactive.Span>
  );
}
```

On **Remotion 4.0.513 or newer** the string itself becomes a field in the pane.
Declare it in the schema and the person edits the sentence without a chat turn:

```
  text: {
    default: "Sponsor the film, not the channel",
    description: "The sentence",
    type: "text-content",
  },
```

## What this cannot give you below 4.0.513

`type: "text-content"` does not exist before 4.0.513, and a schema that declares
it on an older Remotion is a type error rather than a degraded field. On an
older project:

- Keep the `text` prop, the split inside the component and the named
  `Interactive.*` element. Everything above still works; only the string is not
  editable from the pane.
- Changing the words is a sentence in the chat. Changing the typography, the
  curve, the travel and the timing is not — those are already props.
- Do not substitute an enum of candidate strings for the missing field. It
  reads as a control and holds one of its own options and nothing else, which
  is the same mistake as an enum of easing names.

Never fail a turn over the version: write the shape the project can express and
say in your answer which part its Remotion is too old for.
