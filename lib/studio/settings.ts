import { load } from "@tauri-apps/plugin-store";
import { Effect } from "effect";
import type { LayoutStorage } from "react-resizable-panels";
import { isPaneView, type PaneView } from "@/lib/studio/pane-view";
import { crashConsentValue } from "@/shared/crash";
import { type EffortLevel, isEffortLevel } from "@/shared/ipc";
import type { AgentProvider } from "@/shared/providers";

const SETTINGS_FILE = "settings.json";
const PROJECT_FOLDER_KEY = "projectFolder";
const EXPANDED_VIDEOS_KEY = "expandedVideos";
const CLAUDE_MODEL_KEY = "claudeModel";
const CODEX_MODEL_KEY = "codexModel";
const COPILOT_MODEL_KEY = "copilotModel";
const GROK_MODEL_KEY = "grokModel";
const CLAUDE_EFFORT_KEY = "claudeEffort";
const ASSET_OFFERS_KEY = "assetOffers";
const CRASH_REPORTS_KEY = "crashReports";
const PREVIEW_PANE_KEY = "previewPane";
const PROJECTS_PANE_KEY = "projectsPane";
const TASK_DOCK_KEY = "taskDock";
const PANE_VIEW_KEY = "paneView";
const TOURS_SEEN_KEY = "toursSeen";
const TRIAL_CARDS_KEY = "trialCardsDismissed";
const LAYOUT_KEY_PREFIX = "layout:";

const cache = new Map<string, string>();

const openStore = Effect.runSync(
  Effect.cached(Effect.tryPromise(() => load(SETTINGS_FILE)))
);

export interface StudioSettings {
  assetOffers: boolean | null;
  claudeEffort: EffortLevel | null;
  claudeModel: string | null;
  codexModel: string | null;
  copilotModel: string | null;
  crashReports: boolean | null;
  expandedVideos: readonly string[];
  grokModel: string | null;
  legacyProjectFolder: string | null;
  paneView: PaneView | null;
  previewPane: boolean | null;
  projectsPane: boolean | null;
  taskDock: boolean | null;
  toursSeen: readonly string[];
  trialCardsDismissed: readonly string[];
}

export const hydrateSettings: Effect.Effect<StudioSettings> = openStore.pipe(
  Effect.flatMap((store) => Effect.tryPromise(() => store.entries())),
  Effect.orElseSucceed((): [string, unknown][] => []),
  Effect.map((entries) => {
    cache.clear();
    for (const [key, value] of entries) {
      if (typeof value === "string") {
        cache.set(key, value);
      }
    }
    return {
      assetOffers: enabledOf(cache.get(ASSET_OFFERS_KEY)),
      claudeEffort: effortOf(cache.get(CLAUDE_EFFORT_KEY)),
      claudeModel: cache.get(CLAUDE_MODEL_KEY) ?? null,
      codexModel: cache.get(CODEX_MODEL_KEY) ?? null,
      copilotModel: cache.get(COPILOT_MODEL_KEY) ?? null,
      crashReports: enabledOf(cache.get(CRASH_REPORTS_KEY)),
      expandedVideos: idsOf(cache.get(EXPANDED_VIDEOS_KEY)),
      grokModel: cache.get(GROK_MODEL_KEY) ?? null,
      legacyProjectFolder: cache.get(PROJECT_FOLDER_KEY) ?? null,
      paneView: paneViewOf(cache.get(PANE_VIEW_KEY)),
      previewPane: shownOf(cache.get(PREVIEW_PANE_KEY)),
      projectsPane: shownOf(cache.get(PROJECTS_PANE_KEY)),
      taskDock: shownOf(cache.get(TASK_DOCK_KEY)),
      toursSeen: idsOf(cache.get(TOURS_SEEN_KEY)),
      trialCardsDismissed: idsOf(cache.get(TRIAL_CARDS_KEY)),
    };
  })
);

function effortOf(value: string | undefined): EffortLevel | null {
  return isEffortLevel(value) ? value : null;
}

function paneViewOf(value: string | undefined): PaneView | null {
  return value !== undefined && isPaneView(value) ? value : null;
}

