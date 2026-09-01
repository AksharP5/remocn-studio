"use client";

import type { MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Composer } from "@/hooks/use-composer";
import { useNow } from "@/hooks/use-now";
import { type PreviewControl, useOnPreview } from "@/hooks/use-preview";
import {
  highlightCommand,
  inspectCommand,
  type PreviewInspect,
  type PreviewMessage,
  type PreviewRect,
  seekCommand,
  type TuningField,
  type TuningTarget,
  tuneResetCommand,
  tuneSetCommand,
} from "@/lib/studio/preview";
import { byTarget } from "@/lib/studio/tuning";
import type { PromptElement, TuningChange, TuningValue } from "@/shared/ipc";

const SILENCE = "500 millis";
const PATIENCE = 1500;

export interface Marker {
  id: string;
  index: number;
  rect: PreviewRect;
}

export interface PendingComment {
  element: PromptElement;
  /** Which of `targets` the pane is showing, innermost by default. */
  open: number;
  /** The values each target arrived with, per target, so a path that two of
   * them declare cannot collide and switching never loses a baseline. */
  originals: Readonly<Record<string, Readonly<Record<string, TuningValue>>>>;
  rect: PreviewRect;
  /** The `Interactive`s around the element, innermost first. */
  targets: readonly TuningTarget[];
  /** `targets[open]`, kept beside them so every reader stays one lookup deep. */
  tuning: TuningTarget | null;
}

export interface Inspection {
  cancelComment: () => void;
  canInspect: boolean;
  card: PendingComment | null;
  changeTuning: (path: string, value: TuningValue) => void;
  isArmed: boolean;
  markers: readonly Marker[];
  openSelection: (index: number) => void;
  openTarget: (index: number) => void;
  resetSelection: (index: number) => void;
  resetTuning: (paths?: readonly string[]) => void;
  seek: (event: MouseEvent<HTMLButtonElement>) => void;
  submitComment: (comment: string) => void;
  toggle: () => void;
  trouble: string | null;
  tuningRefusal: string | null;
  unavailable: string | null;
}

export interface InspectSettings {
  composer: Composer;
  isArmed: boolean;
  preview: PreviewControl;
  toggle: () => void;
  unavailable: string | null;
}

