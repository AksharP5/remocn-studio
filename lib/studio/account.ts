import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Cause, Data, Duration, Effect, Exit } from "effect";
import { errorMessage } from "@/lib/error-message";
import {
  ACCOUNT_PAGE_PATH,
  type AccountFailure,
  type AccountMe,
  type AccountStatus,
  BILLING_PAGE_PATH,
  type BillingPeriod,
  type CheckoutStart,
  decodeAccountFailure,
  decodeAccountMe,
  decodeAccountStatus,
  decodeCheckoutStart,
  decodePortalLink,
  decodeSignInPoll,
  decodeSignInStart,
  type SignInPoll,
  type SignInStart,
} from "@/shared/account";
import {
  type AccountPlan,
  decodeSignedEntitlement,
  type EntitlementDocument,
  planAt,
  type SignedEntitlement,
} from "@/shared/entitlement";

export type AccountErrorKind = AccountFailure["kind"] | "decode" | "transport";

export class AccountError extends Data.TaggedError("AccountError")<{
  kind: AccountErrorKind;
  message: string;
}> {}

export type SignInOutcome =
  | { status: "denied" }
  | { status: "expired" }
  | { status: "signedIn" };

export const SLOW_DOWN_STEP = 5;

const DECODE_FAILED =
  "The account server answered in a shape the studio does not read.";

export function accountError(cause: unknown): AccountError {
  const failure = decodeAccountFailure(cause);
  if (Exit.isSuccess(failure)) {
    return new AccountError(failure.value);
  }
  return new AccountError({ kind: "transport", message: errorMessage(cause) });
}

function command<A>(
  name: string,
  decode: (data: unknown) => Exit.Exit<A, unknown>,
  args?: Record<string, unknown>
): Effect.Effect<A, AccountError> {
  return Effect.tryPromise({
    catch: accountError,
    try: () => invoke<unknown>(name, args),
  }).pipe(
    Effect.flatMap((data) =>
      decode(data).pipe(
        Effect.mapError(
          (cause) =>
            new AccountError({
              kind: "decode",
              message: `${DECODE_FAILED} ${errorMessage(cause)}`,
            })
        )
      )
    )
  );
}

const nothing = (): Exit.Exit<void, never> => Exit.void;

export const readAccountStatus: Effect.Effect<AccountStatus, AccountError> =
  command("account_status", decodeAccountStatus);

export const startSignIn: Effect.Effect<SignInStart, AccountError> = command(
  "account_sign_in_start",
  decodeSignInStart
);

export const pollSignIn: Effect.Effect<SignInPoll, AccountError> = command(
  "account_sign_in_poll",
  decodeSignInPoll
);

export const cancelSignIn: Effect.Effect<void, AccountError> = command(
  "account_sign_in_cancel",
  nothing
);

export const fetchMe: Effect.Effect<AccountMe, AccountError> = command(
  "account_me",
  decodeAccountMe
);

export const fetchEntitlement: Effect.Effect<SignedEntitlement, AccountError> =
  command("account_entitlement", decodeSignedEntitlement);

export function startCheckout(
  period: BillingPeriod
): Effect.Effect<CheckoutStart, AccountError> {
  return command("account_checkout", decodeCheckoutStart, { period });
}

export const portalLink: Effect.Effect<string, AccountError> = command(
  "account_portal",
  decodePortalLink
).pipe(Effect.map((link) => link.url));

export function revokeDevice(id: string): Effect.Effect<void, AccountError> {
  return command("account_revoke_device", nothing, { id });
}

export const signOut: Effect.Effect<void, AccountError> = command(
  "account_sign_out",
  nothing
);

export function openInBrowser(url: string): Effect.Effect<void, AccountError> {
  return Effect.tryPromise({
    catch: (cause) =>
      new AccountError({ kind: "transport", message: errorMessage(cause) }),
    try: () => openUrl(url),
  });
}

export function accountPageUrl(origin: string): string {
  return `${origin}${ACCOUNT_PAGE_PATH}`;
}

export function billingPageUrl(origin: string): string {
  return `${origin}${BILLING_PAGE_PATH}`;
}

export function pollDelay(
  interval: number,
  slowDowns: number
): Duration.Duration {
  return Duration.seconds(Math.max(1, interval) + SLOW_DOWN_STEP * slowDowns);
}

export function awaitSignIn(
  start: SignInStart,
  poll: Effect.Effect<SignInPoll, AccountError>,
  sleep: (delay: Duration.Duration) => Effect.Effect<void> = Effect.sleep
): Effect.Effect<SignInOutcome, AccountError> {
  const step = (
    slowDowns: number
  ): Effect.Effect<SignInOutcome, AccountError> =>
    sleep(pollDelay(start.interval, slowDowns)).pipe(
      Effect.andThen(poll),
      Effect.flatMap((answer) => {
        switch (answer.status) {
          case "pending":
            return step(slowDowns);
          case "slowDown":
            return step(slowDowns + 1);
          default:
            return Effect.succeed<SignInOutcome>({ status: answer.status });
        }
      })
    );

  return step(0);
}

