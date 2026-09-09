import { SESSION_MODE_LABELS, type SessionMode } from "@/shared/ipc";
import type { AgentProvider } from "@/shared/providers";

export interface ModelChoice {
  readonly label: string;
  readonly value: string;
}

export const CLAUDE_MODELS: readonly ModelChoice[] = [
  { label: "Fable 5.1", value: "claude-fable-5-1" },
  { label: "Fable 5", value: "claude-fable-5" },
  { label: "Opus 5", value: "claude-opus-5" },
  { label: "Sonnet 5", value: "claude-sonnet-5" },
  { label: "Haiku 4.5", value: "claude-haiku-4-5-20251001" },
];

export const DEFAULT_CLAUDE_MODEL = "claude-opus-5";

// Auto is not a mode every model has. Claude Code takes `permissionMode: "auto"`
// from a model that cannot run it and quietly reports `default` back on
// `system`/`init` — so the studio has to know which ones, or the Mode chip
// claims a mode the turn did not run in. Measured one probe per model against
// the real CLI, reading the mode `init` answers with: Fable 5.1, Fable 5,
// Opus 5 and Sonnet 5 all run Auto; Haiku 4.5 comes back `default`.
const WITHOUT_AUTO: ReadonlySet<string> = new Set([
  "claude-haiku-4-5-20251001",
]);

// What a turn will really run in. The session keeps the mode the person picked
// — moving to a model that has Auto brings it back without them re-choosing —
// and only what is *shown* falls back, because the alternative is a chip that
// says Auto over a turn that asked about everything.
export type RunningMode = SessionMode | "default";

export function offersAutoMode(model: string): boolean {
  return !WITHOUT_AUTO.has(model);
}

export function runningMode(mode: SessionMode, model: string): RunningMode {
  return mode === "auto" && !offersAutoMode(model) ? "default" : mode;
}

export function runningModeLabel(mode: RunningMode): string {
  return mode === "default" ? "Default" : SESSION_MODE_LABELS[mode];
}

// Codex's catalog is dynamic and account-shaped: thirteen explicit gpt-5.x
// slugs from the CLI source and the wider lineup were probed against a
// ChatGPT login (codex-cli 0.147.0) and every one answered 400 except Terra
// and Luna. Sol is the third sibling in the source — refused on the probed
// plan, plausibly open on higher tiers, and a refusal fails the turn with
// the router's own sentence. "Default" (no model at all) is the one entry
// that can never drift, so it leads. Astra is gated by the CLI, not the
// plan: measured on the same login, codex-cli 0.148.0 answers 400 *"The
// 'gpt-6-astra' model requires a newer version of Codex"* and 0.153.4 —
// the first release carrying the slug — runs it.
export const CODEX_MODELS: readonly ModelChoice[] = [
  { label: "Default", value: "" },
  { label: "GPT-6 Astra", value: "gpt-6-astra" },
  { label: "GPT-5.6 Terra", value: "gpt-5.6-terra" },
  { label: "GPT-5.6 Luna", value: "gpt-5.6-luna" },
  { label: "GPT-5.6 Sol", value: "gpt-5.6-sol" },
];

// A curated head of the 27 models `copilot help config` documents (CLI
// 1.0.80) — Copilot is a router over other vendors' models, so the group
// samples one strong entry per family rather than mirroring the whole
// catalog. Which of them an account may actually use is plan-shaped; a
// refused model fails the turn with the router's own sentence. "Default"
// is `auto` — Copilot picks — and cannot drift.
export const COPILOT_MODELS: readonly ModelChoice[] = [
  { label: "Default", value: "" },
  { label: "Claude Sonnet 5", value: "claude-sonnet-5" },
  { label: "Claude Opus 5", value: "claude-opus-5" },
  { label: "GPT-5.6 Terra", value: "gpt-5.6-terra" },
  { label: "Gemini 3.1 Pro", value: "gemini-3.1-pro-preview" },
  { label: "Grok 4.5", value: "grok-4.5" },
];

// Measured live with `grok models` against a grok.com login: 4.6 is the
// default, 4.5 the one alternative.
export const GROK_MODELS: readonly ModelChoice[] = [
  { label: "Default", value: "" },
  { label: "Grok 4.6", value: "grok-4.6" },
  { label: "Grok 4.5", value: "grok-4.5" },
];

export const PROVIDER_MODELS: Record<AgentProvider, readonly ModelChoice[]> = {
  claude: CLAUDE_MODELS,
  codex: CODEX_MODELS,
  copilot: COPILOT_MODELS,
  grok: GROK_MODELS,
};

export const DEFAULT_MODELS: Record<AgentProvider, string> = {
  claude: DEFAULT_CLAUDE_MODEL,
  codex: "",
  copilot: "",
  grok: "",
};

export function modelLabelOf(provider: AgentProvider, value: string): string {
  const found = PROVIDER_MODELS[provider].find(
    (choice) => choice.value === value
  );
  return found?.label ?? (value.length > 0 ? value : "Default");
}
