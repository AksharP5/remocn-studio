"use client";

import { Duration, Effect, Fiber } from "effect";
import type { MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toastManager } from "@/components/ui/toast";
import type { Composer } from "@/hooks/use-composer";
import { useNow } from "@/hooks/use-now";
import { type PreviewControl, useOnPreview } from "@/hooks/use-preview";
import {
  highlightCommand,
  inspectCommand,
  type PreviewInspect,
  type PreviewMessage,
  type PreviewPlayhead,
  type PreviewRect,
  type PreviewSelection,
  type PreviewTuneResult,
  type PreviewTuningValues,
  type PreviewWindow,
  replayCommand,
  seekCommand,
  type TuningField,
  type TuningTarget,
  tuneResetCommand,
  tuneSetCommand,
  tuningReadCommand,
} from "@/lib/studio/preview";
import {
  byTarget,
  changedFields,
  changedPaths,
  sameTuningValue,
  titleOf,
} from "@/lib/studio/tuning";
import type {
  PromptElement,
  TuningChange,
  TuningOwner,
  TuningValue,
} from "@/shared/ipc";

const SILENCE = "500 millis";
const PATIENCE = 1500;
const UNDO_WINDOW = "10 seconds";
const REPLAY_DELAY = "250 millis";
const READ_INTERVAL = "250 millis";
const TIMED_GROUPS = new Set(["Effects", "Entry", "Exit", "Timing"]);
const TEXT_PATH = "children";
const EASING_PATH = /[eE]asing$/;
const EMPTY: ReadonlySet<string> = new Set<string>();

export interface Marker {
  id: string;
  index: number;
  rect: PreviewRect;
}

export interface TextDraft {
  draft: string;
  from: string;
}

export interface PendingComment {
  animated?: ReadonlySet<string>;
  element: PromptElement;
  fonts?: readonly string[];
  /** Which of `targets` the pane is showing, innermost by default. */
  open: number;
  /** The values each target arrived with, per target, so a path that two of
   * them declare cannot collide and switching never loses a baseline. */
  originals: Readonly<Record<string, Readonly<Record<string, TuningValue>>>>;
  rect: PreviewRect;
  /** The `Interactive`s around the element, innermost first. */
  targets: readonly TuningTarget[];
  text?: TextDraft | null;
  /** `targets[open]`, kept beside them so every reader stays one lookup deep. */
  tuning: TuningTarget | null;
  window?: PreviewWindow | null;
}

export interface TuningRefusal {
  message: string;
  path: string | null;
  targetId: string | null;
}

export interface Inspection {
  cancelComment: () => void;
  canInspect: boolean;
  card: PendingComment | null;
  changeText: (value: string) => void;
  changeTuning: (path: string, value: TuningValue) => void;
  isArmed: boolean;
  markers: readonly Marker[];
  openSelection: (index: number) => void;
  openTarget: (index: number) => void;
  replay: () => void;
  resetSelection: (index: number) => void;
  resetTuning: (paths?: readonly string[]) => void;
  seek: (event: MouseEvent<HTMLButtonElement>) => void;
  seekTo: (frame: number) => void;
  submitComment: (comment: string) => void;
  toggle: () => void;
  trouble: string | null;
  tuningRefusal: TuningRefusal | null;
  unavailable: string | null;
  undoRevert: (key: string) => void;
}

export interface InspectSettings {
  composer: Composer;
  isArmed: boolean;
  preview: PreviewControl;
  readInterval?: Duration.Input;
  replayDelay?: Duration.Input;
  toggle: () => void;
  unavailable: string | null;
  undoWindow?: Duration.Input;
}

interface Asked {
  before: PendingComment;
  path: string | null;
  targetId: string;
}

interface Reverted {
  card: PendingComment;
  fiber: Fiber.Fiber<void, never>;
  toastId: string;
  values: readonly { path: string; target: string; value: TuningValue }[];
}

