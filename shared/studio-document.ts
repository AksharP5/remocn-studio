import { Schema } from "effect";

const HEX_COLOR = /^#[\da-f]{6}([\da-f]{2})?$/i;

const Identifier = Schema.NonEmptyString.check(
  Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/)
);

const BezierX = Schema.Finite.check(
  Schema.isBetween({ maximum: 1, minimum: 0 })
);
export const StudioBezier = Schema.Tuple([
  BezierX,
  Schema.Finite,
  BezierX,
  Schema.Finite,
]);
export type StudioBezier = typeof StudioBezier.Type;
export const isStudioBezier = Schema.is(StudioBezier);

export const StudioValue = Schema.Union([
  Schema.Finite,
  Schema.String,
  Schema.Boolean,
  StudioBezier,
]);
export type StudioValue = typeof StudioValue.Type;

export const StudioField = Schema.Struct({
  default: StudioValue,
  group: Schema.optionalKey(Schema.String),
  id: Identifier,
  label: Schema.NonEmptyString,
  max: Schema.optionalKey(Schema.Finite),
  min: Schema.optionalKey(Schema.Finite),
  options: Schema.optionalKey(Schema.Array(Schema.NonEmptyString)),
  step: Schema.optionalKey(Schema.Finite),
  type: Schema.Literals([
    "number",
    "text",
    "color",
    "boolean",
    "enum",
    "easing",
  ]),
  unit: Schema.optionalKey(Schema.String),
});
export type StudioField = typeof StudioField.Type;

export const StudioDefinition = Schema.Struct({
  fields: Schema.Array(StudioField),
  id: Identifier,
  version: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
});
export type StudioDefinition = typeof StudioDefinition.Type;

export const StudioObject = Schema.Struct({
  definition: Identifier,
  id: Identifier,
  label: Schema.NonEmptyString,
  parentId: Schema.NullOr(Identifier),
  values: Schema.Record(Identifier, StudioValue),
});
export type StudioObject = typeof StudioObject.Type;

export const StudioFieldChange = Schema.Struct({
  after: StudioValue,
  before: StudioValue,
  field: Identifier,
});
export type StudioFieldChange = typeof StudioFieldChange.Type;

export const StudioOperation = Schema.Struct({
  ...StudioFieldChange.fields,
  changes: Schema.optionalKey(Schema.Array(StudioFieldChange)),
  definition: StudioDefinition,
  id: Schema.NonEmptyString,
  objectId: Identifier,
  undoOf: Schema.optionalKey(Schema.NonEmptyString),
}).check(
  Schema.makeFilter((operation) => {
    const fields = [
      operation.field,
      ...(operation.changes ?? []).map((item) => item.field),
    ];
    return (
      new Set(fields).size === fields.length ||
      "An edit cannot change the same field twice."
    );
  })
);
export type StudioOperation = typeof StudioOperation.Type;

export const StudioDocument = Schema.Struct({
  definitions: Schema.Array(StudioDefinition),
  objects: Schema.Array(StudioObject),
  operations: Schema.Array(StudioOperation),
  version: Schema.Literal(1),
  video: Identifier,
}).check(Schema.makeFilter((document) => documentProblem(document) ?? true));
export type StudioDocument = typeof StudioDocument.Type;

export const StudioDocumentRef = Schema.Struct({
  projectId: Schema.NonEmptyString,
  video: Identifier,
});
export const StudioSnapshot = Schema.Struct({
  document: StudioDocument,
  revision: Schema.NonEmptyString,
});
export type StudioSnapshot = typeof StudioSnapshot.Type;

export function fieldProblem(
  field: StudioField,
  value: StudioValue
): string | null {
  if (field.type === "easing") {
    return isStudioBezier(value)
      ? null
      : `${field.label} needs four finite Bezier coordinates with X between 0 and 1.`;
  }
  if (field.type === "number") {
    return numberProblem(field, value);
  }
  if (field.type === "boolean") {
    return typeof value === "boolean"
      ? null
      : `${field.label} needs a switch value.`;
  }
  if (typeof value !== "string") {
    return `${field.label} needs text.`;
  }
  if (field.type === "enum" && !field.options?.includes(value)) {
    return `Choose one of the options for ${field.label}.`;
  }
  if (field.type === "color" && !HEX_COLOR.test(value)) {
    return `${field.label} needs a six- or eight-digit hex color.`;
  }
  return null;
}

interface DocumentShape {
  readonly definitions: readonly StudioDefinition[];
  readonly objects: readonly StudioObject[];
  readonly operations: readonly StudioOperation[];
}

export function documentProblem(document: DocumentShape): string | null {
  const definitions = new Map(
    document.definitions.map((item) => [item.id, item])
  );
  const objects = new Map(document.objects.map((item) => [item.id, item]));
  if (
    definitions.size !== document.definitions.length ||
    objects.size !== document.objects.length
  ) {
    return "Each object and component definition needs a unique ID.";
  }
  if (
    new Set(document.operations.map((item) => item.id)).size !==
    document.operations.length
  ) {
    return "The edit history contains duplicate operation IDs.";
  }
  for (const definition of document.definitions) {
    const problem = definitionProblem(definition);
    if (problem !== null) {
      return problem;
    }
  }
  for (const object of document.objects) {
    const problem =
      objectProblem(object, definitions.get(object.definition)) ??
      parentProblem(object, objects);
    if (problem !== null) {
      return problem;
    }
  }
  return null;
}

