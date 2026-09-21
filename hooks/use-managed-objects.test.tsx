import { describe, expect, it, mock } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";
import { Effect } from "effect";
import type { PreviewControl, PreviewListener } from "@/hooks/use-preview";
import type { PreviewMessage } from "@/lib/studio/preview";
import { SidecarError } from "@/lib/studio/sidecar";
import {
  applyStudioOperation,
  type StudioSnapshot,
} from "@/shared/studio-document";
import {
  documentFixture,
  easingDocumentFixture,
} from "@/test/fixtures/studio-document";
import { useManagedObjects } from "./use-managed-objects";

function setup(document = documentFixture) {
  const listeners = new Set<PreviewListener>();
  const preview: PreviewControl = {
    composition: "intro",
    frameOf: () => 0,
    hint: null,
    isServing: true,
    onFrame: () => () => undefined,
    pick: null,
    playing: false,
    preview: { phase: "ready", url: "http://localhost:3001" },
    restart: () => undefined,
    send: mock(),
    stage: { current: null },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  let saved: StudioSnapshot = {
    document: structuredClone(document),
    revision: "initial",
  };
  const read = mock(() => Effect.succeed(saved));
  const write = mock(
    (
      params: Parameters<
        NonNullable<Parameters<typeof useManagedObjects>[0]["write"]>
      >[0]
    ) =>
      Effect.try({
        catch: (cause) => new SidecarError({ message: String(cause) }),
        try: () => {
          saved = {
            document: applyStudioOperation(saved.document, params.operation),
            revision: params.operation.id,
          };
          return saved;
        },
      })
  );
  const emit = (message: PreviewMessage) =>
    act(() => {
      for (const listener of listeners) {
        listener(message);
      }
    });
  const hook = renderHook(
    ({ projectId }) =>
      useManagedObjects({
        armed: true,
        enabled: true,
        preview,
        projectId,
        read,
        write,
      }),
    { initialProps: { projectId: "project-one" } }
  );
  return {
    ...hook,
    emit,
    externalSize: (size: number) => {
      saved = {
        ...saved,
        document: {
          ...saved.document,
          objects: saved.document.objects.map((object) =>
            object.id === "third"
              ? { ...object, values: { ...object.values, size } }
              : object
          ),
        },
      };
    },
    preview,
    read,
    ready: () =>
      emit({
        generation: "generation-1",
        lastOperationId: null,
        source: "remocn-preview",
        type: "studio.ready",
        video: "intro",
      }),
    saved: () => saved,
    write,
  };
}

describe("managed inspector", () => {
  it("loads unmounted objects, saves a selected instance across a selection switch and undoes it", async () => {
    const test = setup();
    test.ready();
    await waitFor(() => expect(test.result.current.objects).toHaveLength(3));
    act(() => test.result.current.select("third"));
    act(() => test.result.current.change("size", 72));
    expect(test.result.current.pending).toBe(1);
    act(() => {
      test.result.current.select("first");
    });
    await waitFor(() => expect(test.result.current.pending).toBe(0));
    expect(test.saved().document.objects[2].values.size).toBe(72);
    expect(test.saved().document.objects[0].values.size).toBe(48);
    expect(test.result.current.selected?.id).toBe("first");
    act(() => test.result.current.undo());
    await waitFor(() =>
      expect(test.saved().document.objects[2].values.size).toBe(48)
    );
  });

  it("keeps selection across rebuilds and ignores old generations and other videos", async () => {
    const test = setup();
    test.ready();
    await waitFor(() => expect(test.result.current.objects).toHaveLength(3));
    act(() => test.result.current.select("third"));
    test.emit({ source: "remocn-preview", type: "rebuilt" });
    test.emit({
      generation: "generation-2",
      lastOperationId: null,
      source: "remocn-preview",
      type: "studio.ready",
      video: "intro",
    });
    await waitFor(() => expect(test.result.current.loading).toBe(false));
    test.emit({
      generation: "generation-1",
      objectId: "first",
      source: "remocn-preview",
      type: "studio.select",
      video: "intro",
    });
    test.emit({
      generation: "generation-2",
      objectId: "first",
      source: "remocn-preview",
      type: "studio.select",
      video: "other",
    });
    expect(test.result.current.selected?.id).toBe("third");
    expect(test.result.current.isOpen).toBe(true);
  });

  it("retains conflicting drafts, blocks completion, and does not overwrite the external value", async () => {
    const test = setup();
    test.ready();
    await waitFor(() => expect(test.result.current.objects).toHaveLength(3));
    act(() => test.result.current.select("third"));
    act(() => test.result.current.change("size", 72));
    test.externalSize(90);
    act(() => test.result.current.commit());
    await waitFor(() =>
      expect(test.result.current.error).toContain("changed elsewhere")
    );
    expect(test.result.current.pending).toBe(1);
    expect(test.saved().document.objects[2].values.size).toBe(90);
    act(() => test.result.current.discard());
    await waitFor(() => expect(test.result.current.pending).toBe(0));
  });

  it("does not send a stale read into the newly selected project's inspector", async () => {
    const test = setup();
    test.ready();
    test.rerender({ projectId: "project-two" });
    await act(async () => {
      await Promise.resolve();
    });
    expect(test.result.current.objects).toHaveLength(0);
    expect(test.result.current.selected).toBeNull();
  });
  it("serializes overlapping commits and keeps the latest saved snapshot", async () => {
    const test = setup();
    test.ready();
    await waitFor(() => expect(test.result.current.objects).toHaveLength(3));
    act(() => test.result.current.select("third"));
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const original = test.write.getMockImplementation();
    if (!original) {
      throw new Error("Missing writer");
    }
    test.write.mockImplementationOnce((params) =>
      Effect.promise(() => gate).pipe(Effect.flatMap(() => original(params)))
    );
    act(() => {
      test.result.current.change("size", 72);
      test.result.current.commit();
    });
    act(() => {
      test.result.current.change("text", "Changed");
      test.result.current.commit();
    });
    expect(test.write).toHaveBeenCalledTimes(1);
    await act(async () => {
      release?.();
      await gate;
    });
    await waitFor(() => expect(test.result.current.pending).toBe(0));
    expect(test.result.current.selected?.values).toEqual({
      size: 72,
      text: "Changed",
    });
    expect(test.write).toHaveBeenCalledTimes(2);
  });

  it("retries an uncertain save with the same receipt and immutable contents", async () => {
    const test = setup();
    test.ready();
    await waitFor(() => expect(test.result.current.objects).toHaveLength(3));
    act(() => test.result.current.select("third"));
    const original = test.write.getMockImplementation();
    if (!original) {
      throw new Error("Missing writer");
    }
    test.write.mockImplementationOnce((params) =>
      original(params).pipe(
        Effect.flatMap(() =>
          Effect.fail(new SidecarError({ message: "Reply lost" }))
        )
      )
    );
    act(() => {
      test.result.current.change("size", 72);
      test.result.current.commit();
    });
    await waitFor(() =>
      expect(test.result.current.error).toContain("Reply lost")
    );
    act(() => test.result.current.change("size", 90));
    expect(
      test.result.current.fields.find((field) => field.id === "size")?.value
    ).toBe(72);
    act(() => test.result.current.retry());
    await waitFor(() => expect(test.result.current.pending).toBe(0));
    expect(test.saved().document.operations).toHaveLength(1);
    expect(test.saved().document.objects[2].values.size).toBe(72);
  });

  it("rejects incomplete numeric input without replacing it with zero", async () => {
    const test = setup();
    test.ready();
    await waitFor(() => expect(test.result.current.objects).toHaveLength(3));
    act(() => {
      test.result.current.select("third");
      test.result.current.change("size", "");
      test.result.current.commit();
    });
    expect(test.result.current.pending).toBe(1);
    expect(test.result.current.error).toContain("finite number");
    expect(test.write).not.toHaveBeenCalled();
    act(() => test.result.current.close());
    expect(test.result.current.isOpen).toBe(false);
  });
  it("blocks export until the rebuilt runtime acknowledges the saved operation", async () => {
    const test = setup();
    test.ready();
    await waitFor(() => expect(test.result.current.objects).toHaveLength(3));
    act(() => {
      test.result.current.select("third");
      test.result.current.change("size", 72);
      test.result.current.commit();
    });
    await waitFor(() => expect(test.result.current.pending).toBe(0));
    expect(test.result.current.awaitingPreview).toBe(true);
    test.ready();
    await waitFor(() => expect(test.result.current.loading).toBe(false));
    expect(test.result.current.awaitingPreview).toBe(true);
    test.emit({
      generation: "rebuilt",
      lastOperationId: test.saved().document.operations.at(-1)?.id ?? null,
      source: "remocn-preview",
      type: "studio.ready",
      video: "intro",
    });
    await waitFor(() =>
      expect(test.result.current.awaitingPreview).toBe(false)
    );
  });
});

it("drops equal curve drafts and saves and undoes the entire custom curve", async () => {
  const test = setup(easingDocumentFixture);
  test.ready();
  await waitFor(() => expect(test.result.current.objects).toHaveLength(1));
  act(() => test.result.current.select("title"));
  act(() => test.result.current.change("entryEasing", [0, 0, 0.58, 1]));
  expect(test.result.current.pending).toBe(0);
  act(() => test.result.current.change("entryEasing", [0.2, -0.5, 0.8, 1.4]));
  act(() => test.result.current.commit());
  await waitFor(() => expect(test.result.current.pending).toBe(0));
  expect(test.saved().document.objects[0].values.entryEasing).toEqual([
    0.2, -0.5, 0.8, 1.4,
  ]);
  act(() => test.result.current.undo());
  await waitFor(() =>
    expect(test.saved().document.objects[0].values.entryEasing).toEqual([
      0, 0, 0.58, 1,
    ])
  );
});
