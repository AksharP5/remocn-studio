import type { PreviewScene } from "./preview";

export const MIN_LABEL_WIDTH = 48;

export interface SeekSegment {
  from: number;
  id: string;
  labeled: boolean;
  left: number;
  name: string;
  width: number;
}

export function segmentsOf(
  scenes: readonly PreviewScene[],
  totalFrames: number,
  barWidth: number
): SeekSegment[] {
  if (scenes.length < 2 || totalFrames <= 0) {
    return [];
  }
  const ordered = [...scenes].sort((one, two) => one.from - two.from);
  return ordered.map((scene, index) => {
    const from = Math.max(0, Math.min(totalFrames, scene.from));
    const next = ordered[index + 1]?.from ?? totalFrames;
    const end = Math.max(
      from,
      Math.min(totalFrames, next, scene.from + scene.duration)
    );
    const width = ((end - from) / totalFrames) * 100;
    return {
      from,
      id: scene.id,
      labeled: (width / 100) * barWidth >= MIN_LABEL_WIDTH,
      left: (from / totalFrames) * 100,
      name: scene.name,
      width,
    };
  });
}
