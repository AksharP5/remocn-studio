"use client";

import { ChevronDownIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Account } from "@/hooks/use-account";
import { PRO_PRICE } from "@/shared/account";

export const MONTHLY_LABEL = `Monthly · $${PRO_PRICE.monthly} a month`;
export const YEARLY_LABEL = `Yearly · $${PRO_PRICE.yearly} a month, billed $${
  PRO_PRICE.yearly * 12
} a year`;

// One button, two prices. The period rides on the row as `data-period` and
// `upgrade` reads it off the event, so there is no closure per row.
export function UpgradeMenu({
  account,
  variant = "default",
}: {
  account: Account;
  variant?: "default" | "outline";
}) {
  const isBusy =
    account.checkout !== null && account.checkout.phase !== "active";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button disabled={isBusy} size="sm" variant={variant} />}
      >
        <SparklesIcon data-icon="inline-start" />
        Upgrade
        <ChevronDownIcon className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Pro, billed</DropdownMenuLabel>
          <DropdownMenuItem data-period="month" onClick={account.upgrade}>
            {MONTHLY_LABEL}
          </DropdownMenuItem>
          <DropdownMenuItem data-period="year" onClick={account.upgrade}>
            {YEARLY_LABEL}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
