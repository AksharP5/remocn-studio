import { describe, expect, it } from "vitest";
import {
  type Changed,
  defaultOf,
  editsOf,
  failuresOf,
  frameKey,
  planWrites,
  statusTargetsOf,
  writtenFiles,
} from "@/lib/studio/code-writes";
import type { TuningTarget } from "@/lib/studio/preview";
import type { CodeNodePath, CodeTargetStatus } from "@/shared/ipc";

const FILE = "/videos/promo/src/videos/intro/Title.tsx";

const NODE_PATH: CodeNodePath = {
  absolutePath: FILE,
  effectKeys: [],
  nodePath: ["program", "body", 0, "openingElement"],
  sequenceKeys: ["style.fontSize", "style.opacity"],
  videoConfigValues: {
    durationInFrames: 300,
    fps: 30,
    height: 1080,
    width: 1920,
  },
};

const SCHEMA = {
  children: { type: "text-content" },
  "style.fontSize": { default: 16, type: "number" },
  "style.opacity": { default: 1, type: "number" },
  variant: {
    type: "enum",
    variants: {
      hard: {},
      soft: { blur: { default: 4, type: "number" } },
    },
  },
};

function target(overrides: Partial<TuningTarget> = {}): TuningTarget {
  return {
    componentName: "Title",
    fields: [],
    identity: "remotion.H1",
    instanceId: "anchor-1",
    instances: 1,
    keys: ["style.fontSize", "style.opacity"],
    name: "Headline",
    ordinal: 1,
    origin: { column: 7, file: FILE, line: 24 },
    schema: SCHEMA,
    targetId: "title-1",
    where: { column: 7, file: FILE, line: 24 },
    ...overrides,
  };
}

function statuses(
  props: Record<string, "computed" | "keyframed" | "static">,
  nodePath: CodeNodePath | null = NODE_PATH
): Record<string, CodeTargetStatus> {
  return {
    "title-1": {
      id: "title-1",
      nodePath,
      props: Object.fromEntries(
        Object.entries(props).map(([key, kind]) => [
          key,
          { kind, status: { status: kind } },
        ])
      ),
      reason: null,
    },
  };
}

function changed(
  path: string,
  to: unknown,
  type = "number",
  owner = target()
): Changed {
  return { from: 16, path, target: owner, to: to as never, type };
}

describe("which targets a status is asked for", () => {
  it("takes the ones Remotion recorded a call site for", () => {
    expect(statusTargetsOf([target()])).toEqual([
      {
        file: FILE,
        id: "title-1",
        identity: "remotion.H1",
        keys: ["style.fontSize", "style.opacity"],
        line: 24,
      },
    ]);
  });

  it("skips a target with no call site and one with no keys", () => {
    expect(statusTargetsOf([target({ origin: null })])).toEqual([]);
    expect(statusTargetsOf([target({ keys: [] })])).toEqual([]);
  });
});

describe("planWrites", () => {
  it("puts a static change in the code and a computed one in the message", () => {
    const plan = planWrites({
      changed: [changed("style.fontSize", 48), changed("style.opacity", 0.5)],
      fonts: [],
      frames: {},
      statuses: statuses({
        "style.fontSize": "static",
        "style.opacity": "computed",
      }),
    });

    expect(plan.code.map((change) => change.path)).toEqual(["style.fontSize"]);
    expect(plan.agent.map((change) => change.path)).toEqual(["style.opacity"]);
    expect(plan.edits).toEqual([
      {
        file: FILE,
        id: "title-1",
        keyframes: [],
        nodePath: NODE_PATH,
        schema: SCHEMA,
        updates: [{ defaultValue: 16, key: "style.fontSize", value: 48 }],
      },
    ]);
  });

  it("sends a keyframed change as a keyframe at the frame it was judged at", () => {
    const plan = planWrites({
      changed: [changed("style.opacity", 0.25)],
      fonts: [],
      frames: { [frameKey("title-1", "style.opacity")]: 42 },
      statuses: statuses({ "style.opacity": "keyframed" }),
    });

    expect(plan.edits[0]?.keyframes).toEqual([
      { frame: 42, key: "style.opacity", value: 0.25 },
    ]);
    expect(plan.edits[0]?.updates).toEqual([]);
  });

  // A keyframed value the studio cannot write is still a runtime reading, so
  // the agent has to be told to move the landing value rather than the frame.
  it("keeps the sampled note on a keyframed change it hands over", () => {
    const plan = planWrites({
      changed: [changed("style.opacity", 0.25)],
      fonts: [],
      frames: {},
      statuses: statuses({ "style.opacity": "keyframed" }, null),
    });

    expect(plan.code).toEqual([]);
    expect(plan.agent[0]).toMatchObject({ sampled: true });
  });

  it("names the owner by the call site the codemod would write to", () => {
    const plan = planWrites({
      changed: [changed("style.fontSize", 48)],
      fonts: [],
      frames: {},
      statuses: statuses({ "style.fontSize": "static" }),
    });

    expect(plan.code[0]?.owner).toEqual({
      component: "Title",
      file: FILE,
      line: 24,
      name: "Headline",
    });
  });

  it("carries no edit at all when nothing is writable", () => {
    const plan = planWrites({
      changed: [changed("style.fontSize", 48)],
      fonts: [],
      frames: {},
      statuses: {},
    });

    expect(plan.edits).toEqual([]);
    expect(plan.agent).toHaveLength(1);
  });
});

describe("a key's declared default", () => {
  it("comes off the schema, and reaches through an enum's variants", () => {
    expect(defaultOf(SCHEMA, "style.fontSize")).toBe(16);
    expect(defaultOf(SCHEMA, "blur")).toBe(4);
  });

  // JSON drops an undefined key, so "there is no default" travels as null.
  it("is null for a key the schema does not declare one for", () => {
    expect(defaultOf(SCHEMA, "children")).toBeNull();
    expect(defaultOf(null, "anything")).toBeNull();
  });
});

describe("edits across the composer", () => {
  const edit = {
    file: FILE,
    id: "title-1",
    keyframes: [],
    nodePath: NODE_PATH,
    schema: SCHEMA,
    updates: [],
  };

  it("prefixes each edit with the chip it belongs to", () => {
    const ids = editsOf([
      { writes: [] },
      { writes: [edit] },
      { writes: [edit, { ...edit, id: "rig-1" }] },
    ]).map((one) => one.id);

    expect(ids).toEqual(["1\u0000title-1", "2\u0000title-1", "2\u0000rig-1"]);
  });

  it("reads a failure back to the chip that carried it", () => {
    const failed = failuresOf([
      { file: FILE, id: "1\u0000title-1", line: 24, message: null, ok: true },
      {
        file: FILE,
        id: "2\u0000title-1",
        line: null,
        message: "nope",
        ok: false,
      },
      {
        file: FILE,
        id: "2\u0000rig-1",
        line: null,
        message: "also nope",
        ok: false,
      },
    ]);

    expect([...failed]).toEqual([[2, "nope"]]);
  });

  it("lists each place a value landed once", () => {
    expect(
      writtenFiles([
        { file: FILE, id: "1\u0000a", line: 24, message: null, ok: true },
        { file: FILE, id: "1\u0000b", line: 24, message: null, ok: true },
        { file: FILE, id: "2\u0000c", line: 40, message: null, ok: true },
        { file: FILE, id: "3\u0000d", line: null, message: "nope", ok: false },
      ])
    ).toEqual([
      { file: FILE, line: 24 },
      { file: FILE, line: 40 },
    ]);
  });
});