function definitionProblem(definition: StudioDefinition): string | null {
  if (
    new Set(definition.fields.map((field) => field.id)).size !==
    definition.fields.length
  ) {
    return `${definition.id} declares the same property twice.`;
  }
  for (const field of definition.fields) {
    if (field.step !== undefined && field.step <= 0) {
      return `${field.label} needs a positive step.`;
    }
    if (field.options && new Set(field.options).size !== field.options.length) {
      return `${field.label} has duplicate options.`;
    }
    const problem = fieldProblem(field, field.default);
    if (problem !== null) {
      return problem;
    }
  }
  return null;
}

function objectProblem(
  object: StudioObject,
  definition: StudioDefinition | undefined
): string | null {
  if (definition === undefined) {
    return `${object.label} has no component definition.`;
  }
  if (Object.keys(object.values).length !== definition.fields.length) {
    return `${object.label} must store exactly its declared properties.`;
  }
  for (const field of definition.fields) {
    if (!Object.hasOwn(object.values, field.id)) {
      return `${object.label} is missing ${field.label}.`;
    }
    const problem = fieldProblem(field, object.values[field.id]);
    if (problem !== null) {
      return `${object.label}: ${problem}`;
    }
  }
  return null;
}

function parentProblem(
  object: StudioObject,
  objects: ReadonlyMap<string, StudioObject>
): string | null {
  const visited = new Set([object.id]);
  let parent = object.parentId;
  while (parent !== null) {
    if (visited.has(parent)) {
      return `${object.label} has a parent cycle.`;
    }
    visited.add(parent);
    const ancestor = objects.get(parent);
    if (ancestor === undefined) {
      return `${object.label} has a missing parent.`;
    }
    parent = ancestor.parentId;
  }
  return null;
}

export function sameDefinition(
  left: StudioDefinition,
  right: StudioDefinition
): boolean {
  return (
    JSON.stringify(definitionKey(left)) === JSON.stringify(definitionKey(right))
  );
}

function definitionKey(definition: StudioDefinition) {
  return [
    definition.id,
    definition.version,
    definition.fields.map((field) => [
      field.id,
      field.label,
      field.type,
      field.default,
      field.min,
      field.max,
      field.step,
      field.options,
      field.unit,
      field.group,
    ]),
  ];
}

export function applyStudioOperation(
  document: StudioDocument,
  operation: StudioOperation
): StudioDocument {
  const previous = document.operations.find((item) => item.id === operation.id);
  if (previous !== undefined) {
    if (
      previous.objectId !== operation.objectId ||
      previous.field !== operation.field ||
      !sameStudioValue(previous.before, operation.before) ||
      !sameStudioValue(previous.after, operation.after) ||
      !sameChanges(previous, operation) ||
      previous.undoOf !== operation.undoOf ||
      !sameDefinition(previous.definition, operation.definition)
    ) {
      throw new Error(
        "This edit ID has already been used for a different change."
      );
    }
    return document;
  }
  const object = document.objects.find(
    (item) => item.id === operation.objectId
  );
  if (object === undefined) {
    throw new Error(
      "This object was removed. Reload the properties before editing."
    );
  }
  const definition = document.definitions.find(
    (item) => item.id === object.definition
  );
  if (
    definition === undefined ||
    !sameDefinition(definition, operation.definition)
  ) {
    throw new Error(
      "The component properties changed. Reload them before saving this edit."
    );
  }
  const changes = studioOperationChanges(operation);
  if (new Set(changes.map((change) => change.field)).size !== changes.length) {
    throw new Error("An edit cannot change the same field twice.");
  }
  for (const change of changes) {
    const field = definition.fields.find((item) => item.id === change.field);
    if (field === undefined || !Object.hasOwn(object.values, field.id)) {
      throw new Error("This property no longer exists.");
    }
    if (!sameStudioValue(object.values[field.id], change.before)) {
      throw new Error(
        `${object.label}: ${field.label} changed elsewhere. Reload before trying again.`
      );
    }
    const problem = fieldProblem(field, change.after);
    if (problem !== null) {
      throw new Error(problem);
    }
  }
  return {
    ...document,
    objects: document.objects.map((item) =>
      item.id === object.id
        ? {
            ...item,
            values: {
              ...item.values,
              ...Object.fromEntries(
                changes.map((change) => [change.field, change.after])
              ),
            },
          }
        : item
    ),
    operations: [...document.operations, operation],
  };
}

export function inverseStudioOperation(
  operation: StudioOperation,
  id: string
): StudioOperation {
  return {
    ...operation,
    after: operation.before,
    before: operation.after,
    ...(operation.changes === undefined
      ? {}
      : {
          changes: operation.changes.map((change) => ({
            ...change,
            after: change.before,
            before: change.after,
          })),
        }),
    id,
    undoOf: operation.id,
  };
}

export function studioOperationChanges(
  operation: Pick<StudioOperation, "field" | "before" | "after" | "changes">
): readonly StudioFieldChange[] {
  return [
    {
      field: operation.field,
      before: operation.before,
      after: operation.after,
    },
    ...(operation.changes ?? []),
  ];
}

function sameChanges(left: StudioOperation, right: StudioOperation): boolean {
  const a = left.changes ?? [];
  const b = right.changes ?? [];
  return (
    a.length === b.length &&
    a.every((change, index) => {
      const other = b[index];
      return (
        change.field === other.field &&
        sameStudioValue(change.before, other.before) &&
        sameStudioValue(change.after, other.after)
      );
    })
  );
}

export function sameStudioValue(
  left: StudioValue,
  right: StudioValue
): boolean {
  return (
    left === right ||
    (Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => value === right[index]))
  );
}

function numberProblem(field: StudioField, value: StudioValue): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return `${field.label} needs a finite number.`;
  }
  if (field.min !== undefined && value < field.min) {
    return `${field.label} must be at least ${field.min}.`;
  }
  if (field.max !== undefined && value > field.max) {
    return `${field.label} must be at most ${field.max}.`;
  }
  return null;
}
