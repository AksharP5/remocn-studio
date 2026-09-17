"use client";

import {
  CreditCardIcon,
  LaptopMinimalIcon,
  LogOutIcon,
  RotateCwIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Progress,
  ProgressIndicator,
  ProgressTrack,
} from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import type { Account } from "@/hooks/use-account";
import {
  lastSeen,
  type PlanWording,
  planWording,
  shortDay,
  TRIAL_DAYS,
  trialSpent,
} from "@/lib/studio/account";
import { cn } from "@/lib/utils";
import type { AccountDevice, AccountMe } from "@/shared/account";
import { CheckoutStatus } from "./checkout-status";
import { PricingCards } from "./pricing-cards";
import { SettingsPanel } from "./settings-group";
import { SignInControls } from "./sign-in-controls";
import { useStudio } from "./studio-provider";

const CORE_PENDING = "Waiting for the Tauri core";
const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

export function AccountSection() {
  const { account } = useStudio();
  const now = Date.now();

  if (account.phase.kind === "unknown") {
    return <p className="text-muted-foreground text-xs">{CORE_PENDING}</p>;
  }

  if (account.phase.kind !== "signedIn") {
    return (
      <SettingsPanel title="Sign in">
        <p className="text-muted-foreground text-xs leading-snug">
          Free needs no account. Sign in to start a 7-day Pro trial &mdash;
          Inspect, Snapshot, the skills bundle and the production pipeline
          &mdash; or to use a Pro subscription on this Mac. No card needed.
        </p>
        <SignInControls account={account} />
        <AccountError message={account.error} />
      </SettingsPanel>
    );
  }

  const { me } = account.phase;

  return (
    <div className="flex flex-col gap-10">
      <SettingsPanel title="Profile">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-sm">
              {me?.user.name || me?.user.email || "Signed in"}
            </span>
            {me === null ? null : (
              <span className="truncate text-muted-foreground text-xs">
                {me.user.email}
              </span>
            )}
          </div>
          <Button
            disabled={account.isBusy}
            onClick={account.signOut}
            size="sm"
            variant="outline"
          >
            <LogOutIcon data-icon="inline-start" />
            Sign out
          </Button>
        </div>
      </SettingsPanel>

      <PlanSection account={account} now={now} />

      <Plans account={account} />

      <Devices account={account} me={me} now={now} />

      <AccountError message={account.error} />
    </div>
  );
}

// The plan reads as one surface: the name and a badge with what is left,
// the sentence under it, and — on a trial — how far along it is, drawn as a
// bar with the two dates at its ends. Buying lives in the tiers below it,
// which exist only while there is something to buy.
function PlanSection({ account, now }: { account: Account; now: number }) {
  const { plan } = account;
  const wording = plan === null ? null : planWording(plan, now);

  return (
    <SettingsPanel title="Current plan">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-heading font-medium text-base">
              {wording === null ? "Plan" : wording.name}
            </span>
            {plan?.kind === "trial" ? (
              <Badge variant="outline">{wording?.note}</Badge>
            ) : null}
            {plan?.kind === "grace" ? (
              <Badge variant="warning">Payment failed</Badge>
            ) : null}
          </span>
          <p
            className={cn(
              "text-xs leading-snug",
              wording?.alarming ? "text-amber-500" : "text-muted-foreground"
            )}
          >
            {detailOf(account, wording)}
          </p>
        </div>
        <Button
          className="shrink-0"
          onClick={account.openBillingPage}
          size="sm"
          variant="outline"
        >
          <CreditCardIcon data-icon="inline-start" />
          Manage billing
        </Button>
      </div>
      {plan?.kind === "trial" ? <TrialProgress now={now} plan={plan} /> : null}
      {plan?.kind === "pro" ? <CheckoutStatus account={account} /> : null}
    </SettingsPanel>
  );
}