function enabledOf(value: string | undefined): boolean | null {
  if (value === "enabled") {
    return true;
  }
  if (value === "disabled") {
    return false;
  }
  return null;
}

function shownOf(value: string | undefined): boolean | null {
  if (value === "shown") {
    return true;
  }
  if (value === "hidden") {
    return false;
  }
  return null;
}

function idsOf(value: string | undefined): readonly string[] {
  if (value === undefined) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function persist(key: string, value: string): Effect.Effect<void> {
  return Effect.ignore(
    openStore.pipe(
      Effect.flatMap((opened) =>
        Effect.tryPromise(() => opened.set(key, value))
      )
    )
  );
}

function forget(key: string): Effect.Effect<void> {
  return Effect.ignore(
    openStore.pipe(
      Effect.flatMap((opened) => Effect.tryPromise(() => opened.delete(key)))
    )
  );
}

export const forgetProjectFolder: Effect.Effect<void> = Effect.sync(() => {
  cache.delete(PROJECT_FOLDER_KEY);
}).pipe(Effect.andThen(forget(PROJECT_FOLDER_KEY)));

export function saveExpandedVideos(
  ids: readonly string[]
): Effect.Effect<void> {
  return remember(EXPANDED_VIDEOS_KEY, JSON.stringify(ids));
}

const MODEL_KEYS: Record<AgentProvider, string> = {
  claude: CLAUDE_MODEL_KEY,
  codex: CODEX_MODEL_KEY,
  copilot: COPILOT_MODEL_KEY,
  grok: GROK_MODEL_KEY,
};

export function saveProviderModel(
  provider: AgentProvider,
  model: string | null
): Effect.Effect<void> {
  return remember(MODEL_KEYS[provider], model);
}

export function savePreviewPane(shown: boolean): Effect.Effect<void> {
  return remember(PREVIEW_PANE_KEY, shown ? "shown" : "hidden");
}

export function saveProjectsPane(shown: boolean): Effect.Effect<void> {
  return remember(PROJECTS_PANE_KEY, shown ? "shown" : "hidden");
}

export function saveTaskDock(shown: boolean): Effect.Effect<void> {
  return remember(TASK_DOCK_KEY, shown ? "shown" : "hidden");
}

// The tips a person has answered. Replaying them is this list going empty,
// which is why it is written whole rather than appended to.
export function saveToursSeen(ids: readonly string[]): Effect.Effect<void> {
  return remember(TOURS_SEEN_KEY, JSON.stringify(ids));
}

export function saveTrialCardsDismissed(
  ids: readonly string[]
): Effect.Effect<void> {
  return remember(TRIAL_CARDS_KEY, JSON.stringify(ids));
}

export function savePaneView(view: PaneView): Effect.Effect<void> {
  return remember(PANE_VIEW_KEY, view);
}

export function saveAssetOffers(enabled: boolean): Effect.Effect<void> {
  return remember(ASSET_OFFERS_KEY, enabled ? "enabled" : "disabled");
}

// The one setting the Rust core reads too — it opens this file itself at
// spawn to decide what the sidecar is told, so the value on disk is the
// contract rather than an internal spelling. `crashConsentValue` is what
// writes it, in `shared/crash.ts`, beside the reader both sides use.
export function saveCrashReports(enabled: boolean): Effect.Effect<void> {
  return remember(CRASH_REPORTS_KEY, crashConsentValue(enabled));
}

export function saveClaudeEffort(
  effort: EffortLevel | null
): Effect.Effect<void> {
  return remember(CLAUDE_EFFORT_KEY, effort);
}

function remember(key: string, value: string | null): Effect.Effect<void> {
  return Effect.sync(() => {
    if (value === null) {
      cache.delete(key);
      return;
    }
    cache.set(key, value);
  }).pipe(Effect.andThen(value === null ? forget(key) : persist(key, value)));
}

export const layoutStorage: LayoutStorage = {
  getItem: (key) => cache.get(LAYOUT_KEY_PREFIX + key) ?? null,
  setItem: (key, value) => {
    cache.set(LAYOUT_KEY_PREFIX + key, value);
    Effect.runFork(persist(LAYOUT_KEY_PREFIX + key, value));
  },
};
