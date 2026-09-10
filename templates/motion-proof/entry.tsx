import { AbsoluteFill, Composition, registerRoot, staticFile } from "remotion";
import { cases, type ProofCase } from "./cases";
import {
  ImageSequence,
  MetricSequence,
  PhraseSequence,
} from "./studio-motion-v1/recipes";
import { durationFrames } from "./studio-motion-v1/timing";

function Proof({ item, blank = false }: { item: ProofCase; blank?: boolean }) {
  if (blank) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: item.plan.kind === "metric" ? "#f4efe6" : "#141414",
        }}
      />
    );
  }
  const common = { fontFamily: "MotionProof", fontWeight: 400 };
  return (
    <>
      <style>{`@font-face { font-family: MotionProof; src: url('${staticFile("Manrope.ttf")}') format('truetype'); font-weight: 200 800; font-style: normal; font-display: block; }`}</style>
      {item.plan.kind === "phrases" ? (
        <PhraseSequence {...common} effect="mask" plan={item.plan} />
      ) : null}
      {item.plan.kind === "image" ? (
        <ImageSequence
          {...common}
          plan={item.plan}
          src={staticFile(
            item.height > item.width ? "photo-portrait.jpg" : "photo.jpg"
          )}
        />
      ) : null}
      {item.plan.kind === "metric" ? (
        <MetricSequence {...common} plan={item.plan} suffix="" />
      ) : null}
    </>
  );
}

function Root() {
  return (
    <>
      {cases.map((item) => (
        <Composition
          component={Proof}
          defaultProps={{ item }}
          durationInFrames={durationFrames(item.plan.duration, item.fps)}
          fps={item.fps}
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
