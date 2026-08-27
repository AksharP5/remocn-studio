import { Effect } from "effect";
import {
  cancelSidecarRequest,
  newRequestId,
  requestSidecar,
  type SidecarError,
} from "@/lib/studio/sidecar";
import type {
  EnvironmentCheck,
  EnvironmentReport,
  InstallEvent,
  Installed,
} from "@/shared/ipc";
import type { AgentProvider } from "@/shared/providers";
import type { PreviewComposition } from "./preview";

export function checkEnvironment(
  projectId: string,
  force: boolean,
  provider: AgentProvider
): Effect.Effect<EnvironmentReport, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "project.check",
      params: { force, projectId, provider },
    }).pipe(Effect.onInterrupt(() => Effect.ignore(cancelSidecarRequest(id))));
  });
}

export function installProject(
  projectId: string,
  onEvent: (event: InstallEvent) => void
): Effect.Effect<Installed, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "project.install",
      onStream: onEvent,
      params: { projectId },
    }).pipe(Effect.onInterrupt(() => Effect.ignore(cancelSidecarRequest(id))));
  });
}

export function compositionRow(
  pick: PreviewComposition | null
): EnvironmentCheck {
  if (pick === null) {
    return {
      detail: "Counted once the preview has compiled the project.",
      fix: null,
      id: "compositions",
      state: "pending",
      title: "Compositions",
    };
  }

  if (pick.total === 0 || pick.compositionId === null) {
    return {
      detail:
        "The Root compiled, but it registers no <Composition>. Ask Claude to add a video.",
      fix: null,
      id: "compositions",
      state: "failed",
      title: "No videos are registered",
    };
  }

  // The one case worth failing on now that a project holds many videos: the
  // pane asked for one by name and the compiled project does not render it.
  // "No composition called Main" is the normal case here, not a warning.
  if (pick.reason === "missing") {
    return {
      detail: `Nothing in this project renders ${pick.compositionId}. Its Root.tsx has to register it — ask Claude to, or open a video the project does render.`,
      fix: null,
      id: "compositions",
      state: "failed",
      title: `${pick.compositionId} is not in the code`,
    };
  }

  return {
    detail: `${pick.total} registered, and ${pick.compositionId} is playing.`,
    fix: null,
    id: "compositions",
    state: "ok",
    title: "Videos are registered",
  };
}

export function merged(
  checks: readonly EnvironmentCheck[],
  pick: PreviewComposition | null
): readonly EnvironmentCheck[] {
  const composition = compositionRow(pick);

  return checks.map((check) =>
    check.id === "compositions" ? composition : check
  );
}

export function unresolved(
  checks: readonly EnvironmentCheck[]
): readonly EnvironmentCheck[] {
  return checks.filter(
    (check) => check.state === "failed" || check.state === "warn"
  );
}

// Only the session's own provider being logged out locks the composer: the
// account row's id is the provider id, so the check is one comparison.
export function isBlocked(
  checks: readonly EnvironmentCheck[],
  provider: AgentProvider
): boolean {
  return checks.some(
    (check) => check.id === provider && check.state === "failed"
  );
}
