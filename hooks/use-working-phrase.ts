"use client";

import { useState } from "react";
import { useNow } from "@/hooks/use-now";
import { WORKING_PHRASES, workingPhrase } from "@/lib/studio/working-phrases";

export const PHRASE_MS = 3000;

export function useWorkingPhrase(working: boolean): string {
  const [offset] = useState(() =>
    Math.floor(Math.random() * WORKING_PHRASES.length)
  );
  const now = useNow(working ? PHRASE_MS : null);

  return workingPhrase(offset + Math.floor(now / PHRASE_MS));
}
