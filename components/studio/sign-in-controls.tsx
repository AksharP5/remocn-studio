"use client";

import { ExternalLinkIcon, LogInIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { Account } from "@/hooks/use-account";

export function SignInControls({ account }: { account: Account }) {
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
    <div className="flex items-center gap-2">
      <Button onClick={account.signIn} size="sm">
        <LogInIcon data-icon="inline-start" />
        Sign in
      </Button>
    </div>
  );
}
