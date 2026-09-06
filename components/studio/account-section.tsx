"use client";

import {
  CreditCardIcon,
  LaptopMinimalIcon,
  LogOutIcon,
  RotateCwIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { Account } from "@/hooks/use-account";
import { lastSeen, planWording } from "@/lib/studio/account";
import { cn } from "@/lib/utils";
import type { AccountDevice, AccountMe } from "@/shared/account";
import { SignInControls } from "./sign-in-controls";
import { useStudio } from "./studio-provider";

const CORE_PENDING = "Waiting for the Tauri core";
const DEVICE_LIMIT = 2;

export function AccountSection() {
  const { account } = useStudio();
  const now = Date.now();

  if (account.phase.kind === "unknown") {
    return <p className="text-muted-foreground text-xs">{CORE_PENDING}</p>;
  }

  if (account.phase.kind !== "signedIn") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-xs leading-snug">
          Free needs no account. Sign in to start a 7-day Pro trial &mdash;
          Inspect, Snapshot, the skills bundle and the production pipeline
          &mdash; or to use a Pro subscription on this Mac. No card needed.
        </p>
        <SignInControls account={account} now={now} />
        <AccountError message={account.error} />
      </div>
    );
  }

  const { me } = account.phase;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-6">
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

      <PlanRow account={account} now={now} />

      <Devices account={account} me={me} now={now} />

      <AccountError message={account.error} />
    </div>
  );
}

function PlanRow({ account, now }: { account: Account; now: number }) {
  const wording = account.plan === null ? null : planWording(account.plan, now);

  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm">
          {wording === null ? "Plan" : wording.name}
        </span>
        <p
          className={cn(
            "text-xs leading-snug",
            wording?.alarming ? "text-amber-500" : "text-muted-foreground"
          )}
        >
          {wording === null
            ? "The plan could not be read. Refresh to try again."
            : wording.note}
        </p>
      </div>
      <Button onClick={account.openBillingPage} size="sm" variant="outline">
        <CreditCardIcon data-icon="inline-start" />
        Manage billing
      </Button>
    </div>
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
    <section aria-label="Devices" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm">Devices</span>
          <p className="text-muted-foreground text-xs leading-snug">
            {me === null
              ? "Which copies of the studio are signed in"
              : `${me.devices.length} of ${DEVICE_LIMIT} signed in`}
          </p>
        </div>
        <Button
          disabled={account.isBusy}
          onClick={account.refresh}
          size="xs"
          variant="ghost"
        >
          {account.isBusy ? (
            <Spinner className="size-3" data-icon="inline-start" />
          ) : (
            <RotateCwIcon data-icon="inline-start" />
          )}
          Refresh
        </Button>
      </div>

      {me === null ? null : (
        <ul className="flex flex-col divide-y divide-border rounded-md border">
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
    </section>
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
    <li className="flex items-center gap-3 px-3 py-2.5">
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
