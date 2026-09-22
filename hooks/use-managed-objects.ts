"use client";

import { Effect, Exit } from "effect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { causeMessage } from "@/lib/error-message";
import { inlineTextField } from "@/lib/studio/inline-text";
import {
  readManagedObjects,
  writeManagedObject,
} from "@/lib/studio/managed-objects";
import type { PreviewCommand, PreviewMessage } from "@/lib/studio/preview";
import {
  fieldProblem,
  inverseStudioOperation,
  type StudioOperation,
  type StudioSnapshot,
  type StudioValue,
  sameStudioValue,
  studioOperationChanges,
} from "@/shared/studio-document";
import { GEOMETRY_KEYS, type GeometryBinding } from "@/shared/studio-geometry";
import { type PreviewControl, useOnPreview } from "./use-preview";

interface Draft {
  attempted: boolean;
  error: string | null;
  operation: StudioOperation;
  saving: boolean;
}

interface Session {
  awaitingOperation: string | null;
  commitAgain: boolean;
  dismissed: boolean;
  drafts: Map<string, Draft>;
  epoch: number;
  error: string | null;
  generation: string | null;
  loading: boolean;
  open: boolean;
  projectId: string;
  renderedOperation: string | null;
  selected: string | null;
  snapshot: StudioSnapshot | null;
  undoing: boolean;
  video: string;
  writing: boolean;
}

interface Options {
  armed: boolean;
  enabled: boolean;
  inlineEnabled?: boolean;
  preview: PreviewControl;
  projectId: string | null;
  read?: typeof readManagedObjects;
  write?: typeof writeManagedObject;
}

