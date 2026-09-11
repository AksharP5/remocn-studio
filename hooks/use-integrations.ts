"use client";

import { Effect, Exit } from "effect";
import { useCallback, useEffect, useMemo, useState } from "react";
import { causeMessage } from "@/lib/error-message";
import {
  beginConnection,
  cancelConnection,
  checkConnection,
  confirmConnection,
  readCatalogue,
  readConnections,
  removeConnection,
  replaceSecret,
  setConnectionDisabled,
} from "@/lib/studio/integrations";
import type {
  AuthorizationKind,
  Catalogue,
  Connection,
  ConnectionAttempt,
  IntegrationProvider,
} from "@/shared/integrations";

export type AddStep = "chosen" | "closed" | "naming" | "picking";

export interface Integrations {
  attempt: ConnectionAttempt | null;
  busy: string | null;
  candidate: IntegrationProvider | null;
  catalogue: Catalogue;
  connections: readonly Connection[];
  error: string | null;
  notice: string | null;
  onCancelAdd: () => void;
  onCheck: (id: string) => void;
  onChoose: (provider: IntegrationProvider) => void;
  onConfirm: (name: string) => void;
  onOpenAdd: () => void;
  onRemove: (id: string) => void;
  onReplaceSecret: (id: string, secret: string) => void;
  onSubmitSecret: (secret: string) => void;
  onToggleDisabled: (id: string, disabled: boolean) => void;
  step: AddStep;
}

export function useIntegrations(): Integrations {
  const [catalogue, setCatalogue] = useState<Catalogue>([]);
  const [connections, setConnections] = useState<readonly Connection[]>([]);
  const [step, setStep] = useState<AddStep>("closed");
  const [candidate, setCandidate] = useState<IntegrationProvider | null>(null);
  const [attempt, setAttempt] = useState<ConnectionAttempt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const settle = useCallback(
    async <A, E>(
      effect: Effect.Effect<A, E>,
      working: string | null = null
    ): Promise<A | null> => {
      setBusy(working);
      const exit = await Effect.runPromiseExit(effect);
      setBusy(null);

      if (Exit.isSuccess(exit)) {
        setError(null);
        return exit.value;
      }

      setError(causeMessage(exit.cause));
      return null;
    },
    []
  );

  const refresh = useCallback(async () => {
    const listed = await Effect.runPromiseExit(readConnections);
    if (Exit.isSuccess(listed)) {
      setConnections(listed.value);
    }
  }, []);

  useEffect(() => {
    Effect.runFork(
      readCatalogue.pipe(
        Effect.tap((offered) => Effect.sync(() => setCatalogue(offered))),
        Effect.ignore
      )
    );
    refresh();
  }, [refresh]);

  const onOpenAdd = useCallback(() => {
    setStep("picking");
    setCandidate(null);
    setAttempt(null);
    setError(null);
  }, []);

  const onChoose = useCallback((provider: IntegrationProvider) => {
    setCandidate(provider);
    setStep("chosen");
    setError(null);
  }, []);

  const onCancelAdd = useCallback(() => {
    Effect.runFork(Effect.ignore(cancelConnection));
    setStep("closed");
    setCandidate(null);
    setAttempt(null);
    setError(null);
  }, []);

  const onSubmitSecret = useCallback(
    (secret: string) => {
      if (candidate === null) {
        return;
      }

      const authorization: AuthorizationKind = candidate.authorization[0];
      const trimmed = secret.trim();

      settle(
        beginConnection({
          authorization,
          provider: candidate.id,
          secret: trimmed.length === 0 ? null : trimmed,
        }),
        "checking"
      ).then((checked) => {
        if (checked !== null) {
          setAttempt(checked);
          setStep("naming");
        }
      });
    },
    [candidate, settle]
  );

  const onConfirm = useCallback(
    (name: string) => {
      settle(confirmConnection(name.trim()), "saving").then((made) => {
        if (made !== null) {
          setStep("closed");
          setCandidate(null);
          setAttempt(null);
          refresh();
        }
      });
    },
    [refresh, settle]
  );

  const onCheck = useCallback(
    (id: string) => {
      settle(checkConnection(id), id).then(() => refresh());
    },
    [refresh, settle]
  );

  const onReplaceSecret = useCallback(
    (id: string, secret: string) => {
      settle(replaceSecret(id, secret.trim()), id).then((done) => {
        if (done !== null) {
          refresh();
        }
      });
    },
    [refresh, settle]
  );

  const onToggleDisabled = useCallback(
    (id: string, disabled: boolean) => {
      settle(setConnectionDisabled(id, disabled), id).then(() => refresh());
    },
    [refresh, settle]
  );

  const onRemove = useCallback(
    (id: string) => {
      settle(removeConnection(id), id).then((gone) => {
        if (gone !== null) {
          setNotice(gone.withdrawn ? null : gone.detail);
          refresh();
        }
      });
    },
    [refresh, settle]
  );

  return useMemo(
    () => ({
      attempt,
      busy,
      candidate,
      catalogue,
      connections,
      error,
      notice,
      onCancelAdd,
      onCheck,
      onChoose,
      onConfirm,
      onOpenAdd,
      onRemove,
      onReplaceSecret,
      onSubmitSecret,
      onToggleDisabled,
      step,
    }),
    [
      attempt,
      busy,
      candidate,
      catalogue,
      connections,
      error,
      notice,
      onCancelAdd,
      onCheck,
      onChoose,
      onConfirm,
      onOpenAdd,
      onRemove,
      onReplaceSecret,
      onSubmitSecret,
      onToggleDisabled,
      step,
    ]
  );
}
