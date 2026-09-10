import { createContext, type ReactNode, useContext, useId } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { Beat, Timeline } from "./timing";

const ReviewScope = createContext("");

/** Bind the rendered target to the same beat that drives its animation. */
export function useCue(beat: Beat) {
  const scope = useContext(ReviewScope);
  return { "data-motion-cue": `${scope}/${beat.id}` };
}

export interface MotionReviewProps {
  /** Same frame window passed to the enclosing Sequence, when shorter than the composition. */
  readonly availableFrames?: number;
  readonly children: ReactNode;
  readonly plan: Timeline;
}

/** Keep this mounted for the whole sequence, outside conditional rendering of its children. */
export function MotionReview({
  children,
  plan,
  availableFrames,
}: MotionReviewProps) {
  const id = useId();
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const contract = {
    cues: plan.beats.map((beat) => ({
      ...beat,
      id: `${id}/${beat.id}`,
      ...(beat.slot === undefined ? {} : { slot: `${id}/${beat.slot}` }),
      ...(beat.parent === undefined ? {} : { parent: `${id}/${beat.parent}` }),
    })),
    duration: plan.duration,
    id,
    version: 2,
    window: (availableFrames ?? durationInFrames) / fps,
  };
  return (
    <ReviewScope.Provider value={id}>
      <span
        aria-hidden="true"
        data-studio-motion-frame={frame}
        data-studio-motion-plan={JSON.stringify(contract)}
        style={{ display: "none" }}
      />
      {children}
    </ReviewScope.Provider>
  );
}
