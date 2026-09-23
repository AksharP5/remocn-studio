import { describe, expect, it } from "bun:test";
import {
  type BetweenMotion,
  geometryBetween,
  type PoseFields,
} from "../templates/remotion/src/lib/studio-objects-v5/between";

const values: Record<string, number> = {
  x: 400, y: 300, width: 200, height: 100, rotation: 0,
  entryX: -300, entryY: 300, entryWidth: 100, entryHeight: 50, entryRotation: 30,
};
const rest: PoseFields = { x: "x", y: "y", width: "width", height: "height", rotation: "rotation" };
const entry: PoseFields = {
  x: "entryX", y: "entryY", width: "entryWidth", height: "entryHeight", rotation: "entryRotation",
};

function object() {
  const calls: { fields: PoseFields; motion: BetweenMotion }[] = [];
  return {
    calls,
    number: (field: string) => values[field] as number,
    geometry: (fields: PoseFields, motion: BetweenMotion = {}) => {
      calls.push({ fields, motion });
      return { bind: { "data-studio-geometry": JSON.stringify(fields) }, style: {} };
    },
  };
}

function rendered(call: { fields: PoseFields; motion: BetweenMotion }, key: keyof PoseFields) {
  const id = call.fields[key];
  const base = id === undefined ? 0 : (values[id] as number);
  return base * (call.motion.multiplier?.[key] ?? 1) + (call.motion.offset?.[key] ?? 0);
}

describe("geometryBetween", () => {
  it("binds the start pose while it outweighs the end", () => {
    const target = object();
    geometryBetween(target, { from: entry, to: rest }, 0.2);
    const [call] = target.calls;
    expect(call?.fields).toBe(entry);
    expect(call?.motion.multiplier?.x).toBeCloseTo(0.8);
  });

  it("binds the end pose from the midpoint on", () => {
    const target = object();
    geometryBetween(target, { from: entry, to: rest }, 0.5);
    expect(target.calls[0]?.fields).toBe(rest);
  });

  it("renders the interpolated pose whichever end is bound", () => {
    for (const progress of [0, 0.3, 0.5, 0.8, 1, 1.15, -0.1]) {
      const target = object();
      geometryBetween(target, { from: entry, to: rest }, progress);
      const [call] = target.calls;
      for (const key of ["x", "y", "width", "height", "rotation"] as const) {
        const from = values[entry[key] as string] as number;
        const to = values[rest[key] as string] as number;
        expect(rendered(call!, key)).toBeCloseTo(from * (1 - progress) + to * progress);
      }
      for (const weight of Object.values(call!.motion.multiplier ?? {})) {
        expect(weight).toBeGreaterThanOrEqual(0.5);
      }
    }
  });

  it("leaves a field both poses share out of the interpolation", () => {
    const target = object();
    const start: PoseFields = { ...rest, x: "entryX", y: "entryY" };
    geometryBetween(target, { from: start, to: rest }, 0.2);
    const [call] = target.calls;
    expect(call?.motion.multiplier?.width).toBe(1);
    expect(call?.motion.offset?.width).toBe(0);
    expect(rendered(call!, "width")).toBe(200);
    expect(rendered(call!, "x")).toBeCloseTo(-300 * 0.8 + 400 * 0.2);
  });

  it("composes extra motion on top of the interpolation", () => {
    const target = object();
    geometryBetween(target, { from: entry, to: rest }, 1, {
      motion: { offset: { rotation: 5 }, scale: 1.2 },
    });
    const [call] = target.calls;
    expect(rendered(call!, "rotation")).toBeCloseTo(5);
    expect(call?.motion.scale).toBe(1.2);
  });

  it("tells the canvas which pose is edited and where the other one is", () => {
    const { bind } = geometryBetween(object(), { from: rest, to: entry }, 0.9, { kind: "exit" });
    const between = JSON.parse(bind["data-studio-geometry-between"] as string);
    expect(between.editing).toBe("to");
    expect(between.kind).toBe("exit");
    expect(between.from).toEqual({ x: 400, y: 300, width: 200, height: 100, rotation: 0 });
    expect(between.to.x).toBe(-300);
  });

  it("passes the frames of both poses on when it has them", () => {
    const tagged = (frames?: { from: number; to: number }) =>
      JSON.parse(
        geometryBetween(object(), { from: entry, to: rest }, 0.3, frames ? { frames } : {}).bind[
          "data-studio-geometry-between"
        ] as string
      ).frames;
    expect(tagged({ from: 12, to: 48 })).toEqual({ from: 12, to: 48 });
    expect(tagged()).toBeNull();
  });

  it("refuses a progress it cannot interpolate", () => {
    expect(() => geometryBetween(object(), { from: entry, to: rest }, Number.NaN)).toThrow();
  });
});