// A subscription, and only that: a trial and a grace period are Pro too, but
// neither is what a checkout was opened to buy. The server drops
// `trialEndsAt` once a subscription is paid for, which is what lets a purchase
// made mid-trial read as one.
export function isSubscribed(
  document: EntitlementDocument,
  now: number
): boolean {
  return planAt(document, now).kind === "pro";
}

export const CHECKOUT_POLL: Duration.Duration = Duration.seconds(5);

export const CHECKOUT_PATIENCE: Duration.Duration = Duration.minutes(10);

export type CheckoutOutcome = "active" | "timedOut";

// Polls the entitlement while the checkout is open in the browser: every five
// seconds, for ten minutes, then gives up with a button rather than for ever.
// A poll that fails is not the purchase failing — the browser has the
// person's attention, not the app — so it is skipped, not raised; only a 401
// ends the wait, and it ends it as a failure.
export function awaitSubscription(
  read: Effect.Effect<EntitlementDocument | null, AccountError>,
  options: {
    now?: () => number;
    patience?: Duration.Duration;
    sleep?: (delay: Duration.Duration) => Effect.Effect<void>;
  } = {}
): Effect.Effect<CheckoutOutcome, AccountError> {
  const sleep = options.sleep ?? Effect.sleep;
  const now = options.now ?? Date.now;
  const patience = Duration.toMillis(options.patience ?? CHECKOUT_PATIENCE);
  const deadline = now() + patience;

  const step = (): Effect.Effect<CheckoutOutcome, AccountError> =>
    sleep(CHECKOUT_POLL).pipe(
      Effect.andThen(
        read.pipe(
          Effect.catch((cause) =>
            cause.kind === "unauthorized"
              ? Effect.fail(cause)
              : Effect.succeed<EntitlementDocument | null>(null)
          )
        )
      ),
      Effect.flatMap((document) => {
        if (document !== null && isSubscribed(document, now())) {
          return Effect.succeed<CheckoutOutcome>("active");
        }
        return now() >= deadline
          ? Effect.succeed<CheckoutOutcome>("timedOut")
          : step();
      })
    );

  return step();
}

export function failureKindOf(
  cause: Cause.Cause<unknown>
): AccountErrorKind | null {
  const squashed = Cause.squash(cause);
  return squashed instanceof AccountError ? squashed.kind : null;
}

export function isSignedOut(cause: Cause.Cause<unknown>): boolean {
  return failureKindOf(cause) === "unauthorized";
}

const DAY = 24 * 60 * 60 * 1000;

export function daysLeft(iso: string, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(iso) - now) / DAY));
}

export const TRIAL_DAYS = 7;

export function trialSpent(
  plan: { endsAt: string; startedAt: string | null },
  now: number
): number {
  const ends = Date.parse(plan.endsAt);
  const started =
    plan.startedAt === null
      ? ends - TRIAL_DAYS * DAY
      : Date.parse(plan.startedAt);
  if (Number.isNaN(ends) || Number.isNaN(started) || ends <= started) {
    return 1;
  }
  return Math.min(1, Math.max(0, (now - started) / (ends - started)));
}

export function shortDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
}

export interface PlanWording {
  alarming: boolean;
  name: string;
  note: string;
}

export function planWording(plan: AccountPlan, now: number): PlanWording {
  switch (plan.kind) {
    case "trial": {
      const left = daysLeft(plan.endsAt, now);
      return { alarming: false, name: "Pro trial", note: trialNote(left) };
    }
    case "pro":
      return { alarming: false, name: "Pro", note: "Subscription" };
    case "grace":
      return {
        alarming: true,
        name: "Pro",
        note: `Card failed, access until ${shortDay(plan.accessUntil)}`,
      };
    default:
      return {
        alarming: plan.unverified,
        name: "Free",
        note: freeNote(plan),
      };
  }
}

export const UNVERIFIED_NOTE =
  "The subscription could not be verified. Go online to check it.";

function freeNote(plan: {
  trialEndedAt: string | null;
  unverified: boolean;
}): string {
  if (plan.unverified) {
    return UNVERIFIED_NOTE;
  }
  return plan.trialEndedAt === null
    ? "See what Pro adds"
    : `Trial ended ${shortDay(plan.trialEndedAt)}`;
}

function trialNote(left: number): string {
  if (left === 0) {
    return "Ends today";
  }
  return left === 1 ? "1 day left" : `${left} days left`;
}

const UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * DAY],
  ["month", 30 * DAY],
  ["day", DAY],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

export function lastSeen(iso: string, now: number): string {
  const elapsed = Date.parse(iso) - now;
  if (Number.isNaN(elapsed)) {
    return "";
  }
  const format = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
  for (const [unit, ms] of UNITS) {
    if (Math.abs(elapsed) >= ms) {
      return format.format(Math.round(elapsed / ms), unit);
    }
  }
  return "just now";
}
