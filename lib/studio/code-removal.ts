import { Effect } from "effect";
import {
  newRequestId,
  requestSidecar,
  type SidecarError,
} from "@/lib/studio/sidecar";
import type {
  Removed,
  RemoveParams,
  Restored,
  RestoreParams,
} from "@/shared/ipc";

export function removeCode(
  params: RemoveParams
): Effect.Effect<Removed, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;
    return yield* requestSidecar({ id, method: "preview.remove", params });
  });
}

export function restoreCode(
  params: RestoreParams
): Effect.Effect<Restored, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;
    return yield* requestSidecar({ id, method: "preview.restore", params });
  });
}
