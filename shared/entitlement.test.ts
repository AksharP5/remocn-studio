import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { signedBy, testPublicKey } from "@/lib/studio/entitlement.fixture";
import {
  decodeEntitlement,
  decodeEntitlementPayload,
  ENTITLEMENT_PUBLIC_KEY,
  type EntitlementDocument,
  isEntitlementExpired,
  PRO_FEATURES,
  planAt,
  tierOf,
  verifyEntitlement,
} from "./entitlement";

// The document `buildEntitlement` in the landing repo produces, signed by
// `signEntitlement`: base64 of the JSON, an Ed25519 signature over those
// ASCII bytes.
const DOCUMENT: EntitlementDocument = {
  devices: [
    {
      id: "ses_1",
      lastSeenAt: "2026-09-06T09:00:00.000Z",
      name: "MacBook Pro",
    },
  ],
  expiresAt: "2026-09-13T09:00:00.000Z",
  graceEndsAt: null,
  issuedAt: "2026-09-06T09:00:00.000Z",
  plan: "pro",
  trialEndsAt: "2026-09-11T09:00:00.000Z",
};

const SERVER_ANSWER = {
  algorithm: "ed25519",
  payload: btoa(JSON.stringify(DOCUMENT)),
  signature: "c2lnbmF0dXJl",
};

// `contracts/entitlement.example.json` in the landing repo: a frozen
// GET /api/studio/entitlement response with the key that signed it. The
// shape of the bytes the app verifies is pinned here, so the two repos cannot
// drift on what "signed" means.
const FROZEN = {
  document: {
    devices: [
      {
        id: "cDdG0hZ0nJcTgDdlfM4wIQyXqEzUcVrY",
        lastSeenAt: "2026-09-04T08:59:12.000Z",
        name: "MacBook Pro",
      },
      {
        id: "TnLpQaVw3RkSbYuJ7MdEo1XhZfCiGvBn",
        lastSeenAt: "2026-09-01T17:24:03.000Z",
        name: "Studio PC",
      },
    ],
    expiresAt: "2026-09-11T09:00:00.000Z",
    graceEndsAt: null,
    issuedAt: "2026-09-04T09:00:00.000Z",
    plan: "pro",
    trialEndsAt: "2026-09-11T09:00:00.000Z",
  },
  response: {
    algorithm: "ed25519",
    payload:
      "eyJwbGFuIjoicHJvIiwidHJpYWxFbmRzQXQiOiIyMDI2LTA5LTExVDA5OjAwOjAwLjAwMFoiLCJncmFjZUVuZHNBdCI6bnVsbCwiZGV2aWNlcyI6W3siaWQiOiJjRGRHMGhaMG5KY1RnRGRsZk00d0lReVhxRXpVY1ZyWSIsIm5hbWUiOiJNYWNCb29rIFBybyIsImxhc3RTZWVuQXQiOiIyMDI2LTA5LTA0VDA4OjU5OjEyLjAwMFoifSx7ImlkIjoiVG5McFFhVnczUmtTYll1SjdNZEVvMVhoWmZDaUd2Qm4iLCJuYW1lIjoiU3R1ZGlvIFBDIiwibGFzdFNlZW5BdCI6IjIwMjYtMDktMDFUMTc6MjQ6MDMuMDAwWiJ9XSwiaXNzdWVkQXQiOiIyMDI2LTA5LTA0VDA5OjAwOjAwLjAwMFoiLCJleHBpcmVzQXQiOiIyMDI2LTA5LTExVDA5OjAwOjAwLjAwMFoifQ==",
    signature:
      "M88IBaGBJLR73Sz8ff7TFLkWPRUSTMVVCggN8PfIpVaL3bonvf7iDNIJtX73/lqMrDK3wMY5kNmr4Hea3jTjAA==",
  },
  testPublicKey: "RlCH32PkJ2mj4fPod3+Mo68pOHtBZ0tdysKa6mBhnkM=",
};

