import { load } from "@tauri-apps/plugin-store";
import { Effect, Semaphore } from "effect";
import type { LayoutStorage } from "react-resizable-panels";
import type { NotifyEvent } from "@/lib/studio/attention";
import {
  type OnboardingProgress,
  onboardingProgress,
} from "@/lib/studio/onboarding";
import { isPaneView, type PaneView } from "@/lib/studio/pane-view";
import { crashConsentValue } from "@/shared/crash";
import {
  EXPORT_FORMATS,
  EXPORT_PRESETS,
  EXPORT_QUALITIES,
  EXPORT_RESOLUTIONS,
  type ExportSettings,
} from "@/shared/export";
import { type EffortLevel, isEffortLevel } from "@/shared/ipc";
import type { AgentProvider } from "@/shared/providers";

const ONBOARDING_KEY = "onboarding";
const onboardingWrites = Semaphore.makeUnsafe(1);

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
const NOTIFICATIONS_KEY = "notifications";
const NOTIFY_EVENT_KEYS: Readonly<Record<NotifyEvent, string>> = {
  export: "notifyExport",
  sidecar: "notifySidecar",
  turnEnded: "notifyTurnEnded",
  waiting: "notifyWaiting",
};
const PREVIEW_PANE_KEY = "previewPane";
const PROJECTS_PANE_KEY = "projectsPane";
const TASK_DOCK_KEY = "taskDock";
const PROP_GROUPS_KEY = "collapsedPropGroups";
const TITLEBAR_SHADER_KEY = "titlebarShader";
const TITLEBAR_MOTION_KEY = "titlebarMotion";
const PANE_VIEW_KEY = "paneView";
const CANVAS_CAMERAS_KEY = "canvasCameras";
const CANVAS_RULERS_KEY = "canvasRulers";
const CANVAS_CAMERA_LIMIT = 50;
const LAYOUT_KEY_PREFIX = "layout:";

const cache = new Map<string, string>();

const openStore = Effect.runSync(
  Effect.cached(Effect.tryPromise(() => load(SETTINGS_FILE)))
);

export interface StudioSettings {
  assetOffers: boolean | null;
  canvasRulers: boolean | null;
  claudeEffort: EffortLevel | null;
  claudeModel: string | null;
  codexModel: string | null;
  /** The property groups folded shut, by name. Collapsed rather than expanded,
      so a group the pane gains later opens with everything else. */
  collapsedPropGroups: readonly string[];
  copilotModel: string | null;
  crashReports: boolean | null;
  expandedVideos: readonly string[];
  grokModel: string | null;
  legacyProjectFolder: string | null;
  notifications: boolean | null;
  notifyEvents: Readonly<Record<NotifyEvent, boolean | null>>;
  onboarding: OnboardingProgress;
  paneView: PaneView | null;
  previewPane: boolean | null;
  projectsPane: boolean | null;
  taskDock: boolean | null;
  titlebarMotion: boolean | null;
  titlebarShader: boolean | null;
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
      canvasRulers: shownOf(cache.get(CANVAS_RULERS_KEY)),
      claudeEffort: effortOf(cache.get(CLAUDE_EFFORT_KEY)),
      claudeModel: cache.get(CLAUDE_MODEL_KEY) ?? null,
      codexModel: cache.get(CODEX_MODEL_KEY) ?? null,
      collapsedPropGroups: idsOf(cache.get(PROP_GROUPS_KEY)),
      copilotModel: cache.get(COPILOT_MODEL_KEY) ?? null,
      crashReports: enabledOf(cache.get(CRASH_REPORTS_KEY)),
      expandedVideos: idsOf(cache.get(EXPANDED_VIDEOS_KEY)),
      grokModel: cache.get(GROK_MODEL_KEY) ?? null,
      legacyProjectFolder: cache.get(PROJECT_FOLDER_KEY) ?? null,
      notifications: enabledOf(cache.get(NOTIFICATIONS_KEY)),
      notifyEvents: {
        export: enabledOf(cache.get(NOTIFY_EVENT_KEYS.export)),
        sidecar: enabledOf(cache.get(NOTIFY_EVENT_KEYS.sidecar)),
        turnEnded: enabledOf(cache.get(NOTIFY_EVENT_KEYS.turnEnded)),
        waiting: enabledOf(cache.get(NOTIFY_EVENT_KEYS.waiting)),
      },
      onboarding: onboardingProgress(cache.get(ONBOARDING_KEY)),
      paneView: paneViewOf(cache.get(PANE_VIEW_KEY)),
      previewPane: shownOf(cache.get(PREVIEW_PANE_KEY)),
      projectsPane: shownOf(cache.get(PROJECTS_PANE_KEY)),
      taskDock: shownOf(cache.get(TASK_DOCK_KEY)),
      titlebarMotion: enabledOf(cache.get(TITLEBAR_MOTION_KEY)),
      titlebarShader: shownOf(cache.get(TITLEBAR_SHADER_KEY)),
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

export function saveCollapsedPropGroups(
  groups: readonly string[]
): Effect.Effect<void> {
  return remember(PROP_GROUPS_KEY, JSON.stringify(groups));
}

export function saveCanvasRulers(shown: boolean): Effect.Effect<void> {
  return remember(CANVAS_RULERS_KEY, shown ? "shown" : "hidden");
}

export interface RememberedCamera {
  x: number;
  y: number;
  zoom: number;
}

interface RememberedCameraEntry extends RememberedCamera {
  key: string;
}

function camerasOf(value: string | undefined): RememberedCameraEntry[] {
  if (value === undefined) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(isCameraEntry) : [];
  } catch {
    return [];
  }
}

