"use client";

import { ExternalLinkIcon, SparklesIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Account } from "@/hooks/use-account";
import { shortDay } from "@/lib/studio/account";
import type { TrialCard as TrialCardModel } from "@/lib/studio/trial-card";
import { CheckoutStatus } from "./checkout-status";
import { AboveComposer, NoticeCard } from "./notice-card";
import { SignInControls } from "./sign-in-controls";
import { useStudio } from "./studio-provider";

export function TrialCard() {
  const { account, settingsDialog, trialCard } = useStudio();
  const { card } = trialCard;

  // The purchase ends with the plan turning Pro, which takes the card away:
  // the one line saying so still has to land somewhere the person is looking.
  if (card === null) {
    return account.checkout?.phase === "active" ? (
      <AboveComposer>
        <NoticeCard aria-label="Subscription">
          <CheckoutStatus account={account} />
        </NoticeCard>
      </AboveComposer>
    ) : null;
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
        <Body
          account={account}
          card={card}
          onUpgrade={settingsDialog.openAccount}
        />
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
    case "unverified":
      return "The subscription could not be verified";
    default:
      return "Your card was declined";
  }
}

function Body({
  account,
  card,
  onUpgrade,
}: {
  account: Account;
  card: TrialCardModel;
  onUpgrade: () => void;
}) {
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

  if (card.kind === "unverified") {
    return (
      <>
        <p className="text-muted-foreground text-xs leading-snug">
          The studio has been offline longer than the last plan document lasts,
          so it works as Free until it can reach the account server again.
        </p>
        <div>
          <Button
            disabled={account.isBusy}
            onClick={account.refresh}
            size="sm"
            variant="outline"
          >
            Check again
          </Button>
        </div>
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
        {account.checkout === null ? (
          <div>
            <Button onClick={onUpgrade} size="sm">
              <SparklesIcon data-icon="inline-start" />
              Upgrade
            </Button>
          </div>
        ) : (
          <CheckoutStatus account={account} />
        )}
      </>
    );
  }

  return (
    <>
      <p className="text-muted-foreground text-xs leading-snug">
        Pro stays on until{" "}
        {card.until === null ? "the grace period ends" : shortDay(card.until)},
        then the studio goes back to Free. Update the card in the billing portal
        to keep it.
      </p>
      <div>
        <Button
          disabled={account.isBusy}
          onClick={account.openPortal}
          size="sm"
        >
          <ExternalLinkIcon data-icon="inline-start" />
          Update card
        </Button>
      </div>
    </>
  );
}
