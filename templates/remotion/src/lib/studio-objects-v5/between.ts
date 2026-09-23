import type { CSSProperties } from "react";

type GeometryKey = "x" | "y" | "width" | "height" | "rotation";

export interface PoseFields {
  x: string;
  y: string;
  width: string;
  height: string;
  rotation?: string;
}

export interface BetweenMotion {
  multiplier?: Partial<Record<GeometryKey, number>>;
  offset?: Partial<Record<GeometryKey, number>>;
  scale?: number;
}

interface GeometryObject {
  number: (field: string) => number;
  geometry: (
    fields: PoseFields,
    motion?: BetweenMotion
  ) => { bind: Record<string, string | number>; style: CSSProperties };
}

const KEYS: readonly GeometryKey[] = ["x", "y", "width", "height", "rotation"];

export function geometryBetween(
  object: GeometryObject,
  poses: { from: PoseFields; to: PoseFields },
  progress: number,
  options: {
    kind?: "entry" | "exit";
    motion?: BetweenMotion;
    frames?: { from: number; to: number };
  } = {}
) {
  if (!Number.isFinite(progress)) {
    throw new Error("geometryBetween needs a finite progress.");
  }
  const editing = progress >= 0.5 ? "to" : "from";
  const bound = poses[editing];
  const other = poses[editing === "to" ? "from" : "to"];
  const weight = editing === "to" ? progress : 1 - progress;
  const valueOf = (fields: PoseFields, key: GeometryKey) => {
    const id = fields[key];
    return id === undefined ? 0 : object.number(id);
  };
  const multiplier: Partial<Record<GeometryKey, number>> = {};
  const offset: Partial<Record<GeometryKey, number>> = {};
  for (const key of KEYS) {
    const scale = options.motion?.multiplier?.[key] ?? 1;
    const extra = options.motion?.offset?.[key] ?? 0;
    if (bound[key] !== undefined && bound[key] === other[key]) {
      multiplier[key] = scale;
      offset[key] = extra;
      continue;
    }
    multiplier[key] = weight * scale;
    offset[key] = (1 - weight) * valueOf(other, key) * scale + extra;
  }
  const pose = (fields: PoseFields) =>
    Object.fromEntries(KEYS.map((key) => [key, valueOf(fields, key)]));
  const geometry = object.geometry(bound, {
    multiplier,
    offset,
    scale: options.motion?.scale,
  });
  return {
    ...geometry,
    bind: {
      ...geometry.bind,
      "data-studio-geometry-between": JSON.stringify({
        editing,
        kind: options.kind ?? "entry",
        from: pose(poses.from),
        to: pose(poses.to),
        frames: options.frames ?? null,
      }),
    },
  };
}
