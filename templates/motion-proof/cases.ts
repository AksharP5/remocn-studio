import {
  imagePlan,
  metricPlan,
  phrasePlan,
} from "../remotion/src/lib/studio-motion-v1/plans";

const short = phrasePlan([
  "Make room for an idea.",
  "Give it a shape.",
  "Let it move.",
]);
const long = phrasePlan([
  "A small idea can change the way we see the whole picture.",
  "Give the important details enough room to be understood.",
]);
const russian = phrasePlan([
  "Сначала появляется смысл.",
  "Движение помогает его увидеть.",
  "Всё на своём месте.",
]);
const picture = imagePlan(
  "A different perspective.",
  "A closer look at the details that matter."
);
const metric = metricPlan(
  82,
  "Frames assembled.",
  "Every part finds its place."
);

export const cases = [
  { fps: 30, height: 720, id: "type-short-30", plan: short, width: 1280 },
  { fps: 60, height: 720, id: "type-short-60", plan: short, width: 1280 },
  { fps: 30, height: 720, id: "type-long-30", plan: long, width: 1280 },
  { fps: 30, height: 1280, id: "type-portrait-30", plan: long, width: 720 },
  { fps: 24, height: 1280, id: "type-cyrillic-24", plan: russian, width: 720 },
  { fps: 30, height: 720, id: "image-30", plan: picture, width: 1280 },
  { fps: 60, height: 720, id: "image-60", plan: picture, width: 1280 },
  { fps: 30, height: 1280, id: "image-portrait-30", plan: picture, width: 720 },
  { fps: 30, height: 720, id: "metric-30", plan: metric, width: 1280 },
  { fps: 60, height: 720, id: "metric-60", plan: metric, width: 1280 },
  { fps: 30, height: 1280, id: "metric-portrait-30", plan: metric, width: 720 },
] as const;

export type ProofCase = (typeof cases)[number];
