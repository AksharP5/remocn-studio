export const GEOMETRY_KEYS = ["x", "y", "width", "height", "rotation"] as const;
export type GeometryKey = (typeof GEOMETRY_KEYS)[number];
export type GeometryValues = Record<GeometryKey, number>;
export type GeometryBinding = Record<
  Exclude<GeometryKey, "rotation">,
  string
> & {
  rotation: string | null;
};
export interface GeometryField {
  id: string;
  max: number | null;
  min: number | null;
  value: number;
}
export interface GeometryPose {
  multiplier: GeometryValues;
  offset: GeometryValues;
  scale: number;
}

export const IDENTITY_GEOMETRY_POSE: GeometryPose = {
  multiplier: { height: 1, rotation: 1, width: 1, x: 1, y: 1 },
  offset: { height: 0, rotation: 0, width: 0, x: 0, y: 0 },
  scale: 1,
};

/** A scene declares this mapping; DOM measurements never become saved values. */
export function poseGeometry(
  values: GeometryValues,
  pose: GeometryPose
): GeometryValues {
  return Object.fromEntries(
    GEOMETRY_KEYS.map((key) => [
      key,
      values[key] * pose.multiplier[key] + pose.offset[key],
    ])
  ) as GeometryValues;
}

export function unposeGeometry(
  values: GeometryValues,
  pose: GeometryPose
): GeometryValues {
  return Object.fromEntries(
    GEOMETRY_KEYS.map((key) => [
      key,
      (values[key] - pose.offset[key]) / pose.multiplier[key],
    ])
  ) as GeometryValues;
}
export type GeometryHandle =
  | "move"
  | "rotate"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "nw";

const radians = (degrees: number) => (degrees * Math.PI) / 180;
const round = (value: number) => Math.round(value * 100) / 100;

type GeometryBounds = Partial<
  Record<GeometryKey, { min: number | null; max: number | null }>
>;

function handleSign(
  handle: GeometryHandle,
  positive: string,
  negative: string
): number {
  if (handle.includes(positive)) {
    return 1;
  }
  if (handle.includes(negative)) {
    return -1;
  }
  return 0;
}

function lockedAxis(dx: number, dy: number, shift: boolean) {
  if (!shift) {
    return { dx, dy };
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { dx, dy: 0 };
  }
  return { dx: 0, dy };
}

function proportionalSize(
  before: GeometryValues,
  bounds: GeometryBounds,
  localX: number,
  localY: number,
  width: number,
  height: number
) {
  const factor =
    Math.abs(localX / before.width) >= Math.abs(localY / before.height)
      ? width / before.width
      : height / before.height;
  const min = Math.max(
    Math.max(1, bounds.width?.min ?? 1) / before.width,
    Math.max(1, bounds.height?.min ?? 1) / before.height
  );
  const max = Math.min(
    (bounds.width?.max ?? Number.POSITIVE_INFINITY) / before.width,
    (bounds.height?.max ?? Number.POSITIVE_INFINITY) / before.height
  );
  const ratio = Math.min(max, Math.max(min, factor));
  return { height: before.height * ratio, width: before.width * ratio };
}

/** Pointer deltas are in the unrotated parent's coordinates, not screen pixels. */
export function transformGeometry(
  before: GeometryValues,
  handle: GeometryHandle,
  dx: number,
  dy: number,
  shift: boolean,
  bounds: GeometryBounds,
  angle = 0,
  scale = 1
): GeometryValues {
  const limit = (key: GeometryKey, value: number) =>
    Math.min(
      bounds[key]?.max ?? Number.POSITIVE_INFINITY,
      Math.max(
        bounds[key]?.min ??
          (key === "width" || key === "height" ? 1 : Number.NEGATIVE_INFINITY),
        value
      )
    );
  if (handle === "rotate") {
    const rotation = before.rotation + angle;
    return {
      ...before,
      rotation: limit(
        "rotation",
        shift ? Math.round(rotation / 15) * 15 : before.rotation + round(angle)
      ),
    };
  }
  if (handle === "move") {
    const locked = lockedAxis(dx, dy, shift);
    return {
      ...before,
      x: limit("x", before.x + round(locked.dx)),
      y: limit("y", before.y + round(locked.dy)),
    };
  }
  const cos = Math.cos(radians(before.rotation));
  const sin = Math.sin(radians(before.rotation));
  const localX = (cos * dx + sin * dy) / scale;
  const localY = (-sin * dx + cos * dy) / scale;
  const horizontal = handleSign(handle, "e", "w");
  const vertical = handleSign(handle, "s", "n");
  let width = Math.max(1, limit("width", before.width + horizontal * localX));
  let height = Math.max(1, limit("height", before.height + vertical * localY));
  if (shift && horizontal && vertical) {
    ({ height, width } = proportionalSize(
      before,
      bounds,
      localX,
      localY,
      width,
      height
    ));
  }
  const dw = width - before.width;
  const dh = height - before.height;
  const centerX =
    scale * ((cos * horizontal * dw) / 2 - (sin * vertical * dh) / 2);
  const centerY =
    scale * ((sin * horizontal * dw) / 2 + (cos * vertical * dh) / 2);
  const x = before.x + centerX - dw / 2;
  const y = before.y + centerY - dh / 2;
  // Reject a constrained position instead of letting the opposite edge drift.
  if (limit("x", x) !== x || limit("y", y) !== y) {
    return before;
  }
  return { ...before, height, width, x, y };
}

