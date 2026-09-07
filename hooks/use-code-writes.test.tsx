import { describe, expect, it, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { Effect } from "effect";
import { useCodeWrites } from "@/hooks/use-code-writes";
import type { Selection } from "@/hooks/use-selections";
import { SidecarError } from "@/lib/studio/sidecar";
import type { CodeEdit, WriteParams, WriteResult } from "@/shared/ipc";

const FILE = "/videos/promo/src/videos/intro/Title.tsx";

const EDIT: CodeEdit = {
  file: FILE,
  id: "title-1",
  keyframes: [],
  nodePath: {
    absolutePath: FILE,
    effectKeys: [],
    nodePath: ["program"],
    sequenceKeys: [],
    videoConfigValues: null,
  },
  schema: {},
  updates: [{ defaultValue: 16, key: "style.fontSize", value: 48 }],
};

function selection(writes: readonly CodeEdit[]): Selection {
  return {
    element: {
      column: null,
      component: "Title",
      composition: "intro",
      file: FILE,
      fps: 30,
      frame: 42,
      html: "<h1/>",
      line: 24,
      scene: null,
      stack: [],
    },
    id: "selection-1",
    rect: { height: 0, width: 0, x: 0, y: 0 },
    stale: false,
    tuning: null,
    writes,
  };
}

function harness(write: (params: WriteParams) => WriteResult | Error) {
  const calls: WriteParams[] = [];

  const rendered = renderHook(() =>
    useCodeWrites({
      plan: () => "pro",
      projectId: "project-1",
      write: (params) => {
        calls.push(params);
        const answer = write(params);

        return answer instanceof Error
          ? Effect.fail(new SidecarError({ message: answer.message }))
          : Effect.succeed(answer);
      },
    })
  );

  return { ...rendered, calls: () => [...calls] };
}

const ONE = [selection([EDIT])];

describe("writing values into the code at Send", () => {
  it("writes whole-or-nothing on the first attempt, and says where it landed", async () => {
    const { calls, result } = harness(() => ({
      files: [FILE],
      results: [
        { file: FILE, id: "0\u0000title-1", line: 24, message: null, ok: true },
      ],
    }));

    const outcome = await act(() => result.current.run(ONE));

    expect(calls()[0]?.partial).toBe(false);
    expect(outcome).toEqual({
      failed: new Set(),
      ok: true,
      written: [{ file: FILE, line: 24 }],
    });
    expect(result.current.card).toBeNull();
  });

  it("asks nothing when no chip carries an edit", async () => {
    const { calls, result } = harness(() => ({ files: [], results: [] }));

    const outcome = await act(() => result.current.run([selection([])]));

    expect(calls()).toEqual([]);
    expect(outcome.ok).toBe(true);
  });

  it("raises a card naming the refusal, and cancels without touching the disk", async () => {
    const { calls, result } = harness(() => ({
      files: [],
      results: [
        {
          file: FILE,
          id: "0\u0000title-1",
          line: null,
          message: "cannot write style.fontSize",
          ok: false,
        },
      ],
    }));

    let outcome: Promise<unknown> | null = null;
    await act(() => {
      outcome = result.current.run(ONE);
      return Promise.resolve();
    });

    expect(result.current.card).toEqual({
      kept: 0,
      refused: [{ label: "Title", reason: "cannot write style.fontSize" }],
    });

    await act(async () => {
      result.current.answer(false);
      await outcome;
    });

    expect(await outcome).toEqual({
      failed: new Set(),
      ok: false,
      written: [],
    });
    expect(calls()).toHaveLength(1);
    expect(result.current.card).toBeNull();
  });

  it("lets the rest land when the card is accepted, and names the chips that failed", async () => {
    const { calls, result } = harness((params) =>
      params.partial
        ? {
            files: [FILE],
            results: [
              {
                file: FILE,
                id: "0\u0000title-1",
                line: 24,
                message: null,
                ok: true,
              },
              {
                file: FILE,
                id: "1\u0000rig-1",
                line: null,
                message: "nope",
                ok: false,
              },
            ],
          }
        : {
            files: [],
            results: [
              {
                file: FILE,
                id: "0\u0000title-1",
                line: 24,
                message: null,
                ok: true,
              },
              {
                file: FILE,
                id: "1\u0000rig-1",
                line: null,
                message: "nope",
                ok: false,
              },
            ],
          }
    );

    let outcome = Promise.resolve<{ failed: ReadonlySet<number> }>({
      failed: new Set(),
    });
    await act(() => {
      outcome = result.current.run([
        selection([EDIT]),
        selection([{ ...EDIT, id: "rig-1" }]),
      ]);
      return Promise.resolve();
    });

    expect(result.current.card?.kept).toBe(1);

    await act(async () => {
      result.current.answer(true);
      await outcome;
    });

    expect(calls().map((call) => call.partial)).toEqual([false, true]);
    expect([
      ...((await outcome) as { failed: ReadonlySet<number> }).failed,
    ]).toEqual([1]);
  });

  // A sidecar that could not answer at all is the same question, with every
  // edit refused for the same reason.
  it("turns a failed request into a card rather than a thrown promise", async () => {
    const { result } = harness(() => new Error("the preview is not running"));

    let outcome = Promise.resolve<{ ok: boolean }>({ ok: true });
    await act(() => {
      outcome = result.current.run(ONE);
      return Promise.resolve();
    });

    expect(result.current.card?.refused[0]?.reason).toContain(
      "the preview is not running"
    );

    await act(async () => {
      result.current.answer(false);
      await outcome;
    });

    expect(await outcome).toMatchObject({ ok: false });
  });

  it("does nothing at all with no project open", async () => {
    const write = mock();
    const { result } = renderHook(() =>
      useCodeWrites({ plan: () => "pro", projectId: null, write })
    );

    const outcome = await act(() => result.current.run(ONE));

    expect(write).not.toHaveBeenCalled();
    expect(outcome.ok).toBe(false);
  });
});
