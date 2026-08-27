import { Effect } from "effect";
import {
  cancelSidecarRequest,
  newRequestId,
  requestSidecar,
  type SidecarError,
} from "@/lib/studio/sidecar";
import type {
  Project,
  ProjectDraft,
  ScaffoldEvent,
  Video,
  VideoSize,
} from "@/shared/ipc";

export const listProjects: Effect.Effect<readonly Project[], SidecarError> =
  Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({ id, method: "project.list", params: null });
  });

export function openProject(
  path: string
): Effect.Effect<Project, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "project.open",
      params: { path },
    });
  });
}

export function createProject(
  params: ProjectDraft
): Effect.Effect<Project, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({ id, method: "project.create", params });
  });
}

export function renameProject(
  projectId: string,
  name: string
): Effect.Effect<Project, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "project.rename",
      params: { name, projectId },
    });
  });
}

export function scaffoldProject(
  projectId: string,
  onEvent: (event: ScaffoldEvent) => void
): Effect.Effect<Project, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "project.scaffold",
      onStream: onEvent,
      params: { projectId },
    }).pipe(Effect.onInterrupt(() => Effect.ignore(cancelSidecarRequest(id))));
  });
}

export function relocateProject(
  projectId: string,
  path: string
): Effect.Effect<Project, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "project.relocate",
      params: { path, projectId },
    });
  });
}

export function removeProject(
  projectId: string
): Effect.Effect<boolean, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    const answer = yield* requestSidecar({
      id,
      method: "project.remove",
      params: { projectId },
    });

    return answer.removed;
  });
}

export function listVideos(
  projectId: string
): Effect.Effect<readonly Video[], SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "video.list",
      params: { projectId },
    });
  });
}

export function createVideo(
  projectId: string,
  name: string,
  size: VideoSize
): Effect.Effect<Video, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "video.create",
      params: { ...size, name, projectId },
    });
  });
}

export function renameVideo(
  videoId: string,
  name: string
): Effect.Effect<Video, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "video.rename",
      params: { name, videoId },
    });
  });
}

// Places the studio's scan in the project and splices it into the entry point,
// so a folder that nothing rendered becomes a composition on the next build.
export function registerVideo(
  videoId: string
): Effect.Effect<Video, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "video.register",
      params: { videoId },
    });
  });
}

export function removeVideo(
  videoId: string
): Effect.Effect<boolean, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    const answer = yield* requestSidecar({
      id,
      method: "video.remove",
      params: { videoId },
    });

    return answer.removed;
  });
}

export function restoreVideo(
  videoId: string
): Effect.Effect<Video, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "video.restore",
      params: { videoId },
    });
  });
}

// What the bundle knows beats what the rows remember, and only for the
// project it compiled: a composition nobody recorded becomes a row, a row
// nothing compiles is marked absent, and a video the person deleted stays
// deleted.
export function reconcileVideos(
  projectId: string,
  compositions: readonly string[]
): Effect.Effect<readonly Video[], SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "video.reconcile",
      params: { compositions, projectId },
    });
  });
}
