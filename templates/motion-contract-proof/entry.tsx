import {
  AbsoluteFill,
  Composition,
  registerRoot,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { cardsPlan, detailsPlan } from "./studio-motion-v2/combination-plans";
import {
  CardsSequence,
  DetailsSequence,
} from "./studio-motion-v2/combinations";
import { imagePlan, metricPlan, phrasePlan } from "./studio-motion-v2/plans";
import {
  ImageSequence,
  MetricSequence,
  PhraseSequence,
} from "./studio-motion-v2/recipes";
import { MotionReview, useCue } from "./studio-motion-v2/review";
import { MotionText } from "./studio-motion-v2/text";
import { durationFrames, type Timeline } from "./studio-motion-v2/timing";

const phrases = phrasePlan([
  "We find ways of business growth",
  "through brand design and web development.",
]);
const details = detailsPlan("Branding", [
  "Brand identity",
  "Guidelines",
  "Packaging",
  "Illustrations",
]);
const longDetails = detailsPlan("Make the important details clear", [
  "Research and discovery",
  "Brand identity",
  "Guidelines",
  "Packaging",
  "Illustrations",
  "Digital experiences",
]);
const cards = cardsPlan([
  {
    id: "grid",
    label: "Perspective",
    src: staticFile("photo.jpg"),
    title: "A clear view of the whole picture",
  },
  {
    id: "one",
    label: "Framing",
    src: staticFile("photo-portrait.jpg"),
    title: "A different way to frame the subject",
  },
  {
    id: "one-caption",
    label: "Collection",
    src: staticFile("photo.jpg"),
    title: "The details become a coherent collection",
  },
]);
const image = imagePlan(
  "A different perspective",
  "A closer look at the details that matter"
);
const metric = metricPlan(82, "Frames assembled", "Every part finds its place");
const brokenPhrases: Timeline = {
  beats: [
    {
      end: 1.6,
      exitStart: 1.2,
      id: "first",
      settled: 0.4,
      slot: "headline",
      start: 0,
    },
    {
      end: 3,
      exitStart: 3,
      id: "next",
      settled: 1.8,
      slot: "headline",
      start: 1.4,
    },
  ],
  duration: 3,
};
const brokenCaption: Timeline = {
  beats: [{ end: 2.3, exitStart: 2, id: "caption", settled: 0.3, start: 0 }],
  duration: 3,
};
const clipped: Timeline = {
  beats: [{ end: 3, exitStart: 3, id: "clipped", settled: 0.4, start: 0 }],
  duration: 3,
};
function ClippedContent() {
  const cue = useCue(clipped.beats[0]);
  const time = useCurrentFrame() / useVideoConfig().fps;
  return (
    <AbsoluteFill style={{ backgroundColor: "#f1f1f1" }}>
      <div
        {...cue}
        data-motion-phase={time < 0.4 ? "enter" : "hold"}
        style={{ left: 80, position: "absolute", top: 160 }}
      >
        <div
          data-motion-mask="reveal"
          style={{ height: 100, overflow: "hidden", width: 240 }}
        >
          <span
            style={{
              color: "#1d1d1d",
              fontFamily: "Arial",
              fontSize: 64,
              whiteSpace: "nowrap",
            }}
          >
            This text stays clipped
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
}
function Broken({ plan, cut = false }: { plan: Timeline; cut?: boolean }) {
  return (
    <MotionReview plan={plan}>
      <BrokenContent cut={cut} plan={plan} />
    </MotionReview>
  );
}
function BrokenContent({ plan, cut }: { plan: Timeline; cut: boolean }) {
  const time = useCurrentFrame() / useVideoConfig().fps;
  return (
    <AbsoluteFill style={{ backgroundColor: "#f1f1f1" }}>
      {plan.beats.map((beat, index) =>
        cut && time >= 2 ? null : (
          <MotionText
            beat={beat}
            box={{ height: 160, width: 800, x: 80, y: 160 }}
            color="#1d1d1d"
            effect="fade"
            key={beat.id}
            text={index === 0 ? "business growth" : "through brand design"}
            time={time}
            typography={{ fontFamily: "Arial", fontSize: 64, minFontSize: 40 }}
          />
        )
      )}
    </AbsoluteFill>
  );
}
const cases = [
  {
    component: () => (
      <MotionReview plan={clipped}>
        <ClippedContent />
      </MotionReview>
    ),
    height: 540,
    id: "broken-clipping",
    plan: clipped,
    width: 960,
  },
  {
    component: () => (
      <PhraseSequence background="#f1f1f1" color="#1d1d1d" plan={phrases} />
    ),
    height: 540,
    id: "phrases",
    plan: phrases,
    width: 960,
  },
  {
    component: () => <DetailsSequence plan={details} />,
    height: 540,
    id: "details",
    plan: details,
    width: 960,
  },
  {
    component: () => <DetailsSequence plan={longDetails} />,
    height: 960,
    id: "details-portrait",
    plan: longDetails,
    width: 540,
  },
  {
    component: () => <CardsSequence plan={cards} />,
    height: 540,
    id: "cards",
    plan: cards,
    width: 960,
  },
  {
    component: () => <CardsSequence plan={cards} />,
    height: 960,
    id: "cards-portrait",
    plan: cards,
    width: 540,
  },
  {
    component: () => (
      <ImageSequence plan={image} src={staticFile("photo.jpg")} />
    ),
    height: 540,
    id: "image",
    plan: image,
    width: 960,
  },
  {
    component: () => <MetricSequence plan={metric} />,
    height: 540,
    id: "metric",
    plan: metric,
    width: 960,
  },
  {
    component: () => <Broken plan={brokenPhrases} />,
    height: 540,
    id: "broken-phrases",
    plan: brokenPhrases,
    width: 960,
  },
  {
    component: () => <Broken cut plan={brokenCaption} />,
    height: 540,
    id: "broken-caption",
    plan: brokenCaption,
    width: 960,
  },
];
function Root() {
  return (
    <>
      {cases.map((item) => (
        <Composition
          component={item.component}
          durationInFrames={durationFrames(item.plan.duration, 30)}
          fps={30}
          height={item.height}
          id={item.id}
          key={item.id}
          width={item.width}
        />
      ))}
    </>
  );
}
registerRoot(Root);
