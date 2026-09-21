"use client";

import { Effect, Exit } from "effect";
import { useCallback, useEffect, useRef, useState } from "react";
import { causeMessage } from "@/lib/error-message";
import {
  readManagedObjects,
  writeManagedObject,
} from "@/lib/studio/managed-objects";
import type { PreviewMessage } from "@/lib/studio/preview";
import {
  fieldProblem,
  inverseStudioOperation,
  type StudioOperation,
  type StudioSnapshot,
  type StudioValue,
  sameStudioValue,
} from "@/shared/studio-document";
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
  preview: PreviewControl;
  projectId: string | null;
  read?: typeof readManagedObjects;
  write?: typeof writeManagedObject;
}

export function useManagedObjects({
  projectId,
  preview,
  enabled,
  armed,
  read = readManagedObjects,
  write = writeManagedObject,
}: Options) {
  const [, repaint] = useState(0);
  const sessions = useRef(new Map<string, Session>());
  const active = useRef<Session | null>(null);
  const commitRef = useRef<(owner: Session | null) => void>(() => undefined);
  const { send, composition } = preview;
  const allowed = useRef(enabled);
  allowed.current = enabled;
  const publish = useCallback(() => repaint((value) => value + 1), []);
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
      operation: Pick<StudioOperation, "field" | "objectId" | "after">
    ) => {
      if (active.current !== owner || owner.generation === null) {
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
      if (message.type === "studio.ready" && message.video === owner.video) {
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
    [publish, reload]
  );
  useOnPreview(preview, onMessage);

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

  const select = useCallback(
    (id: string) => {
      const owner = active.current;
      if (owner !== null) {
        commitRef.current(owner);
        owner.dismissed = false;
        owner.selected = id;
        owner.open = true;
        publish();
      }
    },
    [publish]
  );

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
        owner === null ||
        object === undefined ||
        declared === undefined ||
        field === undefined
      ) {
        return;
      }
      const address = JSON.stringify([object.id, fieldId]);
      const held = owner.drafts.get(address);
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
    const owner = active.current;
    if (owner !== null) {
      commit();
      owner.open = false;
      owner.dismissed = true;
      owner.selected = null;
      publish();
    }
  }, [commit, publish]);

  const drafts = [...(session?.drafts.values() ?? [])];
  return {
    awaitingPreview: awaitingPreview(session),
    busy: drafts.some((draft) => draft.saving) || (session?.undoing ?? false),
    canUndo:
      enabled &&
      undoable !== undefined &&
      drafts.length === 0 &&
      !session?.undoing,
    change,
    close,
    commit,
    definition,
    discard,
    error: session?.error ?? drafts.find((draft) => draft.error)?.error ?? null,
    fields:
      definition?.fields.map((field) => {
        const draft = session?.drafts.get(
          JSON.stringify([selected?.id, field.id])
        );
        return {
          ...field,
          error: draft?.error ?? null,
          saving: draft?.attempted ?? false,
          value:
            draft?.operation.after ??
            selected?.values[field.id] ??
            field.default,
        };
      }) ?? [],
    isOpen,
    loading: session?.loading ?? false,
    objects: session?.snapshot?.document.objects ?? [],
    pending: drafts.length,
    reload,
    retry,
    select,
    selected,
    undo,
  };
}

export type ManagedObjects = ReturnType<typeof useManagedObjects>;

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
