import { Duration, Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { AccountError } from "@/lib/studio/account";
import {
  type EntitlementCache,
  REFRESH_EVERY,
  readEntitlement,
} from "@/lib/studio/entitlement";
import { signedBy, testPublicKey } from "@/lib/studio/entitlement.fixture";
import type { SignedEntitlement } from "@/shared/entitlement";

const DOCUMENT = {
  devices: [],
  expiresAt: "2026-09-13T09:00:00.000Z",
  graceEndsAt: null,
  issuedAt: "2026-09-06T09:00:00.000Z",
  plan: "pro",
  trialEndsAt: null,
};

const OLDER = { ...DOCUMENT, issuedAt: "2026-09-01T09:00:00.000Z" };
const UNREACHABLE = /could not reach/;
const NOT_SIGNED = /not signed by the account server/;

function memory(initial: SignedEntitlement | null = null) {
  const state = { cleared: 0, stored: initial, written: 0 };
  const cache: EntitlementCache = {
    clear: Effect.sync(() => {
      state.cleared += 1;
      state.stored = null;
    }),
    read: Effect.sync(() => state.stored),
    write: (signed) =>
      Effect.sync(() => {
        state.written += 1;
        state.stored = signed;
      }),
  };
  return { cache, state };
}

const offline = Effect.fail(
  new AccountError({
    kind: "offline",
    message: "The studio could not reach it.",
  })
);

const signedOut = Effect.fail(
  new AccountError({ kind: "unauthorized", message: "Sign in first." })
);

describe("readEntitlement", () => {
  it("takes the server's document, verifies it and caches the envelope", async () => {
    const publicKey = await testPublicKey();
    const fresh = await signedBy(DOCUMENT);
    const { cache, state } = memory(await signedBy(OLDER));

    const reading = await Effect.runPromise(
      readEntitlement({ cache, fetch: Effect.succeed(fresh), publicKey })
    );

    expect(reading).toEqual({
      document: DOCUMENT,
      error: null,
      source: "server",
    });
    expect(state.stored).toEqual(fresh);
    expect(state.written).toBe(1);
  });

  it("falls back to the cached document when the server is unreachable", async () => {
    const publicKey = await testPublicKey();
    const { cache, state } = memory(await signedBy(OLDER));

    const reading = await Effect.runPromise(
      readEntitlement({ cache, fetch: offline, publicKey })
    );

    expect(reading.source).toBe("cache");
    expect(reading.document).toEqual(OLDER);
    expect(reading.error).toMatch(UNREACHABLE);
    expect(state.written).toBe(0);
  });

  it("answers with nothing, and the reason, when there is no cache either", async () => {
    const { cache } = memory();

    const reading = await Effect.runPromise(
      readEntitlement({
        cache,
        fetch: offline,
        publicKey: await testPublicKey(),
      })
    );

    expect(reading).toEqual({
      document: null,
      error: "The studio could not reach it.",
      source: "none",
    });
  });

  it("refuses a server answer whose signature does not check, and keeps the cache", async () => {
    const publicKey = await testPublicKey();
    const forged = { ...(await signedBy(DOCUMENT)), signature: "c2ln" };
    const { cache, state } = memory(await signedBy(OLDER));

    const reading = await Effect.runPromise(
      readEntitlement({ cache, fetch: Effect.succeed(forged), publicKey })
    );

    expect(reading.source).toBe("cache");
    expect(reading.document).toEqual(OLDER);
    expect(reading.error).toMatch(NOT_SIGNED);
    expect(state.stored).not.toEqual(forged);
  });

  it("drops a cached envelope that no longer verifies", async () => {
    const { cache, state } = memory({
      algorithm: "ed25519",
      payload: btoa(JSON.stringify(DOCUMENT)),
      signature: "c2ln",
    });

    const reading = await Effect.runPromise(
      readEntitlement({
        cache,
        fetch: offline,
        publicKey: await testPublicKey(),
      })
    );

    expect(reading.source).toBe("none");
    expect(state.cleared).toBe(1);
  });

  it("lets a 401 through untouched, because that is the device being signed out", async () => {
    const { cache } = memory(await signedBy(OLDER));

    const exit = await Effect.runPromiseExit(
      readEntitlement({
        cache,
        fetch: signedOut,
        publicKey: await testPublicKey(),
      })
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("refreshes once a day", () => {
    expect(Duration.toMillis(REFRESH_EVERY)).toBe(24 * 60 * 60 * 1000);
  });
});
