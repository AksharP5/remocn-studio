"use client";

import { ArrowRightIcon, CheckIcon } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Account } from "@/hooks/use-account";
import { cn } from "@/lib/utils";
import { type BillingPeriod, PRO_PRICE } from "@/shared/account";
import { CheckoutStatus } from "./checkout-status";

// The account page's short lists, four lines each so the two cards end on
// the same line; the copy is the landing's `components/landing/pricing.tsx`.
const FREE_ESSENTIALS = [
  "Runs on your agent subscription",
  "Live preview and mp4 export",
  "Asset library and stock media",
  "Real Remotion projects, yours",
];

const PRO_ESSENTIALS = [
  "Motion design skills",
  "The seven-stage pipeline",
  "Design check on every scene",
  "Inspect and Snapshot",
];

export const YEARLY_DISCOUNT = Math.round(
  (1 - PRO_PRICE.yearly / PRO_PRICE.monthly) * 100
);

export const YEARLY_TOTAL = PRO_PRICE.yearly * 12;

const PERIODS: readonly {
  hint: string | null;
  label: string;
  value: BillingPeriod;
}[] = [
  { hint: `−${YEARLY_DISCOUNT}%`, label: "Yearly", value: "year" },
  { hint: null, label: "Monthly", value: "month" },
];

function isPeriod(value: string): value is BillingPeriod {
  return value === "year" || value === "month";
}

// Both tiers side by side, the way the account page on the landing draws
// them for someone who already has the app: the plan they are on is marked,
// the other one starts a checkout at the period they picked. Yearly leads,
// because it is the cheaper one.
export function PricingCards({
  account,
  freeMark,
  proCta,
}: {
  account: Account;
  freeMark: string;
  proCta: string;
}) {
  const [period, setPeriod] = useState<BillingPeriod>("year");

  const onPeriod = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const picked = event.currentTarget.value;
    if (isPeriod(picked)) {
      setPeriod(picked);
    }
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="m-0 inline-flex min-w-0 self-start rounded-lg border-0 bg-muted p-1">
        <legend className="sr-only">Billing period</legend>
        {PERIODS.map((option) => (
          <button
            aria-pressed={period === option.value}
            className={cn(
              "rounded-md px-3 py-1 text-xs transition-colors duration-150",
              period === option.value
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
            key={option.value}
            onClick={onPeriod}
            type="button"
            value={option.value}
          >
            {option.label}
            {option.hint === null ? null : (
              <span
                className={cn(
                  "ms-1.5 tabular-nums",
                  period === option.value
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                {option.hint}
              </span>
            )}
          </button>
        ))}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Tier
          cta={<CurrentPlanMark label={freeMark} />}
          description="Making and exporting videos."
          features={FREE_ESSENTIALS}
          name="Free"
          price={<Price note="forever, not a trial" suffix="" value="$0" />}
        />
        <Tier
          cta={
            account.checkout === null ? (
              <Button
                className="w-full"
                data-period={period}
                onClick={account.upgrade}
                size="sm"
              >
                {proCta}
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            ) : (
              <CheckoutStatus account={account} />
            )
          }
          description="The director's half of the studio."
          emphasized
          features={PRO_ESSENTIALS}
          name="Pro"
          price={<ProPrice period={period} />}
        />
      </div>
    </div>
  );
}

function Tier({
  cta,
  description,
  emphasized = false,
  features,
  name,
  price,
}: {
  cta: ReactNode;
  description: string;
  emphasized?: boolean;
  features: readonly string[];
  name: string;
  price: ReactNode;
}) {
  return (
    <section
      aria-label={name}
      className={cn(
        "flex flex-col gap-4 rounded-xl bg-card p-4 shadow-xs ring-1 ring-border",
        emphasized && "ring-primary/40"
      )}
    >
      <div className="flex flex-col gap-1">
        <h3 className="font-heading font-medium text-base">{name}</h3>
        <p className="text-muted-foreground text-xs leading-snug">
          {description}
        </p>
      </div>
      {price}
      <ul className="flex flex-1 flex-col gap-1.5">
        {features.map((feature) => (
          <li
            className="flex gap-2 whitespace-nowrap text-xs leading-snug"
            key={feature}
          >
            <CheckIcon
              aria-hidden="true"
              className="mt-0.5 size-3 shrink-0 text-muted-foreground"
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <div>{cta}</div>
    </section>
  );
}

function Price({
  note,
  suffix,
  value,
}: {
  note: ReactNode;
  suffix: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="flex items-baseline gap-1.5">
        <span className="font-heading font-semibold text-2xl tabular-nums tracking-tight">
          {value}
        </span>
        {suffix === "" ? null : (
          <span className="text-muted-foreground text-xs">{suffix}</span>
        )}
      </p>
      <p className="text-muted-foreground text-xs">{note}</p>
    </div>
  );
}

function ProPrice({ period }: { period: BillingPeriod }) {
  if (period === "year") {
    return (
      <Price
        note={
          <>
            <span className="tabular-nums line-through">
              ${PRO_PRICE.monthly}
            </span>{" "}
            <span className="text-primary">
              ${YEARLY_TOTAL} a year, {YEARLY_DISCOUNT}% off
            </span>
          </>
        }
        suffix="a month, billed yearly"
        value={`$${PRO_PRICE.yearly}`}
      />
    );
  }
  return (
    <Price
      note={`or $${PRO_PRICE.yearly} a month billed yearly`}
      suffix="a month, billed monthly"
      value={`$${PRO_PRICE.monthly}`}
    />
  );
}

// Reads as a button-sized label so both cards end on the same line.
function CurrentPlanMark({ label }: { label: string }) {
  return (
    <p className="flex h-8 w-full items-center justify-center rounded-md bg-muted text-muted-foreground text-xs">
      {label}
    </p>
  );
}
