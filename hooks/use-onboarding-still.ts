"use client";

import { useCallback, useState } from "react";

export function useOnboardingStill() {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const onError = useCallback(() => setFailed(true), []);
  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((value) => value + 1);
  }, []);
  return { attempt, failed, onError, retry };
}
