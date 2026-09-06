"use client";

import { CheckIcon, ExternalLinkIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { Account } from "@/hooks/use-account";

export const SUBSCRIPTION_ACTIVE = "Subscription active";

// What the purchase looks like from inside the app: a page is open in the
// browser, the app asks the server every five seconds, and after ten minutes
// it stops asking and offers a button. Success is one line.
export function CheckoutStatus({ account }: { account: Account }) {
  const { checkout } = account;

  if (checkout === null) {
    return null;
  }

  if (checkout.phase === "active") {
    return (
      <div className="flex items-center gap-2 text-xs" role="status">
        <CheckIcon aria-hidden="true" className="size-3.5 text-primary" />
        <span>{SUBSCRIPTION_ACTIVE}</span>
        <Button
          aria-label="Dismiss"
          className="text-muted-foreground"
          onClick={account.dismissCheckout}
          size="icon-xs"
          variant="ghost"
        >
          <XIcon />
        </Button>
      </div>
    );
  }

  if (checkout.phase === "timedOut") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs leading-snug">
          Still waiting for the payment to come through. Finish the checkout in
          the browser, then check again.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={account.isBusy}
            onClick={account.checkAgain}
            size="xs"
            variant="outline"
          >
            Check again
          </Button>
          <Button onClick={account.openCheckoutPage} size="xs" variant="ghost">
            <ExternalLinkIcon data-icon="inline-start" />
            Open the checkout again
          </Button>
          <Button onClick={account.dismissCheckout} size="xs" variant="ghost">
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-xs leading-snug">
        {checkout.phase === "opening"
          ? "Opening the checkout…"
          : "Finish the purchase in the browser. The plan updates here on its own, usually within a minute."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Spinner className="size-3 text-muted-foreground" />
        {checkout.phase === "waiting" ? (
          <Button onClick={account.openCheckoutPage} size="xs" variant="ghost">
            <ExternalLinkIcon data-icon="inline-start" />
            Open the checkout again
          </Button>
        ) : null}
        <Button onClick={account.dismissCheckout} size="xs" variant="outline">
          Cancel
        </Button>
      </div>
    </div>
  );
}