export interface SnapLine {
  at: number;
  from: number;
  to: number;
}
export interface SnapBox {
  bottom: number;
  left: number;
  right: number;
  top: number;
}
export type SnapSide = "start" | "center" | "end";
export interface SnapLines {
  x: readonly SnapLine[];
  y: readonly SnapLine[];
}
export interface Snapped {
  dx: number;
  dy: number;
  guides: { x: SnapLine | null; y: SnapLine | null };
}

export function snapLinesOf(rects: readonly SnapBox[]): SnapLines {
  return {
    x: rects.flatMap((rect) =>
      [rect.left, (rect.left + rect.right) / 2, rect.right].map((at) => ({
        at,
        from: rect.top,
        to: rect.bottom,
      }))
    ),
    y: rects.flatMap((rect) =>
      [rect.top, (rect.top + rect.bottom) / 2, rect.bottom].map((at) => ({
        at,
        from: rect.left,
        to: rect.right,
      }))
    ),
  };
}

function handleSide(
  handle: GeometryHandle,
  start: string,
  end: string
): SnapSide | null {
  if (handle.includes(start)) {
    return "start";
  }
  if (handle.includes(end)) {
    return "end";
  }
  return null;
}

function sideEdge(side: SnapSide, start: number, end: number): number {
  if (side === "start") {
    return start;
  }
  if (side === "end") {
    return end;
  }
  return (start + end) / 2;
}

export function snapSides(
  handle: GeometryHandle,
  shift: boolean
): { x: readonly SnapSide[]; y: readonly SnapSide[] } {
  if (handle === "move") {
    return {
      x: ["start", "center", "end"],
      y: ["start", "center", "end"],
    };
  }
  const horizontal = handleSide(handle, "w", "e");
  const vertical = handleSide(handle, "n", "s");
  if (handle === "rotate" || (shift && horizontal && vertical)) {
    return { x: [], y: [] };
  }
  return {
    x: horizontal ? [horizontal] : [],
    y: vertical ? [vertical] : [],
  };
}

export function snapBox(
  box: SnapBox,
  lines: SnapLines,
  sides: { x: readonly SnapSide[]; y: readonly SnapSide[] },
  threshold: number
): Snapped {
  const along = (
    start: number,
    end: number,
    candidates: readonly SnapLine[],
    wanted: readonly SnapSide[]
  ) => {
    let best: { offset: number; line: SnapLine } | null = null;
    for (const side of wanted) {
      const edge = sideEdge(side, start, end);
      for (const line of candidates) {
        const offset = line.at - edge;
        if (
          Math.abs(offset) <= threshold &&
          (best === null || Math.abs(offset) < Math.abs(best.offset))
        ) {
          best = { line, offset };
        }
      }
    }
    return best;
  };
  const x = along(box.left, box.right, lines.x, sides.x);
  const y = along(box.top, box.bottom, lines.y, sides.y);
  const dx = x?.offset ?? 0;
  const dy = y?.offset ?? 0;
  return {
    dx,
    dy,
    guides: {
      x: x && {
        at: x.line.at,
        from: Math.min(x.line.from, box.top + dy),
        to: Math.max(x.line.to, box.bottom + dy),
      },
      y: y && {
        at: y.line.at,
        from: Math.min(y.line.from, box.left + dx),
        to: Math.max(y.line.to, box.right + dx),
      },
    },
  };
}
