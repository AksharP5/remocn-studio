"use client";

import { ExternalLinkIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Account } from "@/hooks/use-account";
import { shortDay } from "@/lib/studio/account";
import type { TrialCard as TrialCardModel } from "@/lib/studio/trial-card";
import { AboveComposer, NoticeCard } from "./notice-card";
import { SignInControls } from "./sign-in-controls";
import { useStudio } from "./studio-provider";

export function TrialCard() {
  const { account, trialCard } = useStudio();
  const { card } = trialCard;

  if (card === null) {
    return null;
  }

  return (
    <AboveComposer>
      <NoticeCard aria-label="Pro trial">
        <header className="flex items-start justify-between gap-3">
          <h3 className="font-medium text-xs">{titleOf(card)}</h3>
          <Button
            aria-label="Not now"
            className="-mt-1 -mr-1 shrink-0 text-muted-foreground"
            onClick={trialCard.dismiss}
            size="icon-xs"
            variant="ghost"
          >
            <XIcon />
          </Button>
        </header>
        <Body account={account} card={card} />
        {account.error === null ? null : (
          <p className="break-words text-destructive text-xs" role="alert">
            {account.error}
          </p>
        )}
      </NoticeCard>
    </AboveComposer>
  );
}

function titleOf(card: TrialCardModel): string {
  switch (card.kind) {
    case "invite":
      return "7 days of Pro, free";
    case "trialEnded":
      return card.until === null
        ? "Your Pro trial has ended"
        : `Your Pro trial ended ${shortDay(card.until)}`;
    default:
      return "Your card was declined";
  }
}

function Body({ account, card }: { account: Account; card: TrialCardModel }) {
  if (card.kind === "invite") {
    return (
      <>
        <p className="text-muted-foreground text-xs leading-snug">
          Sign in to start a trial with Inspect, Snapshot, the skills bundle and
          the production pipeline. No card needed; the trial starts when you
          sign in.
        </p>
        <SignInControls account={account} now={Date.now()} />
      </>
    );
  }

  if (card.kind === "trialEnded") {
    return (
      <>
        <p className="text-muted-foreground text-xs leading-snug">
          The studio works as Free now. Upgrade to keep Inspect, Snapshot, the
          skills bundle and the pipeline.
        </p>
        <div>
          <Button onClick={account.openBillingPage} size="sm">
            <ExternalLinkIcon data-icon="inline-start" />
            Upgrade
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="text-muted-foreground text-xs leading-snug">
        Pro stays on until{" "}
        {card.until === null ? "the grace period ends" : shortDay(card.until)},
        then the studio goes back to Free. Update the card on your account page
        to keep it.
      </p>
      <div>
        <Button onClick={account.openBillingPage} size="sm">
          <ExternalLinkIcon data-icon="inline-start" />
          Update card
        </Button>
      </div>
    </>
  );
}