function detailOf(account: Account, wording: PlanWording | null): string {
  const { plan } = account;
  if (plan === null || wording === null) {
    return "The plan could not be read. Refresh to try again.";
  }
  switch (plan.kind) {
    case "trial":
      return `Every Pro tool is unlocked until ${shortDay(plan.endsAt)}.`;
    case "pro":
      return "Your card and your invoices live in the billing portal.";
    case "grace":
      return `The last charge did not go through. Pro keeps working until ${shortDay(plan.accessUntil)}.`;
    default:
      return plan.unverified
        ? wording.note
        : "Making and exporting videos, on the agent subscription you already pay for.";
  }
}

function TrialProgress({
  now,
  plan,
}: {
  now: number;
  plan: { endsAt: string; startedAt: string | null };
}) {
  const spent = trialSpent(plan, now);
  const started =
    plan.startedAt ??
    new Date(Date.parse(plan.endsAt) - TRIAL_MS).toISOString();

  return (
    <Progress
      aria-label="Trial spent"
      className="gap-1.5"
      value={Math.round(spent * 100)}
    >
      <ProgressTrack className="h-1.5">
        <ProgressIndicator />
      </ProgressTrack>
      <div className="flex justify-between text-muted-foreground text-xs tabular-nums">
        <span>Started {shortDay(started)}</span>
        <span>Ends {shortDay(plan.endsAt)}</span>
      </div>
    </Progress>
  );
}

// The two tiers, for anyone not already paying: the plan they are on is
// marked, Pro starts a checkout. Same cards as the account page.
function Plans({ account }: { account: Account }) {
  const { plan } = account;
  if (plan === null || plan.kind === "pro" || plan.kind === "grace") {
    return null;
  }
  const onTrial = plan.kind === "trial";

  return (
    <section aria-label="Plans" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 px-4">
        <h3 className="font-medium text-sm">Plans</h3>
        <p className="text-muted-foreground text-xs leading-snug">
          {onTrial
            ? "When the trial ends the app stays free; only the directing half switches off. Keep it by picking a period."
            : "Pro adds the directing half: the motion design skills, the pipeline, Inspect and Snapshot."}
        </p>
      </div>
      <PricingCards
        account={account}
        freeMark={onTrial ? "Where the trial lands you" : "Your plan"}
        proCta={onTrial ? "Keep Pro" : "Upgrade to Pro"}
      />
    </section>
  );
}

function Devices({
  account,
  me,
  now,
}: {
  account: Account;
  me: AccountMe | null;
  now: number;
}) {
  return (
    <SettingsPanel
      action={
        <Button
          disabled={account.isBusy}
          onClick={account.refresh}
          size="sm"
          variant="ghost"
        >
          {account.isBusy ? (
            <Spinner className="size-3" data-icon="inline-start" />
          ) : (
            <RotateCwIcon data-icon="inline-start" />
          )}
          Refresh
        </Button>
      }
      description={
        me === null
          ? "Which copies of the studio are signed in"
          : `${me.devices.length} signed in`
      }
      title="Devices"
    >
      {me === null ? null : (
        <ul className="flex flex-col divide-y divide-border/60">
          {me.devices.map((device) => (
            <DeviceRow
              account={account}
              device={device}
              isThisMac={device.id === me.session.id}
              key={device.id}
              now={now}
            />
          ))}
        </ul>
      )}
    </SettingsPanel>
  );
}

function DeviceRow({
  account,
  device,
  isThisMac,
  now,
}: {
  account: Account;
  device: AccountDevice;
  isThisMac: boolean;
  now: number;
}) {
  return (
    <li className="flex min-w-0 items-center gap-3 py-4 first:pt-0 last:pb-0">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
        <LaptopMinimalIcon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm">
          {device.name}
          {isThisMac ? (
            <span className="text-muted-foreground"> &middot; This Mac</span>
          ) : null}
        </span>
        <span className="text-muted-foreground text-xs">
          Last seen {lastSeen(device.lastSeenAt, now)}
        </span>
      </div>
      {isThisMac ? null : (
        <Button
          disabled={account.isBusy}
          onClick={account.revokeDevice}
          size="xs"
          value={device.id}
          variant="outline"
        >
          Sign out
        </Button>
      )}
    </li>
  );
}

function AccountError({ message }: { message: string | null }) {
  if (message === null) {
    return null;
  }
  return (
    <p className="break-words text-destructive text-xs" role="alert">
      {message}
    </p>
  );
}
