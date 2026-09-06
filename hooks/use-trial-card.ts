"use client";

import { Effect } from "effect";
import { useCallback, useMemo, useState } from "react";
import type { Account } from "@/hooks/use-account";
import {
  type StudioSettings,
  saveTrialCardsDismissed,
} from "@/lib/studio/settings";
import {
  isOnFree,
  type TrialCard,
  type TrialCardAccount,
  trialCardOf,
} from "@/lib/studio/trial-card";

export interface TrialCardState {
  card: TrialCard | null;
  dismiss: () => void;
  isOnFree: boolean;
  reopen: () => void;
}

export function useTrialCard({
  account,
  settings,
}: {
  account: Account;
  settings: StudioSettings | null;
}): TrialCardState {
  const [written, setWritten] = useState<readonly string[] | null>(null);
  const [isRevived, setRevived] = useState(false);

  const dismissed = written ?? settings?.trialCardsDismissed ?? null;

  const subject = useMemo<TrialCardAccount>(() => {
    const { phase } = account;
    switch (phase.kind) {
      case "signedIn":
        return { kind: "signedIn", plan: account.plan };
      case "signingIn":
        return { kind: "signingIn" };
      case "signedOut":
        return { kind: "signedOut" };
      default:
        return { kind: "unknown" };
    }
  }, [account]);

  const card =
    dismissed === null
      ? null
      : trialCardOf(subject, isRevived ? [] : dismissed);
  const onFree = isOnFree(subject);

  const dismiss = useCallback(() => {
    if (card === null) {
      return;
    }
    const next = dismissed?.includes(card.id)
      ? dismissed
      : [...(dismissed ?? []), card.id];
    setRevived(false);
    setWritten(next);
    Effect.runFork(saveTrialCardsDismissed(next));
  }, [card, dismissed]);

  const reopen = useCallback(() => {
    if (onFree) {
      setRevived(true);
    }
  }, [onFree]);

  return useMemo(
    () => ({ card, dismiss, isOnFree: onFree, reopen }),
    [card, dismiss, onFree, reopen]
  );
}
