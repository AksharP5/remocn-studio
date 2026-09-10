import { Schema } from "effect";
import type { DesignFinding } from "./design";

export const VideoScene = Schema.Struct({
  from: Schema.Int,
  name: Schema.NonEmptyString,
  to: Schema.Int,
});

export type VideoScene = (typeof VideoScene)["Type"];

export const VideoCheck = Schema.Struct({
  camera: Schema.NullOr(Schema.NonEmptyString),
  scenes: Schema.Array(VideoScene),
});

export type VideoCheck = (typeof VideoCheck)["Type"];

export const MAX_VIDEO_SAMPLES = 240;
export const MAX_VIDEO_SCENES = 24;
export const MIN_VIDEO_STEP = 3;
export const MAX_VIDEO_STEP = 15;
export const BOUNDARY_GAP = 3;
export const FROZEN_INFO_FRAMES = 45;
export const RHYTHM_MIN_SPREAD = 0.15;
export const RHYTHM_MIN_SCENES = 3;
export const ACCENT_MIN_SCENES = 6;
export const ACCENT_SECONDS = 1.5;

export interface VideoElementState {
  readonly designId: string;
  readonly visible: boolean;
}

export interface VideoFrameProbe {
  readonly camera: string | null;
  readonly fingerprint: string;
  readonly ids: readonly VideoElementState[];
}

export interface VideoSample extends VideoFrameProbe {
  readonly frame: number;
}

export interface VideoBoundary {
  readonly after: number;
  readonly before: number;
  readonly left: number;
  readonly right: number;
}

