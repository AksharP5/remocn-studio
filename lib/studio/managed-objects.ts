import { Effect } from "effect";
import type { SidecarParams } from "@/shared/ipc";
import { newRequestId, requestSidecar } from "./sidecar";

export function readManagedObjects(params: SidecarParams<"studio.read">) {
  return Effect.gen(function* () {
    const id = yield* newRequestId;
    return yield* requestSidecar({ id, method: "studio.read", params });
  });
}

export function writeManagedObject(params: SidecarParams<"studio.patch">) {
  return Effect.gen(function* () {
    const id = yield* newRequestId;
    return yield* requestSidecar({ id, method: "studio.patch", params });
  });
}

export function removeManagedObject(params: SidecarParams<"studio.remove">) {
  return Effect.gen(function* () {
    const id = yield* newRequestId;
    return yield* requestSidecar({ id, method: "studio.remove", params });
  });
}
