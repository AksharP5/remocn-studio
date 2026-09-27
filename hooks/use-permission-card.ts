"use client";

import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  batchChoices,
  batchTitle,
  type PermissionAction,
  type PermissionChoice,
  permissionChoices,
  permissionTitle,
} from "@/lib/studio/permission";
import type { PendingPermission } from "@/lib/studio/turns";
import type { SessionMode } from "@/shared/ipc";

export interface PermissionCard {
  asks: readonly PendingPermission[];
  checked: string[];
  choices: PermissionChoice[];
  first: RefObject<HTMLButtonElement | null>;
  gathered: boolean;
  onCheck: (value: string[]) => void;
  onChoose: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  title: string;
}

export function usePermissionCard(
  permission: PendingPermission,
  gatheredAsks: readonly PendingPermission[] | undefined,
  onAnswer: (
    id: string,
    action: PermissionAction,
    mode: SessionMode | null
  ) => void
): PermissionCard {
  const first = useRef<HTMLButtonElement>(null);
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(
    () => new Set()
  );

  // Locking the composer drops focus on <body>; the ask is the thing to answer,
  // so the keyboard lands on it. The card is keyed by the ask's id where it is
  // rendered, so the next ask in the queue mounts fresh and takes focus too.
  useEffect(() => {
    first.current?.focus();
  }, []);

  const asks = useMemo(
    () => (gatheredAsks === undefined ? [permission] : gatheredAsks),
    [gatheredAsks, permission]
  );
  const gathered = asks.length > 1;

  const checked = useMemo(
    () => asks.filter((ask) => !unchecked.has(ask.id)).map((ask) => ask.id),
    [asks, unchecked]
  );

  const choices = useMemo(
    () =>
      gathered
        ? batchChoices(permission.reason, checked.length, asks.length)
        : permissionChoices(permission.reason),
    [asks.length, checked.length, gathered, permission.reason]
  );

  const answer = useCallback(
    (choice: PermissionChoice) => {
      if (choice.disabled === true) {
        return;
      }
      if (choice.action === "cancel") {
        onAnswer(permission.id, "cancel", null);
        return;
      }
      for (const ask of asks) {
        const included = choice.action === "deny" || !unchecked.has(ask.id);
        onAnswer(
          ask.id,
          included ? choice.action : "deny",
          included ? choice.mode : null
        );
      }
    },
    [asks, onAnswer, permission.id, unchecked]
  );

  const onCheck = useCallback(
    (value: string[]) => {
      setUnchecked(
        new Set(asks.map((ask) => ask.id).filter((id) => !value.includes(id)))
      );
    },
    [asks]
  );

  const onChoose = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const chosen = choices.find(
        (choice) => choice.id === event.currentTarget.value
      );

      if (chosen !== undefined) {
        answer(chosen);
      }
    },
    [answer, choices]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Escape") {
        return;
      }

      const declined = choices.find((choice) => choice.action === "deny");

      if (declined !== undefined) {
        event.preventDefault();
        answer(declined);
      }
    },
    [answer, choices]
  );

  const title = gathered
    ? batchTitle(permission.reason, asks.length)
    : permissionTitle(permission.reason);

  return useMemo(
    () => ({
      asks,
      checked,
      choices,
      first,
      gathered,
      onCheck,
      onChoose,
      onKeyDown,
      title,
    }),
    [asks, checked, choices, gathered, onCheck, onChoose, onKeyDown, title]
  );
}