export interface VideoPlan {
  readonly boundaries: readonly VideoBoundary[];
  readonly frames: readonly number[];
  readonly interiors: readonly number[];
  readonly timeline: readonly number[];
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function videoStep(frames: number): number {
  return clamp(
    Math.ceil(frames / MAX_VIDEO_SAMPLES),
    MIN_VIDEO_STEP,
    MAX_VIDEO_STEP
  );
}

function rangeOf(
  video: VideoCheck,
  last: number
): { end: number; start: number } {
  if (video.scenes.length === 0) {
    return { end: last, start: 0 };
  }

  const start = clamp(
    Math.min(...video.scenes.map((scene) => scene.from)),
    0,
    last
  );
  const end = clamp(
    Math.max(...video.scenes.map((scene) => scene.to)) - 1,
    start,
    last
  );
  return { end, start };
}

export function videoPlan(
  video: VideoCheck,
  durationInFrames: number,
  sampledFrames?: readonly number[]
): VideoPlan {
  const last = Math.max(0, durationInFrames - 1);
  const { end, start } = rangeOf(video, last);
  const step = videoStep(end - start + 1);

  const timeline: number[] = sampledFrames
    ? [...sampledFrames]
        .filter((frame) => frame >= start && frame <= end)
        .sort((a, b) => a - b)
    : [];
  if (!sampledFrames) {
    for (let frame = start; frame < end; frame += step) {
      timeline.push(frame);
    }
    timeline.push(end);
  }

  const interiors = video.scenes.map((scene) =>
    clamp(
      Math.round((scene.from + scene.to - 1) / 2),
      clamp(scene.from, 0, last),
      clamp(scene.to - 1, 0, last)
    )
  );

  const boundaries = video.scenes.slice(0, -1).map((scene, index) => {
    const next = video.scenes[index + 1] as VideoScene;
    const left = clamp(
      next.from - BOUNDARY_GAP,
      clamp(scene.from, 0, last),
      clamp(scene.to - 1, 0, last)
    );
    const right = clamp(
      scene.to + BOUNDARY_GAP,
      clamp(next.from, 0, last),
      clamp(next.to - 1, 0, last)
    );
    const usable = left < right;

    return {
      after: index + 1,
      before: index,
      left: usable ? left : (interiors[index] as number),
      right: usable ? right : (interiors[index + 1] as number),
    };
  });

  const frames = [
    ...new Set([
      ...timeline,
      ...interiors,
      ...boundaries.flatMap(({ left, right }) => [left, right]),
    ]),
  ]
    .map((frame) => clamp(frame, 0, last))
    .sort((first, second) => first - second);

  return { boundaries, frames: [...new Set(frames)], interiors, timeline };
}

export function videoCheckError(
  video: VideoCheck,
  durationInFrames: number
): string | null {
  if (durationInFrames < 2) {
    return "the whole-video check needs a composition of at least two frames";
  }
  if (video.scenes.length === 0) {
    return "the whole-video check needs at least one scene; a continuous shot can be one scene";
  }
  if (video.scenes.length > MAX_VIDEO_SCENES) {
    return `the whole-video check takes at most ${MAX_VIDEO_SCENES} scenes, and this map has ${video.scenes.length}`;
  }

  for (const [index, scene] of video.scenes.entries()) {
    if (scene.to <= scene.from) {
      return `scene ${scene.name} needs "to" greater than "from"`;
    }
    if (scene.to > durationInFrames) {
      return `scene ${scene.name} ends at frame ${scene.to}, past the composition's ${durationInFrames} frames`;
    }
    const previous = video.scenes[index - 1];
    if (previous !== undefined && scene.from <= previous.from) {
      return `the scene map must be ordered by "from": ${scene.name} starts at ${scene.from}, not after ${previous.name} at ${previous.from}`;
    }
  }

  const planned = videoPlan(video, durationInFrames).frames.length;
  if (planned > MAX_VIDEO_SAMPLES) {
    return `this video needs ${planned} samples, above the ${MAX_VIDEO_SAMPLES}-frame budget for one pass; check it in halves by passing the scenes of one half at a time`;
  }

  return null;
}

function finding(shape: {
  readonly code: DesignFinding["code"];
  readonly expected: string;
  readonly fix: string;
  readonly frames: readonly number[];
  readonly message: string;
  readonly observed: string;
  readonly selector?: string | null;
  readonly severity: DesignFinding["severity"];
}): DesignFinding {
  return {
    bbox: null,
    code: shape.code,
    expected: shape.expected,
    fix: shape.fix,
    frames: [...new Set(shape.frames)].sort((first, second) => first - second),
    message: shape.message,
    observed: shape.observed,
    selector: shape.selector ?? null,
    severity: shape.severity,
    text: null,
  };
}

function rhythmFinding(
  video: VideoCheck,
  plan: VideoPlan
): DesignFinding | null {
  const durations = video.scenes.map((scene) => scene.to - scene.from);
  if (durations.length < RHYTHM_MIN_SCENES) {
    return null;
  }

  const mean =
    durations.reduce((sum, value) => sum + value, 0) / durations.length;
  if (mean <= 0) {
    return null;
  }
  const variance =
    durations.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    durations.length;
  const spread = Math.sqrt(variance) / mean;
  const ratio = Math.max(...durations) / Math.min(...durations);

  if (spread >= RHYTHM_MIN_SPREAD) {
    return null;
  }

  return finding({
    code: "video_uniform_rhythm",
    expected:
      "Timing that supports the selected direction and reading windows; equal durations are valid.",
    fix: "Compare the rendered event sequence with the brief and primary reference. Change durations only where an action or result needs more or less time.",
    frames: plan.interiors,
    message:
      "The declared scene durations are nearly uniform; this does not measure the beats within each shot.",
    observed: `${durations.length} scenes of ${durations.join(", ")} frames — spread ${round2(spread)}, longest/shortest ${round2(ratio)}×.`,
    severity: "info",
  });
}

function accentFinding(
  video: VideoCheck,
  plan: VideoPlan,
  fps: number
): DesignFinding | null {
  const durations = video.scenes.map((scene) => scene.to - scene.from);
  if (durations.length < ACCENT_MIN_SCENES || fps <= 0) {
    return null;
  }

  const shortest = Math.min(...durations);
  const ceiling = ACCENT_SECONDS * fps;
  if (shortest <= ceiling) {
    return null;
  }

  return finding({
    code: "video_no_accent",
    expected:
      "Accents appropriate to the selected direction; a short cut is optional.",
    fix: "If the brief needs an accent, inspect whether an event within a shot already supplies it. Keep longer shots when they support comprehension.",
    frames: plan.interiors,
    message: `No declared scene is shorter than ${ACCENT_SECONDS}s; accents may occur within shots.`,
    observed: `The shortest of ${durations.length} scenes runs ${shortest} frames (${round2(shortest / fps)}s).`,
    severity: "info",
  });
}

function frozenFinding(
  plan: VideoPlan,
  samples: ReadonlyMap<number, VideoSample>
): DesignFinding | null {
  const finale = plan.timeline.at(-1);
  const opening = plan.timeline.at(0);
  let longest: { from: number; to: number } | null = null;
  let start: number | null = null;
  let previous: VideoSample | null = null;

  const settle = (end: number) => {
    if (start === null || start === end) {
      return;
    }
    if (end === finale && start !== opening) {
      return;
    }
    if (longest === null || end - start > longest.to - longest.from) {
      longest = { from: start, to: end };
    }
  };

  for (const frame of plan.timeline) {
    const sample = samples.get(frame);
    if (sample === undefined) {
      settle(previous?.frame ?? frame);
      start = null;
      previous = null;
      continue;
    }
    if (previous !== null && previous.fingerprint === sample.fingerprint) {
      start = start ?? previous.frame;
    } else {
      settle(previous?.frame ?? frame);
      start = null;
    }
    previous = sample;
  }
  settle(previous?.frame ?? 0);

  if (longest === null) {
    return null;
  }

  const held = longest as { from: number; to: number };
  const span = held.to - held.from;
  if (span < FROZEN_INFO_FRAMES) {
    return null;
  }

  return finding({
    code: "video_frozen_run",
    expected:
      "The intended action or reading hold; unchanged samples alone do not establish a defect.",
    fix: "Inspect this interval against the promised behavior. Keep a readable hold; if a required action is missing, fix its timing or frame-driven implementation.",
    frames: [held.from, held.to],
    message: `Nothing in the frame changed for ${span} frames.`,
    observed: `Every sampled frame from ${held.from} to ${held.to} carried the same fingerprint.`,
    severity: "info",
  });
}

function boundaryFindings(
  video: VideoCheck,
  plan: VideoPlan,
  samples: ReadonlyMap<number, VideoSample>
): DesignFinding[] {
  if (plan.boundaries.length === 0) {
    return [];
  }
  const tagged = [...samples.values()].some((sample) => sample.ids.length > 0);
  if (!tagged) {
    return [
      finding({
        code: "video_untagged",
        expected:
          "A stable data-design-id on every element you animate, so continuity across a cut can be measured.",
        fix: 'Add data-design-id="…" to the elements each scene animates and run the pass again.',
        frames: plan.boundaries.flatMap(({ left, right }) => [left, right]),
        message:
          "No element carried a data-design-id, so continuity across the cuts could not be judged.",
        observed: `None of the ${samples.size} sampled frames held a tagged element.`,
        severity: "info",
      }),
    ];
  }

  const measuredBoundaries = plan.boundaries.filter(
    (boundary) => samples.has(boundary.left) && samples.has(boundary.right)
  );
  const dead = measuredBoundaries.filter((boundary) => {
    const left = samples.get(boundary.left);
    const right = samples.get(boundary.right);
    if (left === undefined || right === undefined) {
      return false;
    }
    const living = new Set(
      left.ids.filter((entry) => entry.visible).map((entry) => entry.designId)
    );
    return !right.ids.some(
      (entry) => entry.visible && living.has(entry.designId)
    );
  });

  if (dead.length * 2 <= plan.boundaries.length) {
    return [];
  }

  const named = dead
    .slice(0, 6)
    .map(
      ({ after, before }) =>
        `${video.scenes[before]?.name ?? before} → ${video.scenes[after]?.name ?? after}`
    )
    .join(", ");

  return [
    finding({
      code: "video_boundary_dead",
      expected:
        "Understandable shot relationships; cuts to a new subject need no shared element.",
      fix: "Inspect these cuts against the intended relationship. For a promised shared-object handoff, verify geometry and ownership. A persistent background or matching id alone does not prove visual continuity.",
      frames: dead.flatMap(({ left, right }) => [left, right]),
      message: `${dead.length} of ${plan.boundaries.length} declared boundaries have no shared visible design id in the sampled frames.`,
      observed: `No matching visible design id on both sampled sides of: ${named}${dead.length > 6 ? `, and ${dead.length - 6} more` : ""}.`,
      severity: "info",
    }),
  ];
}

function cameraFindings(
  video: VideoCheck,
  plan: VideoPlan,
  samples: ReadonlyMap<number, VideoSample>
): DesignFinding[] {
  if (video.camera === null) {
    return [];
  }

  const seen = plan.timeline.flatMap((frame) => {
    const sample = samples.get(frame);
    return sample === undefined || sample.camera === null
      ? []
      : [sample.camera];
  });

  if (seen.length === 0) {
    return [
      finding({
        code: "video_static_camera",
        expected: `Exactly one element matching ${video.camera} on the sampled frames.`,
        fix: "Check the selector against the rendered scene; a camera wrapper should carry a stable data-design-id.",
        frames: [...plan.timeline],
        message:
          "The camera selector matched nothing, so the camera could not be verified.",
        observed: `${video.camera} matched no single element on any of the ${plan.timeline.length} sampled frames.`,
        selector: video.camera,
        severity: "warning",
      }),
    ];
  }

  if (seen.some((print) => print !== seen[0])) {
    return [];
  }

  return [
    finding({
      code: "video_static_camera",
      expected:
        "Framing that supports the intended subject; a locked camera is valid.",
      fix: "Compare the framing with the intended shot. Keep the locked view when it shows the subject; investigate timing or the selector only if a camera move was promised.",
      frames: [...plan.timeline],
      message: "The declared camera never moves.",
      observed: `${video.camera} held the same transform and box across all ${plan.timeline.length} sampled frames.`,
      selector: video.camera,
      severity: "info",
    }),
  ];
}

export function videoFindings(input: {
  readonly fps: number;
  readonly plan: VideoPlan;
  readonly samples: readonly VideoSample[];
  readonly video: VideoCheck;
}): DesignFinding[] {
  const byFrame = new Map(
    input.samples.map((sample) => [sample.frame, sample])
  );

  return [
    rhythmFinding(input.video, input.plan),
    accentFinding(input.video, input.plan, input.fps),
    frozenFinding(input.plan, byFrame),
    ...boundaryFindings(input.video, input.plan, byFrame),
    ...cameraFindings(input.video, input.plan, byFrame),
  ].filter((entry): entry is DesignFinding => entry !== null);
}

// This function is serialized into the Remotion render page, like the audit
// functions in design.ts: every helper stays inside, because imports and module
// closures do not cross the browser boundary. It only reads — the whole-video
// pass runs hundreds of times per call and must leave the page as it found it.
export function probeVideoFrame(camera: string | null): VideoFrameProbe {
  const round = (value: number) => Math.round(value * 100) / 100;
  const hash = (value: string) => {
    let result = 0;
    for (let index = 0; index < value.length; index += 1) {
      result = (result * 31 + value.charCodeAt(index)) % 4_294_967_296;
    }
    return String(result);
  };
  const opacityOf = (element: Element) => {
    let value = 1;
    let current: Element | null = element;
    while (current !== null && current !== document.documentElement) {
      const styles = getComputedStyle(current);
      if (styles.display === "none" || styles.visibility === "hidden") {
        return 0;
      }
      value *= Number.parseFloat(styles.opacity || "1");
      current = current.parentElement;
    }
    return value;
  };
  const onScreen = (rect: DOMRect) =>
    rect.width >= 2 &&
    rect.height >= 2 &&
    rect.right > 0 &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.top < window.innerHeight;
  const mediaHash = (element: HTMLCanvasElement | HTMLVideoElement) => {
    try {
      const rect = element.getBoundingClientRect();
      const sourceWidth =
        element instanceof HTMLVideoElement
          ? element.videoWidth
          : element.width || rect.width;
      const sourceHeight =
        element instanceof HTMLVideoElement
          ? element.videoHeight
          : element.height || rect.height;
      if (!(sourceWidth && sourceHeight)) {
        return "empty";
      }
      const canvas = document.createElement("canvas");
      canvas.width = 8;
      canvas.height = 8;
      const context = canvas.getContext("2d");
      if (context === null) {
        return "unreadable";
      }
      context.drawImage(element, 0, 0, 8, 8);
      const pixels = context.getImageData(0, 0, 8, 8).data;
      let result = 0;
      for (const pixel of pixels) {
        result = (result * 31 + pixel) % 4_294_967_296;
      }
      return String(result);
    } catch {
      return "unreadable";
    }
  };
  const signatureOf = (element: Element, rect: DOMRect) => {
    const styles = getComputedStyle(element);
    return [
      round(rect.left),
      round(rect.top),
      round(rect.width),
      round(rect.height),
      round(opacityOf(element)),
      styles.transform,
      styles.backgroundColor,
      styles.color,
      styles.fill,
      styles.stroke,
      hash(element.textContent ?? ""),
    ].join(",");
  };

  const fingerprint: string[] = [];
  for (const element of document.body.querySelectorAll("*")) {
    const rect = element.getBoundingClientRect();
    if (opacityOf(element) > 0.01 && onScreen(rect)) {
      fingerprint.push(signatureOf(element, rect));
    }
  }
  for (const media of document.body.querySelectorAll("canvas, video")) {
    if (
      (media instanceof HTMLCanvasElement ||
        media instanceof HTMLVideoElement) &&
      onScreen(media.getBoundingClientRect())
    ) {
      fingerprint.push(`pixels:${mediaHash(media)}`);
    }
  }

  const ids: VideoElementState[] = [];
  for (const element of [
    ...document.body.querySelectorAll("[data-design-id]"),
  ].slice(0, 200)) {
    const designId = element.getAttribute("data-design-id");
    if (designId === null || designId.length === 0) {
      continue;
    }
    const rect = element.getBoundingClientRect();
    ids.push({
      designId,
      visible: opacityOf(element) > 0.01 && onScreen(rect),
    });
  }

  let framed: string | null = null;
  if (camera !== null) {
    try {
      const found = [...document.body.querySelectorAll(camera)];
      const [element] = found;
      if (found.length === 1 && element !== undefined) {
        framed = signatureOf(element, element.getBoundingClientRect());
      }
    } catch {
      framed = null;
    }
  }

  return { camera: framed, fingerprint: fingerprint.join("|"), ids };
}
