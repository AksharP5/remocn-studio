"use client";

import { CircleUserRoundIcon } from "lucide-react";
import {
  Progress,
  ProgressIndicator,
  ProgressTrack,
} from "@/components/ui/progress";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import type { Account } from "@/hooks/use-account";
import { planWording, trialSpent } from "@/lib/studio/account";
import { cn } from "@/lib/utils";
import { useStudio } from "./studio-provider";

interface Lines {
  alarming: boolean;
  detail: string;
  spent: number | null;
  status: string;
  title: string;
}

export function AccountStatus({ now }: { now: number }) {
  const { account, settingsDialog } = useStudio();
  const lines = linesOf(account, now);

  return (
    <SidebarMenuButton
      aria-label="Account"
      className="h-auto py-1.5 text-muted-foreground"
      onClick={settingsDialog.openAccount}
      size="lg"
    >
      <CircleUserRoundIcon className="size-5" />
      <span className="flex min-w-0 flex-1 flex-col gap-1 leading-tight">
        <span className="truncate text-foreground">{lines.title}</span>
        <span className="flex items-baseline justify-between gap-2 text-xs">
          <span className="truncate">{lines.status}</span>
          {lines.detail === "" ? null : (
            <span
              className={cn(
                "shrink-0 tabular-nums",
                lines.alarming && "text-amber-500"
              )}
            >
              {lines.detail}
            </span>
          )}
        </span>
        {lines.spent === null ? null : (
          <Progress
            aria-label="Trial spent"
            className="gap-0"
            value={Math.round(lines.spent * 100)}
          >
            <ProgressTrack className="h-1 bg-sidebar-border">
              <ProgressIndicator className="bg-foreground/70" />
            </ProgressTrack>
          </Progress>
        )}
      </span>
    </SidebarMenuButton>
  );
}

function linesOf(account: Account, now: number): Lines {
  const { phase } = account;

  switch (phase.kind) {
    case "unknown":
      return {
        alarming: false,
        detail: "",
        spent: null,
        status: "Waiting for the core",
        title: "Account",
      };
    case "signingIn":
      return {
        alarming: false,
        detail: "",
        spent: null,
        status: "Confirm in the browser",
        title: "Signing in…",
      };
    case "signedOut":
      return {
        alarming: false,
        detail: "",
        spent: null,
        status: "Sign in for a 7-day Pro trial",
        title: "Not signed in",
      };
    default: {
      const title = phase.me?.user.name || phase.me?.user.email || "Signed in";
      const { plan } = account;
      if (plan === null) {
        return {
          alarming: false,
          detail: "",
          spent: null,
          status: "Plan not read",
          title,
        };
      }
      const wording = planWording(plan, now);
      return {
        alarming: wording.alarming,
        detail: plan.kind === "pro" ? "" : wording.note,
        spent: plan.kind === "trial" ? trialSpent(plan, now) : null,
        status: wording.name,
        title,
      };
    }
  }
}
