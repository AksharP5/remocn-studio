import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Effect, Exit } from "effect";
import type { CodeEdit, CodeNodePath, CodeTarget } from "@/shared/ipc";
import {
  AMBIGUOUS_LINE,
  assemble,
  CANNOT_DELETE,
  type Codemods,
  codemodsOf,
  removalOf,
  statusesOf,
} from "@/sidecar/preview/codemod";

const FILE = "/videos/promo/src/videos/intro/Title.tsx";
const OTHER = "/videos/promo/src/videos/intro/Backdrop.tsx";

const VIDEO = { durationInFrames: 300, fps: 30, height: 1080, width: 1920 };

const NODE_PATH: CodeNodePath = {
  absolutePath: FILE,
  effectKeys: [],
  nodePath: ["program", "body", 0, "openingElement"],
  sequenceKeys: ["style.fontSize"],
  videoConfigValues: VIDEO,
};

function edit(overrides: Partial<CodeEdit> = {}): CodeEdit {
  return {
    file: FILE,
    id: "title-1",
    keyframes: [],
    nodePath: NODE_PATH,
    schema: {},
    updates: [{ defaultValue: 16, key: "style.fontSize", value: 48 }],
    ...overrides,
  };
}

function target(overrides: Partial<CodeTarget> = {}): CodeTarget {
  return {
    file: FILE,
    id: "title-1",
    identity: null,
    keys: ["style.fontSize"],
    line: 24,
    ...overrides,
  };
}

/**
 * The project's codemods, faked down to what the studio calls: `refuse` names
 * the edits this stand-in throws for, which is how a real one behaves — it
 * throws for the whole file, not for the one change it could not make.
 */
function codemods(refuse: readonly string[] = []): Codemods {
  return {
    computeSequencePropsSubscriptionFromContent: ({ line }) =>
      line === 24
        ? {
            nodePath: NODE_PATH,
            status: {
              props: {
                children: { status: "computed" },
                "style.fontSize": { status: "static" },
                "style.opacity": { status: "keyframed" },
                unknowable: { status: "something-new" },
              },
            },
            success: true,
          }
        : { status: { reason: "not-found" }, success: false },
    updateMultipleSequenceProps: ({ changes, input }) => {
      for (const change of changes) {
        for (const update of change.updates) {
          if (refuse.includes(update.key)) {
            throw new Error(`cannot write ${update.key}`);
          }
        }
      }

      return {
        output: `${input}\n// props: ${changes.length}`,
        results: changes.map((_, at) => ({ logLine: 24 + at })),
      };
    },
    updateSequenceKeyframesAst: ({ input, updates }) => {
      for (const update of updates) {
        if (refuse.includes(update.key)) {
          throw new Error(`cannot move ${update.key}`);
        }
      }

      return { logLine: 40, serialized: `${input}\n// keyframes` };
    },
  };
}

const SOURCES: Record<string, string> = {
  [FILE]: "export const Title = () => null;\n",
  [OTHER]: "export const Backdrop = () => null;\n",
};

const read = (file: string) =>
  file in SOURCES
    ? Promise.resolve(SOURCES[file] as string)
    : Promise.reject(new Error(`ENOENT: ${file}`));

describe("reading the statuses", () => {
  it("keeps the three kinds the studio knows and drops anything else", async () => {
    const [answer] = await Effect.runPromise(
      statusesOf(codemods(), [target()], VIDEO, read)
    );

    expect(answer?.nodePath).toEqual(NODE_PATH);
    expect(answer?.props).toEqual({
      children: { kind: "computed", status: { status: "computed" } },
      "style.fontSize": { kind: "static", status: { status: "static" } },
      "style.opacity": { kind: "keyframed", status: { status: "keyframed" } },
    });
  });

  it("answers a reason rather than failing when the element is not found", async () => {
    const [answer] = await Effect.runPromise(
      statusesOf(codemods(), [target({ line: 99 })], VIDEO, read)
    );

    expect(answer).toEqual({
      id: "title-1",
      nodePath: null,
      props: {},
      reason: "not-found",
    });
  });

  it("refuses a file that is not TypeScript, and one it cannot read", async () => {
    const answers = await Effect.runPromise(
      statusesOf(
        codemods(),
        [
          target({ file: "/videos/promo/src/Title.jsx", id: "a" }),
          target({ file: "/videos/promo/src/Gone.tsx", id: "b" }),
        ],
        VIDEO,
        read
      )
    );

    expect(answers.map((answer) => answer.nodePath)).toEqual([null, null]);
    expect(answers[0]?.reason).toBe("the file is not TypeScript");
    expect(answers[1]?.reason).toContain("ENOENT");
  });
});

