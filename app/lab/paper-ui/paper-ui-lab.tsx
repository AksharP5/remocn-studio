"use client";

import {
  ArrowLeftIcon,
  CheckIcon,
  DownloadIcon,
  FolderDownIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { type CSSProperties, memo, useRef, useState } from "react";
import { AppShell } from "@/components/studio/app-shell";
import { cn } from "@/lib/utils";
import { LabButton } from "./lab-ui";
import { downloadTheme, type ProjectDirectory, saveToProject } from "./save-theme";
import {
  ACCENTS,
  CONFIG_PATH,
  CONTROLS,
  FONTS,
  INITIAL,
  type Parameters,
  parseParameters,
  serialize,
  themeCss,
} from "./theme";

const Studio = memo(AppShell);
const CHROME_STYLE = {
  "--radius": "0.375rem",
  colorScheme: "dark",
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
  fontWeight: 400,
} as CSSProperties;

export function PaperUiLab({
  dmSansFamily,
  interFamily,
}: {
  dmSansFamily: string;
  interFamily: string;
}) {
  const [parameters, setParameters] = useState<Parameters>(INITIAL);
  const [savedSnapshot, setSavedSnapshot] = useState(() => serialize(INITIAL));
  const [enabled, setEnabled] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const directory = useRef<ProjectDirectory | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const settingsTrigger = useRef<HTMLButtonElement>(null);
  const dirty = serialize(parameters) !== savedSnapshot;

  const update = <Key extends keyof Parameters>(key: Key, value: Parameters[Key]) => {
    setParameters((current) => ({ ...current, [key]: value }));
    setEnabled(true);
    setStatus("");
    setError("");
  };

  const closeSettings = () => {
    setSettingsOpen(false);
    settingsTrigger.current?.focus();
  };

  const save = async () => {
    const snapshot = parameters;
    setSaving(true);
    setError("");
    setStatus("");
    try {
      directory.current = await saveToProject(snapshot, directory.current);
      setSavedSnapshot(serialize(snapshot));
      setStatus(`Saved: ${directory.current.name}/${CONFIG_PATH}`);
    } catch (reason) {
      directory.current = null;
      if (!(reason instanceof DOMException && reason.name === "AbortError")) {
        setError(reason instanceof Error ? reason.message : "Could not save this configuration.");
      }
    } finally {
      setSaving(false);
    }
  };

  const importFile = async (file: File) => {
    setError("");
    setStatus("");
    try {
      if (file.size > 65_536) throw new Error("Choose a configuration smaller than 64 KB.");
      const next = parseParameters(JSON.parse(await file.text()));
      setParameters(next);
      setEnabled(true);
      setStatus(`Loaded ${file.name}. Save to keep it in the project.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not read this configuration.");
    }
  };

  return (
    <div className="h-dvh" data-paper-ui-preview={enabled ? "paper" : "original"}>
      <style>{themeCss(parameters, dmSansFamily, interFamily)}</style>
      <Studio />

      <nav
        aria-label="Appearance preview"
        className="fixed top-3 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-1 rounded-lg border border-white/12 bg-[#202020] p-1 text-sm text-[#e5e5df] shadow-lg"
        style={CHROME_STYLE}
      >
        <Link
          aria-label="Back to Studio"
          className="flex size-10 shrink-0 items-center justify-center rounded-md text-[#a7a7a2] outline-offset-2 hover:bg-white/6 focus-visible:outline-2 focus-visible:outline-[#c7c7c0] pointer-coarse:size-11"
          href="/"
          title="Back to Studio"
        >
          <ArrowLeftIcon className="size-4" strokeWidth={1.5} />
        </Link>
        <div aria-label="Theme" className="flex gap-1" role="group">
          <LabButton
            aria-pressed={!enabled}
            className="text-[#a7a7a2] aria-pressed:bg-white/10 aria-pressed:text-[#e5e5df]"
            onClick={() => setEnabled(false)}
          >
            Studio
          </LabButton>
          <LabButton
            aria-pressed={enabled}
            className="text-[#a7a7a2] aria-pressed:bg-white/10 aria-pressed:text-[#e5e5df]"
            onClick={() => setEnabled(true)}
          >
            Preview
          </LabButton>
        </div>
        <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-white/12" />
        <LabButton
          aria-controls="paper-appearance-settings"
          aria-expanded={settingsOpen}
          aria-label="Adjust appearance"
          className="w-10 px-0 aria-expanded:bg-white/10 pointer-coarse:w-11"
          onClick={() => setSettingsOpen(!settingsOpen)}
          ref={settingsTrigger}
          title="Adjust appearance"
        >
          <SlidersHorizontalIcon className="size-4" strokeWidth={1.5} />
        </LabButton>
      </nav>

      {settingsOpen && (
        <aside
          aria-labelledby="paper-settings-title"
          className="fixed top-18 right-4 z-40 max-h-[calc(100dvh-5.5rem)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain rounded-lg border border-white/12 bg-[#202020] text-sm text-[#e5e5df] shadow-xl"
          id="paper-appearance-settings"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              closeSettings();
            }
          }}
          style={CHROME_STYLE}
        >
          <div className="flex items-center justify-between gap-2 border-white/10 border-b py-2 pr-2 pl-5">
            <h2 className="font-medium" id="paper-settings-title">Appearance</h2>
            <LabButton aria-label="Close appearance settings" className="w-10 px-0" onClick={closeSettings}>
              <XIcon className="size-4" strokeWidth={1.5} />
            </LabButton>
          </div>

          <div className="flex flex-col gap-5 p-5">
            <p className="text-pretty text-[#a7a7a2]">Your current Studio, with a Codex-inspired palette.</p>

            <div className="flex flex-col gap-2">
              <label htmlFor="paper-font">Font</label>
              <select
                className="h-10 w-full rounded-md border border-white/12 bg-[#292929] px-3 text-[#e5e5df] outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#c7c7c0]"
                id="paper-font"
                name="font"
                onChange={(event) => update("font", event.target.value as Parameters["font"])}
                value={parameters.font}
              >
                {Object.entries(FONTS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <p className="text-xs leading-relaxed text-[#a7a7a2]">DM Sans is the current font. Text sizes stay the same.</p>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2">Accent</legend>
              <div className="flex gap-2">
                {Object.entries(ACCENTS).map(([key, accent]) => (
                  <button
                    aria-label={accent.label}
                    aria-pressed={parameters.accent === key}
                    className="flex size-10 cursor-pointer items-center justify-center rounded-md border border-white/12 bg-(--swatch) text-[#181818] outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#c7c7c0] pointer-coarse:size-11"
                    key={key}
                    onClick={() => update("accent", key as Parameters["accent"])}
                    style={{ "--swatch": accent.dark } as CSSProperties}
                    title={accent.label}
                    type="button"
                  >
                    {parameters.accent === key && <CheckIcon className="size-4" />}
                  </button>
                ))}
              </div>
            </fieldset>

            {CONTROLS.map((control) => (
              <div className="flex flex-col gap-1" key={control.key}>
                <div className="flex items-center justify-between gap-2 text-[#b8b8b2]">
                  <label htmlFor={`paper-${control.key}`}>{control.label}</label>
                  <output className="font-mono text-xs tabular-nums" htmlFor={`paper-${control.key}`}>
                    {parameters[control.key]}{control.unit}
                  </output>
                </div>
                <input
                  aria-valuetext={`${parameters[control.key]}${control.unit}`}
                  className="h-7 w-full cursor-pointer accent-[#dbdbd2] focus-visible:outline-2 focus-visible:outline-[#c7c7c0] pointer-coarse:h-11"
                  id={`paper-${control.key}`}
                  max={control.max}
                  min={control.min}
                  name={control.key}
                  onChange={(event) => update(control.key, event.target.valueAsNumber)}
                  step={control.step}
                  type="range"
                  value={parameters[control.key]}
                />
              </div>
            ))}

            <div className="flex items-center justify-between gap-2 border-white/10 border-t pt-3">
              <p className="flex items-center gap-2 text-xs text-[#a7a7a2]">
                <span aria-hidden="true" className={cn("size-1.5 rounded-full", dirty ? "bg-[#a0b8ef]" : "bg-[#71716b]")} />
                {dirty ? "Unsaved changes" : "Saved configuration"}
              </p>
              <LabButton
                className="px-2 text-[#a7a7a2]"
                onClick={() => { setParameters(INITIAL); setStatus(""); setError(""); }}
                title="Reset to the configuration loaded from the project"
              >
                <RotateCcwIcon className="size-3.5" strokeWidth={1.5} />Reset
              </LabButton>
            </div>

            <div className="flex flex-col gap-2">
              <LabButton className="w-full bg-[#e5e5da] text-[#181818] hover:bg-[#f0f0e7]" disabled={saving} onClick={save}>
                <FolderDownIcon className="size-4" strokeWidth={1.5} />{saving ? "Saving…" : "Save to project"}
              </LabButton>
              <div className="grid grid-cols-2 gap-1">
                <LabButton className="px-1 text-[#b8b8b2]" onClick={() => { downloadTheme(parameters); setStatus("JSON downloaded. Place it at the project path below to save this theme."); setError(""); }}>
                  <DownloadIcon className="size-3.5" strokeWidth={1.5} />Download
                </LabButton>
                <LabButton className="px-1 text-[#b8b8b2]" onClick={() => importInput.current?.click()}>
                  <UploadIcon className="size-3.5" strokeWidth={1.5} />Load JSON
                </LabButton>
              </div>
              <input
                accept="application/json,.json"
                aria-label="Load a Paper UI configuration"
                className="sr-only"
                name="configuration"
                onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void importFile(file); }}
                ref={importInput}
                tabIndex={-1}
                type="file"
              />
              <p className="text-xs leading-relaxed text-[#a7a7a2]">Choose the project folder on your first save. This theme stays on the lab page.</p>
              <p className="break-all font-mono text-[0.6875rem] text-[#a7a7a2]" data-selectable>{CONFIG_PATH}</p>
              {status && <p aria-live="polite" className="break-words text-[#b8ccee]" role="status">{status}</p>}
              {error && <p className="break-words text-[#efb1a9]" role="alert">{error}</p>}
            </div>

            <p className="text-xs text-[#a7a7a2]">Palette reference: Codex desktop</p>
          </div>
        </aside>
      )}
    </div>
  );
}
