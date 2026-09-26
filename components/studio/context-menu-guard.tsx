"use client";

import { useContextMenuGuard } from "@/hooks/use-context-menu-guard";

export function ContextMenuGuard() {
  useContextMenuGuard();
  return null;
}
