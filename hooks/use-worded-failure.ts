"use client";

import { useMemo } from "react";
import { type WordedFailure, wordFailure } from "@/lib/studio/failure-text";

export function useWordedFailure(
  raw: string | null | undefined,
  fallback: string
): WordedFailure {
  return useMemo(() => wordFailure(raw, fallback), [raw, fallback]);
}