export function useInspect({
  composer,
  isArmed,
  preview,
  readInterval = READ_INTERVAL,
  replayDelay = REPLAY_DELAY,
  toggle,
  unavailable,
  undoWindow = UNDO_WINDOW,
}: InspectSettings): Inspection {
  const [card, setCard] = useState<PendingComment | null>(null);
  const [drawn, setDrawn] = useState<readonly string[]>([]);
  const [asked, setAsked] = useState<number | null>(null);
  const [reported, setReported] = useState<PreviewInspect | null>(null);
  const [tuningRefusal, setTuningRefusal] = useState<TuningRefusal | null>(
    null
  );
  const requests = useRef(new Map<string, Asked>());
  const reverts = useRef(new Map<string, Reverted>());
  const minted = useRef(0);
  const cardRef = useRef<PendingComment | null>(null);
  const pending = useRef(
    new Map<string, { before: PendingComment; value: TuningValue }>()
  );
  const flushHandle = useRef<number | null>(null);
  const replayFiber = useRef<Fiber.Fiber<void, never> | null>(null);
  const readFiber = useRef<Fiber.Fiber<void, never> | null>(null);
  const readAt = useRef(0);
  const playing = useRef(false);
  cardRef.current = card;

  const { select, selections } = composer;
  const { send } = preview;

  playing.current = preview.playing;

  const drop = useCallback((key: string): Reverted | null => {
    const held = reverts.current.get(key);
    if (held === undefined) {
      return null;
    }

    reverts.current.delete(key);
    Effect.runFork(Fiber.interrupt(held.fiber));
    toastManager.close(held.toastId);
    return held;
  }, []);

  const abandonRef = useRef<((open: PendingComment | null) => void) | null>(
    null
  );

  const undoRevert = useCallback(
    (key: string) => {
      const held = drop(key);
      if (held === null) {
        return;
      }

      abandonRef.current?.(cardRef.current);

      for (const { path, target, value } of held.values) {
        send(tuneSetCommand(nextRequestId(minted), target, path, value));
      }

      cardRef.current = held.card;
      setCard(held.card);
    },
    [drop, send]
  );

  const abandon = useCallback(
    (pendingCard: PendingComment | null) => {
      // Only what is still pending. An added card's values are what its
      // message asks for, so reverting them on the way out would leave the
      // frame contradicting the request that was just made.
      if (pendingCard === null) {
        return;
      }

      const reverting = changedPaths(pendingCard);
      if (reverting.size === 0) {
        return;
      }

      pending.current.clear();

      for (const [target, owned] of reverting) {
        send(tuneResetCommand(nextRequestId(minted), target, owned));
      }

      const values = changedFields(pendingCard).map(({ field, target }) => ({
        path: field.path,
        target: target.targetId,
        value: field.value,
      }));
      const key = cardKey(pendingCard);
      drop(key);

      const toastId = toastManager.add({
        actionProps: { children: "Undo", onClick: () => undoRevert(key) },
        timeout: Duration.toMillis(undoWindow),
        title: revertedTitle(pendingCard, values.length),
      });

      const fiber = Effect.runFork(
        Effect.sleep(undoWindow).pipe(
          Effect.andThen(
            Effect.sync(() => {
              if (reverts.current.get(key)?.toastId === toastId) {
                reverts.current.delete(key);
              }
            })
          )
        )
      );

      reverts.current.set(key, { card: pendingCard, fiber, toastId, values });
    },
    [drop, send, undoRevert, undoWindow]
  );

  abandonRef.current = abandon;

  const onSelection = useCallback(
    (message: PreviewSelection) => {
      const open = cardRef.current;

      // Clicking the same thing again is not a new selection. Without this
      // it would revert whatever had been tuned on it and reopen the chain
      // at the innermost link — a punishing answer to a stray second click.
      if (message.repeat && open !== null) {
        return;
      }

      if (open !== null && sameElement(open, message.tuning)) {
        return;
      }

      // Picking elsewhere abandons what was pending, exactly as Cancel does.
      // It has to: the drafts live in the preview keyed by target, so a card
      // dropped without reverting would leave the frame showing values the
      // pane no longer lists and the agent will never be told about.
      abandon(open);
      setTuningRefusal(null);
      setCard(cardOf(message));
    },
    [abandon]
  );

  const replay = useCallback(() => {
    const span = cardRef.current?.window ?? null;

    if (span !== null) {
      send(replayCommand(span));
    }
  }, [send]);

  const scheduleReplay = useCallback(() => {
    if (replayFiber.current !== null) {
      Effect.runFork(Fiber.interrupt(replayFiber.current));
      replayFiber.current = null;
    }

    if (playing.current) {
      return;
    }

    replayFiber.current = Effect.runFork(
      Effect.sleep(replayDelay).pipe(
        Effect.andThen(
          Effect.sync(() => {
            replayFiber.current = null;
            replay();
          })
        )
      )
    );
  }, [replay, replayDelay]);

  const readValues = useCallback(() => {
    const open = cardRef.current;
    const targetIds =
      open === null ? [] : open.targets.map((target) => target.targetId);

    if (targetIds.length === 0) {
      return;
    }

    readAt.current = Date.now();
    send(tuningReadCommand(targetIds));
  }, [send]);

  const scheduleRead = useCallback(() => {
    if (readFiber.current !== null) {
      Effect.runFork(Fiber.interrupt(readFiber.current));
      readFiber.current = null;
    }

    const waited = Date.now() - readAt.current;
    const interval = Duration.toMillis(readInterval);

    if (waited >= interval) {
      readValues();
      return;
    }

    readFiber.current = Effect.runFork(
      Effect.sleep(Duration.millis(interval - waited)).pipe(
        Effect.andThen(
          Effect.sync(() => {
            readFiber.current = null;
            readValues();
          })
        )
      )
    );
  }, [readInterval, readValues]);

  const onPlayhead = useCallback(
    (message: PreviewPlayhead) => {
      const open = cardRef.current;

      if (open === null || message.frame === open.element.frame) {
        return;
      }

      scheduleRead();
    },
    [scheduleRead]
  );

  const onTuningValues = useCallback((message: PreviewTuningValues) => {
    const open = cardRef.current;

    if (open === null) {
      return;
    }

    const animated = withAnimated(open, message.values);

    if (sameKeys(open.animated, animated)) {
      return;
    }

    const next = { ...open, animated };
    cardRef.current = next;
    setCard(next);
  }, []);

  const onRebuilt = useCallback(() => {
    const live = cardRef.current;

    for (const [target, owned] of live === null ? [] : changedPaths(live)) {
      send(tuneResetCommand(nextRequestId(minted), target, owned));
    }

    pending.current.clear();
    setDrawn([]);
    setCard(null);
    selections.markStale();
  }, [selections, send]);

  const onTuneResult = useCallback((message: PreviewTuneResult) => {
    const request = requests.current.get(message.requestId);
    requests.current.delete(message.requestId);

    if (message.ok) {
      setTuningRefusal((current) =>
        current === null ||
        (current.path === request?.path &&
          current.targetId === request?.targetId)
          ? null
          : current
      );
      return;
    }

    setTuningRefusal({
      message:
        message.error ?? "The preview refused that change without saying why.",
      path: request?.path ?? null,
      targetId: request?.targetId ?? null,
    });

    if (request !== undefined) {
      setCard((current) =>
        current !== null &&
        current.tuning?.targetId === request.before.tuning?.targetId
          ? request.before
          : current
      );
    }
  }, []);

  const onMessage = useCallback(
    (message: PreviewMessage) => {
      if (message.type === "selection") {
        onSelection(message);
        return;
      }

      if (message.type === "inspect") {
        setReported(message);
        return;
      }

      if (message.type === "rebuilt") {
        onRebuilt();
        return;
      }

      if (message.type === "playhead") {
        onPlayhead(message);
        return;
      }

      if (message.type === "tuning.values") {
        onTuningValues(message);
        return;
      }

      if (message.type === "tune.result") {
        onTuneResult(message);
      }
    },
    [onPlayhead, onRebuilt, onSelection, onTuneResult, onTuningValues]
  );

  useOnPreview(preview, onMessage);

  useEffect(() => {
    setReported(null);
    setAsked(Date.now());
    send(inspectCommand(isArmed));
  }, [isArmed, send]);

  // Which link of the chain the pane is on, drawn in the preview so the names
  // in the switcher are places rather than words. Keyed on the id alone, so
  // editing a value does not repaint the box.
  const openLink = card?.tuning ?? null;
  const openTargetId =
    openLink === null ? null : keyOf(openLink.instanceId, openLink.targetId);

  // Not guarded on `isArmed`: the box follows the card, so closing the pane has
  // to take it down whether or not the mode is still on, and disarming with the
  // pane still open has to leave it alone.
  const isCardOpen = card !== null;

  useEffect(() => {
    send(highlightCommand(openTargetId, isCardOpen));
  }, [isCardOpen, openTargetId, send]);

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
              fonts: open.fonts ?? [],
              open: open.open,
              originals: open.originals,
              targets: open.targets,
              text: open.text?.draft ?? null,
              window: open.window ?? null,
            }
      );
      setDrawn((current) => [...current, id]);

      // The pane stays open on what was just added, and the values stay live
      // in the frame — they are what the message asks for. What has to move is
      // the baseline: rebased here, a second Add carries only what changed
      // since the first, instead of asking twice for the same thing.
      const settled = {
        ...open,
        originals: originalsOf(open.targets),
        text: rebasedText(open),
      };
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
      requests.current.set(requestId, { before, path, targetId: target });
      send(tuneSetCommand(requestId, target, path, value));
    }

    if (
      movesTime(
        cardRef.current,
        stashed.map(([key]) => key)
      )
    ) {
      scheduleReplay();
    }
  }, [scheduleReplay, send]);

  useEffect(
    () => () => {
      if (flushHandle.current !== null) {
        cancelAnimationFrame(flushHandle.current);
      }

      for (const held of [replayFiber.current, readFiber.current]) {
        if (held !== null) {
          Effect.runFork(Fiber.interrupt(held));
        }
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

      if (whole) {
        pending.current.clear();
      } else {
        for (const path of paths) {
          pending.current.delete(keyed(current.tuning.targetId, path));
        }
      }

      const reverting = whole
        ? changedPaths(current)
        : byTarget(current.tuning.fields, paths);

      for (const [target, owned] of reverting) {
        const requestId = nextRequestId(minted);
        requests.current.set(requestId, {
          before: current,
          path: null,
          targetId: target,
        });
        send(tuneResetCommand(requestId, target, owned));
      }

      const next = withOriginalValues(current, paths, whole);
      cardRef.current = next;
      setCard(next);
    },
    [send]
  );

  const changeText = useCallback((value: string) => {
    const { current } = cardRef;
    const text = current?.text ?? null;

    if (current === null || text === null) {
      return;
    }

    const next = { ...current, text: { ...text, draft: value } };
    cardRef.current = next;
    setCard(next);
  }, []);

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
    const { current } = cardRef;
    const target = current?.targets[index];

    if (current === null || current === undefined || target === undefined) {
      return;
    }

    const next = { ...current, open: index, tuning: target };
    cardRef.current = next;
    setCard(next);
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

      const { fonts, open, originals, targets, text, window } = item.tuning;

      setCard({
        element: item.element,
        fonts,
        open,
        originals,
        rect: item.rect,
        targets,
        text: text === null ? null : { draft: text, from: text },
        tuning: targets[open] ?? targets.at(0) ?? null,
        window,
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

      for (const [target, owned] of changedPaths(item.tuning)) {
        send(tuneResetCommand(nextRequestId(minted), target, owned));
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

  const seekTo = useCallback(
    (frame: number) => {
      send(seekCommand(frame));
    },
    [send]
  );

  const markers = useMemo(() => {
    const showing = new Set(drawn);

    return selections.items
      .map((item, index) => ({ id: item.id, index, rect: item.rect }))
      .filter((marker) => showing.has(marker.id));
  }, [drawn, selections.items]);

  const now = useNow(isArmed && reported === null ? SILENCE : null);
  const trouble = troubleOf(isArmed, reported, asked, now);

  return useMemo(
    () => ({
      cancelComment,
      canInspect: unavailable === null,
      card,
      changeText,
      changeTuning,
      isArmed,
      markers,
      openSelection,
      openTarget,
      replay,
      resetSelection,
      resetTuning,
      seek,
      seekTo,
      submitComment,
      toggle,
      trouble,
      tuningRefusal,
      unavailable,
      undoRevert,
    }),
    [
      card,
      cancelComment,
      changeText,
      changeTuning,
      isArmed,
      markers,
      openSelection,
      openTarget,
      replay,
      resetTuning,
      resetSelection,
      seek,
      seekTo,
      submitComment,
      toggle,
      trouble,
      tuningRefusal,
      unavailable,
      undoRevert,
    ]
  );
}

/** The same pick as the one already open, by the link it opened on. */
function sameElement(
  card: PendingComment,
  targets: readonly TuningTarget[]
): boolean {
  const was = card.targets.at(0);
  const now = targets.at(0);

  if (was === undefined || now === undefined) {
    return false;
  }

  return was.instanceId.length > 0 && now.instanceId.length > 0
    ? was.instanceId === now.instanceId
    : was.targetId === now.targetId;
}

function keyOf(instanceId: string, targetId: string): string {
  return instanceId.length > 0 ? instanceId : targetId;
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

function cardOf(message: PreviewSelection): PendingComment {
  return {
    animated: EMPTY,
    element: message.element,
    fonts: message.fonts,
    open: 0,
    originals: originalsOf(message.tuning),
    rect: message.rect,
    targets: message.tuning,
    text: textOf(message),
    tuning: message.tuning.at(0) ?? null,
    window: message.window,
  };
}

function textOf(message: PreviewSelection): TextDraft | null {
  const innermost = message.tuning.at(0) ?? null;

  if (message.text === null || innermost === null || hasLiveText(innermost)) {
    return null;
  }

  return { draft: message.text, from: message.text };
}

function hasLiveText(target: TuningTarget): boolean {
  return target.fields.some(
    (field) => field.path === TEXT_PATH && field.type === "text-content"
  );
}

export function isTextChanged(card: PendingComment): boolean {
  const text = card.text ?? null;

  return text !== null && text.draft !== text.from;
}

function textChangeOf(card: PendingComment): TuningChange | null {
  const text = card.text ?? null;

  if (text === null || text.draft === text.from) {
    return null;
  }

  const owner = card.targets.at(0);
  const change: TuningChange = {
    from: text.from,
    path: TEXT_PATH,
    to: text.draft,
  };

  return owner === undefined ? change : { ...change, owner: ownerOf(owner) };
}

function rebasedText(card: PendingComment): TextDraft | null {
  const text = card.text ?? null;

  return text === null ? null : { draft: text.draft, from: text.draft };
}

export function animatedKey(targetId: string, path: string): string {
  return `${targetId} ${path}`;
}

export function isFieldAnimated(
  card: PendingComment,
  field: { path: string; targetId: string }
): boolean {
  return card.animated?.has(animatedKey(field.targetId, field.path)) ?? false;
}

function withAnimated(
  card: PendingComment,
  values: readonly {
    readonly path: string;
    readonly targetId: string;
    readonly value: TuningValue;
  }[]
): ReadonlySet<string> {
  const animated = new Set<string>(card.animated ?? EMPTY);

  for (const reading of values) {
    const target = card.targets.find(
      (each) => each.targetId === reading.targetId
    );
    const field = target?.fields.find((each) => each.path === reading.path);

    if (target === undefined || field === undefined) {
      continue;
    }

    const original = card.originals[target.targetId]?.[field.path];

    if (original !== undefined && !sameTuningValue(reading.value, original)) {
      animated.add(animatedKey(target.targetId, field.path));
    }
  }

  return animated;
}

function sameKeys(
  was: ReadonlySet<string> | undefined,
  now: ReadonlySet<string>
): boolean {
  const before = was ?? EMPTY;

  return before.size === now.size && [...now].every((key) => before.has(key));
}

function movesTime(
  card: PendingComment | null,
  keys: readonly string[]
): boolean {
  if (card === null) {
    return false;
  }

  return keys.some((key) => {
    const { path, target } = unkeyed(key);
    const field = card.targets
      .find((each) => each.targetId === target)
      ?.fields.find((each) => each.path === path);

    return (
      field !== undefined &&
      (TIMED_GROUPS.has(field.group) || EASING_PATH.test(field.path))
    );
  });
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
  const text = card.text ?? null;

  return {
    ...card,
    targets,
    text: text === null ? null : { ...text, draft: text.from },
    tuning: targets[card.open] ?? null,
  };
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

function changesOf(card: PendingComment): TuningChange[] {
  const tuned = changedFields(card).map(({ field, from, target }) => {
    const change: TuningChange = {
      from,
      owner: ownerOf(target),
      path: field.path,
      to: field.value,
    };

    return isFieldAnimated(card, field) ? { ...change, sampled: true } : change;
  });

  const text = textChangeOf(card);

  return text === null ? tuned : [...tuned, text];
}

function ownerOf(target: TuningTarget): TuningOwner {
  return {
    component: target.componentName,
    file: target.where?.file ?? null,
    line: target.where?.line ?? null,
    name: target.name,
  };
}

function cardKey(card: PendingComment): string {
  const first = card.targets.at(0);

  return first === undefined
    ? "element"
    : keyOf(first.instanceId, first.targetId);
}

function revertedTitle(card: PendingComment, count: number): string {
  const open = card.targets[card.open] ?? card.targets.at(0) ?? null;

  return `Reverted ${count} change${count === 1 ? "" : "s"}${
    open === null ? "" : ` on ${titleOf(open)}`
  }`;
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