export function useManagedObjects({
  projectId,
  preview,
  enabled,
  inlineEnabled = enabled,
  armed,
  read = readManagedObjects,
  write = writeManagedObject,
}: Options) {
  const [localRevision, repaint] = useState(0);
  const sessions = useRef(new Map<string, Session>());
  const active = useRef<Session | null>(null);
  const commitRef = useRef<(owner: Session | null) => void>(() => undefined);
  const { send, composition } = preview;
  const previewUrl =
    preview.preview.phase === "ready" ? preview.preview.url : null;
  const allowed = useRef(enabled);
  allowed.current = enabled;
  const inlineAllowed = useRef(inlineEnabled && enabled);
  inlineAllowed.current = inlineEnabled && enabled;
  const inline = useRef<{
    generation: string;
    operation: StudioOperation;
    owner: Session;
    requestId: string;
  } | null>(null);
  const inlineMessage = useRef<(message: PreviewMessage) => void>(
    () => undefined
  );
  const geometry = useRef<{
    binding: GeometryBinding;
    generation: string;
    objectId: string;
    owner: Session;
    requestId: string;
    snapshot: StudioSnapshot;
  } | null>(null);
  const geometryMessage = useRef<(message: PreviewMessage) => void>(
    () => undefined
  );
  const geometryConfigRef = useRef<Extract<
    PreviewCommand,
    { type: "studio.geometry.config" }
  > | null>(null);
  const publish = useCallback(() => repaint((value) => value + 1), []);
  const cancelInline = useCallback(() => {
    const editing = inline.current;
    inline.current = null;
    if (editing !== null) {
      send({
        error: null,
        requestId: editing.requestId,
        source: "remocn-studio",
        type: "studio.text.close",
      });
      publish();
    }
  }, [publish, send]);
  const cancelGeometry = useCallback(() => {
    const gesture = geometry.current;
    geometry.current = null;
    if (gesture !== null) {
      send({
        error: "The transform was cancelled.",
        requestId: gesture.requestId,
        source: "remocn-studio",
        type: "studio.geometry.result",
      });
      publish();
    }
  }, [publish, send]);
  const key =
    projectId === null || composition === null
      ? null
      : JSON.stringify([projectId, composition]);
  if (
    key !== null &&
    projectId !== null &&
    composition !== null &&
    !sessions.current.has(key)
  ) {
    sessions.current.set(key, {
      awaitingOperation: null,
      commitAgain: false,
      dismissed: false,
      drafts: new Map(),
      epoch: 0,
      error: null,
      generation: null,
      loading: false,
      open: false,
      projectId,
      renderedOperation: null,
      selected: null,
      snapshot: null,
      undoing: false,
      video: composition,
      writing: false,
    });
  }
  const session = key === null ? null : (sessions.current.get(key) ?? null);
  active.current = session;

  const broadcast = useCallback(
    (
      owner: Session,
      operation: Pick<
        StudioOperation,
        "field" | "objectId" | "after" | "changes"
      >
    ) => {
      if (active.current !== owner || owner.generation === null) {
        return;
      }
      if (operation.changes?.length) {
        send({
          generation: owner.generation,
          objectId: operation.objectId,
          source: "remocn-studio",
          type: "studio.batch",
          values: Object.fromEntries([
            [operation.field, operation.after],
            ...operation.changes.map((change) => [change.field, change.after]),
          ]),
        });
        return;
      }
      send({
        field: operation.field,
        generation: owner.generation,
        objectId: operation.objectId,
        source: "remocn-studio",
        type: "studio.draft",
        value: operation.after,
      });
    },
    [send]
  );

  const replay = useCallback(
    (owner: Session, snapshot: StudioSnapshot) => {
      for (const object of snapshot.document.objects) {
        for (const [field, value] of Object.entries(object.values)) {
          broadcast(owner, { after: value, field, objectId: object.id });
        }
      }
      for (const draft of owner.drafts.values()) {
        if (draft.error === null) {
          broadcast(owner, draft.operation);
        }
      }
    },
    [broadcast]
  );

  const reload = useCallback(() => {
    const owner = active.current;
    if (owner === null || !allowed.current || owner.generation === null) {
      return;
    }
    owner.epoch += 1;
    const { epoch } = owner;
    owner.loading = true;
    publish();
    Effect.runPromiseExit(
      read({ projectId: owner.projectId, video: owner.video })
    ).then((result) => {
      if (epoch !== owner.epoch) {
        return;
      }
      owner.loading = false;
      if (Exit.isFailure(result)) {
        owner.error =
          causeMessage(result.cause) ??
          "The object's properties could not be loaded.";
      } else {
        owner.snapshot = result.value;
        owner.error = null;
        if (
          owner.selected !== null &&
          !result.value.document.objects.some(
            (object) => object.id === owner.selected
          )
        ) {
          owner.selected = null;
        }
        replay(owner, result.value);
      }
      publish();
    });
  }, [publish, read, replay]);

  const onMessage = useCallback(
    (message: PreviewMessage) => {
      const owner = active.current;
      if (owner === null || !allowed.current) {
        return;
      }
      if (message.type.startsWith("studio.text.")) {
        inlineMessage.current(message);
        return;
      }
      if (message.type.startsWith("studio.geometry.")) {
        geometryMessage.current(message);
        return;
      }
      if (message.type === "studio.ready" && message.video === owner.video) {
        if (owner.generation !== message.generation) {
          cancelInline();
          cancelGeometry();
        }
        owner.generation = message.generation;
        owner.renderedOperation = message.lastOperationId;
        reload();
      } else if (
        message.type === "studio.select" &&
        message.video === owner.video &&
        message.generation === owner.generation
      ) {
        commitRef.current(owner);
        owner.dismissed = false;
        owner.selected = message.objectId;
        owner.open = true;
        publish();
      } else if (message.type === "selection") {
        commitRef.current(owner);
        owner.dismissed = true;
        owner.open = false;
        publish();
      }
    },
    [cancelGeometry, cancelInline, publish, reload]
  );
  useOnPreview(preview, onMessage);

  useEffect(
    () => cancelInline,
    [cancelInline, session, enabled, inlineEnabled, previewUrl]
  );
  useEffect(
    () => cancelGeometry,
    [cancelGeometry, session, enabled, inlineEnabled, previewUrl]
  );

  useEffect(() => {
    if (enabled && key !== null && preview.isServing) {
      send({ source: "remocn-studio", type: "studio.request" });
    }
  }, [enabled, key, preview.isServing, send]);

  useEffect(() => {
    if (armed && session) {
      session.dismissed = false;
      publish();
    }
  }, [armed, session, publish]);

  const isOpen =
    enabled &&
    session !== null &&
    (session.open ||
      (armed && !session.dismissed && session.generation !== null));
  const selected =
    session?.snapshot?.document.objects.find(
      (object) => object.id === session.selected
    ) ?? null;
  const definition =
    session?.snapshot?.document.definitions.find(
      (item) => item.id === selected?.definition
    ) ?? null;
  const generation = session?.generation;
  const revision = session?.snapshot?.revision;
  const video = session?.video;
  useEffect(() => {
    if (!(generation && revision && video)) {
      return;
    }
    send({
      generation,
      objectId: isOpen ? (selected?.id ?? null) : null,
      source: "remocn-studio",
      type: "studio.highlight",
      video,
    });
  }, [isOpen, selected?.id, send, generation, revision, video]);

  const geometryAvailable =
    inlineEnabled &&
    enabled &&
    isOpen &&
    !session?.loading &&
    !session?.writing &&
    !session?.undoing &&
    session?.drafts.size === 0 &&
    inline.current === null;
  const geometryConfig = useMemo(() => {
    if (!(generation && video)) return null;
    return {
      source: "remocn-studio" as const,
      type: "studio.geometry.config" as const,
      enabled: geometryAvailable,
      generation,
      video,
      objectId: isOpen ? (selected?.id ?? null) : null,
      fields:
        definition?.fields.flatMap((field) => {
          const held =
            session && selected
              ? draftForField(session, selected.id, field.id)
              : null;
          const value = held?.change.after ?? selected?.values[field.id];
          return field.type === "number" && typeof value === "number"
            ? [
                {
                  id: field.id,
                  value,
                  min: field.min ?? null,
                  max: field.max ?? null,
                },
              ]
            : [];
        }) ?? [],
    };
  }, [
    definition,
    generation,
    geometryAvailable,
    isOpen,
    localRevision,
    selected,
    session,
    video,
  ]);
  geometryConfigRef.current = geometryConfig;
  useEffect(() => {
    if (geometryConfig) send(geometryConfig);
  }, [geometryConfig, send]);

  const select = useCallback(
    (id: string) => {
      cancelGeometry();
      const owner = active.current;
      if (owner !== null) {
        commitRef.current(owner);
        owner.dismissed = false;
        owner.selected = id;
        owner.open = true;
        publish();
      }
    },
    [cancelGeometry, publish]
  );

  const open = useCallback(() => {
    const owner = active.current;
    if (owner !== null && owner.generation !== null && allowed.current) {
      owner.dismissed = false;
      owner.open = true;
      publish();
    }
  }, [publish]);

  const change = useCallback(
    (fieldId: string, value: StudioValue) => {
      const owner = active.current;
      const object = owner?.snapshot?.document.objects.find(
        (item) => item.id === owner.selected
      );
      const declared = owner?.snapshot?.document.definitions.find(
        (item) => item.id === object?.definition
      );
      const field = declared?.fields.find((item) => item.id === fieldId);
      if (
        !allowed.current ||
        geometry.current !== null ||
        inline.current !== null ||
        owner === null ||
        object === undefined ||
        declared === undefined ||
        field === undefined
      ) {
        return;
      }
      const address = JSON.stringify([object.id, fieldId]);
      const held = draftForField(owner, object.id, fieldId)?.draft;
      if (held?.attempted || owner.undoing) {
        return;
      }
      const operation = {
        ...(held?.operation ?? {
          before: object.values[fieldId],
          definition: declared,
          field: fieldId,
          id: crypto.randomUUID(),
          objectId: object.id,
        }),
        after: value,
      };
      if (sameStudioValue(value, operation.before)) {
        owner.drafts.delete(address);
        broadcast(owner, operation);
        publish();
        return;
      }
      const error = fieldProblem(field, value);
      owner.drafts.set(address, {
        attempted: false,
        error,
        operation,
        saving: false,
      });
      if (error === null) {
        broadcast(owner, operation);
      }
      publish();
    },
    [broadcast, publish]
  );

  const commitOwner = useCallback(
    (owner: Session | null) => {
      if (owner === null || !allowed.current || owner.undoing) {
        return;
      }
      if (owner.writing) {
        owner.commitAgain = true;
        return;
      }
      const pending = [...owner.drafts.entries()].filter(
        ([, draft]) => !draft.saving && draft.error === null
      );
      if (pending.length === 0) {
        return;
      }
      owner.writing = true;
      for (const [, draft] of pending) {
        draft.saving = true;
        draft.attempted = true;
      }
      publish();
      Effect.runPromiseExit(
        Effect.forEach(
          pending,
          ([address, draft]) =>
            Effect.gen(function* () {
              const result = yield* Effect.exit(
                write({
                  operation: draft.operation,
                  plan: "pro",
                  projectId: owner.projectId,
                  video: owner.video,
                })
              );
              if (Exit.isFailure(result)) {
                draft.error =
                  causeMessage(result.cause) ??
                  "This change could not be saved.";
                draft.saving = false;
              } else {
                owner.epoch += 1;
                owner.loading = false;
                owner.snapshot = result.value;
                owner.awaitingOperation =
                  result.value.document.operations.at(-1)?.id ?? null;
                owner.drafts.delete(address);
              }
              publish();
            }),
          { concurrency: 1 }
        )
      ).then((result) => {
        owner.writing = false;
        if (Exit.isFailure(result)) {
          owner.error = causeMessage(result.cause) ?? "Saving failed.";
        }
        publish();
        if (owner.commitAgain) {
          owner.commitAgain = false;
          commitRef.current(owner);
        }
      });
    },
    [publish, write]
  );
  commitRef.current = commitOwner;
  geometryMessage.current = (message) => {
    const result = (requestId: string, error: string | null) =>
      send({
        source: "remocn-studio",
        type: "studio.geometry.result",
        requestId,
        error,
      });
    if (message.type === "studio.geometry.request") {
      if (geometryConfigRef.current) send(geometryConfigRef.current);
      return;
    }
    if (message.type === "studio.geometry.cancel") {
      if (geometry.current?.requestId === message.requestId) {
        geometry.current = null;
        publish();
      }
      return;
    }
    if (message.type === "studio.geometry.begin") {
      const owner = active.current;
      if (
        !inlineAllowed.current ||
        !owner?.snapshot ||
        owner.generation !== message.generation ||
        owner.video !== message.video ||
        owner.selected !== message.objectId ||
        owner.loading ||
        owner.writing ||
        owner.undoing ||
        owner.drafts.size > 0 ||
        inline.current ||
        geometry.current
      ) {
        result(
          message.requestId,
          "Finish the current edit before transforming this object."
        );
        return;
      }
      const object = owner.snapshot.document.objects.find(
        (item) => item.id === message.objectId
      );
      const definition = owner.snapshot.document.definitions.find(
        (item) => item.id === object?.definition
      );
      const fields = Object.values(message.binding).filter(
        (field): field is string => field !== null
      );
      if (
        !object ||
        !definition ||
        new Set(fields).size !== fields.length ||
        GEOMETRY_KEYS.some((key) => {
          const id = message.binding[key];
          if (id === null)
            return key !== "rotation" || message.values.rotation !== 0;
          const field = definition.fields.find((item) => item.id === id);
          const value = object.values[id];
          return (
            field?.type !== "number" ||
            typeof value !== "number" ||
            !sameStudioValue(value, message.values[key]) ||
            (field.unit !== undefined &&
              field.unit !== (key === "rotation" ? "deg" : "px")) ||
            ((key === "width" || key === "height") && value < 1)
          );
        })
      ) {
        result(
          message.requestId,
          "This object does not declare editable geometry."
        );
        return;
      }
      geometry.current = {
        binding: message.binding,
        generation: message.generation,
        objectId: object.id,
        owner,
        requestId: message.requestId,
        snapshot: owner.snapshot,
      };
      publish();
      return;
    }
    if (message.type !== "studio.geometry.commit") return;
    const gesture = geometry.current;
    if (gesture?.requestId !== message.requestId) return;
    const { owner, snapshot, objectId, binding } = gesture;
    geometry.current = null;
    if (
      !inlineAllowed.current ||
      active.current !== owner ||
      owner.generation !== gesture.generation ||
      owner.snapshot?.revision !== snapshot.revision ||
      owner.loading ||
      owner.writing ||
      owner.undoing ||
      owner.drafts.size > 0
    ) {
      result(
        message.requestId,
        "The object changed during the gesture. Try again."
      );
      publish();
      return;
    }
    const object = snapshot.document.objects.find(
      (item) => item.id === objectId
    )!;
    const definition = snapshot.document.definitions.find(
      (item) => item.id === object.definition
    )!;
    const changes = GEOMETRY_KEYS.flatMap((key) => {
      const field = binding[key];
      return field === null ||
        sameStudioValue(object.values[field], message.values[key])
        ? []
        : [{ field, before: object.values[field], after: message.values[key] }];
    });
    const problem = changes
      .map((change) =>
        fieldProblem(
          definition.fields.find((field) => field.id === change.field)!,
          change.after
        )
      )
      .find((error) => error !== null);
    if (problem) {
      result(message.requestId, problem);
    } else if (changes.length > 0) {
      const [first, ...rest] = changes;
      const operation: StudioOperation = {
        ...first,
        changes: rest,
        definition,
        id: crypto.randomUUID(),
        objectId,
      };
      owner.drafts.set(JSON.stringify([objectId, first.field]), {
        operation,
        attempted: false,
        error: null,
        saving: false,
      });
      broadcast(owner, operation);
      commitOwner(owner);
      result(message.requestId, null);
    } else {
      result(message.requestId, null);
    }
    publish();
  };
  inlineMessage.current = (message) => {
    const reply = (requestId: string, error: string | null) =>
      send({
        error,
        requestId,
        source: "remocn-studio",
        type: "studio.text.close",
      });

    if (message.type === "studio.text.cancel") {
      if (inline.current?.requestId === message.requestId) {
        inline.current = null;
        publish();
      }
      return;
    }
    if (message.type === "studio.text.request") {
      cancelInline();
      const owner = active.current;
      if (
        !inlineAllowed.current ||
        owner === null ||
        owner.video !== message.video ||
        owner.generation !== message.generation
      ) {
        reply(
          message.requestId,
          "Text editing is unavailable in this preview."
        );
        return;
      }
      if (
        owner.loading ||
        owner.writing ||
        owner.undoing ||
        owner.drafts.size > 0 ||
        geometry.current
      ) {
        reply(
          message.requestId,
          "Finish saving the current properties, then edit this text."
        );
        return;
      }
      const object = owner.snapshot?.document.objects.find(
        (item) => item.id === message.objectId
      );
      const definition = owner.snapshot?.document.definitions.find(
        (item) => item.id === object?.definition
      );
      const match =
        object && definition
          ? inlineTextField(object, definition, message.candidates)
          : null;
      if (!object || !definition || !match) {
        reply(
          message.requestId,
          "Edit this text in Properties; its text field is not uniquely bound."
        );
        return;
      }
      const value = object.values[match.field.id];
      if (typeof value !== "string") {
        return;
      }
      inline.current = {
        generation: message.generation,
        operation: {
          after: value,
          before: value,
          definition,
          field: match.field.id,
          id: crypto.randomUUID(),
          objectId: object.id,
        },
        owner,
        requestId: message.requestId,
      };
      owner.selected = object.id;
      owner.open = true;
      owner.dismissed = false;
      send({
        candidate: match.candidate,
        label: match.field.label,
        requestId: message.requestId,
        source: "remocn-studio",
        type: "studio.text.open",
        value,
      });
      publish();
      return;
    }
    if (message.type !== "studio.text.commit") {
      return;
    }
    const editing = inline.current;
    if (editing === null || editing.requestId !== message.requestId) {
      return;
    }
    const { owner, operation } = editing;
    const object = owner.snapshot?.document.objects.find(
      (item) => item.id === operation.objectId
    );
    if (
      !inlineAllowed.current ||
      active.current !== owner ||
      owner.generation !== editing.generation ||
      !object ||
      !sameStudioValue(object.values[operation.field], operation.before) ||
      owner.loading ||
      owner.writing ||
      owner.undoing ||
      owner.drafts.size > 0
    ) {
      reply(
        message.requestId,
        "Properties changed during editing. Copy your text, then reopen the field."
      );
      return;
    }
    inline.current = null;
    if (!sameStudioValue(message.value, operation.before)) {
      const updated = { ...operation, after: message.value };
      owner.drafts.set(JSON.stringify([operation.objectId, operation.field]), {
        attempted: false,
        error: null,
        operation: updated,
        saving: false,
      });
      broadcast(owner, updated);
      commitOwner(owner);
    }
    reply(message.requestId, null);
    publish();
  };
  const commit = useCallback(() => commitOwner(active.current), [commitOwner]);
  const retry = useCallback(() => {
    const owner = active.current;
    if (!owner) {
      return;
    }
    for (const draft of owner.drafts.values()) {
      if (draft.attempted && !draft.saving) {
        draft.error = null;
      }
    }
    commitOwner(owner);
  }, [commitOwner]);

  const discard = useCallback(() => {
    const owner = active.current;
    if (owner === null) {
      return;
    }
    for (const [address, draft] of owner.drafts) {
      if (draft.saving) {
        continue;
      }
      const object = owner.snapshot?.document.objects.find(
        (item) => item.id === draft.operation.objectId
      );
      broadcast(owner, {
        ...draft.operation,
        after: object?.values[draft.operation.field] ?? draft.operation.before,
        changes: draft.operation.changes?.map((change) => ({
          ...change,
          after: object?.values[change.field] ?? change.before,
        })),
      });
      owner.drafts.delete(address);
    }
    publish();
    reload();
  }, [broadcast, publish, reload]);

  const operations = session?.snapshot?.document.operations ?? [];
  const undone = new Set(
    operations.flatMap((operation) =>
      operation.undoOf ? [operation.undoOf] : []
    )
  );
  const undoable = operations.findLast(
    (operation) => !(operation.undoOf || undone.has(operation.id))
  );
  const undo = useCallback(() => {
    const owner = active.current;
    if (
      owner === null ||
      !allowed.current ||
      !undoable ||
      owner.undoing ||
      geometry.current !== null ||
      inline.current !== null ||
      owner.drafts.size > 0
    ) {
      return;
    }
    owner.undoing = true;
    owner.error = null;
    publish();
    const operation = inverseStudioOperation(undoable, crypto.randomUUID());
    Effect.runPromiseExit(
      write({
        operation,
        plan: "pro",
        projectId: owner.projectId,
        video: owner.video,
      })
    ).then((result) => {
      owner.undoing = false;
      if (Exit.isFailure(result)) {
        owner.error =
          causeMessage(result.cause) ?? "The change could not be undone.";
      } else {
        owner.epoch += 1;
        owner.loading = false;
        owner.snapshot = result.value;
        owner.awaitingOperation =
          result.value.document.operations.at(-1)?.id ?? null;
        broadcast(owner, operation);
      }
      publish();
    });
  }, [broadcast, publish, undoable, write]);

  const close = useCallback(() => {
    cancelInline();
    cancelGeometry();
    const owner = active.current;
    if (owner !== null) {
      commit();
      owner.open = false;
      owner.dismissed = true;
      owner.selected = null;
      publish();
    }
  }, [cancelGeometry, cancelInline, commit, publish]);

  const drafts = [...(session?.drafts.values() ?? [])];
  return {
    awaitingPreview: awaitingPreview(session),
    busy:
      drafts.some((draft) => draft.saving) ||
      (session?.undoing ?? false) ||
      geometry.current !== null,
    canUndo:
      enabled &&
      undoable !== undefined &&
      drafts.length === 0 &&
      geometry.current === null &&
      inline.current === null &&
      !session?.undoing,
    change,
    close,
    commit,
    definition,
    discard,
    editingText: inline.current !== null,
    error: session?.error ?? drafts.find((draft) => draft.error)?.error ?? null,
    fields:
      definition?.fields.map((field) => {
        const held =
          session && selected
            ? draftForField(session, selected.id, field.id)
            : null;
        const draft = held?.draft;
        return {
          ...field,
          error: draft?.error ?? null,
          saving:
            geometry.current !== null ||
            inline.current !== null ||
            (draft?.attempted ?? false),
          value:
            held?.change.after ?? selected?.values[field.id] ?? field.default,
        };
      }) ?? [],
    isOpen,
    loading: session?.loading ?? false,
    objects: session?.snapshot?.document.objects ?? [],
    open,
    pending: drafts.length,
    reload,
    retry,
    select,
    selected,
    undo,
  };
}

export type ManagedObjects = ReturnType<typeof useManagedObjects>;

function draftForField(owner: Session, objectId: string, field: string) {
  for (const draft of owner.drafts.values()) {
    if (draft.operation.objectId !== objectId) continue;
    const change = studioOperationChanges(draft.operation).find(
      (item) => item.field === field
    );
    if (change) return { draft, change };
  }
  return null;
}

function awaitingPreview(session: Session | null): boolean {
  if (!session?.awaitingOperation) {
    return false;
  }
  const operations = session.snapshot?.document.operations ?? [];
  const expected = operations.findIndex(
    (operation) => operation.id === session.awaitingOperation
  );
  const rendered = operations.findIndex(
    (operation) => operation.id === session.renderedOperation
  );
  return expected === -1 || rendered < expected;
}
