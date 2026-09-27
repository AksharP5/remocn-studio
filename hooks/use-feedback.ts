"use client";

import { useCallback, useMemo } from "react";
import { useAsyncAction } from "@/hooks/use-async-action";
import { openFeedback } from "@/lib/studio/feedback";

export interface Feedback {
  error: string | null;
  send: () => Promise<void>;
}

export function useFeedback({
  environment,
  os,
  provider,
  version,
}: {
  environment: string | null;
  os: string | null;
  provider: string | null;
  version: string | null;
}): Feedback {
  const { error, run } = useAsyncAction();

  const send = useCallback(async () => {
    await run(openFeedback({ environment, os, provider, version }));
  }, [environment, os, provider, run, version]);

  return useMemo(() => ({ error, send }), [error, send]);
}