export function useInspect({
  composer,
  isArmed,
  preview,
  toggle,
  unavailable,
}: InspectSettings): Inspection {
  const [card, setCard] = useState<PendingComment | null>(null);
  const [drawn, setDrawn] = useState<readonly string[]>([]);
  const [asked, setAsked] = useState<number | null>(null);
  const [reported, setReported] = useState<PreviewInspect | null>(null);
  const [tuningRefusal, setTuningRefusal] = useState<string | null>(null);
  const requests = useRef(new Map<string, PendingComment>());
  const minted = useRef(0);
  const cardRef = useRef<PendingComment | null>(null);
  const pending = useRef(
    new Map<string, { before: PendingComment; value: TuningValue }>()
  );
  const flushHandle = useRef<number | null>(null);
  cardRef.current = card;

  const { select, selections } = composer;
  const { send } = preview;

  const abandon = useCallback(
    (pendingCard: PendingComment | null) => {
      // Only what is still pending. An added card's values are what its
      // message asks for, so reverting them on the way out would leave the
      // frame contradicting the request that was just made.
      if (pendingCard === null || changesOf(pendingCard).length === 0) {
        return;
      }

      pending.current.clear();

      for (const target of byTarget(
        pendingCard.targets.flatMap((each) => each.fields),
        []
      ).keys()) {
        send(tuneResetCommand(nextRequestId(minted), target, []));
      }
    },
    [send]
  );

  const onMessage = useCallback(
    (message: PreviewMessage) => {
      if (message.type === "selection") {
        const open = cardRef.current;

        // Clicking the same thing again is not a new selection. Without this
        // it would revert whatever had been tuned on it and reopen the chain
        // at the innermost link — a punishing answer to a stray second click.
        if (open !== null && sameElement(open, message.tuning)) {
          return;
        }

        // Picking elsewhere abandons what was pending, exactly as Cancel does.
        // It has to: the drafts live in the preview keyed by target, so a card
        // dropped without reverting would leave the frame showing values the
        // pane no longer lists and the agent will never be told about.
        abandon(open);
        setTuningRefusal(null);
        setCard(cardOf(message.element, message.rect, message.tuning));
        return;
      }

      if (message.type === "inspect") {
        setReported(message);
        return;
      }

      if (message.type === "rebuilt") {
        pending.current.clear();
        setDrawn([]);
        setCard(null);
        selections.markStale();
        return;
      }

      if (message.type === "tune.result" && !message.ok) {
        const before = requests.current.get(message.requestId);
        requests.current.delete(message.requestId);
        setTuningRefusal(
          message.error ?? "The preview refused that change without saying why."
        );
        if (before !== undefined) {
          setCard((current) =>
            current !== null &&
            current.tuning?.targetId === before.tuning?.targetId
              ? before
              : current
          );
        }
        return;
      }

      if (message.type === "tune.result") {
        requests.current.delete(message.requestId);
        setTuningRefusal(null);
      }
    },
    [abandon, selections]
  );

  useOnPreview(preview, onMessage);

  useEffect(() => {
    setReported(null);
    setAsked(Date.now());
    send(inspectCommand(isArmed));

    // The card outlives the mode. Turning Inspect off means "stop picking",
    // not "throw away what I picked" — its values are still live in the frame
    // and still on their way to the composer, so closing the pane here would
    // silently revert work the person never asked to undo. Cancel and Add are
    // the two ways out, and they say which they are.
    if (!isArmed) {
      setDrawn([]);
    }
  }, [isArmed, send]);

  // Which link of the chain the pane is on, drawn in the preview so the names
  // in the switcher are places rather than words. Keyed on the id alone, so
  // editing a value does not repaint the box.
  const openTargetId = card?.tuning?.targetId ?? null;

  useEffect(() => {
    if (isArmed) {
      send(highlightCommand(openTargetId));
    }
  }, [isArmed, openTargetId, send]);

  // Read through the ref, not through state: an edit writes the card there
  // immediately, so Add made in the same tick as the last drag still carries
  // it.
  const submitComment = useCallback(
    (comment: string) => {
      const open = cardRef.current;

      if (open === null) {
        return;
      }

      const changes = changesOf(open);
      const id = select(
        changes.length === 0
          ? open.element
          : { ...open.element, tuningChanges: changes },
        open.rect,
        comment,
        open.tuning === null
          ? null
          : {
              originals: open.originals[open.tuning.targetId] ?? {},
              target: open.tuning,
            }
      );
      setDrawn((current) => [...current, id]);

      // The pane stays open on what was just added, and the values stay live
      // in the frame — they are what the message asks for. What has to move is
      // the baseline: rebased here, a second Add carries only what changed
      // since the first, instead of asking twice for the same thing.
      const settled = { ...open, originals: originalsOf(open.targets) };
      cardRef.current = settled;
      setCard(settled);
    },
    [select]
  );

  const flushTuning = useCallback(() => {
    flushHandle.current = null;
    const stashed = [...pending.current];
    pending.current.clear();

    for (const [key, { before, value }] of stashed) {
      const { path, target } = unkeyed(key);
      const requestId = nextRequestId(minted);
      requests.current.set(requestId, before);
      send(tuneSetCommand(requestId, target, path, value));
    }
  }, [send]);

  useEffect(
    () => () => {
      if (flushHandle.current !== null) {
        cancelAnimationFrame(flushHandle.current);
      }
    },
    []
  );

  // No paths means the whole selection — every target in the chain, not only
  // the one on screen, since Reset all and Cancel have to undo edits made
  // before the pane was switched.
  const resetTuning = useCallback(
    (paths: readonly string[] = []) => {
      const { current } = cardRef;
      if (current === null || current.tuning === null) {
        return;
      }

      const whole = paths.length === 0;
      const fields = whole
        ? current.targets.flatMap((target) => target.fields)
        : current.tuning.fields;

      if (whole) {
        pending.current.clear();
      } else {
        for (const path of paths) {
          pending.current.delete(keyed(current.tuning.targetId, path));
        }
      }

      for (const [target, owned] of byTarget(fields, paths)) {
        const requestId = nextRequestId(minted);
        requests.current.set(requestId, current);
        send(tuneResetCommand(requestId, target, owned));
      }

      const next = withOriginalValues(current, paths, whole);
      cardRef.current = next;
      setCard(next);
    },
    [send]
  );

  const changeTuning = useCallback(
    (path: string, value: TuningValue) => {
      const { current } = cardRef;
      if (current === null || current.tuning === null) {
        return;
      }

      const key = keyed(current.tuning.targetId, path);
      const held = pending.current.get(key);
      pending.current.set(key, { before: held?.before ?? current, value });

      if (flushHandle.current === null) {
        flushHandle.current = requestAnimationFrame(flushTuning);
      }

      const next = withValue(current, path, value);
      cardRef.current = next;
      setCard(next);
    },
    [flushTuning]
  );

  // Switching is a read: the whole chain arrived with the selection, so no
  // round trip and no re-pick. Edits already made on another target stay in
  // `targets` and still count towards Add.
  const openTarget = useCallback((index: number) => {
    setCard((current) => {
      const target = current?.targets[index];

      return current === undefined || current === null || target === undefined
        ? current
        : { ...current, open: index, tuning: target };
    });
  }, []);

  const cancelComment = useCallback(() => {
    resetTuning();
    setCard(null);
  }, [resetTuning]);

  const openSelection = useCallback(
    (index: number) => {
      const item = selections.items[index];
      if (item?.tuning === null || item === undefined || item.stale) {
        return;
      }

      // A stored selection keeps the target that was edited, so it comes
      // back as a chain of one — there is nothing to switch between.
      setCard({
        element: item.element,
        open: 0,
        originals: {
          [item.tuning.target.targetId]: item.tuning.originals,
        },
        rect: item.rect,
        targets: [item.tuning.target],
        tuning: item.tuning.target,
      });
    },
    [selections.items]
  );

  const resetSelection = useCallback(
    (index: number) => {
      const item = selections.items[index];
      if (item?.tuning === null || item === undefined || item.stale) {
        return;
      }

      for (const target of byTarget(item.tuning.target.fields, []).keys()) {
        send(tuneResetCommand(nextRequestId(minted), target, []));
      }
    },
    [selections.items, send]
  );

  const seek = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const found = selections.items[Number(event.currentTarget.value)];
      if (found !== undefined) {
        send(seekCommand(found.element.frame));
      }
    },
    [selections.items, send]
  );

  const markers = useMemo(() => {
    const showing = new Set(drawn);

    return selections.items
      .map((item, index) => ({ id: item.id, index, rect: item.rect }))
      .filter((marker) => isArmed && showing.has(marker.id));
  }, [drawn, isArmed, selections.items]);

  const now = useNow(isArmed && reported === null ? SILENCE : null);
  const trouble = troubleOf(isArmed, reported, asked, now);

  return useMemo(
    () => ({
      cancelComment,
      canInspect: unavailable === null,
      card,
      changeTuning,
      isArmed,
      markers,
      openSelection,
      openTarget,
      resetSelection,
      resetTuning,
      seek,
      submitComment,
      toggle,
      trouble,
      tuningRefusal,
      unavailable,
    }),
    [
      card,
      cancelComment,
      changeTuning,
      isArmed,
      markers,
      openSelection,
      openTarget,
      resetTuning,
      resetSelection,
      seek,
      submitComment,
      toggle,
      trouble,
      tuningRefusal,
      unavailable,
    ]
  );
}

