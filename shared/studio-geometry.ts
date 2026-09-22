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
  value: number;
  min: number | null;
  max: number | null;
}
export interface GeometryPose {
  multiplier: GeometryValues;
  offset: GeometryValues;
  scale: number;
}

export const IDENTITY_GEOMETRY_POSE: GeometryPose = {
  multiplier: { x: 1, y: 1, width: 1, height: 1, rotation: 1 },
  offset: { x: 0, y: 0, width: 0, height: 0, rotation: 0 },
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

/** Pointer deltas are in the unrotated parent's coordinates, not screen pixels. */
export function transformGeometry(
  before: GeometryValues,
  handle: GeometryHandle,
  dx: number,
  dy: number,
  shift: boolean,
  bounds: Partial<
    Record<GeometryKey, { min: number | null; max: number | null }>
  >,
  angle = 0,
  scale = 1
): GeometryValues {
  const limit = (key: GeometryKey, value: number) =>
    Math.min(
      bounds[key]?.max ?? Infinity,
      Math.max(
        bounds[key]?.min ??
          (key === "width" || key === "height" ? 1 : -Infinity),
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
    if (shift) {
      if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    return {
      ...before,
      x: limit("x", before.x + round(dx)),
      y: limit("y", before.y + round(dy)),
    };
  }
  const cos = Math.cos(radians(before.rotation));
  const sin = Math.sin(radians(before.rotation));
  const localX = (cos * dx + sin * dy) / scale;
  const localY = (-sin * dx + cos * dy) / scale;
  const horizontal = handle.includes("e") ? 1 : handle.includes("w") ? -1 : 0;
  const vertical = handle.includes("s") ? 1 : handle.includes("n") ? -1 : 0;
  let width = Math.max(1, limit("width", before.width + horizontal * localX));
  let height = Math.max(1, limit("height", before.height + vertical * localY));
  if (shift && horizontal && vertical) {
    const factor =
      Math.abs(localX / before.width) >= Math.abs(localY / before.height)
        ? width / before.width
        : height / before.height;
    const min = Math.max(
      Math.max(1, bounds.width?.min ?? 1) / before.width,
      Math.max(1, bounds.height?.min ?? 1) / before.height
    );
    const max = Math.min(
      (bounds.width?.max ?? Infinity) / before.width,
      (bounds.height?.max ?? Infinity) / before.height
    );
    const ratio = Math.min(max, Math.max(min, factor));
    width = before.width * ratio;
    height = before.height * ratio;
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
  if (limit("x", x) !== x || limit("y", y) !== y) return before;
  return { ...before, x, y, width, height };
}
