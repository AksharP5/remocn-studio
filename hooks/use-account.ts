"use client";

import { type Duration, Effect, Exit, Fiber } from "effect";
import type { MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { causeMessage } from "@/lib/error-message";
import {
  type AccountError,
  accountPageUrl,
  awaitSignIn,
  billingPageUrl,
  cancelSignIn,
  failureKindOf,
  fetchEntitlement,
  fetchMe,
  isSignedOut,
  openInBrowser,
  pollSignIn,
  readAccountStatus,
  revokeDevice as revokeDeviceOnServer,
  type SignInOutcome,
  signOut as signOutOnServer,
  startSignIn,
} from "@/lib/studio/account";
import type { AccountDevice, AccountMe } from "@/shared/account";
import {
  type AccountPlan,
  type EntitlementDocument,
  planAt,
} from "@/shared/entitlement";

export type AccountPhase =
  | {
      kind: "signedIn";
      document: EntitlementDocument | null;
      me: AccountMe | null;
    }
  | { kind: "signedOut" }
  | { kind: "signingIn"; userCode: string; verificationUri: string }
  | { kind: "unknown" };

export interface DeviceLimitHit {
  devices: readonly AccountDevice[];
  message: string;
}

export interface Account {
  cancelSignIn: () => void;
  deviceLimit: DeviceLimitHit | null;
  error: string | null;
  isBusy: boolean;
  openAccountPage: () => void;
  openBillingPage: () => void;
  openVerification: () => void;
  origin: string | null;
  phase: AccountPhase;
  plan: AccountPlan | null;
  refresh: () => void;
  revokeDevice: (event: MouseEvent<HTMLButtonElement>) => void;
  signIn: () => void;
  signOut: () => void;
}

const SESSION_ENDED = "This device was signed out. Sign in again to continue.";
const CODE_EXPIRED =
  "The sign-in code expired before it was confirmed. Try again.";
const SIGN_IN_DECLINED = "The sign-in was declined in the browser.";

const UNKNOWN: AccountPhase = { kind: "unknown" };
const SIGNED_OUT: AccountPhase = { kind: "signedOut" };

const loadAccount = Effect.all([fetchMe, fetchEntitlement], {
  concurrency: 2,
});

export interface AccountOptions {
  sleep?: (delay: Duration.Duration) => Effect.Effect<void>;
}

export function useAccount({ sleep }: AccountOptions = {}): Account {
  const [phase, setPhase] = useState<AccountPhase>(UNKNOWN);
  const [origin, setOrigin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deviceLimit, setDeviceLimit] = useState<DeviceLimitHit | null>(null);
  const [isBusy, setBusy] = useState(false);
  const flow = useRef<Fiber.Fiber<unknown, unknown> | null>(null);
  const live = useRef(true);

  const settle = useCallback(
    (exit: Exit.Exit<readonly [AccountMe, EntitlementDocument], unknown>) => {
      if (!live.current) {
        return;
      }
      if (Exit.isSuccess(exit)) {
        const [me, document] = exit.value;
        setPhase({ document, kind: "signedIn", me });
        setError(null);
        return;
      }
      if (isSignedOut(exit.cause)) {
        setPhase(SIGNED_OUT);
        setError(SESSION_ENDED);
        return;
      }
      setPhase((current) =>
        current.kind === "signedIn"
          ? current
          : { document: null, kind: "signedIn", me: null }
      );
      setError(causeMessage(exit.cause));
    },
    []
  );

  const refresh = useCallback(() => {
    setBusy(true);
    Effect.runPromiseExit(loadAccount).then((exit) => {
      if (live.current) {
        setBusy(false);
      }
      settle(exit);
    });
  }, [settle]);

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
          return Effect.sync(() => {
            setPhase(SIGNED_OUT);
            setDeviceLimit({
              devices: outcome.devices,
              message: outcome.message,
            });
          });
      }
    },
    [settle]
  );

  const signIn = useCallback(() => {
    if (flow.current !== null) {
      return;
    }
    setError(null);
    setDeviceLimit(null);

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
      setPhase(SIGNED_OUT);
      setDeviceLimit(null);
    });
  }, []);

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
            setPhase(SIGNED_OUT);
            setError(SESSION_ENDED);
            return;
          }
          setError(causeMessage(exit.cause));
          return;
        }
        refresh();
      });
    },
    [phase, refresh, signOut]
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

  return useMemo(
    () => ({
      cancelSignIn: cancel,
      deviceLimit,
      error,
      isBusy,
      openAccountPage,
      openBillingPage,
      openVerification,
      origin,
      phase,
      plan,
      refresh,
      revokeDevice,
      signIn,
      signOut,
    }),
    [
      cancel,
      deviceLimit,
      error,
      isBusy,
      openAccountPage,
      openBillingPage,
      openVerification,
      origin,
      phase,
      plan,
      refresh,
      revokeDevice,
      signIn,
      signOut,
    ]
  );
}