describe("assembling a write", () => {
  it("produces the new text of every file it touched", async () => {
    const built = await Effect.runPromise(
      assemble(codemods(), [edit()], false, read)
    );

    expect(built.results).toEqual([
      { file: FILE, id: "title-1", line: 24, message: null, ok: true },
    ]);
    expect(built.files).toEqual([
      { contents: `${SOURCES[FILE]}\n// props: 1`, path: FILE },
    ]);
  });

  it("runs the keyframes before the props, threading one text through", async () => {
    const built = await Effect.runPromise(
      assemble(
        codemods(),
        [
          edit({
            keyframes: [{ frame: 12, key: "style.opacity", value: 0.5 }],
          }),
        ],
        false,
        read
      )
    );

    expect(built.files[0]?.contents).toBe(
      `${SOURCES[FILE]}\n// keyframes\n// props: 1`
    );
  });

  // A codemod throws for the whole file, so the failure is probed apart: each
  // edit is tried alone, and the ones that survive are then applied together.
  it("names the one edit at fault and keeps the rest, when partial is allowed", async () => {
    const built = await Effect.runPromise(
      assemble(
        codemods(["style.color"]),
        [
          edit(),
          edit({
            id: "rig-1",
            updates: [
              { defaultValue: null, key: "style.color", value: "#fff" },
            ],
          }),
        ],
        true,
        read
      )
    );

    expect(built.results).toEqual([
      { file: FILE, id: "title-1", line: 24, message: null, ok: true },
      {
        file: FILE,
        id: "rig-1",
        line: null,
        message: "cannot write style.color",
        ok: false,
      },
    ]);
    expect(built.files).toHaveLength(1);
  });

  it("writes nothing at all while one edit is refused and partial is off", async () => {
    const built = await Effect.runPromise(
      assemble(
        codemods(["style.color"]),
        [
          edit(),
          edit({
            file: OTHER,
            id: "rig-1",
            nodePath: { ...NODE_PATH, absolutePath: OTHER },
            updates: [
              { defaultValue: null, key: "style.color", value: "#fff" },
            ],
          }),
        ],
        false,
        read
      )
    );

    expect(built.files).toEqual([]);
    expect(built.results.map((result) => result.ok)).toEqual([true, false]);
  });

  it("refuses every edit in a file it cannot read, by name", async () => {
    const built = await Effect.runPromise(
      assemble(
        codemods(),
        [edit({ file: "/videos/promo/src/Gone.tsx" })],
        true,
        read
      )
    );

    expect(built.files).toEqual([]);
    expect(built.results[0]?.message).toContain("ENOENT");
  });

  it("refuses a file that is not TypeScript before parsing it", async () => {
    const built = await Effect.runPromise(
      assemble(
        codemods(),
        [edit({ file: "/videos/promo/src/Title.jsx" })],
        true,
        () => Promise.resolve("whatever")
      )
    );

    expect(built.results[0]).toMatchObject({
      message: "the file is not TypeScript",
      ok: false,
    });
  });
});

describe("removing an element", () => {
  const TITLE = [
    "export const Title = () => (",
    "  <Frame>",
    "    <Badge />",
    "  </Frame>",
    ");",
    "",
  ].join("\n");
  const reader = (text: string) => () => Promise.resolve(text);
  const deleting = (): Codemods => ({
    ...codemods(),
    deleteJsxNode: ({ input }) =>
      Promise.resolve({
        logLine: 3,
        output: input.replace("    <Badge />\n", ""),
      }),
  });
  const at = (overrides: Partial<CodeTarget> = {}) =>
    target({ line: 3, ...overrides });
  const finding = (): Codemods => ({
    ...deleting(),
    computeSequencePropsSubscriptionFromContent: ({ line }) =>
      line === 3
        ? { nodePath: NODE_PATH, status: { props: {} }, success: true }
        : { status: { reason: "not-found" }, success: false },
  });
  const failure = async (
    effect: Effect.Effect<unknown, { message: string }>
  ) => {
    const exit = await Effect.runPromiseExit(effect);
    return Exit.isFailure(exit) ? String(exit.cause) : "succeeded";
  };

  it("answers the new text and the old, and writes nothing", async () => {
    const removed = await Effect.runPromise(
      removalOf(finding(), "Badge", at(), VIDEO, reader(TITLE))
    );
    expect(removed).toEqual({
      after: TITLE.replace("    <Badge />\n", ""),
      before: TITLE,
      file: FILE,
      line: 3,
    });
  });

  it("refuses when the element is no longer at its line", async () => {
    expect(
      await failure(
        removalOf(finding(), "Badge", at({ line: 2 }), VIDEO, reader(TITLE))
      )
    ).toContain("could not find this element in the code");
  });

  it("refuses when the codemod removed something other than the picked element", async () => {
    expect(
      await failure(removalOf(finding(), "Frame", at(), VIDEO, reader(TITLE)))
    ).toContain(AMBIGUOUS_LINE);
  });

  it("refuses a project whose codemods cannot delete, and a file that is not TypeScript", async () => {
    expect(
      await failure(removalOf(codemods(), "Badge", at(), VIDEO, reader(TITLE)))
    ).toContain(CANNOT_DELETE);
    expect(
      await failure(
        removalOf(
          finding(),
          "Badge",
          at({ file: "/videos/promo/src/Title.jsx" }),
          VIDEO,
          reader(TITLE)
        )
      )
    ).toContain("the file is not TypeScript");
  });
});

