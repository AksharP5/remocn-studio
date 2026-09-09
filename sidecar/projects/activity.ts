import { Effect, Semaphore } from "effect";
import { ProjectSettingsError } from "@/shared/project-config";

const active = new Map<string, number>();
const moving = new Set<string>();
export function projectActivity<A, E, R>(
  projectId: string,
  exclusive: boolean,
  work: Effect.Effect<A, E, R>
) {
  return Effect.acquireUseRelease(
    Effect.try({
      catch: (cause) => cause as ProjectSettingsError,
      try: () => {
        if (
          moving.has(projectId) ||
          (exclusive && (active.get(projectId) ?? 0) > 0)
        ) {
          throw new ProjectSettingsError({
            code: "busy",
            message:
              "Wait for this project's active operation to finish before moving it.",
          });
        }
        if (exclusive) {
          moving.add(projectId);
        }
        active.set(projectId, (active.get(projectId) ?? 0) + 1);
      },
    }),
    () => work,
    () =>
      Effect.sync(() => {
        const count = (active.get(projectId) ?? 1) - 1;
        if (count === 0) {
          active.delete(projectId);
        } else {
          active.set(projectId, count);
        }
        if (exclusive) {
          moving.delete(projectId);
        }
      })
  );
}

const brandTurns = new Map<string, Semaphore.Semaphore>();
export function serializeBrandTurn<A, E, R>(
  projectId: string,
  work: Effect.Effect<A, E, R>
) {
  let semaphore = brandTurns.get(projectId);
  if (!semaphore) {
    semaphore = Semaphore.makeUnsafe(1);
    brandTurns.set(projectId, semaphore);
  }
  return semaphore.withPermits(1)(work);
}
export function checkProjectAvailable(projectId: string) {
  return Effect.suspend(() =>
    moving.has(projectId)
      ? Effect.fail(
          new ProjectSettingsError({
            code: "busy",
            message: "This project is moving. Wait for its location to update.",
          })
        )
      : Effect.void
  );
}
