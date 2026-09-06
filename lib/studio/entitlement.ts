import { load } from "@tauri-apps/plugin-store";
import { Duration, Effect, Exit } from "effect";
import { errorMessage } from "@/lib/error-message";
import type { AccountError } from "@/lib/studio/account";
import {
  decodeSignedEntitlement,
  ENTITLEMENT_PUBLIC_KEY,
  type EntitlementDocument,
  type SignedEntitlement,
  verifyEntitlement,
} from "@/shared/entitlement";

const CACHE_FILE = "entitlement.json";
const SIGNED_KEY = "signed";

// Once a day is the server's own cadence for "still around", and a document
// lives seven days, so a laptop closed over a weekend refreshes with room to
// spare.
export const REFRESH_EVERY: Duration.Duration = Duration.hours(24);

export type EntitlementSource = "cache" | "none" | "server";

export interface EntitlementReading {
  document: EntitlementDocument | null;
  // Why the server was not the source, in a sentence; null when it was.
  error: string | null;
  source: EntitlementSource;
}

export interface EntitlementCache {
  clear: Effect.Effect<void>;
  read: Effect.Effect<SignedEntitlement | null>;
  write: (signed: SignedEntitlement) => Effect.Effect<void>;
}

const openStore = Effect.runSync(
  Effect.cached(Effect.tryPromise(() => load(CACHE_FILE)))
);

// The signed envelope is what is cached, never the decoded document, so a
// load re-runs the same verification a fetch does and a file edited by hand
// reads as no cache at all.
export const entitlementCache: EntitlementCache = {
  clear: Effect.ignore(
    openStore.pipe(
      Effect.flatMap((store) =>
        Effect.tryPromise(() => store.delete(SIGNED_KEY))
      )
    )
  ),
  read: openStore.pipe(
    Effect.flatMap((store) =>
      Effect.tryPromise(() => store.get<unknown>(SIGNED_KEY))
    ),
    Effect.map((stored) => {
      const decoded = decodeSignedEntitlement(stored);
      return Exit.isSuccess(decoded) ? decoded.value : null;
    }),
    Effect.orElseSucceed((): SignedEntitlement | null => null)
  ),
  write: (signed) =>
    Effect.ignore(
      openStore.pipe(
        Effect.flatMap((store) =>
          Effect.tryPromise(() => store.set(SIGNED_KEY, signed))
        )
      )
    ),
};

export interface EntitlementSources {
  cache: EntitlementCache;
  fetch: Effect.Effect<SignedEntitlement, AccountError>;
  publicKey?: string;
}

const OFFLINE_NOTE = "The last document the server issued is in use.";

// The server first, the cache when the server cannot answer, and nothing at
// all only when neither has a document that verifies. A 401 is the one fetch
// failure that passes through: it means this device was signed out, which is
// the caller's to act on and not something a cached document may paper over.
export function readEntitlement({
  cache,
  fetch,
  publicKey = ENTITLEMENT_PUBLIC_KEY,
}: EntitlementSources): Effect.Effect<EntitlementReading, AccountError> {
  const fromCache = (error: string): Effect.Effect<EntitlementReading> =>
    cache.read.pipe(
      Effect.flatMap((stored) =>
        stored === null
          ? Effect.succeed<EntitlementReading>({
              document: null,
              error,
              source: "none",
            })
          : verifyEntitlement(stored, publicKey).pipe(
              Effect.map(
                (document): EntitlementReading => ({
                  document,
                  error: `${error} ${OFFLINE_NOTE}`,
                  source: "cache",
                })
              ),
              Effect.catch(() =>
                cache.clear.pipe(
                  Effect.as<EntitlementReading>({
                    document: null,
                    error,
                    source: "none",
                  })
                )
              )
            )
      )
    );

  return fetch.pipe(
    Effect.flatMap((signed) =>
      verifyEntitlement(signed, publicKey).pipe(
        Effect.tap(() => cache.write(signed)),
        Effect.map(
          (document): EntitlementReading => ({
            document,
            error: null,
            source: "server",
          })
        ),
        Effect.catch((cause) => fromCache(errorMessage(cause)))
      )
    ),
    Effect.catch((cause) =>
      cause.kind === "unauthorized"
        ? Effect.fail(cause)
        : fromCache(cause.message)
    )
  );
}
