"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { PlanTier } from "@/shared/entitlement";

export interface PlanHandle {
  read: () => PlanTier;
  set: (tier: PlanTier) => void;
}

// The workspace is built before the account is, and a turn reads the tier at
// dispatch rather than at render: a ref behind two stable closures is what
// lets the two meet without the account re-creating the turn machinery.
export function usePlanTier(): PlanHandle {
  const tier = useRef<PlanTier>("free");
  const read = useCallback(() => tier.current, []);
  const set = useCallback((next: PlanTier) => {
    tier.current = next;
  }, []);
  return useMemo(() => ({ read, set }), [read, set]);
}

export function useFollowPlanTier(
  handle: PlanHandle | null,
  tier: PlanTier
): void {
  useEffect(() => {
    handle?.set(tier);
  }, [handle, tier]);
}
