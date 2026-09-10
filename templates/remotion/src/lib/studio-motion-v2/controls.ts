import type { InteractivitySchema } from "remotion";

export type Bezier = readonly [number, number, number, number];

export const curveField = (value: Bezier, description: string) =>
  ({
    default: value,
    description,
    item: { max: 1.5, min: -0.5, step: 0.01, type: "number" },
    maxLength: 4,
    minLength: 4,
    newItemDefault: 0,
    type: "array",
  }) as const;

export const sequenceStyleSchema = {
  background: { default: "#141414", description: "Background", type: "color" },
  color: { default: "#f5f3ef", description: "Text", type: "color" },
  fontFamily: {
    default: "Arial",
    description: "Typeface",
    type: "font-family",
  },
  fontSize: {
    default: undefined,
    description: "Preferred type size; content may fit smaller",
    hiddenFromList: false,
    max: 400,
    min: 12,
    step: 1,
    type: "number",
  },
  fontWeight: {
    default: 400,
    description: "Type weight",
    hiddenFromList: false,
    max: 900,
    min: 100,
    step: 100,
    type: "number",
  },
} as const satisfies InteractivitySchema;
