"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AgentProvider } from "@/shared/providers";

export const SETTINGS_SECTIONS = [
  "account",
  "appearance",
  "behavior",
  "stock",
  "updates",
  "accounts",
  "feedback",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export function isSettingsSection(value: unknown): value is SettingsSection {
  return (
    typeof value === "string" &&
    (SETTINGS_SECTIONS as readonly string[]).includes(value)
  );
}

export interface SettingsView {
  close: () => void;
  isOpen: boolean;
  open: () => void;
  openAccount: () => void;
  openAccounts: (provider: AgentProvider) => void;
  provider: AgentProvider | null;
  section: SettingsSection;
  setOpen: (open: boolean) => void;
  setSection: (section: SettingsSection) => void;
}

// Settings is a view of the window rather than a dialog over it: it takes the
// whole window while open and the shell stays mounted underneath, so a turn,
// the preview and the sidecar carry on. Cmd+, is the standard macOS settings
// shortcut and Escape is the way back; the listeners live here, not in the
// pane, so both work while the sidebar is hidden.
export function useSettingsView(): SettingsView {
  const [isOpen, setIsOpen] = useState(false);
  const [section, setSection] = useState<SettingsSection>("appearance");
  const [provider, setProvider] = useState<AgentProvider | null>(null);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const openAccount = useCallback(() => {
    setSection("account");
    setIsOpen(true);
  }, []);

  const openAccounts = useCallback((target: AgentProvider) => {
    setSection("accounts");
    setProvider(target);
    setIsOpen(true);
  }, []);

  const setOpen = useCallback((next: boolean) => {
    setIsOpen(next);
    if (!next) {
      setProvider(null);
    }
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "," && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setIsOpen(true);
        return;
      }
      // A menu or a popover open on the page answers Escape first and
      // prevents the default; only an Escape nothing else wanted leaves.
      if (event.key === "Escape" && isOpen && !event.defaultPrevented) {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, setOpen]);

  return useMemo(
    () => ({
      close,
      isOpen,
      open,
      openAccount,
      openAccounts,
      provider,
      section,
      setOpen,
      setSection,
    }),
    [close, isOpen, open, openAccount, openAccounts, provider, section, setOpen]
  );
}
