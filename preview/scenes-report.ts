import { useCallback, useEffect, useRef } from "react";
import { post } from "./bridge";
import {
  type RegisteredSequence,
  type Scene,
  sameScenes,
  scenesOf,
} from "./scenes";

export function useSceneObserver(
  composition: string,
  durationInFrames: number
): (sequences: readonly unknown[]) => void {
  const posted = useRef<readonly Scene[]>([]);
  const latest = useRef<readonly unknown[]>([]);
  const scheduled = useRef(0);

  const flush = useCallback(() => {
    scheduled.current = 0;
    const scenes = scenesOf(
      latest.current as readonly RegisteredSequence[],
      durationInFrames
    );
    if (!sameScenes(scenes, posted.current)) {
      posted.current = scenes;
      post({ compositionId: composition, scenes, type: "scenes" });
    }
  }, [composition, durationInFrames]);

  useEffect(() => {
    posted.current = [];
    return () => cancelAnimationFrame(scheduled.current);
  }, []);

  return useCallback(
    (sequences: readonly unknown[]) => {
      latest.current = sequences;
      if (scheduled.current === 0) {
        scheduled.current = requestAnimationFrame(flush);
      }
    },
    [flush]
  );
}
