import { describe, expect, it } from "bun:test";
import { Exit, Schema } from "effect";
import {
  documentFixture,
  easingDocumentFixture,
  operationFixture,
} from "@/test/fixtures/studio-document";
import {
  applyStudioOperation,
  inverseStudioOperation,
  StudioDocument,
} from "./studio-document";

const decode = Schema.decodeUnknownExit(StudioDocument);

describe("managed object contract", () => {
  it("edits one repeated instance after reorder, keeps independent edits and undoes only its own field", () => {
    const first = applyStudioOperation(documentFixture, operationFixture());
    const other = applyStudioOperation(
      { ...first, objects: [...first.objects].reverse() },
      operationFixture({ after: 90, id: "edit-2", objectId: "first" })
    );
    const undone = applyStudioOperation(
      other,
      inverseStudioOperation(operationFixture(), "undo-1")
    );
    expect(
      undone.objects.find((item) => item.id === "third")?.values.size
    ).toBe(48);
    expect(
      undone.objects.find((item) => item.id === "first")?.values.size
    ).toBe(90);
    expect(documentFixture.objects[2].values.size).toBe(48);
  });

  it("retries idempotently even after another edit and refuses reusing an operation ID", () => {
    const first = applyStudioOperation(documentFixture, operationFixture());
    const second = applyStudioOperation(
      first,
      operationFixture({ after: 80, before: 72, id: "second" })
    );
    expect(applyStudioOperation(second, operationFixture())).toBe(second);
    expect(() =>
      applyStudioOperation(second, operationFixture({ after: 90 }))
    ).toThrow("different change");
  });

  it("refuses stale writes, stale Undo, deleted objects and changed schemas", () => {
    const changed = applyStudioOperation(documentFixture, operationFixture());
    expect(() =>
      applyStudioOperation(changed, operationFixture({ id: "stale" }))
    ).toThrow("changed elsewhere");
    const newer = applyStudioOperation(
      changed,
      operationFixture({ after: 90, before: 72, id: "newer" })
    );
    expect(() =>
      applyStudioOperation(
        newer,
        inverseStudioOperation(operationFixture(), "undo")
      )
    ).toThrow("changed elsewhere");
    expect(() =>
      applyStudioOperation(
        { ...documentFixture, objects: [] },
        operationFixture()
      )
    ).toThrow("removed");
    expect(() =>
      applyStudioOperation(
        documentFixture,
        operationFixture({
          definition: { ...documentFixture.definitions[0], version: 2 },
        })
      )
    ).toThrow("properties changed");
  });

  it("validates IDs, parents, values, supported versions and explicit defaults", () => {
    expect(Exit.isSuccess(decode(documentFixture))).toBe(true);
    for (const invalid of [
      { ...documentFixture, version: 2 },
      {
        ...documentFixture,
        objects: [...documentFixture.objects, documentFixture.objects[0]],
      },
      {
        ...documentFixture,
        objects: [{ ...documentFixture.objects[0], parentId: "first" }],
      },
      {
        ...documentFixture,
        objects: [{ ...documentFixture.objects[0], parentId: "missing" }],
      },
      {
        ...documentFixture,
        objects: [{ ...documentFixture.objects[0], values: { size: 48 } }],
      },
      {
        ...documentFixture,
        objects: [
          { ...documentFixture.objects[0], values: { size: 400, text: "" } },
        ],
      },
      {
        ...documentFixture,
        objects: [
          {
            ...documentFixture.objects[0],
            values: { size: Number.NaN, text: "" },
          },
        ],
      },
    ]) {
      expect(Exit.isFailure(decode(invalid))).toBe(true);
    }
    expect(() =>
      applyStudioOperation(documentFixture, operationFixture({ after: 0 }))
    ).toThrow("at least");
    expect(() =>
      applyStudioOperation(documentFixture, operationFixture({ after: "72" }))
    ).toThrow("number");
  });
});

it("validates Bezier domains and permits overshoot", () => {
  const doc = structuredClone(easingDocumentFixture);
  expect(Exit.isSuccess(decode(doc))).toBe(true);
  const overshoot = {
    ...doc,
    objects: [
      { ...doc.objects[0], values: { entryEasing: [0.2, -1, 0.8, 2] } },
    ],
  };
  expect(Exit.isSuccess(decode(overshoot))).toBe(true);
  for (const value of [
    [-0.1, 0, 1, 1],
    [0, 0, 1.1, 1],
    [0, Number.POSITIVE_INFINITY, 1, 1],
    [0, 0, 1],
    "easeOut",
  ]) {
    expect(
      Exit.isFailure(
        decode({
          ...doc,
          objects: [{ ...doc.objects[0], values: { entryEasing: value } }],
        })
      )
    ).toBe(true);
  }
});

it("compares curves by coordinates across serialization, retries and checked Undo", () => {
  const doc = easingDocumentFixture;
  const operation = {
    after: [0.25, -0.3, 0.8, 1.4] as const,
    before: [0, 0, 0.58, 1] as const,
    definition: structuredClone(doc.definitions[0]),
    field: "entryEasing",
    id: "curve",
    objectId: "title",
  };
  const saved = applyStudioOperation(doc, operation);
  expect(applyStudioOperation(saved, structuredClone(operation))).toBe(saved);
  const undone = applyStudioOperation(
    saved,
    inverseStudioOperation(structuredClone(operation), "undo")
  );
  expect(undone.objects[0].values.entryEasing).toEqual(operation.before);
  expect(() =>
    applyStudioOperation(saved, { ...operation, id: "stale" })
  ).toThrow("changed elsewhere");
  expect(() =>
    applyStudioOperation(saved, { ...operation, after: [0, 0, 1, 1] })
  ).toThrow("different change");
});