function isCameraEntry(value: unknown): value is RememberedCameraEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { key, x, y, zoom } = value as Record<string, unknown>;
  return (
    typeof key === "string" &&
    [x, y, zoom].every(
      (number) => typeof number === "number" && Number.isFinite(number)
    ) &&
    (zoom as number) > 0
  );
}

export function readCanvasCamera(key: string): RememberedCamera | null {
  const entry = camerasOf(cache.get(CANVAS_CAMERAS_KEY)).find(
    (item) => item.key === key
  );
  return entry ? { x: entry.x, y: entry.y, zoom: entry.zoom } : null;
}

export function saveCanvasCamera(
  key: string,
  camera: RememberedCamera
): Effect.Effect<void> {
  return Effect.suspend(() => {
    const entries = [
      { key, x: camera.x, y: camera.y, zoom: camera.zoom },
      ...camerasOf(cache.get(CANVAS_CAMERAS_KEY)).filter(
        (item) => item.key !== key
      ),
    ].slice(0, CANVAS_CAMERA_LIMIT);
    return remember(CANVAS_CAMERAS_KEY, JSON.stringify(entries));
  });
}

export function saveOnboarding(progress: OnboardingProgress) {
  const value = JSON.stringify(progress);
  return onboardingWrites.withPermit(
    openStore.pipe(
      Effect.flatMap((store) =>
        Effect.tryPromise(async () => {
          await store.set(ONBOARDING_KEY, value);
          await store.save();
          cache.set(ONBOARDING_KEY, value);
        })
      )
    )
  );
}

export function savePaneView(view: PaneView): Effect.Effect<void> {
  return remember(PANE_VIEW_KEY, view);
}

export function saveTitlebarShader(shown: boolean): Effect.Effect<void> {
  return remember(TITLEBAR_SHADER_KEY, shown ? "shown" : "hidden");
}

export function saveTitlebarMotion(enabled: boolean): Effect.Effect<void> {
  return remember(TITLEBAR_MOTION_KEY, enabled ? "enabled" : "disabled");
}

export function saveAssetOffers(enabled: boolean): Effect.Effect<void> {
  return remember(ASSET_OFFERS_KEY, enabled ? "enabled" : "disabled");
}

export function saveNotifications(enabled: boolean): Effect.Effect<void> {
  return remember(NOTIFICATIONS_KEY, enabled ? "enabled" : "disabled");
}

export function saveNotifyEvent(
  event: NotifyEvent,
  enabled: boolean
): Effect.Effect<void> {
  return remember(NOTIFY_EVENT_KEYS[event], enabled ? "enabled" : "disabled");
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

const EXPORT_KEY_PREFIX = "export:";

export interface RememberedExport {
  folder: string | null;
  settings: ExportSettings;
}

export function readExportSettings(projectId: string): RememberedExport | null {
  const held = cache.get(EXPORT_KEY_PREFIX + projectId);

  if (held === undefined) {
    return null;
  }

  try {
    return rememberedOf(JSON.parse(held));
  } catch {
    return null;
  }
}

export function saveExportSettings(
  projectId: string,
  remembered: RememberedExport
): Effect.Effect<void> {
  return remember(
    EXPORT_KEY_PREFIX + projectId,
    JSON.stringify({ ...remembered.settings, folder: remembered.folder })
  );
}

function rememberedOf(parsed: unknown): RememberedExport | null {
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const { folder, format, preset, quality, resolution } = parsed as Record<
    string,
    unknown
  >;

  if (
    !(
      isOneOf(EXPORT_FORMATS, format) &&
      isOneOf(EXPORT_PRESETS, preset) &&
      isOneOf(EXPORT_QUALITIES, quality) &&
      isOneOf(EXPORT_RESOLUTIONS, resolution)
    )
  ) {
    return null;
  }

  return {
    folder: typeof folder === "string" ? folder : null,
    settings: { format, preset, quality, resolution },
  };
}

function isOneOf<T extends string>(
  allowed: readonly T[],
  value: unknown
): value is T {
  return (
    typeof value === "string" && (allowed as readonly string[]).includes(value)
  );
}