const FIXTURE = fileURLToPath(
  new URL("../../test/fixtures/render-smoke", import.meta.url)
);
const hasCodemods = existsSync(
  path.join(FIXTURE, "node_modules/@remotion/studio-codemods")
);

describe.skipIf(!hasCodemods)("removing with Remotion's own codemods", () => {
  const SCENE = [
    'import { AbsoluteFill } from "remotion";',
    "",
    "export const Scene = ({ show, items }: { show: boolean; items: string[] }) => (",
    "  <AbsoluteFill>",
    "    <Badge />",
    "    {show && <Badge />}",
    "    {show ? <Card /> : <Badge />}",
    "    {items.map((item) => <Badge key={item} />)}",
    "    {show ? <Badge /> : <Card />}",
    "    <Footer />",
    "  </AbsoluteFill>",
    ");",
    "",
  ].join("\n");

  const removeAt = async (line: number, component = "Badge") => {
    const real = await Effect.runPromise(codemodsOf(FIXTURE));
    return Effect.runPromise(
      removalOf(
        real,
        component,
        target({ identity: null, keys: [], line }),
        VIDEO,
        () => Promise.resolve(SCENE)
      )
    );
  };

  it("removes a plain child and nothing else", async () => {
    const removed = await removeAt(5);
    expect(removed.after).not.toContain("    <Badge />\n");
    expect(removed.after).toContain("{show && <Badge />}");
    expect(removed.after).toContain("<Footer />");
  });

  it("replaces an element in && and in a ternary with null", async () => {
    expect((await removeAt(6)).after).toContain("{show && null}");
    expect((await removeAt(7)).after).toContain("{show ? <Card /> : null}");
  });

  it("removes the one line a .map draws every instance from", async () => {
    const removed = await removeAt(8);
    expect(removed.after).toContain("items.map((item) => null)");
  });

  it("refuses rather than remove the wrong element of a shared line", async () => {
    await expect(removeAt(9)).rejects.toThrow(AMBIGUOUS_LINE);
  });

  it("removes one of several siblings that all start with <", async () => {
    const LIST = [
      "export const List = () => (",
      "  <AbsoluteFill>",
      "    <Badge />",
      "    <Footer />",
      '    <Card title="a" />',
      '    <Card title="b" />',
      "  </AbsoluteFill>",
      ");",
      "",
    ].join("\n");
    const real = await Effect.runPromise(codemodsOf(FIXTURE));
    const at = (line: number, component: string) =>
      Effect.runPromise(
        removalOf(
          real,
          component,
          target({ identity: null, keys: [], line }),
          VIDEO,
          () => Promise.resolve(LIST)
        )
      );
    expect((await at(3, "Badge")).after).toBe(
      LIST.replace("    <Badge />\n", "")
    );
    expect((await at(4, "Footer")).after).toBe(
      LIST.replace("    <Footer />\n", "")
    );
    expect((await at(5, "Card")).after).toBe(
      LIST.replace('    <Card title="a" />\n', "")
    );
    expect((await at(6, "Card")).after).toBe(
      LIST.replace('    <Card title="b" />\n', "")
    );
  });

  it("refuses a line where no element starts", async () => {
    await expect(removeAt(2)).rejects.toThrow(
      "could not find this element in the code"
    );
  });
});
