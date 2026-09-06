"use client";

import { ExternalLinkIcon, LogInIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { Account } from "@/hooks/use-account";
import { lastSeen } from "@/lib/studio/account";

export function SignInControls({
  account,
  now,
}: {
  account: Account;
  now: number;
}) {
  const { phase } = account;

  if (phase.kind === "signingIn") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs leading-snug">
          Confirm the sign-in in your browser. The page shows this code:
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="select-text rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs tracking-wider">
            {phase.userCode}
          </code>
          <Spinner className="size-3 text-muted-foreground" />
          <Button onClick={account.openVerification} size="xs" variant="ghost">
            <ExternalLinkIcon data-icon="inline-start" />
            Open the page again
          </Button>
          <Button onClick={account.cancelSignIn} size="xs" variant="outline">
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {account.deviceLimit === null ? null : (
        <DeviceLimitNotice account={account} now={now} />
      )}
      <div className="flex items-center gap-2">
        <Button onClick={account.signIn} size="sm">
          <LogInIcon data-icon="inline-start" />
          {account.deviceLimit === null ? "Sign in" : "Try again"}
        </Button>
      </div>
    </div>
  );
}

function DeviceLimitNotice({
  account,
  now,
}: {
  account: Account;
  now: number;
}) {
  const limit = account.deviceLimit;
  if (limit === null) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5" role="alert">
      <p className="text-xs leading-snug">{limit.message}</p>
      <ul className="flex flex-col gap-0.5 text-muted-foreground text-xs">
        {limit.devices.map((device) => (
          <li
            className="flex items-center justify-between gap-3"
            key={device.id}
          >
            <span className="truncate">{device.name}</span>
            <span className="shrink-0 tabular-nums">
              {lastSeen(device.lastSeenAt, now)}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-xs leading-snug">
        Sign one of them out on your account page, then try again here.
      </p>
      <div>
        <Button onClick={account.openAccountPage} size="xs" variant="outline">
          <ExternalLinkIcon data-icon="inline-start" />
          Open account page
        </Button>
      </div>
    </div>
  );
}