const NOW = Date.parse("2026-09-06T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe("decodeEntitlement", () => {
  it("reads the server's signed envelope back into the document", () => {
    const exit = Effect.runSyncExit(decodeEntitlement(SERVER_ANSWER));
    expect(Exit.isSuccess(exit) && exit.value).toEqual(DOCUMENT);
  });

  it("refuses an envelope with another algorithm", () => {
    const exit = Effect.runSyncExit(
      decodeEntitlement({ ...SERVER_ANSWER, algorithm: "hs256" })
    );
    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("refuses a payload that is not base64 JSON", () => {
    expect(Exit.isFailure(decodeEntitlementPayload("not base64!"))).toBe(true);
    expect(Exit.isFailure(decodeEntitlementPayload(btoa("[]")))).toBe(true);
  });
});

describe("verifyEntitlement", () => {
  it("accepts the frozen response the landing signed, with its key", async () => {
    const document = await Effect.runPromise(
      verifyEntitlement(FROZEN.response, FROZEN.testPublicKey)
    );
    expect(document).toEqual(FROZEN.document);
  });

  it("refuses the frozen response against the production key", async () => {
    const exit = await Effect.runPromiseExit(
      verifyEntitlement(FROZEN.response, ENTITLEMENT_PUBLIC_KEY)
    );
    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("refuses a payload edited after signing", async () => {
    const forged = {
      ...FROZEN.response,
      payload: btoa(JSON.stringify({ ...FROZEN.document, plan: "pro" })),
    };
    const exit = await Effect.runPromiseExit(
      verifyEntitlement(forged, FROZEN.testPublicKey)
    );
    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("accepts a document signed the way the landing signs it", async () => {
    const document = await Effect.runPromise(
      verifyEntitlement(await signedBy(DOCUMENT), await testPublicKey())
    );
    expect(document).toEqual(DOCUMENT);
  });

  it("refuses a signature that is not base64 as a failure, not a throw", async () => {
    const exit = await Effect.runPromiseExit(
      verifyEntitlement(
        { ...FROZEN.response, signature: "not base64!" },
        FROZEN.testPublicKey
      )
    );
    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("ships a real 32-byte key", () => {
    expect(atob(ENTITLEMENT_PUBLIC_KEY)).toHaveLength(32);
  });
});

describe("planAt", () => {
  it("is a trial while the trial runs on a pro document", () => {
    expect(planAt(DOCUMENT, NOW)).toEqual({
      endsAt: DOCUMENT.trialEndsAt,
      kind: "trial",
      startedAt: null,
    });
    expect(
      planAt({ ...DOCUMENT, trialStartedAt: "2026-09-04T09:00:00.000Z" }, NOW)
    ).toMatchObject({ startedAt: "2026-09-04T09:00:00.000Z" });
  });

  it("is pro once the trial is over and the plan still says pro", () => {
    expect(
      planAt(
        { ...DOCUMENT, expiresAt: "2099-01-01T00:00:00.000Z" },
        NOW + 10 * DAY
      )
    ).toEqual({ kind: "pro" });
  });

  it("is pro with no trial on record", () => {
    expect(planAt({ ...DOCUMENT, trialEndsAt: null }, NOW)).toEqual({
      kind: "pro",
    });
  });

  it("is grace while the card has failed and access is kept", () => {
    const graceEndsAt = "2026-09-09T09:00:00.000Z";
    expect(
      planAt({ ...DOCUMENT, graceEndsAt, trialEndsAt: null }, NOW)
    ).toEqual({ accessUntil: graceEndsAt, kind: "grace" });
  });

  it("is free, remembering the trial that ended", () => {
    expect(
      planAt(
        { ...DOCUMENT, plan: "free", trialEndsAt: "2026-09-01T09:00:00.000Z" },
        NOW
      )
    ).toEqual({
      kind: "free",
      trialEndedAt: "2026-09-01T09:00:00.000Z",
      unverified: false,
    });
  });

  it("is free with no trial ended when the server never started one", () => {
    expect(
      planAt({ ...DOCUMENT, plan: "free", trialEndsAt: null }, NOW)
    ).toEqual({ kind: "free", trialEndedAt: null, unverified: false });
  });

  it("never counts a free document's trial as running", () => {
    expect(planAt({ ...DOCUMENT, plan: "free" }, NOW)).toEqual({
      kind: "free",
      trialEndedAt: null,
      unverified: false,
    });
  });

  // Past `expiresAt` the document vouches for nothing: the app has been
  // unable to refresh it for the whole week it was good for.
  it("is free and unverified once the document has expired", () => {
    const later = Date.parse(DOCUMENT.expiresAt) + DAY;
    expect(isEntitlementExpired(DOCUMENT, NOW)).toBe(false);
    expect(isEntitlementExpired(DOCUMENT, later)).toBe(true);
    expect(planAt(DOCUMENT, later)).toEqual({
      kind: "free",
      trialEndedAt: DOCUMENT.trialEndsAt,
      unverified: true,
    });
    expect(planAt({ ...DOCUMENT, expiresAt: "not a date" }, NOW)).toMatchObject(
      { kind: "free", unverified: true }
    );
  });
});

describe("tierOf", () => {
  it("is pro for a trial, a subscription and a grace period", () => {
    expect(tierOf(planAt(DOCUMENT, NOW))).toBe("pro");
    expect(tierOf({ kind: "pro" })).toBe("pro");
    expect(tierOf({ accessUntil: DOCUMENT.expiresAt, kind: "grace" })).toBe(
      "pro"
    );
  });

  it("is free with no document and for a free or expired one", () => {
    expect(tierOf(null)).toBe("free");
    expect(tierOf(planAt({ ...DOCUMENT, plan: "free" }, NOW))).toBe("free");
    expect(tierOf(planAt(DOCUMENT, NOW + 30 * DAY))).toBe("free");
  });
});

describe("PRO_FEATURES", () => {
  it("names each thing Pro adds exactly once", () => {
    expect(new Set(PRO_FEATURES).size).toBe(PRO_FEATURES.length);
  });
});