/** The same pick as the one already open, by the link it opened on. */
function sameElement(
  card: PendingComment,
  targets: readonly TuningTarget[]
): boolean {
  const was = card.targets.at(0)?.targetId;

  return was !== undefined && was === targets.at(0)?.targetId;
}

function keyed(target: string, path: string): string {
  return `${target}\u0000${path}`;
}

function unkeyed(key: string): { path: string; target: string } {
  const [target = "", path = ""] = key.split("\u0000");
  return { path, target };
}

function originalsOf(
  targets: readonly TuningTarget[]
): Record<string, Record<string, TuningValue>> {
  return Object.fromEntries(
    targets.map((target) => [
      target.targetId,
      Object.fromEntries(
        target.fields.map((field) => [field.path, field.value])
      ),
    ])
  );
}

function cardOf(
  element: PromptElement,
  rect: PreviewRect,
  targets: readonly TuningTarget[]
): PendingComment {
  return {
    element,
    open: 0,
    originals: originalsOf(targets),
    rect,
    targets,
    tuning: targets.at(0) ?? null,
  };
}

/** The same card with one field of the open target moved. */
function withValue(
  card: PendingComment,
  path: string,
  value: TuningValue
): PendingComment {
  return mapOpen(card, (field) =>
    field.path === path ? { ...field, value } : field
  );
}

