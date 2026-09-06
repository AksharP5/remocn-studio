import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Effect, type Scope } from "effect";
import { errorMessage } from "@/lib/error-message";
import { SidecarError } from "@/lib/studio/sidecar";
import { DEEP_LINK_EVENT } from "@/shared/ipc";

const fail = (cause: unknown) =>
  new SidecarError({ message: errorMessage(cause) });

// The core keeps every link it was handed until the webview asks for them, so
// a link that opened the app is read once the page is up rather than lost to
// an event nobody was listening to yet.
export const takeDeepLinks: Effect.Effect<readonly string[], SidecarError> =
  Effect.tryPromise({
    catch: fail,
    try: () => invoke<string[]>("take_deep_links"),
  });

export function watchDeepLinks(
  onLink: () => void
): Effect.Effect<void, SidecarError, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.tryPromise({
      catch: fail,
      try: () => listen(DEEP_LINK_EVENT, () => onLink()),
    }),
    (unlisten: UnlistenFn) =>
      Effect.ignore(
        Effect.tryPromise({
          catch: fail,
          try: () => Promise.resolve(unlisten()),
        })
      )
  ).pipe(Effect.asVoid);
}
