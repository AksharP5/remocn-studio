"use client";

import { absurd, type Duration, Effect, Exit, Fiber } from "effect";
import type { MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { causeMessage } from "@/lib/error-message";
import {
  type AccountError,
  accountPageUrl,
  awaitSignIn,
  awaitSubscription,
  billingPageUrl,
  cancelSignIn,
  failureKindOf,
  fetchEntitlement,
  fetchMe,
  isSignedOut,
  isSubscribed,
  openInBrowser,
  pollSignIn,
  portalLink,
  readAccountStatus,
  revokeDevice as revokeDeviceOnServer,
  type SignInOutcome,
  signOut as signOutOnServer,
  startCheckout,
  startSignIn,
} from "@/lib/studio/account";
import {
  type EntitlementCache,
  type EntitlementReading,
  type EntitlementSource,
  entitlementCache,
  REFRESH_EVERY,
  readEntitlement,
} from "@/lib/studio/entitlement";
import type { AccountMe, BillingPeriod } from "@/shared/account";
import {
  type AccountPlan,
  type EntitlementDocument,
  type PlanTier,
  planAt,
  tierOf,
} from "@/shared/entitlement";

export type AccountPhase =
  | {
      kind: "signedIn";
      document: EntitlementDocument | null;
      me: AccountMe | null;
      source: EntitlementSource;
    }
  | { kind: "signedOut" }
  | { kind: "signingIn"; userCode: string; verificationUri: string }
  | { kind: "unknown" };

// `opening` asks the server for a page; `waiting` has it open in the browser
// and polls; `timedOut` stopped polling and offers Check again; `active` is
// the one line the purchase ends on.
export type CheckoutPhase = "active" | "opening" | "timedOut" | "waiting";

export interface CheckoutState {
  period: BillingPeriod;
  phase: CheckoutPhase;
  url: string | null;
}

export interface Account {
  cancelSignIn: () => void;
  checkAgain: () => void;
  checkout: CheckoutState | null;
  dismissCheckout: () => void;
  error: string | null;
  isBusy: boolean;
  openAccountPage: () => void;
  openBillingPage: () => void;
  openCheckoutPage: () => void;
  openPortal: () => void;
  openVerification: () => void;
  origin: string | null;
  phase: AccountPhase;
  plan: AccountPlan | null;
  refresh: () => void;
  revokeDevice: (event: MouseEvent<HTMLButtonElement>) => void;
  signIn: () => void;
  signOut: () => void;
  tier: PlanTier;
  upgrade: (event: MouseEvent<HTMLElement>) => void;
}

const SESSION_ENDED = "This device was signed out. Sign in again to continue.";
const CODE_EXPIRED =
  "The sign-in code expired before it was confirmed. Try again.";
const SIGN_IN_DECLINED = "The sign-in was declined in the browser.";

const UNKNOWN: AccountPhase = { kind: "unknown" };
const SIGNED_OUT: AccountPhase = { kind: "signedOut" };

type Loaded = readonly [Exit.Exit<AccountMe, AccountError>, EntitlementReading];

export interface AccountOptions {
  cache?: EntitlementCache;
  publicKey?: string;
  sleep?: (delay: Duration.Duration) => Effect.Effect<void>;
}

export function useAccount({
  cache = entitlementCache,
  publicKey,
  sleep = Effect.sleep,
}: AccountOptions = {}): Account {
  const [phase, setPhase] = useState<AccountPhase>(UNKNOWN);
  const [origin, setOrigin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setBusy] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutState | null>(null);
  const flow = useRef<Fiber.Fiber<unknown, unknown> | null>(null);
  const purchase = useRef<Fiber.Fiber<unknown, unknown> | null>(null);
  const daily = useRef<Fiber.Fiber<unknown, unknown> | null>(null);
  const live = useRef(true);

  // The profile and the plan are read together but fail apart: an account
  // server that is down still leaves the cached document, so the plan the
  // person paid for survives a bad connection. Only a 401 ends the session.
  const loadAccount = useMemo(
    () =>
      Effect.all(
        [
          Effect.exit(fetchMe),
          readEntitlement({ cache, fetch: fetchEntitlement, publicKey }),
        ],
        { concurrency: 2 }
      ),
    [cache, publicKey]
  );

  const signedOut = useCallback(
    (message: string | null) => {
      Effect.runFork(cache.clear);
      if (purchase.current !== null) {
        Effect.runFork(Fiber.interrupt(purchase.current));
        purchase.current = null;
      }
      setCheckout(null);
      setPhase(SIGNED_OUT);
      setError(message);
    },
    [cache]
  );

  const settle = useCallback(
    (exit: Exit.Exit<Loaded, AccountError>) => {
      if (!live.current) {
        return;
      }
      if (Exit.isFailure(exit)) {
        if (isSignedOut(exit.cause)) {
          signedOut(SESSION_ENDED);
          return;
        }
        setError(causeMessage(exit.cause));
        return;
      }
      const [me, reading] = exit.value;
      if (Exit.isFailure(me) && isSignedOut(me.cause)) {
        signedOut(SESSION_ENDED);
        return;
      }
      setPhase({
        document: reading.document,
        kind: "signedIn",
        me: Exit.isSuccess(me) ? me.value : null,
        source: reading.source,
      });
      setError(Exit.isFailure(me) ? causeMessage(me.cause) : reading.error);
    },
    [signedOut]
  );

  const refresh = useCallback(() => {
    setBusy(true);
    Effect.runPromiseExit(loadAccount).then((exit) => {
      if (live.current) {
        setBusy(false);
      }
      settle(exit);
    });
  }, [loadAccount, settle]);

  // Once a day, for as long as the session is signed in: the server's own
  // reading of the plan, so a subscription that ended or a card that failed
  // reaches the app without a relaunch.
  useEffect(() => {
    if (phase.kind !== "signedIn" || daily.current !== null) {
      if (phase.kind !== "signedIn" && daily.current !== null) {
        Effect.runFork(Fiber.interrupt(daily.current));
        daily.current = null;
      }
      return;
    }
    daily.current = Effect.runFork(
      sleep(REFRESH_EVERY).pipe(
        Effect.andThen(loadAccount),
        Effect.tap((loaded) => Effect.sync(() => settle(Exit.succeed(loaded)))),
        Effect.catch((cause) => Effect.sync(() => settle(Exit.fail(cause)))),
        Effect.forever
      )
    );
  }, [loadAccount, phase.kind, settle, sleep]);

  useEffect(() => {
    live.current = true;

    Effect.runPromiseExit(readAccountStatus).then((exit) => {
      if (!live.current) {
        return;
      }
      if (Exit.isFailure(exit)) {
        if (failureKindOf(exit.cause) !== "transport") {
          setPhase(SIGNED_OUT);
          setError(causeMessage(exit.cause));
        }
        return;
      }
      setOrigin(exit.value.origin);
      if (exit.value.signedIn) {
        refresh();
      } else {
        setPhase(SIGNED_OUT);
      }
    });

    return () => {
      live.current = false;
      if (flow.current !== null) {
        Effect.runFork(Fiber.interrupt(flow.current));
        flow.current = null;
      }
      if (daily.current !== null) {
        Effect.runFork(Fiber.interrupt(daily.current));
        daily.current = null;
      }
      if (purchase.current !== null) {
        Effect.runFork(Fiber.interrupt(purchase.current));
        purchase.current = null;
      }
    };
  }, [refresh]);

  const finishSignIn = useCallback(
    (outcome: SignInOutcome): Effect.Effect<void, AccountError> => {
      switch (outcome.status) {
        case "signedIn":
          return loadAccount.pipe(
            Effect.onExit((exit) => Effect.sync(() => settle(exit))),
            Effect.asVoid
          );
        case "expired":
          return Effect.sync(() => {
            setPhase(SIGNED_OUT);
            setError(CODE_EXPIRED);
          });
        case "denied":
          return Effect.sync(() => {
            setPhase(SIGNED_OUT);
            setError(SIGN_IN_DECLINED);
          });
        default:
          return absurd(outcome);
      }
    },
    [loadAccount, settle]
  );

  const signIn = useCallback(() => {
    if (flow.current !== null) {
      return;
    }
    setError(null);

    flow.current = Effect.runFork(
      startSignIn.pipe(
        Effect.tap((start) =>
          Effect.sync(() => {
            setPhase({
              kind: "signingIn",
              userCode: start.userCode,
              verificationUri: start.verificationUri,
            });
          })
        ),
        Effect.tap((start) =>
          openInBrowser(start.verificationUri).pipe(
            Effect.catch((cause) =>
              Effect.sync(() => {
                setError(cause.message);
              })
            )
          )
        ),
        Effect.flatMap((start) => awaitSignIn(start, pollSignIn, sleep)),
        Effect.flatMap(finishSignIn),
        Effect.onInterrupt(() =>
          Effect.ignore(cancelSignIn).pipe(
            Effect.andThen(
              Effect.sync(() => {
                if (live.current) {
                  setPhase(SIGNED_OUT);
                }
              })
            )
          )
        ),
        Effect.onExit((exit) =>
          Effect.sync(() => {
            flow.current = null;
            if (!live.current || Exit.isSuccess(exit)) {
              return;
            }
            const message = causeMessage(exit.cause);
            if (message !== null) {
              setPhase(SIGNED_OUT);
              setError(message);
            }
          })
        ),
        Effect.ignore
      )
    );
  }, [finishSignIn, sleep]);

  const cancel = useCallback(() => {
    if (flow.current !== null) {
      Effect.runFork(Fiber.interrupt(flow.current));
    }
  }, []);

  const signOut = useCallback(() => {
    setBusy(true);
    setError(null);
    Effect.runPromiseExit(signOutOnServer).then((exit) => {
      if (!live.current) {
        return;
      }
      setBusy(false);
      if (Exit.isFailure(exit)) {
        setError(causeMessage(exit.cause));
        return;
      }
      signedOut(null);
    });
  }, [signedOut]);

  const revokeDevice = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const id = event.currentTarget.value;
      if (phase.kind === "signedIn" && phase.me?.session.id === id) {
        signOut();
        return;
      }
      setBusy(true);
      setError(null);
      Effect.runPromiseExit(revokeDeviceOnServer(id)).then((exit) => {
        if (!live.current) {
          return;
        }
        if (Exit.isFailure(exit)) {
          setBusy(false);
          if (isSignedOut(exit.cause)) {
            signedOut(SESSION_ENDED);
            return;
          }
          setError(causeMessage(exit.cause));
          return;
        }
        refresh();
      });
    },
    [phase, refresh, signOut, signedOut]
  );

  const openPage = useCallback((url: string | null) => {
    if (url === null) {
      return;
    }
    Effect.runPromiseExit(openInBrowser(url)).then((exit) => {
      if (live.current && Exit.isFailure(exit)) {
        setError(causeMessage(exit.cause));
      }
    });
  }, []);

  // The entitlement as the checkout poll reads it: the same policy the boot
  // uses, so a cached document cannot answer "paid" — only the server can.
  const readDocument = useMemo(
    () =>
      readEntitlement({ cache, fetch: fetchEntitlement, publicKey }).pipe(
        Effect.map((reading) =>
          reading.source === "server" ? reading.document : null
        )
      ),
    [cache, publicKey]
  );

  const settleCheckout = useCallback(
    (outcome: "active" | "timedOut") =>
      outcome === "active"
        ? loadAccount.pipe(
            Effect.tap((loaded) =>
              Effect.sync(() => settle(Exit.succeed(loaded)))
            ),
            Effect.andThen(
              Effect.sync(() => {
                setCheckout((current) =>
                  current === null ? null : { ...current, phase: "active" }
                );
              })
            ),
            Effect.asVoid
          )
        : Effect.sync(() => {
            setCheckout((current) =>
              current === null ? null : { ...current, phase: "timedOut" }
            );
          }),
    [loadAccount, settle]
  );

  // Buying is the sign-in's shape again: a page opened in the browser, a poll
  // that waits for the server to say so, and no return trip into the app.
  const upgrade = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const period: BillingPeriod =
        event.currentTarget.getAttribute("data-period") === "year"
          ? "year"
          : "month";
      if (purchase.current !== null) {
        return;
      }
      setError(null);
      setCheckout({ period, phase: "opening", url: null });

      purchase.current = Effect.runFork(
        startCheckout(period).pipe(
          Effect.tap((start) =>
            Effect.sync(() => {
              setCheckout({ period, phase: "waiting", url: start.checkoutUrl });
            })
          ),
          Effect.tap((start) =>
            openInBrowser(start.checkoutUrl).pipe(
              Effect.catch((cause) =>
                Effect.sync(() => {
                  setError(cause.message);
                })
              )
            )
          ),
          Effect.andThen(awaitSubscription(readDocument, { sleep })),
          Effect.flatMap(settleCheckout),
          Effect.onExit((exit) =>
            Effect.sync(() => {
              purchase.current = null;
              if (!live.current || Exit.isSuccess(exit)) {
                return;
              }
              if (isSignedOut(exit.cause)) {
                signedOut(SESSION_ENDED);
                return;
              }
              const message = causeMessage(exit.cause);
              setCheckout(null);
              if (message !== null) {
                setError(message);
              }
            })
          ),
          Effect.ignore
        )
      );
    },
    [readDocument, settleCheckout, signedOut, sleep]
  );

  const checkAgain = useCallback(() => {
    setBusy(true);
    setError(null);
    Effect.runPromiseExit(
      readDocument.pipe(
        Effect.flatMap((document) =>
          settleCheckout(
            document !== null && isSubscribed(document, Date.now())
              ? "active"
              : "timedOut"
          )
        )
      )
    ).then((exit) => {
      if (!live.current) {
        return;
      }
      setBusy(false);
      if (Exit.isFailure(exit)) {
        if (isSignedOut(exit.cause)) {
          signedOut(SESSION_ENDED);
          return;
        }
        setError(causeMessage(exit.cause));
      }
    });
  }, [readDocument, settleCheckout, signedOut]);

  const dismissCheckout = useCallback(() => {
    if (purchase.current !== null) {
      Effect.runFork(Fiber.interrupt(purchase.current));
      purchase.current = null;
    }
    setCheckout(null);
  }, []);

  const openCheckoutPage = useCallback(() => {
    if (checkout?.url === null || checkout === null) {
      return;
    }
    Effect.runPromiseExit(openInBrowser(checkout.url)).then((exit) => {
      if (live.current && Exit.isFailure(exit)) {
        setError(causeMessage(exit.cause));
      }
    });
  }, [checkout]);

  const openPortal = useCallback(() => {
    setBusy(true);
    setError(null);
    Effect.runPromiseExit(portalLink.pipe(Effect.flatMap(openInBrowser))).then(
      (exit) => {
        if (!live.current) {
          return;
        }
        setBusy(false);
        if (Exit.isFailure(exit)) {
          if (isSignedOut(exit.cause)) {
            signedOut(SESSION_ENDED);
            return;
          }
          setError(causeMessage(exit.cause));
        }
      }
    );
  }, [signedOut]);

  const openAccountPage = useCallback(() => {
    openPage(origin === null ? null : accountPageUrl(origin));
  }, [openPage, origin]);

  const openBillingPage = useCallback(() => {
    openPage(origin === null ? null : billingPageUrl(origin));
  }, [openPage, origin]);

  const openVerification = useCallback(() => {
    if (phase.kind !== "signingIn") {
      return;
    }
    Effect.runPromiseExit(openInBrowser(phase.verificationUri)).then((exit) => {
      if (live.current && Exit.isFailure(exit)) {
        setError(causeMessage(exit.cause));
      }
    });
  }, [phase]);

  const plan = useMemo(
    () =>
      phase.kind === "signedIn" && phase.document !== null
        ? planAt(phase.document, Date.now())
        : null,
    [phase]
  );

  const tier = tierOf(plan);

  return useMemo(
    () => ({
      cancelSignIn: cancel,
      checkAgain,
      checkout,
      dismissCheckout,
      error,
      isBusy,
      openAccountPage,
      openBillingPage,
      openCheckoutPage,
      openPortal,
      openVerification,
      origin,
      phase,
      plan,
      refresh,
      revokeDevice,
      signIn,
      signOut,
      tier,
      upgrade,
    }),
    [
      cancel,
      checkAgain,
      checkout,
      dismissCheckout,
      error,
      isBusy,
      openAccountPage,
      openBillingPage,
      openCheckoutPage,
      openPortal,
      openVerification,
      origin,
      phase,
      plan,
      refresh,
      revokeDevice,
      signIn,
      signOut,
      tier,
      upgrade,
    ]
  );
}