function withOriginalValues(
  card: PendingComment,
  paths: readonly string[],
  whole: boolean
): PendingComment {
  const reset = new Set(paths);
  const restore = (field: TuningField, target: string) =>
    whole || reset.has(field.path)
      ? {
          ...field,
          value: card.originals[target]?.[field.path] ?? field.value,
        }
      : field;

  if (!whole) {
    return mapOpen(card, (field) =>
      restore(field, card.tuning?.targetId ?? "")
    );
  }

  const targets = card.targets.map((target) => ({
    ...target,
    fields: target.fields.map((field) => restore(field, target.targetId)),
  }));

  return { ...card, targets, tuning: targets[card.open] ?? null };
}

function mapOpen(
  card: PendingComment,
  step: (field: TuningField) => TuningField
): PendingComment {
  if (card.tuning === null) {
    return card;
  }

  const targets = card.targets.map((target, at) =>
    at === card.open ? { ...target, fields: target.fields.map(step) } : target
  );

  return { ...card, targets, tuning: targets[card.open] ?? null };
}

/** Every field of every target that moved — the pane may have been switched. */
function changesOf(card: PendingComment): TuningChange[] {
  return card.targets.flatMap((target) =>
    target.fields.flatMap((field) => {
      const from = card.originals[target.targetId]?.[field.path];

      return from === undefined || sameValue(from, field.value)
        ? []
        : [{ from, path: field.path, to: field.value }];
    })
  );
}

function sameValue(first: TuningValue, second: TuningValue): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

function nextRequestId(minted: { current: number }): string {
  minted.current += 1;
  return `tune-${minted.current}`;
}

function troubleOf(
  isArmed: boolean,
  reported: PreviewInspect | null,
  asked: number | null,
  now: number
): string | null {
  if (!isArmed) {
    return null;
  }

  const status = reported?.status ?? null;
  if (status === "no-grab") {
    return "React Grab did not load, so selections will carry no source location.";
  }

  if (status === "no-canvas") {
    return "The player is not on screen yet, so there is nothing to pick from.";
  }

  if (reported?.paused) {
    return null;
  }

  if (status !== null) {
    return "The preview answered, but its player did not — the video will not pause.";
  }

  return asked !== null && now - asked > PATIENCE
    ? "Inspect is on, but the preview never answered — its page is probably from an older build. Restart the preview."
    : null;
}
